"""Audit tables: one AnalysisRun per search, with its AspectMetric rows and PostRecord rows."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    query: Mapped[str] = mapped_column(String(200))
    query_norm: Mapped[str] = mapped_column(String(200), index=True)
    sample_size: Mapped[int] = mapped_column(Integer)
    since: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    until: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    lang: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    sort: Mapped[str] = mapped_column(String(10))

    fetched: Mapped[int] = mapped_column(Integer)
    analyzed: Mapped[int] = mapped_column(Integer)
    pages_fetched: Mapped[int] = mapped_column(Integer)
    hits_total: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    model: Mapped[str] = mapped_column(String(200))
    confidence_floor: Mapped[float] = mapped_column(Float)

    positive: Mapped[int] = mapped_column(Integer)
    neutral: Mapped[int] = mapped_column(Integer)
    negative: Mapped[int] = mapped_column(Integer)
    nss: Mapped[float] = mapped_column(Float)
    nss_band: Mapped[str] = mapped_column(String(20))
    mean_confidence: Mapped[float] = mapped_column(Float)
    mean_score: Mapped[float] = mapped_column(Float)
    duration_seconds: Mapped[float] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)  # naive UTC
    result_json: Mapped[str] = mapped_column(Text)                        # full AnalysisResult

    aspects: Mapped[list["AspectMetric"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )
    posts: Mapped[list["PostRecord"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class AspectMetric(Base):
    __tablename__ = "aspect_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_pk: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id", ondelete="CASCADE"), index=True)
    aspect: Mapped[str] = mapped_column(String(64))
    display: Mapped[str] = mapped_column(String(64))
    mentions: Mapped[int] = mapped_column(Integer)
    positive: Mapped[int] = mapped_column(Integer)
    neutral: Mapped[int] = mapped_column(Integer)
    negative: Mapped[int] = mapped_column(Integer)
    nss: Mapped[float] = mapped_column(Float)
    mean_score: Mapped[float] = mapped_column(Float)

    run: Mapped[AnalysisRun] = relationship(back_populates="aspects")


class PostRecord(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_pk: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id", ondelete="CASCADE"), index=True)
    post_id: Mapped[str] = mapped_column(String(200), index=True)
    url: Mapped[str] = mapped_column(String(300))
    author_handle: Mapped[str] = mapped_column(String(200))
    author_name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[str] = mapped_column(String(40))
    text: Mapped[str] = mapped_column(Text)
    clean_text: Mapped[str] = mapped_column(Text)
    likes: Mapped[int] = mapped_column(Integer)
    replies: Mapped[int] = mapped_column(Integer)
    reposts: Mapped[int] = mapped_column(Integer)
    quotes: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(10))
    effective_label: Mapped[str] = mapped_column(String(10))
    score: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    aspects: Mapped[str] = mapped_column(String(300))  # comma-separated aspect keys

    run: Mapped[AnalysisRun] = relationship(back_populates="posts")



class CompareRun(Base):
    __tablename__ = "compare_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    compare_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    query: Mapped[str] = mapped_column(String(200))
    query_norm: Mapped[str] = mapped_column(String(200), index=True)
    sample_size: Mapped[int] = mapped_column(Integer)
    period_count: Mapped[int] = mapped_column(Integer)
    trend: Mapped[str] = mapped_column(String(20))
    first_nss: Mapped[float] = mapped_column(Float)
    last_nss: Mapped[float] = mapped_column(Float)
    duration_seconds: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    result_json: Mapped[str] = mapped_column(Text)