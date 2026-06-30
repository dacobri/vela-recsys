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
from recsys.matrix_factorization import ALS, MF
from recsys.semantic import SemanticRecommender

from . import tmdb

BASE_METHODS = ["random", "popularity", "damped_mean", "content",
                "itemcf", "usercf", "mf", "als", "semantic"]
# methods that support cold-start fold-in (recommend_from); others fall back to semantic
SESSION_METHODS = {"content", "semantic", "itemcf", "hybrid", "popularity"}


class ModelService:
    def __init__(self, dataset: str | None = None):
        self.dataset = dataset or os.environ.get("VELA_DATASET", "small")
        self._galaxy_cache: dict[int, dict] = {}
        self._galaxy_xy = None
        self._eval = None
        self._load()

    # -- startup ---------------------------------------------------------
    def _load(self):
        ratings = data.filter_kcore(data.load_ratings(self.dataset), 5, 5)
        self.movies = data.build_movies_table(self.dataset, ratings=ratings).reset_index(drop=True)
        self.meta = self.movies.set_index(config.ITEM_COL)
        self.tmdb_id = {int(m): (int(t) if pd.notna(t) else None)
                        for m, t in zip(self.movies[config.ITEM_COL], self.movies["tmdbId"])}
        self.posters = self._load_posters()
        self.train, self.test = data.temporal_holdout(ratings, frac=0.2)

        emb = self._load_embeddings()
        self.emb_row = {int(m): i for i, m in enumerate(self.movies[config.ITEM_COL])}
        self.pop_median = float(self.movies["n_ratings"].median())
        self.models = {
            "random": RandomRec().fit(self.train),
            "popularity": MostPopular().fit(self.train),
            "damped_mean": DampedMean().fit(self.train),
            "content": ContentBased().fit(self.train, self.movies),
            "itemcf": ItemItemCF(k=30).fit(self.train),
            "usercf": UserUserCF(k=40).fit(self.train),
            "mf": MF(n_factors=50, n_epochs=20).fit(self.train),
            "als": ALS(factors=64, iterations=20, alpha=20.0).fit(self.train),
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
                aligned = np.zeros((len(order), emb.shape[1]), dtype=emb.dtype)
                missing = 0
                for r, m in enumerate(order):
                    j = pos.get(int(m))
                    if j is None:                        # stale cache: zero-fill (don't crash)
                        missing += 1
                    else:
                        aligned[r] = emb[j]
                if missing:
                    print(f"[service] WARNING: {missing} movies missing from embedding cache; "
                          "zero-filled. Re-run scripts/clustering_test.py to refresh.")
                emb = aligned
            self.emb = emb
            return emb
        # cache miss -> build with torch (offline path), then persist
        from recsys.semantic import embed_movies
        emb, ids = embed_movies(self.movies)
        np.save(emb_path, emb)
        np.save(ids_path, ids)
        self.emb = emb
        return emb

    def _load_posters(self) -> dict:
        """Load the precomputed movieId -> {poster_url, backdrop_url, overview} cache
        so enrichment never hits TMDB at request time (falls back to live if absent)."""
        path = config.ARTIFACTS_DIR / f"posters_{self.dataset}.parquet"
        if not path.exists():
            return {}
        df = pd.read_parquet(path)

        def _v(x):  # NaN -> None (NaN is not JSON-serializable)
            return None if (x is None or (isinstance(x, float) and pd.isna(x))) else x

        return {int(r.movieId): {"poster_url": _v(r.poster_url), "backdrop_url": _v(r.backdrop_url),
                                 "overview": _v(r.overview)} for r in df.itertuples()}

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
        cached = self.posters.get(int(mid))
        if cached is not None:
            d.update({k: cached.get(k) for k in ("poster_url", "backdrop_url", "overview")})
        else:
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

    def recommend(self, user_id: int, method: str, k: int = 10, diversity: float = 0.0) -> dict:
        if method == "llm_rerank":
            return self._llm_rerank(user_id, k)
        pool = k * 4 if diversity > 0 else k
        if method == "hybrid":
            recs = self.hybrid.recommend(user_id, k=pool)
        else:
            model = self.models.get(method)
            if model is None:
                raise ValueError(f"unknown method {method}")
            recs = model.recommend(user_id, pool)
        recs = self._mmr(recs, k, diversity) if diversity > 0 else recs[:k]
        return {"user_id": user_id, "method": method, "k": k,
                "items": self._enrich(recs), "llm": False, "diversity": diversity}

    def _llm_rerank(self, user_id: int, k: int) -> dict:
        base = self.models["usercf"].recommend(user_id, k=25) or \
            self.models["popularity"].recommend(user_id, k=25)
        cands = [{"id": int(m), "title": self._title(m), "genres": self._genres(m)}
                 for m, _ in base]
        res = self.llm.rerank(self._taste_text(user_id), cands, k=k)
        valid = {int(c["id"]) for c in cands}            # ground to the candidate set (no hallucinated ids)
        score, reasons, recs, picked = dict(base), {}, [], set()
        for it in res["items"]:
            try:
                mid = int(it["id"])
            except (TypeError, ValueError, KeyError):
                continue
            if mid in valid and mid not in picked:
                reasons[mid] = it.get("reason", "")
                recs.append((mid, score.get(mid, 0.0)))
                picked.add(mid)
        for mid, s in base:                              # backfill from base ranking if short
            if len(recs) >= k:
                break
            if mid not in picked:
                recs.append((mid, s))
                picked.add(mid)
        return {"user_id": user_id, "method": "llm_rerank", "k": k,
                "items": self._enrich(recs[:k], reasons), "llm": res.get("llm", False)}

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

    def galaxy(self, n_clusters: int = 8) -> dict:
        """2D map of the catalog. Each film is embedded by its content (title +
        genres + tags), projected to 2D with PCA (computed once), and grouped into
        exactly ``n_clusters`` k-means clusters (so the dropdown actually changes
        the map). Clusters are labelled by their most common genres."""
        from collections import Counter

        n = max(2, min(int(n_clusters), 18))
        if n in self._galaxy_cache:
            return self._galaxy_cache[n]
        if self._galaxy_xy is None:
            from sklearn.decomposition import PCA
            self._galaxy_xy = PCA(n_components=2,
                                  random_state=config.RANDOM_STATE).fit_transform(self.emb).astype(float)
        from sklearn.cluster import KMeans

        labels = KMeans(n_clusters=n, random_state=config.RANDOM_STATE,
                        n_init=10).fit_predict(self.emb)
        xy = self._galaxy_xy
        mv = self.movies
        ids = mv[config.ITEM_COL].to_numpy()
        titles = mv["title_clean"].fillna(mv[config.TITLE_COL]).to_numpy()
        glist = mv["genres_list"].tolist()
        points = []
        for i in range(len(mv)):
            mid = int(ids[i])
            cached = self.posters.get(mid)
            points.append({
                "movieId": mid, "title": str(titles[i]),
                "x": float(xy[i, 0]), "y": float(xy[i, 1]), "cluster": int(labels[i]),
                "poster_url": (cached or {}).get("poster_url"),
                "genres": list(glist[i] or [])[:3],
            })
        clusters = []
        for c in range(n):
            idxs = [i for i in range(len(labels)) if labels[i] == c]
            gen = Counter(g for i in idxs for g in (glist[i] or []))
            clusters.append({"cluster": c, "size": len(idxs),
                             "top_genres": [g for g, _ in gen.most_common(3)]})
        out = {"n_clusters": n, "points": points,
               "clusters": sorted(clusters, key=lambda c: -c["size"])}
        self._galaxy_cache[n] = out
        return out

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

    # -- consumer front door --------------------------------------------
    def _emb_row(self, mid):
        return self.emb_row.get(int(mid))

    def _mmr(self, recs, k, lam=0.3):
        """Maximal Marginal Relevance re-rank: trade relevance for diversity."""
        if not recs or lam <= 0:
            return recs[:k]
        scores = [s for _, s in recs]                   # min-max so relevance is in [0,1]
        lo, hi = min(scores), max(scores)               # (a raw s/max flips sign if scores<0)
        rng = (hi - lo) or 1.0
        cand, chosen, chosen_rows = list(recs), [], []
        while cand and len(chosen) < k:
            best_i, best_val = 0, -1e18
            for i, (mid, s) in enumerate(cand):
                row = self._emb_row(mid)
                sim = max((float(self.emb[row] @ self.emb[cr]) for cr in chosen_rows),
                          default=0.0) if row is not None else 0.0
                val = (1 - lam) * ((s - lo) / rng) - lam * sim
                if val > best_val:
                    best_val, best_i = val, i
            mid, s = cand.pop(best_i)
            chosen.append((mid, s))
            row = self._emb_row(mid)
            if row is not None:
                chosen_rows.append(row)
        return chosen

    def _popularity_list(self, k, exclude=()):
        ex = {int(i) for i in exclude}
        out = []
        for m in self.models["popularity"].ranking_:
            if int(m) in ex:
                continue
            out.append((int(m), float(self.models["popularity"]._score_map.get(int(m), 0.0))))
            if len(out) >= k:
                break
        return out

    def _novel_filter(self, recs, k):
        gems = [(m, s) for m, s in recs
                if float(self.meta.loc[m].get("n_ratings", 0)) < self.pop_median]
        return (gems or recs)[:k]

    def similar_recs(self, mid, k=12):
        return self.models["semantic"].similar_items(int(mid), k)

    def similar(self, mid, k=12):
        if mid not in self.meta.index:
            raise KeyError(mid)
        return {"id": int(mid), "items": self._enrich(self.similar_recs(mid, k))}

    def popular(self, k=30) -> dict:
        """Top popular movies — used for the onboarding picker (no user needed)."""
        return {"items": self._enrich(self._popularity_list(k))}

    def _profile_recs(self, rated, method, k):
        """Recommend for an ad-hoc (onboarding) user from a list of (item, rating)."""
        excl = [i for i, _ in rated]
        if method == "popularity":
            return self._popularity_list(k, exclude=excl)
        if method == "hybrid":
            agg: dict[int, float] = {}
            for name, w in (("itemcf", 0.5), ("semantic", 0.3), ("popularity", 0.2)):
                rr = (self._popularity_list(k * 3, exclude=excl) if name == "popularity"
                      else self.models[name].recommend_from(rated, k=k * 3, exclude_ids=excl))
                if not rr:
                    continue
                mx = max(s for _, s in rr) or 1.0
                for mid, s in rr:
                    agg[mid] = agg.get(mid, 0.0) + w * (s / mx)
            return sorted(agg.items(), key=lambda x: -x[1])[:k]
        model = self.models.get(method)
        if model is None or not hasattr(model, "recommend_from"):
            return self.models["semantic"].recommend_from(rated, k=k, exclude_ids=excl)
        return model.recommend_from(rated, k=k, exclude_ids=excl)

    def session_recommend(self, rated, method="hybrid", k=10, diversity=0.0) -> dict:
        rated = [(int(i), float(r)) for i, r in rated]
        used = method if method in SESSION_METHODS else "semantic"   # honest label on fallback
        recs = self._profile_recs(rated, used, k * 4 if diversity > 0 else k)
        recs = self._mmr(recs, k, diversity) if diversity > 0 else recs[:k]
        return {"method": used, "requested": method, "k": k,
                "items": self._enrich(recs), "llm": False}

    def foryou(self, user_id=None, rated=None) -> dict:
        """Netflix-style labeled rows for the consumer home (known user OR onboarding)."""
        if rated is not None:
            rated = [(int(i), float(r)) for i, r in rated]
            excl = [i for i, _ in rated]
            top = self._profile_recs(rated, "hybrid", 18)
            liked = sorted(rated, key=lambda x: -x[1])
            seed = liked[0][0] if liked else None
            sem = self.models["semantic"].recommend_from(rated, k=40, exclude_ids=excl)
            trending = self._popularity_list(14, exclude=excl)
        else:
            top = self.hybrid.recommend(user_id, 18)
            ur = self.train[self.train[config.USER_COL] == user_id].sort_values(
                config.RATING_COL, ascending=False)
            seed = int(ur.iloc[0][config.ITEM_COL]) if not ur.empty else None
            sem = self.models["semantic"].recommend(user_id, 40)
            trending = self._popularity_list(14, exclude=self.models["popularity"].seen(user_id))
        rows = [{"title": "Top picks for you", "items": self._enrich(top[:18])}]
        if seed is not None:
            rows.append({"title": f"Because you liked {self._title(seed)}",
                         "items": self._enrich(self.similar_recs(seed, 14))})
        rows.append({"title": "Hidden gems", "items": self._enrich(self._novel_filter(sem, 14))})
        rows.append({"title": "Trending now", "items": self._enrich(trending)})
        return {"rows": rows}

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

    def recommend(self, user_id, k=10, exclude_seen=True):
        depth = max(k, 120)                              # candidate pool depth per base model
        agg: dict[int, float] = {}
        for name, w in self.weights:
            recs = self.models[name].recommend(user_id, k=depth, exclude_seen=exclude_seen)
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
