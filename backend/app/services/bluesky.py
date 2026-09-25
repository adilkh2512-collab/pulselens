from __future__ import annotations

import asyncio
import logging
import math
from dataclasses import dataclass, asdict
from typing import Any, Awaitable, Callable, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# XRPC method paths (relative to the PDS base URL from .env)
CREATE_SESSION = "/xrpc/com.atproto.server.createSession"
REFRESH_SESSION = "/xrpc/com.atproto.server.refreshSession"
SEARCH_POSTS = "/xrpc/app.bsky.feed.searchPosts"

MAX_RETRIES = 5
INITIAL_BACKOFF_SECONDS = 1.0
MAX_BACKOFF_SECONDS = 30.0
RETRYABLE_STATUS = {429, 403, 500, 502, 503, 504}

ProgressCallback = Callable[[int, int, int], Awaitable[None]]
# (current_page, estimated_total_pages, posts_collected_so_far)


class BlueskyError(Exception):
    """Raised when the Bluesky API returns an unrecoverable error."""


@dataclass
class Post:
    post_id: str          # AT URI - globally unique
    cid: str
    author_handle: str
    author_name: str
    created_at: str       # ISO-8601
    text: str
    likes: int
    replies: int
    reposts: int
    quotes: int
    langs: list[str]
    url: str              # clickable web link


@dataclass
class FetchResult:
    posts: list[Post]
    pages_fetched: int
    hits_total: Optional[int]
    exhausted: bool       # True when Bluesky ran out of results before target


def normalize_post(raw: dict[str, Any], web_url: str) -> Optional[Post]:
    """Convert a Bluesky postView into our flat schema. Returns None for empty posts."""
    record = raw.get("record") or {}
    text = (record.get("text") or "").strip()
    if not text:
        return None

    author = raw.get("author") or {}
    handle = author.get("handle") or ""
    uri = raw.get("uri") or ""
    rkey = uri.rsplit("/", 1)[-1] if uri else ""

    return Post(
        post_id=uri,
        cid=raw.get("cid") or "",
        author_handle=handle,
        author_name=author.get("displayName") or handle,
        created_at=record.get("createdAt") or raw.get("indexedAt") or "",
        text=text,
        likes=int(raw.get("likeCount") or 0),
        replies=int(raw.get("replyCount") or 0),
        reposts=int(raw.get("repostCount") or 0),
        quotes=int(raw.get("quoteCount") or 0),
        langs=list(record.get("langs") or []),
        url=f"{web_url}/profile/{handle}/post/{rkey}" if handle and rkey else "",
    )


