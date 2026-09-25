"""SQLAlchemy engine/session. SQLite path in .env is resolved relative to backend/."""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import BASE_DIR, get_settings

settings = get_settings()


def _resolve_sqlite_url(url: str) -> str:
    prefix = "sqlite:///./"
    if url.startswith(prefix):
        return "sqlite:///" + str((BASE_DIR / url[len(prefix):]).resolve()).replace("\\", "/")
    return url


DATABASE_URL = _resolve_sqlite_url(settings.database_url)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    import app.db.models  # noqa: F401 - register tables
    Base.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


def db_path() -> str:
    return DATABASE_URL.replace("sqlite:///", "") if DATABASE_URL.startswith("sqlite") else DATABASE_URL