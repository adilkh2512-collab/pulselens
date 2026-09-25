"""POST /api/analyze starts a background run; GET /api/analyze/{run_id} reports progress/result.
Finished runs are persisted to SQLite and served from there after a restart."""

from __future__ import annotations

import asyncio
import logging
import math
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from app.config import get_settings
from app.db import repository
from app.schemas import (
    AnalyzeRequest,
    AnalyzedPost,
    AnalysisResult,
    AspectMetric,
    RunAccepted,
    RunStatus,
    SentimentSummary,
    Timeline,
)
from app.services import metrics
from app.services.aspects import extract_aspects
from app.services.bluesky import BlueskyClient, BlueskyError, Post
from app.services.cleaning import prepare
from app.services.sentiment import get_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["analysis"])
settings = get_settings()


@dataclass
class RunState:
    run_id: str
    status: str = "queued"
    stage_current: int = 0
    stage_total: int = 1
    message: str = "Queued"
    error: Optional[str] = None
    result: Optional[AnalysisResult] = None
    created_at: float = field(default_factory=time.time)

    def set(self, status: str, current: int, total: int, message: str) -> None:
        self.status = status
        self.stage_current = current
        self.stage_total = max(total, 1)
        self.message = message

    def finish(self, result: AnalysisResult) -> None:
        self.result = result
        self.set("done", 1, 1, "Analysis complete")

    def fail(self, error: str) -> None:
        self.error = error
        self.set("failed", 0, 1, "Analysis failed")

    def to_status(self) -> RunStatus:
        pct = 100.0 if self.status == "done" else round(100.0 * self.stage_current / self.stage_total, 1)
        return RunStatus(
            run_id=self.run_id,
            status=self.status,
            stage_current=self.stage_current,
            stage_total=self.stage_total,
            progress_pct=pct,
            message=self.message,
            error=self.error,
            result=self.result,
        )


# In-memory registry for runs in progress; finished runs also live in SQLite.
_RUNS: dict[str, RunState] = {}
_TASKS: set[asyncio.Task] = set()


@router.post("/analyze", response_model=RunAccepted, status_code=202)
async def start_analysis(payload: AnalyzeRequest, request: Request) -> RunAccepted:
    if payload.sample_size > settings.max_sample_size:
        raise HTTPException(422, f"sample_size cannot exceed {settings.max_sample_size}")

    if not payload.force:
        existing = await asyncio.to_thread(
            repository.find_recent_duplicate,
            payload.query, payload.sample_size, payload.since, payload.until,
            payload.lang, payload.sort, settings.dedupe_window_minutes,
        )
        if existing:
            logger.info("Reusing run %s for %r (within %d min)", existing, payload.query, settings.dedupe_window_minutes)
            return RunAccepted(run_id=existing, status="done", cached=True)

    run_id = uuid.uuid4().hex[:12]
    state = RunState(run_id=run_id)
    _RUNS[run_id] = state

    task = asyncio.create_task(_run_pipeline(state, payload, request.app.state.bsky))
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)
    logger.info("Run %s queued - query=%r sample=%d", run_id, payload.query, payload.sample_size)
    return RunAccepted(run_id=run_id, status="queued")


@router.get("/analyze/{run_id}", response_model=RunStatus)
async def get_analysis(run_id: str) -> RunStatus:
    state = _RUNS.get(run_id)
    if state is not None:
        return state.to_status()

    stored = await asyncio.to_thread(repository.load_result, run_id)
    if stored is None:
        raise HTTPException(404, "Unknown run_id")
    return RunStatus(
        run_id=run_id, status="done", stage_current=1, stage_total=1, progress_pct=100.0,
        message="Loaded from history", cached=True, result=stored,
    )


# --------------------------------------------------------------------- pipeline

