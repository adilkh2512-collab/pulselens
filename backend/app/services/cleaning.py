"""Text normalisation before inference. Removes links, anonymises mentions,
and flags posts that carry no analysable opinion (link-only, hashtag spam)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# Regex pieces are assembled so this source file never contains a literal URL.
_SCHEME = "http" + "s?" + "://"
_TLDS = (
    "com|net|org|io|co|be|ca|uk|fm|app|social|dev|ai|gov|edu|info|me|tv|ly|gl|"
    "us|in|de|fr|au|nz|jp|xyz|news|blog|tech|substack|bsky"
)

URL_RE = re.compile(
    rf"(?:{_SCHEME}|www\.)\S+"                       # scheme or www prefix
    rf"|\b(?:[a-z0-9-]+\.)+(?:{_TLDS})\b(?:/\S*)?",  # bare domains like youtu.be/abc
    re.IGNORECASE,
)
MENTION_RE = re.compile(r"(?<!\w)@[\w.-]+")
HASHTAG_RE = re.compile(r"(?<!\w)#\w+")
WHITESPACE_RE = re.compile(r"\s+")
WORD_RE = re.compile(r"[A-Za-z\u00C0-\u024F']{2,}")  # alphabetic words, 2+ chars

DEFAULT_MIN_WORDS = 3
MAX_HASHTAGS = 6


@dataclass
class CleanedText:
    text: str
    word_count: int
    ok: bool
    reason: Optional[str]  # None when ok, else "too_short" | "hashtag_spam" | "empty"


def clean_text(raw: str) -> str:
    """Strip links, anonymise @mentions (model was trained with '@user'), collapse whitespace."""
    text = raw.replace("\u200b", "")          # zero-width spaces
    text = URL_RE.sub(" ", text)
    text = MENTION_RE.sub("@user", text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    return text


def prepare(raw: str, min_words: int = DEFAULT_MIN_WORDS) -> CleanedText:
    """Clean a post and decide whether it is worth classifying."""
    if not raw or not raw.strip():
        return CleanedText("", 0, False, "empty")

    if len(HASHTAG_RE.findall(raw)) > MAX_HASHTAGS:
        return CleanedText(clean_text(raw), 0, False, "hashtag_spam")

    text = clean_text(raw)
    words = WORD_RE.findall(text)
    if len(words) < min_words:
        return CleanedText(text, len(words), False, "too_short")

    return CleanedText(text, len(words), True, None)