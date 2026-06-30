# Deployment

Vela runs as two services:

| Service | Host | URL |
|---|---|---|
| Backend (FastAPI) | Hugging Face Spaces (Docker) | https://dacobri-vela.hf.space |
| Frontend (Vite/React) | Vercel | https://vela-deploy-nu.vercel.app |

## Backend — Hugging Face Space (`dacobri/vela`)

A Docker Space. Its repo root contains a `Dockerfile` (see `backend/Dockerfile` for
the equivalent), plus the serving payload arranged as the engine expects:

```
Dockerfile
backend/{app,recsys,artifacts,requirements-serve.txt}
data/raw/ml-latest-small/        # the small MovieLens subset
```

- Serving is **torch-free**: item embeddings are precomputed offline and shipped as
  `backend/artifacts/emb_small.npy` (+ `ids_small.npy`, `posters_small.parquet`).
  These are gitignored in this repo (regenerate with `scripts/`), and uploaded to the
  Space directly (LFS).
- System dep `libgomp1` is installed for `faiss-cpu` / `implicit` (OpenMP runtime).
- Secrets are set as **Space secrets** (never committed): `ANTHROPIC_API_KEY`,
  `ANTHROPIC_MODEL`, `LLM_MAX_TOKENS`, `LLM_DAILY_REQUEST_CAP`, `TMDB_API_KEY`,
  `TMDB_READ_TOKEN`.
- App listens on port `7860` (`app_port` in the Space README front-matter).

## Frontend — Vercel (`vela-deploy`)

Root directory `frontend/`, framework Vite (auto-detected), SPA rewrites in
`frontend/vercel.json`. Production environment variables:

- `VITE_API_URL=https://dacobri-vela.hf.space`  (points the app at the live API)
- `VITE_TMDB_API_BASE_URL=https://api.themoviedb.org/3`
- `VITE_API_KEY=<TMDB read-only v3 key>`

CORS on the backend (`backend/app/main.py`) allows the Vercel production and preview
domains. Update `ALLOWED_ORIGINS` / `ALLOWED_ORIGIN_REGEX` if the project is renamed.
