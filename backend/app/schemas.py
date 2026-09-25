from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

SortOrder = Literal["latest", "top"]
SentimentLabel = Literal["positive", "neutral", "negative"]
RunStage = Literal[
    "queued", "fetching", "cleaning", "loading_model", "analyzing",
    "extracting_aspects", "aggregating", "saving", "done", "failed",
]


class AnalyzeRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)
    sample_size: int = Field(500, ge=10)
    since: Optional[str] = None
    until: Optional[str] = None
    lang: Optional[str] = "en"
    sort: SortOrder = "latest"
    force: bool = Field(False, description="Skip the recent-duplicate cache and fetch fresh")


class RunAccepted(BaseModel):
    run_id: str
    status: RunStage
    cached: bool = False


class AnalyzedPost(BaseModel):
    post_id: str
    url: str
    author_handle: str
    author_name: str
    created_at: str
    text: str
    clean_text: str
    likes: int
    replies: int
    reposts: int
    quotes: int
    label: SentimentLabel            # raw model label
    effective_label: SentimentLabel  # after confidence floor
    low_confidence: bool
    score: float
    confidence: float
    p_positive: float
    p_neutral: float
    p_negative: float
    aspects: list[str] = []


class SentimentSummary(BaseModel):
    total: int
    counts: dict[str, int]
    raw_counts: dict[str, int]
    percentages: dict[str, float]
    nss: float
    nss_band: Literal["strong_positive", "neutral", "critical"]
    mean_confidence: float
    mean_score: float


class AspectMetric(BaseModel):
    aspect: str
    display: str
    mentions: int
    positive: int
    neutral: int
    negative: int
    positive_pct: float
    neutral_pct: float
    negative_pct: float
    nss: float
    mean_score: float
    sample_post_ids: list[str]


class TimelineBucket(BaseModel):
    bucket_start: str
    count: int
    positive: int
    neutral: int
    negative: int
    positive_pct: float
    neutral_pct: float
    negative_pct: float
    mean_score: float


class Timeline(BaseModel):
    granularity: Optional[Literal["quarter_hour", "hour", "day", "week"]]
    buckets: list[TimelineBucket]


class AnalysisResult(BaseModel):
    run_id: str
    query: str
    requested: int
    fetched: int
    analyzed: int
    dropped: dict[str, int]
    low_confidence_count: int
    confidence_floor: float
    pages_fetched: int
    hits_total: Optional[int]
    since: Optional[str]
    until: Optional[str]
    lang: Optional[str]
    sort: SortOrder
    oldest: Optional[str]
    newest: Optional[str]
    model: str
    started_at: str
    duration_seconds: float
    summary: SentimentSummary
    aspects: list[AspectMetric]
    timeline: Timeline
    posts: list[AnalyzedPost]


class RunStatus(BaseModel):
    run_id: str
    status: RunStage
    stage_current: int
    stage_total: int
    progress_pct: float
    message: str
    cached: bool = False
    error: Optional[str] = None
    result: Optional[AnalysisResult] = None


class HistoryItem(BaseModel):
    run_id: str
    query: str
    sample_size: int
    analyzed: int
    since: Optional[str]
    until: Optional[str]
    sort: SortOrder
    nss: float
    nss_band: str
    positive: int
    neutral: int
    negative: int
    mean_confidence: float
    duration_seconds: float
    created_at: str


class HistoryResponse(BaseModel):
    items: list[HistoryItem]
    total: int
    limit: int
    offset: int

# ------------------------------------------------------------------ compare

CompareStage = Literal["queued", "running", "done", "failed"]
TrendDirection = Literal["improving", "worsening", "stable"]


class ComparePeriod(BaseModel):
    label: Optional[str] = Field(None, max_length=60)
    since: str = Field(..., description="YYYY-MM-DD inclusive")
    until: str = Field(..., description="YYYY-MM-DD exclusive")


class CompareRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)
    sample_size: int = Field(300, ge=10, description="Posts per period")
    lang: Optional[str] = "en"
    sort: SortOrder = "latest"
    periods: list[ComparePeriod] = Field(..., min_length=2, max_length=4)
    force: bool = False


class CompareAccepted(BaseModel):
    compare_id: str
    status: CompareStage


class PeriodResult(BaseModel):
    label: str
    since: str
    until: str
    run_id: str
    fetched: int
    analyzed: int
    summary: SentimentSummary
    aspects: list[AspectMetric]
    timeline: Timeline


class PeriodDelta(BaseModel):
    from_label: str
    to_label: str
    nss_delta: float
    positive_pct_delta: float
    neutral_pct_delta: float
    negative_pct_delta: float
    volume_delta: int
    direction: TrendDirection


class AspectShift(BaseModel):
    aspect: str
    display: str
    nss: list[Optional[float]]      # one entry per period, None if the aspect did not surface
    mentions: list[int]


class CompareResult(BaseModel):
    compare_id: str
    query: str
    sample_size: int
    lang: Optional[str]
    sort: SortOrder
    created_at: str
    duration_seconds: float
    periods: list[PeriodResult]
    deltas: list[PeriodDelta]
    trend: TrendDirection
    aspect_shift: list[AspectShift]


class CompareStatus(BaseModel):
    compare_id: str
    status: CompareStage
    progress_pct: float
    message: str
    current_period: int
    total_periods: int
    error: Optional[str] = None
    result: Optional[CompareResult] = None



class CompareHistoryItem(BaseModel):
    compare_id: str
    query: str
    sample_size: int
    period_count: int
    trend: TrendDirection
    first_nss: float
    last_nss: float
    duration_seconds: float
    created_at: str


class CompareHistoryResponse(BaseModel):
    items: list[CompareHistoryItem]
    total: int
    limit: int
    offset: int