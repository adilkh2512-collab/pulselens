"""Transformer sentiment engine. Model name, batch size come from .env.
Works with any 3-class social sentiment model on Hugging Face
(cardiffnlp/twitter-roberta-base-sentiment-latest, finiteautomata/bertweet-base-sentiment-analysis, ...)."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from functools import lru_cache

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from app.config import get_settings

logger = logging.getLogger(__name__)

# Different models name their labels differently; map them all to our three.
LABEL_ALIASES = {
    "positive": "positive", "pos": "positive", "label_2": "positive",
    "neutral": "neutral", "neu": "neutral", "label_1": "neutral",
    "negative": "negative", "neg": "negative", "label_0": "negative",
}


@dataclass
class SentimentResult:
    label: str          # positive | neutral | negative
    score: float        # P(positive) - P(negative), range -1..+1
    confidence: float   # max class probability, 0..1
    p_positive: float
    p_neutral: float
    p_negative: float


class SentimentEngine:
    def __init__(self, model_name: str, batch_size: int, max_length: int = 128) -> None:
        self.model_name = model_name
        self.batch_size = batch_size
        self.max_length = max_length
        self._tokenizer = None
        self._model = None
        self._index: dict[str, int] = {}
        self._lock = threading.Lock()

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Download (first time only) and load the model. Thread-safe, idempotent."""
        with self._lock:
            if self._model is not None:
                return
            started = time.perf_counter()
            logger.info("Loading sentiment model '%s' (first run downloads it)", self.model_name)
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            model.eval()

            index: dict[str, int] = {}
            for idx, name in model.config.id2label.items():
                canonical = LABEL_ALIASES.get(str(name).lower())
                if canonical is None:
                    raise RuntimeError(f"Model label '{name}' is not a recognised sentiment class")
                index[canonical] = int(idx)
            if set(index) != {"positive", "neutral", "negative"}:
                raise RuntimeError(f"Model must expose positive/neutral/negative labels, got {index}")

            self._model = model
            self._index = index
            logger.info("Model ready in %.1fs - label index %s", time.perf_counter() - started, index)

    def predict(self, texts: list[str]) -> list[SentimentResult]:
        """Classify a list of texts. Runs in batches of self.batch_size on CPU."""
        if not texts:
            return []
        self.load()
        assert self._tokenizer is not None and self._model is not None

        results: list[SentimentResult] = []
        with torch.inference_mode():
            for start in range(0, len(texts), self.batch_size):
                batch = texts[start:start + self.batch_size]
                encoded = self._tokenizer(
                    batch,
                    padding=True,
                    truncation=True,
                    max_length=self.max_length,
                    return_tensors="pt",
                )
                logits = self._model(**encoded).logits
                probs = torch.softmax(logits, dim=-1).cpu().tolist()
                results.extend(self._to_result(row) for row in probs)
        return results

    def _to_result(self, row: list[float]) -> SentimentResult:
        p_pos = float(row[self._index["positive"]])
        p_neu = float(row[self._index["neutral"]])
        p_neg = float(row[self._index["negative"]])
        label, confidence = max(
            (("positive", p_pos), ("neutral", p_neu), ("negative", p_neg)),
            key=lambda item: item[1],
        )
        return SentimentResult(
            label=label,
            score=round(p_pos - p_neg, 4),
            confidence=round(confidence, 4),
            p_positive=round(p_pos, 4),
            p_neutral=round(p_neu, 4),
            p_negative=round(p_neg, 4),
        )


@lru_cache
def get_engine() -> SentimentEngine:
    settings = get_settings()
    return SentimentEngine(settings.sentiment_model, settings.batch_size)