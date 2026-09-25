# PulseLens — Bluesky Sentiment Intelligence Dashboard

A learning project that fetches live public posts from the Bluesky network, classifies their sentiment with a
transformer model, discovers the topics people are talking about, compares time periods, and produces a printable
executive briefing. Everything is computed from live data — no hard-coded samples.

## Features

- **Dynamic search & ingestion** — any topic, 100–1,500 posts, authenticated AT Protocol `searchPosts` with cursor
  pagination and 429/403 back-off.
- **Transformer sentiment** — `cardiffnlp/twitter-roberta-base-sentiment-latest` (swappable via `.env`), batched on CPU,
  with per-post confidence.
- **Net Sentiment Score (NSS)** — `% positive − % negative`, banded: ≥ +20 strong, 0–19 balanced, < 0 critical.
- **Unsupervised aspect analysis** — spaCy noun extraction surfaces the top discussion topics with a positive/negative
  split per aspect. No topic dictionaries.
- **Visual suite** — NSS gauge, polarity area chart over time, consensus donut, aspect split bars, KPI cards.
- **Compare Periods** — 2–4 date windows side by side with deltas, trend direction and aspect shift.
- **Evidence feed** — the raw public posts with handle, likes, timestamp, sentiment badge and aspect tags.
- **Executive PDF briefing** — print-styled memo with metrics, aspects, timeline, rules-based recommendation and quotes.
- **Audit storage** — every run and comparison saved to SQLite; history page; 10-minute duplicate cache.

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python 3.11+, FastAPI, httpx, SQLAlchemy 2, SQLite |
| NLP | Hugging Face Transformers + PyTorch (CPU), spaCy `en_core_web_sm` |
| Frontend | Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts, TanStack Query, React Router |

## Prerequisites

- Python 3.11 or newer, Node.js 20 or newer, Git
- A free Bluesky account and an **App Password** (Settings → Privacy and Security → App Passwords)
- ~3 GB free disk (model + dependencies); the sentiment model (~500 MB) downloads once on first start

## Setup

```bash
git clone [https://github.com/YOUR-USERNAME/pulselens.git](https://github.com/YOUR-USERNAME/pulselens.git)
cd pulselens
```

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1      macOS/Linux: source .venv/bin/activate
python -m pip install --upgrade pip
pip install --index-url [https://download.pytorch.org/whl/cpu%20torch](https://download.pytorch.org/whl/cpu%20torch)
pip install -r requirements.txt
python -m spacy download en_core_web_sm
# Windows: copy .env.example .env             macOS/Linux: cp .env.example .env
```

Edit `backend/.env` and set `BSKY_HANDLE` (e.g. `name.bsky.social`) and `BSKY_APP_PASSWORD`.
Never commit `.env`.

### Frontend

```bash
cd ../frontend
npm install
```

## Run

Two terminals:

```bash
# Terminal 1 — backend (from backend/, venv active)
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend (from frontend/)
npm run dev
```

Open [http://localhost:5173.%20Wait%20for%20the%20**Model%20ready**%20badge,%20enter%20a%20topic%20and%20click%20**Analyze%20Pulse**.](http://localhost:5173.%20Wait%20for%20the%20**Model%20ready**%20badge,%20enter%20a%20topic%20and%20click%20**Analyze%20Pulse**.)
API docs are at [http://localhost:8000/docs.](http://localhost:8000/docs.)

## Configuration (`backend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `BSKY_HANDLE` / `BSKY_APP_PASSWORD` | Bluesky login (App Password, not account password) | — |
| `BSKY_PDS_URL` | PDS endpoint | `[https://bsky.social`%20|](https://bsky.social`%20|)
| `SENTIMENT_MODEL` | Any 3-class HF sentiment model | `cardiffnlp/twitter-roberta-base-sentiment-latest` |
| `BATCH_SIZE` | Inference batch size | `32` |
| `MAX_SAMPLE_SIZE` | Slider upper bound | `1500` |
| `NEUTRAL_CONFIDENCE_FLOOR` | Posts below this confidence count as neutral | `0.45` |
| `TOP_ASPECTS` / `MIN_ASPECT_MENTIONS` | Aspect discovery limits | `5` / `3` |
| `DEDUPE_WINDOW_MINUTES` | Identical search reuses the saved run within this window | `10` |
| `DATABASE_URL` | SQLAlchemy URL | `sqlite:///./sentiment.db` |
| `CORS_ORIGINS` | Allowed frontend origins | `[http://localhost:5173`%20|](http://localhost:5173`%20|)

## Project structure

```
backend/app/
  main.py            FastAPI app, health, debug fetch
  config.py          .env settings with validation
  schemas.py         Pydantic request/response models
  routers/           analyze, compare, history
  services/          bluesky (ingestion), cleaning, sentiment, aspects, metrics, compare
  db/                SQLAlchemy engine, models, repository
frontend/src/
  pages/             Dashboard, Compare, History
  components/        charts, KPI cards, gauge, aspect bars, evidence feed, executive briefing
  api/ hooks/ lib/   API client, TanStack Query hooks, formatting + recommendation rules
```

## Notes and limits

- Unauthenticated Bluesky search does not support cursor pagination; this project logs in with an App Password.
- Three-class social sentiment models reach roughly 70–75% accuracy; sarcasm is the main weak spot. Low-confidence
  posts are flagged in the evidence feed and counted as neutral for the NSS.
- Search results for niche topics may span a long period; use Compare Periods with explicit date windows for trends.
- Public Bluesky data only, non-commercial learning use.