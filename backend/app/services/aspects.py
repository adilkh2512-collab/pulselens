"""Unsupervised aspect discovery: nouns people actually talk about, ranked by how many
posts mention them, each with its own sentiment split. No topic dictionary anywhere.
Adjacent proper nouns ('Tumbler Ridge', 'Sam Altman') are merged into one aspect."""

from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Optional

import spacy
from spacy.language import Language
from spacy.tokens import Span, Token

from app.config import get_settings
from app.services.metrics import distribution, net_sentiment_score

logger = logging.getLogger(__name__)

# Nouns that carry no topical meaning in ANY domain (filler words, not a topic list).
GENERIC_NOUNS = {
    "thing", "things", "people", "person", "someone", "anyone", "everyone", "nobody",
    "time", "times", "way", "day", "today", "tomorrow", "yesterday", "year", "week", "month",
    "lot", "lots", "one", "ones", "guy", "guys", "man", "woman", "kid", "kids", "folks",
    "post", "stuff", "bit", "part", "point", "kind", "sort", "user", "something", "nothing",
    "anything", "everything", "yeah", "lol", "lmao", "tbh", "imo", "omg", "wtf", "thanks",
}
MIN_LEN = 3
TOKEN_RE = re.compile(r"^[a-z][a-z'-]*[a-z]$")


@dataclass
class _Stats:
    key: str
    surfaces: Counter = field(default_factory=Counter)
    post_indices: set[int] = field(default_factory=set)


@lru_cache
def get_nlp() -> Language:
    name = get_settings().spacy_model
    logger.info("Loading spaCy model '%s'", name)
    return spacy.load(name, disable=["ner"])


def _query_terms(query: str) -> set[str]:
    """Words of the search query itself are never aspects."""
    terms = {query.lower().replace(" ", "")}
    for tok in get_nlp()(query.lower()):
        terms.add(tok.text)
        terms.add(tok.lemma_.lower())
    return terms


def _candidate(tok: Token, banned: set[str]) -> Optional[str]:
    if tok.pos_ not in ("NOUN", "PROPN") or tok.is_stop or tok.like_num:
        return None
    lemma = tok.lemma_.lower().strip()
    if len(lemma) < MIN_LEN or not TOKEN_RE.match(lemma):
        return None
    if lemma in GENERIC_NOUNS or lemma in banned or tok.text.lower() in banned:
        return None
    return lemma


def _proper_noun_span(chunk: Span, banned: set[str]) -> Optional[tuple[str, str, set[int]]]:
    """If a noun chunk holds 2-3 adjacent proper nouns, treat them as ONE aspect.
    Returns (key, display_surface, token_indices) or None."""
    tokens = [
        t for t in chunk
        if t.pos_ == "PROPN" and not t.is_stop and TOKEN_RE.match(t.lemma_.lower())
    ]
    if len(tokens) < 2 or len(tokens) > 3:
        return None
    if any(b.i != a.i + 1 for a, b in zip(tokens, tokens[1:])):  # must be contiguous
        return None
    words = [t.lemma_.lower() for t in tokens]
    if any(w in banned for w in words) or "".join(words) in banned:
        return None
    return " ".join(words), " ".join(t.text for t in tokens), {t.i for t in tokens}


def extract_aspects(
    texts: list[str],
    query: str,
    labels: list[str],
    scores: list[float],
    likes: list[int],
    post_ids: list[str],
    top_n: int,
    min_mentions: int,
) -> tuple[list[dict[str, Any]], list[list[str]]]:
    """Returns (ranked aspect metrics, per-post list of the top aspects each post mentions)."""
    nlp = get_nlp()
    banned = _query_terms(query)
    stats: dict[str, _Stats] = {}
    per_post: list[dict[str, str]] = [dict() for _ in texts]

    for i, doc in enumerate(nlp.pipe(texts, batch_size=64)):
        found: dict[str, str] = {}
        consumed: set[int] = set()

        for chunk in doc.noun_chunks:
            span = _proper_noun_span(chunk, banned)
            if span:
                key, surface, idxs = span
                found.setdefault(key, surface)
                consumed |= idxs
                continue
            key = _candidate(chunk.root, banned)
            if key:
                found.setdefault(key, chunk.root.text)

        for tok in doc:  # nouns that are not part of any chunk
            if tok.i in consumed:
                continue
            key = _candidate(tok, banned)
            if key:
                found.setdefault(key, tok.text)

        for key, surface in found.items():
            st = stats.setdefault(key, _Stats(key))
            st.surfaces[surface] += 1
            st.post_indices.add(i)
        per_post[i] = found

    ranked = sorted(stats.values(), key=lambda s: (-len(s.post_indices), s.key))
    top = [s for s in ranked if len(s.post_indices) >= min_mentions][:top_n]
    top_keys = {s.key for s in top}

    aspects: list[dict[str, Any]] = []
    for s in top:
        idx = sorted(s.post_indices)
        counts, pcts = distribution([labels[i] for i in idx])
        surface = s.surfaces.most_common(1)[0][0]
        display = surface if any(c.isupper() for c in surface) else surface.capitalize()
        aspects.append({
            "aspect": s.key,
            "display": display,
            "mentions": len(idx),
            "positive": counts["positive"],
            "neutral": counts["neutral"],
            "negative": counts["negative"],
            "positive_pct": pcts["positive"],
            "neutral_pct": pcts["neutral"],
            "negative_pct": pcts["negative"],
            "nss": net_sentiment_score(pcts["positive"], pcts["negative"]),
            "mean_score": round(sum(scores[i] for i in idx) / len(idx), 4),
            "sample_post_ids": [post_ids[i] for i in sorted(idx, key=lambda j: -likes[j])[:3]],
        })

    tagged = [[k for k in found if k in top_keys] for found in per_post]
    logger.info("Aspects for %r: %s", query, [a["display"] for a in aspects])
    return aspects, tagged