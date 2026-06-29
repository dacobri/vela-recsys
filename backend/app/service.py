"""Model service: loads data, fits every recommender once, and answers the API.

Serving stays torch-free: item embeddings are precomputed offline and cached as
.npy, so this process uses faiss on the cached vectors without importing
sentence-transformers/torch (which otherwise conflicts with faiss's OpenMP
runtime on macOS).
"""

from __future__ import annotations

import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import numpy as np
import pandas as pd

from recsys import config, data
from recsys.baselines import DampedMean, MostPopular, RandomRec
from recsys.collaborative import ItemItemCF, UserUserCF
from recsys.content import ContentBased
from recsys.evaluation import run_benchmark
from recsys.llm import get_llm
from recsys.matrix_factorization import MF
from recsys.semantic import SemanticRecommender

from . import tmdb

BASE_METHODS = ["random", "popularity", "damped_mean", "content",
                "itemcf", "usercf", "mf", "semantic"]


class ModelService:
    def __init__(self, dataset: str | None = None):
        self.dataset = dataset or os.environ.get("VELA_DATASET", "small")
        self._galaxy = None
        self._eval = None
        self._load()

    # -- startup ---------------------------------------------------------
    def _load(self):
        ratings = data.filter_kcore(data.load_ratings(self.dataset), 5, 5)
        self.movies = data.build_movies_table(self.dataset, ratings=ratings).reset_index(drop=True)
        self.meta = self.movies.set_index(config.ITEM_COL)
        self.tmdb_id = {int(m): (int(t) if pd.notna(t) else None)
                        for m, t in zip(self.movies[config.ITEM_COL], self.movies["tmdbId"])}
        self.train, self.test = data.temporal_holdout(ratings, frac=0.2)

        emb = self._load_embeddings()
        self.models = {
            "random": RandomRec().fit(self.train),
            "popularity": MostPopular().fit(self.train),
            "damped_mean": DampedMean().fit(self.train),
            "content": ContentBased().fit(self.train, self.movies),
            "itemcf": ItemItemCF(k=30).fit(self.train),
            "usercf": UserUserCF(k=40).fit(self.train),
            "mf": MF(n_factors=32, n_epochs=12).fit(self.train),
            "semantic": SemanticRecommender().fit(self.train, self.movies, embeddings=emb),
        }
        self.hybrid = _Hybrid(self.models)
        self.llm = get_llm()

    def _load_embeddings(self) -> np.ndarray:
        emb_path = config.ARTIFACTS_DIR / f"emb_{self.dataset}.npy"
        ids_path = config.ARTIFACTS_DIR / f"ids_{self.dataset}.npy"
        if emb_path.exists() and ids_path.exists():
            emb, ids = np.load(emb_path), np.load(ids_path)
            order = self.movies[config.ITEM_COL].to_numpy()
            if not np.array_equal(ids, order):           # realign to movie-table order
                pos = {int(m): i for i, m in enumerate(ids)}
                emb = emb[[pos[int(m)] for m in order]]
            self.emb = emb
            return emb
        # cache miss -> build with torch (offline path), then persist
        from recsys.semantic import embed_movies
        emb, ids = embed_movies(self.movies)
        np.save(emb_path, emb)
        np.save(ids_path, ids)
        self.emb = emb
        return emb

    # -- enrichment ------------------------------------------------------
    def _movie_dict(self, mid: int, score: float | None = None, reason: str | None = None) -> dict:
        row = self.meta.loc[mid]
        d = {
            "id": int(mid),
            "title": str(row.get("title_clean") or row[config.TITLE_COL]),
            "year": int(row["year"]) if pd.notna(row.get("year")) else None,
            "genres": list(row.get("genres_list") or []),
            "poster_url": None,
            "backdrop_url": None,
            "overview": None,
        }
        tid = self.tmdb_id.get(int(mid))
        if tid:
            info = tmdb.fetch_movie(tid)
            if info:
                d.update({k: info[k] for k in ("poster_url", "backdrop_url", "overview")})
        if score is not None:
            d["score"] = round(float(score), 4)
        if reason:
            d["reason"] = reason
        return d

    def _enrich(self, recs, reasons: dict | None = None) -> list[dict]:
        return [self._movie_dict(mid, score, (reasons or {}).get(mid)) for mid, score in recs]

    # -- API methods -----------------------------------------------------
    def users(self, limit=50, offset=0) -> dict:
        counts = self.train[config.USER_COL].value_counts()
        ids = counts.index.to_numpy()[offset:offset + limit]
        return {"total": int(counts.size),
                "users": [{"id": int(u), "n_ratings": int(counts[u])} for u in ids]}

    def movie(self, mid: int) -> dict:
        if mid not in self.meta.index:
            raise KeyError(mid)
        return self._movie_dict(mid)

    def recommend(self, user_id: int, method: str, k: int = 10) -> dict:
        if method == "hybrid":
            return {"user_id": user_id, "method": method, "k": k,
                    "items": self._enrich(self.hybrid.recommend(user_id, k)), "llm": False}
        if method == "llm_rerank":
            return self._llm_rerank(user_id, k)
        model = self.models.get(method)
        if model is None:
            raise ValueError(f"unknown method {method}")
        return {"user_id": user_id, "method": method, "k": k,
                "items": self._enrich(model.recommend(user_id, k)), "llm": False}

    def _llm_rerank(self, user_id: int, k: int) -> dict:
        base = self.models["usercf"].recommend(user_id, k=25) or \
            self.models["popularity"].recommend(user_id, k=25)
        cands = [{"id": int(m), "title": self._title(m), "genres": self._genres(m)}
                 for m, _ in base]
        res = self.llm.rerank(self._taste_text(user_id), cands, k=k)
        score = dict(base)
        reasons = {int(it["id"]): it.get("reason", "") for it in res["items"]}
        recs = [(int(it["id"]), score.get(int(it["id"]), 0.0)) for it in res["items"]]
        return {"user_id": user_id, "method": "llm_rerank", "k": k,
                "items": self._enrich(recs, reasons), "llm": res.get("llm", False)}

    def arena(self, user_id: int, methods: list[str], k: int = 10) -> dict:
        return {"user_id": user_id,
                "results": {m: self.recommend(user_id, m, k)["items"] for m in methods}}

    def evaluate(self, k: int = 10, max_users: int = 400) -> dict:
        if self._eval is None:
            models = {m: self.models[m] for m in BASE_METHODS}
            models["hybrid"] = self.hybrid
            table = run_benchmark(models, self.train, self.test, self.movies,
                                  k=k, max_users=max_users)
            self._eval = table.reset_index().to_dict(orient="records")
        return {"k": k, "metrics": self._eval}

    def taste(self, user_id: int) -> dict:
        ur = self.train[self.train[config.USER_COL] == user_id]
        if ur.empty:
            return {"user_id": user_id, "top_genres": [], "top_movies": [], "summary": ""}
        weights: dict[str, float] = {}
        for _, r in ur.iterrows():
            for g in (self.meta.loc[r[config.ITEM_COL]].get("genres_list") or []):
                weights[g] = weights.get(g, 0.0) + float(r[config.RATING_COL])
        tot = sum(weights.values()) or 1.0
        top_genres = sorted(((g, round(w / tot, 3)) for g, w in weights.items()),
                            key=lambda x: -x[1])[:8]
        top = ur.sort_values(config.RATING_COL, ascending=False).head(8)
        top_movies = self._enrich([(int(r[config.ITEM_COL]), float(r[config.RATING_COL]))
                                    for _, r in top.iterrows()])
        summary = "You gravitate toward " + ", ".join(g for g, _ in top_genres[:3]) + " films."
        return {"user_id": user_id, "top_genres": top_genres,
                "top_movies": top_movies, "summary": summary}

    def galaxy(self) -> dict:
        if self._galaxy is None:
            from recsys.clustering import build_galaxy
            ids = self.movies[config.ITEM_COL].to_numpy()
            self._galaxy = build_galaxy(self.movies, self.emb, ids, layout="pca")
        return self._galaxy

    def chat(self, user_id: int, message: str, history: list | None = None) -> dict:
        # broad + personal candidate pool so mood/vibe requests aren't limited to
        # the user's dominant genre (the LLM picks from variety, grounded to real items)
        personal = self.models["semantic"].recommend(user_id, k=15)
        popular = self.models["popularity"].recommend(user_id, k=35)
        seen, base = set(), []
        for mid, s in personal + popular:
            if mid in seen:
                continue
            seen.add(mid)
            base.append((mid, s))
        cands = [{"id": int(m), "title": self._title(m), "genres": self._genres(m)}
                 for m, _ in base[:40]]
        res = self.llm.chat(message, cands, history)
        return {"reply": res["reply"], "llm": res.get("llm", False),
                "recommendations": self._enrich(base[:8])}

    # -- small helpers ---------------------------------------------------
    def _title(self, mid) -> str:
        row = self.meta.loc[mid]
        return str(row.get("title_clean") or row[config.TITLE_COL])

    def _genres(self, mid) -> list[str]:
        return list(self.meta.loc[mid].get("genres_list") or [])

    def _taste_text(self, user_id) -> str:
        t = self.taste(user_id)
        return "likes " + ", ".join(g for g, _ in t["top_genres"][:4]) if t["top_genres"] else "general taste"


class _Hybrid:
    """Weighted blend of normalized scores from user-CF, semantic and popularity."""

    name = "hybrid"

    def __init__(self, models, weights=(("usercf", 0.5), ("semantic", 0.3), ("popularity", 0.2))):
        self.models = models
        self.weights = weights

    def recommend(self, user_id, k=10, exclude_seen=True, pool=120):
        agg: dict[int, float] = {}
        for name, w in self.weights:
            recs = self.models[name].recommend(user_id, k=pool, exclude_seen=exclude_seen)
            if not recs:
                continue
            mx = max(s for _, s in recs) or 1.0
            for mid, s in recs:
                agg[mid] = agg.get(mid, 0.0) + w * (s / mx)
        return sorted(agg.items(), key=lambda x: -x[1])[:k]


_service: ModelService | None = None


def get_service() -> ModelService:
    global _service
    if _service is None:
        _service = ModelService()
    return _service
