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

## 🚀 Live demo

| | |
|---|---|
| **App** (consumer UI + analytical Lab) | **https://vela-deploy-nu.vercel.app** |
| **API** (FastAPI, interactive docs) | **https://dacobri-vela.hf.space** · [`/docs`](https://dacobri-vela.hf.space/docs) |

Frontend on Vercel, backend on Hugging Face Spaces (Docker). The API serves the
MovieLens `ml-latest-small` subset; first request after idle may take ~30s while
the Space wakes. Open the app, pick a user, and try **Lab → Arena / Evaluation /
Taste DNA / Galaxy** or the conversational **Chat**.

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

## Results (MovieLens small, 590 users, per-user temporal split, K=10)

Best top-N model is **User-CF** (NDCG@10 **0.110**, 95% CI [0.096, 0.123]); item-CF
follows (0.097) after shrinkage tuning lifted it 5×. At **ml-32m** scale, **item-CF**
wins and improves with data (NDCG 0.121). Content and semantic models sit near the
random floor on accuracy but top coverage/novelty — the accuracy-vs-discovery trade-off,
quantified with bootstrap CIs and Holm-corrected paired tests. Full tables in `results/`.

## Status
✅ **Deployed and final.** Backend engine implemented, unit-tested, benchmarked
(small + ml-32m with statistical rigor); FastAPI live on HF Spaces; React app live on
Vercel. See the live links above.
