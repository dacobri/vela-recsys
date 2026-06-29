<div align="center">
  <img src="brand/logo-lockup.svg" alt="Vela" width="200"/>
  <p><em>your personal map of cinema</em></p>
</div>

# Vela

A movie recommender prototype built for the ESADE *Recommender Systems* course —
every algorithm family the course teaches, implemented from scratch and compared
on the same data, wrapped in a polished web app with a modern semantic + LLM layer.

> Not just "a recommender" — a **referee that puts seven recommendation
> philosophies in the ring on the same data and lets you judge them honestly**,
> then shows how the winner changes once you value diversity and remove data leakage.

## What's inside

| Layer | What |
|---|---|
| **Non-personalised** | most-popular, Bayesian damped-mean (IMDb weighted rating), random |
| **Content-based** | TF-IDF over genres/tags + centered-rating user profile + cosine |
| **Collaborative** | item-item (adjusted cosine) & user-user (mean-centered + significance weighting) |
| **Matrix factorization** | biased SGD `μ+b_u+b_i+p_u·q_i` (+ implicit ALS for scale) |
| **Semantic** | sentence-transformer embeddings + FAISS ("content-based 2.0" / two-tower retrieval) |
| **Galaxy** | Leiden community detection over the embedding graph → browsable micro-genres |
| **Hybrid + LLM** | weighted blend; Claude re-ranking, natural-language explanations & chat |
| **Evaluation** | leakage-free temporal split; Precision/Recall/NDCG/MAP/MRR + coverage/novelty/diversity |

## Architecture

```
React (Vite + TS + Tailwind)  ──HTTP──▶  FastAPI  ──▶  recsys engine (numpy/scipy/sklearn/faiss)
   Vercel                                  HF Spaces        ├─ Claude (re-rank/explain/chat)
                                                            └─ TMDB (posters, server-side)
data: MovieLens ml-32m (offline eval) + ml-25m genome + IMDb + TMDB
```

## Run it

```bash
# backend
cd backend && uv pip install -r requirements.txt
./.venv/bin/python scripts/run_benchmark.py --dataset small      # methods × metrics table
./.venv/bin/uvicorn app.main:app --reload --port 8000

# frontend
cd frontend && npm install && npm run dev                        # http://localhost:5173
```

Secrets live in `.env` (gitignored): `ANTHROPIC_API_KEY` (server-side only),
`TMDB_READ_TOKEN`. The frontend uses a read-only TMDB key for browse images.

## Data & licensing
MovieLens (GroupLens) — research use; cite Harper & Konstan 2015. IMDb —
non-commercial. TMDB — "This product uses the TMDB API but is not endorsed or
certified by TMDB." See `_context/` for the full project analysis and build spec.

## Status
Backend engine: ✅ implemented, unit-tested, benchmarked. API: ✅ all endpoints live.
Frontend: ✅ rebranded, builds. Next: tune MF/item-CF, full ml-32m evaluation,
deploy artifacts, ship to Vercel + HF Spaces.