class BlueskyClient:
    """Authenticated AT Protocol client with session caching, pagination and backoff."""

    def __init__(self) -> None:
        settings = get_settings()
        self._handle = settings.bsky_handle
        self._app_password = settings.bsky_app_password
        self._page_size = settings.page_size
        self._web_url = settings.bsky_web_url
        self._http = httpx.AsyncClient(
            base_url=settings.bsky_pds_url.rstrip("/"),
            timeout=httpx.Timeout(30.0),
            headers={"User-Agent": "PulseLens/0.1 (learning project)"},
        )
        self._access_jwt: Optional[str] = None
        self._refresh_jwt: Optional[str] = None
        self._session_lock = asyncio.Lock()

    async def close(self) -> None:
        await self._http.aclose()

    # ------------------------------------------------------------------ auth

    async def _login(self) -> None:
        logger.info("Creating Bluesky session for %s", self._handle)
        resp = await self._http.post(
            CREATE_SESSION,
            json={"identifier": self._handle, "password": self._app_password},
        )
        if resp.status_code != 200:
            raise BlueskyError(
                f"createSession failed ({resp.status_code}): {resp.text[:300]}"
            )
        data = resp.json()
        self._access_jwt = data["accessJwt"]
        self._refresh_jwt = data["refreshJwt"]

    async def _refresh(self) -> None:
        if not self._refresh_jwt:
            await self._login()
            return
        resp = await self._http.post(
            REFRESH_SESSION,
            headers={"Authorization": f"Bearer {self._refresh_jwt}"},
        )
        if resp.status_code == 200:
            data = resp.json()
            self._access_jwt = data["accessJwt"]
            self._refresh_jwt = data["refreshJwt"]
            logger.info("Bluesky session refreshed")
        else:
            logger.warning("refreshSession failed (%s) - logging in again", resp.status_code)
            await self._login()

    async def _ensure_session(self) -> None:
        async with self._session_lock:
            if self._access_jwt is None:
                await self._login()

    # -------------------------------------------------------------- transport

    async def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        """GET with bearer auth, 401 refresh, and exponential backoff on 429/403/5xx."""
        await self._ensure_session()
        backoff = INITIAL_BACKOFF_SECONDS

        for attempt in range(1, MAX_RETRIES + 1):
            resp = await self._http.get(
                path,
                params=params,
                headers={"Authorization": f"Bearer {self._access_jwt}"},
            )

            if resp.status_code == 200:
                return resp.json()

            if resp.status_code == 401:
                logger.info("Token expired - refreshing session")
                async with self._session_lock:
                    await self._refresh()
                continue

            if resp.status_code in RETRYABLE_STATUS and attempt < MAX_RETRIES:
                retry_after = resp.headers.get("retry-after")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else backoff
                logger.warning(
                    "Bluesky returned %s (attempt %d/%d) - retrying in %.1fs",
                    resp.status_code, attempt, MAX_RETRIES, wait,
                )
                await asyncio.sleep(wait)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
                continue

            raise BlueskyError(f"{path} failed ({resp.status_code}): {resp.text[:300]}")

        raise BlueskyError(f"{path} failed after {MAX_RETRIES} retries")

    # ----------------------------------------------------------------- search

    async def search_page(
        self,
        q: str,
        cursor: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        lang: Optional[str] = None,
        sort: str = "latest",
    ) -> tuple[list[dict[str, Any]], Optional[str], Optional[int]]:
        params: dict[str, Any] = {"q": q, "limit": self._page_size, "sort": sort}
        if cursor:
            params["cursor"] = cursor
        if since:
            params["since"] = since
        if until:
            params["until"] = until
        if lang:
            params["lang"] = lang

        data = await self._get(SEARCH_POSTS, params)
        return data.get("posts", []), data.get("cursor"), data.get("hitsTotal")

    async def fetch_posts(
        self,
        q: str,
        target: int,
        since: Optional[str] = None,
        until: Optional[str] = None,
        lang: Optional[str] = "en",
        sort: str = "latest",
        progress: Optional[ProgressCallback] = None,
    ) -> FetchResult:
        """Paginate searchPosts until `target` unique posts are collected or results run out."""
        estimated_pages = max(1, math.ceil(target / self._page_size))
        seen: set[str] = set()
        posts: list[Post] = []
        cursor: Optional[str] = None
        hits_total: Optional[int] = None
        page = 0

        while len(posts) < target:
            page += 1
            raw_posts, cursor, hits = await self.search_page(
                q, cursor=cursor, since=since, until=until, lang=lang, sort=sort
            )
            if hits is not None:
                hits_total = hits

            if not raw_posts:
                logger.info("Page %d returned no posts - stopping", page)
                break

            for raw in raw_posts:
                if len(posts) >= target:
                    break
                post = normalize_post(raw, self._web_url)
                if post and post.post_id not in seen:
                    seen.add(post.post_id)
                    posts.append(post)

            logger.info("Page %d fetched - %d unique posts so far", page, len(posts))
            if progress:
                await progress(page, estimated_pages, len(posts))

            if not cursor:
                logger.info("No cursor returned - result set exhausted")
                break

        return FetchResult(
            posts=posts[:target],
            pages_fetched=page,
            hits_total=hits_total,
            exhausted=cursor is None,
        )


def posts_to_dicts(posts: list[Post]) -> list[dict[str, Any]]:
    return [asdict(p) for p in posts]