"""All database reads/writes live here so routers stay thin."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select

from app.db.database import SessionLocal
from app.db.models import AnalysisRun, AspectMetric, CompareRun, PostRecord
from app.schemas import AnalysisResult, CompareResult



def normalize_query(q: str) -> str:
    return " ".join(q.lower().split())


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _nullable_eq(column, value):
    return column.is_(None) if value is None else column == value


def save_run(result: AnalysisResult) -> None:
    with SessionLocal() as session, session.begin():
        run = AnalysisRun(
            run_id=result.run_id, query=result.query, query_norm=normalize_query(result.query),
            sample_size=result.requested, since=result.since, until=result.until, lang=result.lang,
            sort=result.sort, fetched=result.fetched, analyzed=result.analyzed,
            pages_fetched=result.pages_fetched, hits_total=result.hits_total, model=result.model,
            confidence_floor=result.confidence_floor,
            positive=result.summary.counts["positive"], neutral=result.summary.counts["neutral"],
            negative=result.summary.counts["negative"], nss=result.summary.nss,
            nss_band=result.summary.nss_band, mean_confidence=result.summary.mean_confidence,
            mean_score=result.summary.mean_score, duration_seconds=result.duration_seconds,
            created_at=_utcnow_naive(), result_json=result.model_dump_json(),
        )
        run.aspects = [
            AspectMetric(aspect=a.aspect, display=a.display, mentions=a.mentions, positive=a.positive,
                         neutral=a.neutral, negative=a.negative, nss=a.nss, mean_score=a.mean_score)
            for a in result.aspects
        ]
        run.posts = [
            PostRecord(post_id=p.post_id, url=p.url, author_handle=p.author_handle,
                       author_name=p.author_name, created_at=p.created_at, text=p.text,
                       clean_text=p.clean_text, likes=p.likes, replies=p.replies, reposts=p.reposts,
                       quotes=p.quotes, label=p.label, effective_label=p.effective_label,
                       score=p.score, confidence=p.confidence, aspects=",".join(p.aspects))
            for p in result.posts
        ]
        session.add(run)


def load_result(run_id: str) -> Optional[AnalysisResult]:
    with SessionLocal() as session:
        raw = session.scalar(select(AnalysisRun.result_json).where(AnalysisRun.run_id == run_id))
    return AnalysisResult.model_validate_json(raw) if raw else None


def find_recent_duplicate(query: str, sample_size: int, since: Optional[str], until: Optional[str],
                          lang: Optional[str], sort: str, window_minutes: int) -> Optional[str]:
    cutoff = _utcnow_naive() - timedelta(minutes=window_minutes)
    stmt = (
        select(AnalysisRun.run_id)
        .where(
            AnalysisRun.query_norm == normalize_query(query),
            AnalysisRun.sample_size == sample_size,
            _nullable_eq(AnalysisRun.since, since),
            _nullable_eq(AnalysisRun.until, until),
            _nullable_eq(AnalysisRun.lang, lang),
            AnalysisRun.sort == sort,
            AnalysisRun.created_at >= cutoff,
        )
        .order_by(AnalysisRun.created_at.desc())
        .limit(1)
    )
    with SessionLocal() as session:
        return session.scalar(stmt)


def list_runs(limit: int, offset: int, query: Optional[str] = None) -> tuple[list[AnalysisRun], int]:
    base = select(AnalysisRun)
    count = select(func.count(AnalysisRun.id))
    if query:
        pattern = f"%{normalize_query(query)}%"
        base = base.where(AnalysisRun.query_norm.like(pattern))
        count = count.where(AnalysisRun.query_norm.like(pattern))
    with SessionLocal() as session:
        rows = list(session.scalars(base.order_by(AnalysisRun.created_at.desc()).offset(offset).limit(limit)))
        total = session.scalar(count) or 0
    return rows, total


def delete_run(run_id: str) -> bool:
    with SessionLocal() as session, session.begin():
        run = session.scalar(select(AnalysisRun).where(AnalysisRun.run_id == run_id))
        if run is None:
            return False
        session.delete(run)
        return True


def count_runs() -> int:
    with SessionLocal() as session:
        return session.scalar(select(func.count(AnalysisRun.id))) or 0





def save_compare(result: CompareResult) -> None:
    with SessionLocal() as session, session.begin():
        session.add(CompareRun(
            compare_id=result.compare_id, query=result.query, query_norm=normalize_query(result.query),
            sample_size=result.sample_size, period_count=len(result.periods), trend=result.trend,
            first_nss=result.periods[0].summary.nss, last_nss=result.periods[-1].summary.nss,
            duration_seconds=result.duration_seconds, created_at=_utcnow_naive(),
            result_json=result.model_dump_json(),
        ))


def load_compare(compare_id: str) -> Optional[CompareResult]:
    with SessionLocal() as session:
        raw = session.scalar(select(CompareRun.result_json).where(CompareRun.compare_id == compare_id))
    return CompareResult.model_validate_json(raw) if raw else None


def list_compares(limit: int = 20, offset: int = 0) -> tuple[list[CompareRun], int]:
    with SessionLocal() as session:
        rows = list(session.scalars(select(CompareRun).order_by(CompareRun.created_at.desc()).offset(offset).limit(limit)))
        total = session.scalar(select(func.count(CompareRun.id))) or 0
    return rows, total




def delete_compare(compare_id: str) -> bool:
    with SessionLocal() as session, session.begin():
        row = session.scalar(select(CompareRun).where(CompareRun.compare_id == compare_id))
        if row is None:
            return False
        session.delete(row)
        return True