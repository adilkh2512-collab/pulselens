"""Browse, reload and delete saved analyses and comparisons."""

from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response

from app.db import repository
from app.schemas import (
    AnalysisResult, CompareHistoryItem, CompareHistoryResponse, HistoryItem, HistoryResponse,
)

router = APIRouter(prefix="/api/history", tags=["history"])


# NOTE: static '/compares' routes are declared before '/{run_id}' so they are matched first.

@router.get("/compares", response_model=CompareHistoryResponse)
async def list_compare_history(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> CompareHistoryResponse:
    rows, total = await asyncio.to_thread(repository.list_compares, limit, offset)
    items = [
        CompareHistoryItem(
            compare_id=r.compare_id, query=r.query, sample_size=r.sample_size,
            period_count=r.period_count, trend=r.trend, first_nss=r.first_nss, last_nss=r.last_nss,
            duration_seconds=r.duration_seconds, created_at=r.created_at.isoformat() + "Z",
        )
        for r in rows
    ]
    return CompareHistoryResponse(items=items, total=total, limit=limit, offset=offset)


@router.delete("/compares/{compare_id}", status_code=204, response_class=Response)
async def delete_compare_item(compare_id: str) -> Response:
    if not await asyncio.to_thread(repository.delete_compare, compare_id):
        raise HTTPException(404, "Comparison not found")
    return Response(status_code=204)


@router.get("", response_model=HistoryResponse)
async def list_history(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: Optional[str] = Query(None, description="Filter by query text"),
) -> HistoryResponse:
    rows, total = await asyncio.to_thread(repository.list_runs, limit, offset, q)
    items = [
        HistoryItem(
            run_id=r.run_id, query=r.query, sample_size=r.sample_size, analyzed=r.analyzed,
            since=r.since, until=r.until, sort=r.sort, nss=r.nss, nss_band=r.nss_band,
            positive=r.positive, neutral=r.neutral, negative=r.negative,
            mean_confidence=r.mean_confidence, duration_seconds=r.duration_seconds,
            created_at=r.created_at.isoformat() + "Z",
        )
        for r in rows
    ]
    return HistoryResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{run_id}", response_model=AnalysisResult)
async def get_history_item(run_id: str) -> AnalysisResult:
    result = await asyncio.to_thread(repository.load_result, run_id)
    if result is None:
        raise HTTPException(404, "Run not found")
    return result


@router.delete("/{run_id}", status_code=204, response_class=Response)
async def delete_history_item(run_id: str) -> Response:
    if not await asyncio.to_thread(repository.delete_run, run_id):
        raise HTTPException(404, "Run not found")
    return Response(status_code=204)