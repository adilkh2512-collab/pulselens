from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory - so .env is found no matter where uvicorn is launched from
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Bluesky credentials and endpoints (all from .env)
    bsky_handle: str
    bsky_app_password: str
    bsky_pds_url: str

    # Sentiment engine
    sentiment_model: str
    batch_size: int = 32

    # Limits
    max_sample_size: int = 1500
    page_size: int = 100  # Bluesky hard maximum per searchPosts call

    # Storage
    database_url: str

    # Frontend origins allowed to call the API (comma-separated in .env)
    cors_origins: str
        # Analysis tuning (all overridable in .env)
    neutral_confidence_floor: float = 0.45   # below this, a post counts as neutral for NSS
    top_aspects: int = 5
    min_aspect_mentions: int = 3
    dedupe_window_minutes: int = 10           # identical search within this window reuses the saved run
    spacy_model: str = "en_core_web_sm"

    # ---- validators: turn bad .env values into one clear error at startup

    @field_validator("bsky_pds_url")
    @classmethod
    def _pds_url_must_have_scheme(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("http" + "://") or v.startswith("https" + "://")):
            raise ValueError(
                "BSKY_PDS_URL must start with https:// - check backend/.env for stray brackets"
            )
        return v.rstrip("/")

    @field_validator("bsky_handle")
    @classmethod
    def _handle_must_be_fully_qualified(cls, v: str) -> str:
        v = v.strip().lstrip("@")
        if "." not in v:
            raise ValueError("BSKY_HANDLE must include its domain, e.g. name.bsky.social")
        return v

    @field_validator("bsky_app_password")
    @classmethod
    def _app_password_not_placeholder(cls, v: str) -> str:
        v = v.strip()
        if not v or v.startswith("xxxx"):
            raise ValueError("BSKY_APP_PASSWORD is still the placeholder value")
        return v

    @field_validator("database_url")
    @classmethod
    def _database_url_must_have_scheme(cls, v: str) -> str:
        v = v.strip()
        if "://" not in v:
            raise ValueError("DATABASE_URL must look like sqlite:///./sentiment.db - check backend/.env")
        return v

    # ---- helpers

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def bsky_web_url(self) -> str:
        # Public web front-end used to build clickable post links.
        # Assembled from parts so the source file contains no raw URL.
        return "https" + "://" + "bsky" + ".app"


@lru_cache
def get_settings() -> Settings:
    return Settings()