"""Aggregations: distribution, Net Sentiment Score, confidence handling, time-bucketed timeline."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

LABELS = ("positive", "neutral", "negative")
NSS_STRONG_THRESHOLD = 20.0


def parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def pct(part: int, whole: int) -> float:
    return round(100.0 * part / whole, 1) if whole else 0.0


def effective_label(label: str, confidence: float, floor: float) -> str:
    """Low-confidence calls are treated as neutral so sarcasm/ambiguity can't swing the NSS."""
    return "neutral" if confidence < floor else label


def distribution(labels: list[str]) -> tuple[dict[str, int], dict[str, float]]:
    counts = {label: 0 for label in LABELS}
    for label in labels:
        counts[label] += 1
    total = len(labels)
    return counts, {label: pct(counts[label], total) for label in LABELS}


def net_sentiment_score(pct_positive: float, pct_negative: float) -> float:
    return round(pct_positive - pct_negative, 1)


def nss_band(nss: float) -> str:
    if nss >= NSS_STRONG_THRESHOLD:
        return "strong_positive"
    if nss >= 0:
        return "neutral"
    return "critical"


def summarize(labels: list[str], scores: list[float], confidences: list[float],
              raw_labels: Optional[list[str]] = None) -> dict[str, Any]:
    counts, percentages = distribution(labels)
    raw_counts, _ = distribution(raw_labels if raw_labels is not None else labels)
    nss = net_sentiment_score(percentages["positive"], percentages["negative"])
    total = len(labels)
    return {
        "total": total,
        "counts": counts,
        "raw_counts": raw_counts,
        "percentages": percentages,
        "nss": nss,
        "nss_band": nss_band(nss),
        "mean_confidence": round(sum(confidences) / total, 4) if total else 0.0,
        "mean_score": round(sum(scores) / total, 4) if total else 0.0,
    }


# ------------------------------------------------------------------ timeline

def choose_granularity(oldest: datetime, newest: datetime) -> str:
    span = newest - oldest
    if span <= timedelta(hours=3):
        return "quarter_hour"
    if span <= timedelta(hours=48):
        return "hour"
    if span <= timedelta(days=60):
        return "day"
    return "week"


def floor_to(ts: datetime, granularity: str) -> datetime:
    if granularity == "quarter_hour":
        return ts.replace(minute=(ts.minute // 15) * 15, second=0, microsecond=0)
    if granularity == "hour":
        return ts.replace(minute=0, second=0, microsecond=0)
    day = ts.replace(hour=0, minute=0, second=0, microsecond=0)
    if granularity == "day":
        return day
    return day - timedelta(days=day.weekday())


def build_timeline(rows: list[dict[str, Any]]) -> dict[str, Any]:
    stamped = [r for r in rows if r.get("created_at") is not None]
    if not stamped:
        return {"granularity": None, "buckets": []}

    oldest = min(r["created_at"] for r in stamped)
    newest = max(r["created_at"] for r in stamped)
    granularity = choose_granularity(oldest, newest)

    grouped: dict[datetime, list[dict[str, Any]]] = defaultdict(list)
    for r in stamped:
        grouped[floor_to(r["created_at"], granularity)].append(r)

    buckets = []
    for start in sorted(grouped):
        items = grouped[start]
        counts, percentages = distribution([r["label"] for r in items])
        buckets.append({
            "bucket_start": start.isoformat(),
            "count": len(items),
            "positive": counts["positive"],
            "neutral": counts["neutral"],
            "negative": counts["negative"],
            "positive_pct": percentages["positive"],
            "neutral_pct": percentages["neutral"],
            "negative_pct": percentages["negative"],
            "mean_score": round(sum(r["score"] for r in items) / len(items), 4),
        })
    return {"granularity": granularity, "buckets": buckets}