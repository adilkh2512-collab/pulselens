"""POST /api/compare runs the analysis pipeline once per time window and compares the results."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from app.config import get_settings
from app.db import repository
from app.routers.analyze import RunState, _run_pipeline
from app.schemas import (
    AnalyzeRequest, AnalysisResult, CompareAccepted, CompareRequest, CompareResult, CompareStatus,
    PeriodResult,
)
from app.services import compare as cmp
from app.services.bluesky import BlueskyClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["compare"])
settings = get_settings()


@dataclass
class CompareState:
    compare_id: str
    total: int
    status: str = "queued"
    current: int = 0
    message: str = "Queued"
    error: Optional[str] = None
    result: Optional[CompareResult] = None

    def set(self, current: int, message: str) -> None:
        self.status, self.current, self.message = "running", current, message

    def to_status(self) -> CompareStatus:
        pct = 100.0 if self.status == "done" else round(100.0 * self.current / max(self.total, 1), 1)
        return CompareStatus(compare_id=self.compare_id, status=self.status, progress_pct=pct,  # type: ignore[arg-type]
                             message=self.message, current_period=self.current, total_periods=self.total,
                             error=self.error, result=self.result)


_COMPARES: dict[str, CompareState] = {}
_TASKS: set[asyncio.Task] = set()


@router.post("/compare", response_model=CompareAccepted, status_code=202)
async def start_compare(payload: CompareRequest, request: Request) -> CompareAccepted:
    if payload.sample_size > settings.max_sample_size:
        raise HTTPException(422, f"sample_size cannot exceed {settings.max_sample_size}")
    for p in payload.periods:
        if p.since >= p.until:
            raise HTTPException(422, f"Period {p.since} → {p.until}: 'since' must be before 'until'")

    compare_id = uuid.uuid4().hex[:12]
    state = CompareState(compare_id=compare_id, total=len(payload.periods))
    _COMPARES[compare_id] = state
    task = asyncio.create_task(_run_compare(state, payload, request.app.state.bsky))
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)
    logger.info("Compare %s queued - query=%r periods=%d", compare_id, payload.query, len(payload.periods))
    return CompareAccepted(compare_id=compare_id, status="queued")


@router.get("/compare/{compare_id}", response_model=CompareStatus)
async def get_compare(compare_id: str) -> CompareStatus:
    state = _COMPARES.get(compare_id)
    if state is not None:
        return state.to_status()
    stored = await asyncio.to_thread(repository.load_compare, compare_id)
    if stored is None:
        raise HTTPException(404, "Unknown compare_id")
    return CompareStatus(compare_id=compare_id, status="done", progress_pct=100.0, message="Loaded from history",
                         current_period=len(stored.periods), total_periods=len(stored.periods), result=stored)


async def _analyze_period(state: CompareState, idx: int, label: str, req: AnalyzeRequest,
                          bsky: BlueskyClient) -> AnalysisResult:
    n = state.total
    if not req.force:
        existing = await asyncio.to_thread(
            repository.find_recent_duplicate, req.query, req.sample_size, req.since, req.until,
            req.lang, req.sort, settings.dedupe_window_minutes,
        )
        if existing:
            cached = await asyncio.to_thread(repository.load_result, existing)
            if cached:
                state.set(idx, f"Period {idx + 1}/{n} ({label}): reused recent run")
                return cached

    child = RunState(run_id=uuid.uuid4().hex[:12])
    task = asyncio.create_task(_run_pipeline(child, req, bsky))
    while not task.done():
        state.set(idx, f"Period {idx + 1}/{n} ({label}): {child.message}")
        await asyncio.sleep(0.4)
    await task
    if child.status == "failed" or child.result is None:
        raise ValueError(f"Period '{label}' failed: {child.error or 'no result'}. Try a wider window or smaller sample.")
    return child.result


async def _run_compare(state: CompareState, req: CompareRequest, bsky: BlueskyClient) -> None:
    started = time.perf_counter()
    try:
        periods: list[PeriodResult] = []
        for idx, p in enumerate(req.periods):
            label = p.label or cmp.default_label(p.since, p.until)
            analyze_req = AnalyzeRequest(query=req.query, sample_size=req.sample_size, since=p.since,
                                         until=p.until, lang=req.lang, sort=req.sort, force=req.force)
            result = await _analyze_period(state, idx, label, analyze_req, bsky)
            periods.append(PeriodResult(
                label=label, since=p.since, until=p.until, run_id=result.run_id,
                fetched=result.fetched, analyzed=result.analyzed, summary=result.summary,
                aspects=result.aspects, timeline=result.timeline,
            ))

        state.set(state.total, "Computing deltas and aspect shifts")
        result = CompareResult(
            compare_id=state.compare_id, query=req.query, sample_size=req.sample_size, lang=req.lang,
            sort=req.sort, created_at=datetime.now(timezone.utc).isoformat(),
            duration_seconds=round(time.perf_counter() - started, 2), periods=periods,
            deltas=cmp.build_deltas(periods), trend=cmp.overall_trend(periods),
            aspect_shift=cmp.build_aspect_shift(periods),
        )
        await asyncio.to_thread(repository.save_compare, result)
        state.result = result
        state.status = "done"
        state.message = "Comparison complete"
        logger.info("Compare %s done - trend=%s NSS %s in %.1fs", state.compare_id, result.trend,
                    [p.summary.nss for p in periods], result.duration_seconds)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Compare %s failed", state.compare_id)
        state.status, state.error, state.message = "failed", str(exc), "Comparison failed"