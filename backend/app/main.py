import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import repository
from app.db.database import db_path, init_db
from app.routers import analyze, history, compare
from app.services.bluesky import BlueskyClient, BlueskyError, posts_to_dicts
from app.services.sentiment import get_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("pulselens")

settings = get_settings()


async def _warm_up_model() -> None:
    """Load the transformer in a worker thread so the API is usable immediately."""
    try:
        await asyncio.to_thread(get_engine().load)
    except Exception as exc:  # noqa: BLE001 - never crash the server because of warm-up
        logger.warning("Model warm-up failed (will retry on first analysis): %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database ready at %s", db_path())
    app.state.bsky = BlueskyClient()
    logger.info(
        "PulseLens API started - handle=%s model=%s",
        settings.bsky_handle, settings.sentiment_model,
    )
    warmup = asyncio.create_task(_warm_up_model())
    yield
    warmup.cancel()
    await app.state.bsky.close()
    logger.info("PulseLens API stopped")


app = FastAPI(
    title="PulseLens API",
    description="Bluesky sentiment intelligence backend",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(history.router)
app.include_router(compare.router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "handle": settings.bsky_handle,
        "sentiment_model": settings.sentiment_model,
        "model_loaded": get_engine().is_loaded,
        "batch_size": settings.batch_size,
        "max_sample_size": settings.max_sample_size,
        "confidence_floor": settings.neutral_confidence_floor,
        "runs_stored": repository.count_runs(),
    }


@app.get("/api/debug/fetch")
async def debug_fetch(
    q: str = Query(..., min_length=1),
    n: int = Query(100, ge=1),
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
    lang: Optional[str] = Query("en"),
    sort: str = Query("latest", pattern="^(latest|top)$"),
):
    """Raw fetch without sentiment - kept for troubleshooting ingestion."""
    n = min(n, settings.max_sample_size)
    try:
        result = await app.state.bsky.fetch_posts(
            q=q, target=n, since=since, until=until, lang=lang or None, sort=sort
        )
    except BlueskyError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    dates = sorted(p.created_at for p in result.posts if p.created_at)
    return {
        "query": q,
        "requested": n,
        "returned": len(result.posts),
        "pages_fetched": result.pages_fetched,
        "hits_total": result.hits_total,
        "exhausted": result.exhausted,
        "oldest": dates[0] if dates else None,
        "newest": dates[-1] if dates else None,
        "sample": posts_to_dicts(result.posts[:10]),
    }