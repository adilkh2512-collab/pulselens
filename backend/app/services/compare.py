"""Pure comparison maths: deltas between consecutive periods, overall trend, aspect shifts."""

from __future__ import annotations

from datetime import date
from typing import Optional

from app.schemas import AspectShift, PeriodDelta, PeriodResult, TrendDirection

STABLE_BAND = 5.0  # |NSS delta| within this is 'stable'


def default_label(since: str, until: str) -> str:
    try:
        s = date.fromisoformat(since[:10])
        u = date.fromisoformat(until[:10])
        # 'until' is exclusive - show the last included day
        last = date.fromordinal(u.toordinal() - 1)
        if s.month == last.month and s.year == last.year and s.day == 1 and (last.month != (date.fromordinal(last.toordinal() + 1)).month):
            return s.strftime("%b %Y")
        return f"{s.strftime('%d %b')} – {last.strftime('%d %b %Y')}"
    except ValueError:
        return f"{since} → {until}"


def direction(nss_delta: float) -> TrendDirection:
    if nss_delta > STABLE_BAND:
        return "improving"
    if nss_delta < -STABLE_BAND:
        return "worsening"
    return "stable"


def build_deltas(periods: list[PeriodResult]) -> list[PeriodDelta]:
    deltas: list[PeriodDelta] = []
    for prev, cur in zip(periods, periods[1:]):
        a, b = prev.summary, cur.summary
        nss_delta = round(b.nss - a.nss, 1)
        deltas.append(PeriodDelta(
            from_label=prev.label,
            to_label=cur.label,
            nss_delta=nss_delta,
            positive_pct_delta=round(b.percentages["positive"] - a.percentages["positive"], 1),
            neutral_pct_delta=round(b.percentages["neutral"] - a.percentages["neutral"], 1),
            negative_pct_delta=round(b.percentages["negative"] - a.percentages["negative"], 1),
            volume_delta=cur.analyzed - prev.analyzed,
            direction=direction(nss_delta),
        ))
    return deltas


def overall_trend(periods: list[PeriodResult]) -> TrendDirection:
    if len(periods) < 2:
        return "stable"
    return direction(periods[-1].summary.nss - periods[0].summary.nss)


def build_aspect_shift(periods: list[PeriodResult]) -> list[AspectShift]:
    """Union of top aspects across periods, with each period's NSS/mentions (None/0 if absent)."""
    display: dict[str, str] = {}
    order: list[str] = []
    for p in periods:
        for a in p.aspects:
            if a.aspect not in display:
                display[a.aspect] = a.display
                order.append(a.aspect)

    shifts: list[AspectShift] = []
    for key in order:
        nss: list[Optional[float]] = []
        mentions: list[int] = []
        for p in periods:
            hit = next((a for a in p.aspects if a.aspect == key), None)
            nss.append(hit.nss if hit else None)
            mentions.append(hit.mentions if hit else 0)
        shifts.append(AspectShift(aspect=key, display=display[key], nss=nss, mentions=mentions))

    shifts.sort(key=lambda s: -sum(s.mentions))
    return shifts