---
title: Vela RecSys API
emoji: 🎬
colorFrom: indigo
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# Vela — RecSys API

FastAPI backend for the Vela movie recommender. Serves every recommender family
(popularity, damped-mean, content TF-IDF, item/user CF, matrix factorization,
semantic embeddings, hybrid) plus a Claude LLM layer (re-rank, explanations,
chat) and the Leiden "movie galaxy".

## Run locally
```bash
cd backend
uv venv --python 3.12 .venv && uv pip install -r requirements.txt   # full (incl. torch for offline embedding)
./.venv/bin/uvicorn app.main:app --reload --port 8000
```
Requires `../.env` with `ANTHROPIC_API_KEY`, `TMDB_READ_TOKEN` (or `TMDB_API_KEY`).
Precompute embeddings once (`scripts/clustering_test.py` or `prepare_data.py`) so
serving is torch-free.

## Endpoints
`GET /health` · `GET /users` · `GET /movies/{id}` · `GET /recommend?user_id&method&k`
· `POST /arena` · `GET /evaluate` · `GET /taste/{user_id}` · `GET /galaxy` · `POST /chat`

`method` ∈ `popularity, damped_mean, content, itemcf, usercf, mf, semantic, hybrid, llm_rerank`.

## Deploy (Hugging Face Spaces, Docker)
Push `backend/` to a Docker Space. Uses `requirements-serve.txt` (lean, torch-free).
Set Space **Secrets**: `ANTHROPIC_API_KEY`, `TMDB_READ_TOKEN`. Ship the deploy
artifacts (`data/deploy/`, `artifacts/emb_deploy.npy`) so the cache is warm.
LLM calls are rate-limited (per-IP) + daily-capped + cached, with a non-LLM fallback.