async def _run_pipeline(state: RunState, req: AnalyzeRequest, bsky: BlueskyClient) -> None:
    started = time.perf_counter()
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        # 1. Fetch ---------------------------------------------------------------
        est_pages = max(1, math.ceil(req.sample_size / settings.page_size))
        state.set("fetching", 0, est_pages, "Connecting to Bluesky")

        async def on_progress(page: int, est: int, count: int) -> None:
            state.set("fetching", page, est, f"Fetched page {page} of ~{est} ({count} posts)")

        fetch = await bsky.fetch_posts(
            q=req.query, target=req.sample_size, since=req.since, until=req.until,
            lang=req.lang or None, sort=req.sort, progress=on_progress,
        )
        if not fetch.posts:
            raise ValueError("Bluesky returned no posts for this query and filters")

        # 2. Clean ---------------------------------------------------------------
        state.set("cleaning", 0, 1, "Removing links, mentions and noise")
        kept: list[tuple[Post, str]] = []
        dropped: dict[str, int] = {}
        for post in fetch.posts:
            cleaned = prepare(post.text)
            if cleaned.ok:
                kept.append((post, cleaned.text))
            else:
                key = cleaned.reason or "unknown"
                dropped[key] = dropped.get(key, 0) + 1
        if not kept:
            raise ValueError("All fetched posts were link-only or too short to analyse")

        # 3. Classify ------------------------------------------------------------
        engine = get_engine()
        if not engine.is_loaded:
            state.set("loading_model", 0, 1, "Loading sentiment model")
            await asyncio.to_thread(engine.load)

        batch = settings.batch_size
        total_batches = math.ceil(len(kept) / batch)
        results = []
        for i in range(total_batches):
            chunk = [text for _, text in kept[i * batch:(i + 1) * batch]]
            results.extend(await asyncio.to_thread(engine.predict, chunk))
            state.set("analyzing", i + 1, total_batches, f"Analysing batch {i + 1} of {total_batches}")

        floor = settings.neutral_confidence_floor
        eff_labels = [metrics.effective_label(r.label, r.confidence, floor) for r in results]
        low_conf = sum(1 for r in results if r.confidence < floor)

        # 4. Aspects -------------------------------------------------------------
        state.set("extracting_aspects", 0, 1, "Discovering discussion aspects")
        aspects_raw, tagged = await asyncio.to_thread(
            extract_aspects,
            [text for _, text in kept],
            req.query,
            eff_labels,
            [r.score for r in results],
            [post.likes for post, _ in kept],
            [post.post_id for post, _ in kept],
            settings.top_aspects,
            settings.min_aspect_mentions,
        )

        # 5. Aggregate -----------------------------------------------------------
        state.set("aggregating", 0, 1, "Computing metrics and timeline")
        analyzed: list[AnalyzedPost] = []
        timeline_rows = []
        for (post, clean), res, eff, tags in zip(kept, results, eff_labels, tagged):
            analyzed.append(AnalyzedPost(
                post_id=post.post_id,
                url=post.url,
                author_handle=post.author_handle,
                author_name=post.author_name,
                created_at=post.created_at,
                text=post.text,
                clean_text=clean,
                likes=post.likes,
                replies=post.replies,
                reposts=post.reposts,
                quotes=post.quotes,
                label=res.label,
                effective_label=eff,
                low_confidence=res.confidence < floor,
                score=res.score,
                confidence=res.confidence,
                p_positive=res.p_positive,
                p_neutral=res.p_neutral,
                p_negative=res.p_negative,
                aspects=tags,
            ))
            timeline_rows.append({
                "created_at": metrics.parse_timestamp(post.created_at),
                "label": eff,
                "score": res.score,
            })

        summary = metrics.summarize(
            eff_labels,
            [r.score for r in results],
            [r.confidence for r in results],
            raw_labels=[r.label for r in results],
        )
        timeline = metrics.build_timeline(timeline_rows)
        stamps = sorted(r["created_at"] for r in timeline_rows if r["created_at"])

        result = AnalysisResult(
            run_id=state.run_id,
            query=req.query,
            requested=req.sample_size,
            fetched=len(fetch.posts),
            analyzed=len(analyzed),
            dropped=dropped,
            low_confidence_count=low_conf,
            confidence_floor=floor,
            pages_fetched=fetch.pages_fetched,
            hits_total=fetch.hits_total,
            since=req.since,
            until=req.until,
            lang=req.lang,
            sort=req.sort,
            oldest=stamps[0].isoformat() if stamps else None,
            newest=stamps[-1].isoformat() if stamps else None,
            model=settings.sentiment_model,
            started_at=started_at,
            duration_seconds=round(time.perf_counter() - started, 2),
            summary=SentimentSummary(**summary),
            aspects=[AspectMetric(**a) for a in aspects_raw],
            timeline=Timeline(**timeline),
            posts=analyzed,
        )

        # 6. Persist -------------------------------------------------------------
        state.set("saving", 0, 1, "Saving to history")
        await asyncio.to_thread(repository.save_run, result)

        state.finish(result)
        logger.info(
            "Run %s done - %d analysed, NSS %.1f (%s), aspects=%s, %.1fs",
            state.run_id, result.analyzed, result.summary.nss, result.summary.nss_band,
            [a.display for a in result.aspects], result.duration_seconds,
        )

    except BlueskyError as exc:
        logger.error("Run %s Bluesky error: %s", state.run_id, exc)
        state.fail(f"Bluesky error: {exc}")
    except Exception as exc:  # noqa: BLE001 - surface any failure to the client
        logger.exception("Run %s failed", state.run_id)
        state.fail(str(exc))