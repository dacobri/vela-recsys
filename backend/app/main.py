"""Vela recommender API (FastAPI).

Endpoints: /health, /users, /movies/{id}, /recommend, /arena, /evaluate,
/taste/{user_id}, /galaxy, /chat. The LLM-touched routes are rate-limited; the
Anthropic key is read server-side only (never exposed to the frontend).
"""

from __future__ import annotations

import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from fastapi import FastAPI, HTTPException, Query, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402
from slowapi import Limiter, _rate_limit_exceeded_handler  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402
from slowapi.util import get_remote_address  # noqa: E402

from .service import get_service  # noqa: E402

ALLOWED_ORIGINS = ["https://vela-recsys.vercel.app",
                   "http://localhost:5173", "http://127.0.0.1:5173"]
ALLOWED_ORIGIN_REGEX = r"https://vela-recsys-[a-z0-9-]+\.vercel\.app"


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    return xff.split(",")[0].strip() if xff else get_remote_address(request)


limiter = Limiter(key_func=_client_ip)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_service()                 # warm: load data + fit all models once
    yield


app = FastAPI(title="Vela RecSys API", version="0.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["*"],
)


class ArenaIn(BaseModel):
    user_id: int
    methods: list[str]
    k: int = 10


class ChatIn(BaseModel):
    user_id: int
    message: str
    history: list[dict] = []


class SessionIn(BaseModel):
    ratings: list[dict]            # [{"id": int, "rating": float}, ...]
    method: str = "hybrid"
    k: int = 10
    diversity: float = 0.0


class ForYouIn(BaseModel):
    ratings: list[dict]


@app.get("/health")
def health():
    s = get_service()
    return {"status": "ok", "dataset": s.dataset,
            "n_movies": int(len(s.movies)),
            "n_train_users": int(s.train["userId"].nunique()),
            "llm": s.llm.available, "methods": list(s.models) + ["hybrid", "llm_rerank"]}


@app.get("/users")
def users(limit: int = Query(50, le=200), offset: int = 0):
    return get_service().users(limit, offset)


@app.get("/popular")
def popular(k: int = Query(30, le=100)):
    return get_service().popular(k)


@app.get("/movies/{mid}")
def movie(mid: int):
    try:
        return get_service().movie(mid)
    except KeyError:
        raise HTTPException(404, "movie not found")


@app.get("/recommend")
def recommend(user_id: int, method: str = "usercf", k: int = Query(10, le=50),
              diversity: float = Query(0.0, ge=0.0, le=1.0)):
    try:
        return get_service().recommend(user_id, method, k, diversity)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/movies/{mid}/similar")
def similar(mid: int, k: int = Query(12, le=50)):
    try:
        return get_service().similar(mid, k)
    except KeyError:
        raise HTTPException(404, "movie not found")


@app.post("/session/recommend")
def session_recommend(payload: SessionIn):
    rated = [(r["id"], r["rating"]) for r in payload.ratings]
    return get_service().session_recommend(rated, payload.method, payload.k, payload.diversity)


@app.post("/session/foryou")
def session_foryou(payload: ForYouIn):
    rated = [(r["id"], r["rating"]) for r in payload.ratings]
    return get_service().foryou(rated=rated)


@app.get("/foryou/{user_id}")
def foryou(user_id: int):
    return get_service().foryou(user_id=user_id)


@app.post("/arena")
def arena(payload: ArenaIn):
    return get_service().arena(payload.user_id, payload.methods, payload.k)


@app.get("/evaluate")
def evaluate(k: int = Query(10, le=50)):
    return get_service().evaluate(k)


@app.get("/taste/{user_id}")
def taste(user_id: int):
    return get_service().taste(user_id)


@app.get("/galaxy")
def galaxy():
    return get_service().galaxy()


@app.post("/chat")
@limiter.limit("30/minute")
def chat(request: Request, payload: ChatIn):
    return get_service().chat(payload.user_id, payload.message, payload.history)
