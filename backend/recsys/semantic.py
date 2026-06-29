"""Semantic content recommender — "content-based 2.0".

Encodes each movie's text (title + genres + genome tags + TMDB overview/keywords
when available) into a dense sentence-transformer embedding, indexes them with
FAISS, and recommends by nearest-neighbour search around a user profile built in
that embedding space. This is the neural upgrade of the TF-IDF content model and
the candidate-generation half of a two-tower retriever.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import config
from .base import Recommender

DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def movie_text(row) -> str:
    parts: list[str] = []
    title = row.get("title_clean") or row.get(config.TITLE_COL)
    if isinstance(title, str):
        parts.append(title)
    parts += list(row.get("genres_list") or [])
    tags = row.get("genome_top_tags")
    if isinstance(tags, (list, tuple)):
        parts += [str(t) for t in tags]
    for col in ("tmdb_overview", "tmdb_keywords"):
        v = row.get(col)
        if isinstance(v, str):
            parts.append(v)
        elif isinstance(v, (list, tuple)):
            parts += [str(x) for x in v]
    return " ".join(parts)


def embed_movies(movies: pd.DataFrame, model_name: str = DEFAULT_MODEL,
                 batch_size: int = 256):
    """Return (embeddings [n x d] float32 L2-normalised, item_ids)."""
    from sentence_transformers import SentenceTransformer

    texts = movies.apply(movie_text, axis=1).tolist()
    model = SentenceTransformer(model_name)
    emb = model.encode(texts, batch_size=batch_size, normalize_embeddings=True,
                       show_progress_bar=False, convert_to_numpy=True)
    return emb.astype(np.float32), movies[config.ITEM_COL].to_numpy()


def build_faiss_index(embeddings: np.ndarray):
    import faiss

    index = faiss.IndexFlatIP(embeddings.shape[1])   # inner product on L2-norm == cosine
    index.add(embeddings)
    return index


class SemanticRecommender(Recommender):
    name = "semantic"

    def __init__(self, model_name: str = DEFAULT_MODEL):
        self.model_name = model_name

    def fit(self, train: pd.DataFrame, movies: pd.DataFrame,
            embeddings: np.ndarray | None = None):
        self._record_seen(train)
        if embeddings is None:
            embeddings, item_ids = embed_movies(movies, self.model_name)
        else:
            item_ids = movies[config.ITEM_COL].to_numpy()
        self.emb = embeddings
        self.item_ids_ = item_ids
        self.i2row_ = {int(m): r for r, m in enumerate(item_ids)}
        self.index = build_faiss_index(embeddings)
        self._user_mean = train.groupby(config.USER_COL)[config.RATING_COL].mean().to_dict()
        self._user_ratings = {
            u: list(zip(g[config.ITEM_COL].to_numpy(), g[config.RATING_COL].to_numpy()))
            for u, g in train.groupby(config.USER_COL)
        }
        return self

    def _profile_from(self, rated):
        if not rated:
            return None
        mu = float(np.mean([r for _, r in rated]))
        rows, w = [], []
        for item, r in rated:
            row = self.i2row_.get(int(item))
            if row is not None:
                rows.append(row)
                w.append(r - mu)
        if not rows:
            return None
        wv = np.asarray(w, dtype=np.float32)
        if not np.any(np.abs(wv) > 1e-9):               # all ratings equal -> treat as likes
            wv = np.ones_like(wv)
        prof = (wv @ self.emb[rows]).astype(np.float32)
        n = np.linalg.norm(prof)
        return (prof / n).reshape(1, -1) if n > 0 else None

    def _profile(self, user_id):
        return self._profile_from(self._user_ratings.get(user_id, []))

    def _rank(self, prof, exclude, k):
        scores, idx = self.index.search(prof, k + len(exclude) + 1)
        out = []
        for j, s in zip(idx[0], scores[0]):
            item = int(self.item_ids_[j])
            if item in exclude:
                continue
            out.append((item, float(s)))
            if len(out) >= k:
                break
        return out

    def recommend(self, user_id, k=config.TOP_K, exclude_seen=True):
        prof = self._profile(user_id)
        if prof is None:
            return []
        return self._rank(prof, self.seen(user_id) if exclude_seen else set(), k)

    def recommend_from(self, rated, k=config.TOP_K, exclude_ids=None):
        prof = self._profile_from(rated)
        if prof is None:
            return []
        exclude = {int(i) for i, _ in rated} | set(exclude_ids or [])
        return self._rank(prof, exclude, k)

    def similar_items(self, item_id, k=10):
        row = self.i2row_.get(int(item_id))
        if row is None:
            return []
        scores, idx = self.index.search(self.emb[row].reshape(1, -1), k + 1)
        return [(int(self.item_ids_[j]), float(s))
                for j, s in zip(idx[0], scores[0]) if j != row][:k]
