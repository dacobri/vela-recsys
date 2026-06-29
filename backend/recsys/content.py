"""Content-based filtering.

Item vectors are TF-IDF over the movie's genres (and tags / genome tags when
available). A user profile is the sum of the TF-IDF vectors of the items the user
rated, weighted by *mean-centered* ratings — so disliked movies push the profile
away from their features. Recommendations are the unseen items whose vectors are
most cosine-similar to the profile.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

from . import config
from .base import Recommender


def _genre_tokens(genres_list) -> str:
    if not isinstance(genres_list, (list, tuple)):
        return ""
    return " ".join(g.lower().replace(" ", "_").replace("-", "_") for g in genres_list)


class ContentBased(Recommender):
    name = "content"

    def __init__(self, use_tags: bool = True, max_features: int | None = None):
        self.use_tags = use_tags
        self.max_features = max_features

    def fit(self, train: pd.DataFrame, movies: pd.DataFrame):
        self._record_seen(train)
        movies = movies.copy()

        # build a text document per movie from genres (+ optional tags / genome tags)
        docs = movies["genres_list"].apply(_genre_tokens)
        if self.use_tags and "genome_top_tags" in movies.columns:
            extra = movies["genome_top_tags"].apply(
                lambda t: " ".join(str(x).lower().replace(" ", "_") for x in t)
                if isinstance(t, (list, tuple)) else ""
            )
            docs = docs.str.cat(extra, sep=" ")

        self.vectorizer = TfidfVectorizer(max_features=self.max_features, norm="l2")
        self.item_features_ = self.vectorizer.fit_transform(docs.tolist())  # (n_items x d), L2
        self.item_ids_ = movies[config.ITEM_COL].to_numpy()
        self.i2row_ = {int(m): r for r, m in enumerate(self.item_ids_)}

        # cache training ratings per user and user means for profile building
        self._user_mean = train.groupby(config.USER_COL)[config.RATING_COL].mean().to_dict()
        self._user_ratings = {
            u: list(zip(g[config.ITEM_COL].to_numpy(), g[config.RATING_COL].to_numpy()))
            for u, g in train.groupby(config.USER_COL)
        }
        return self

    def _profile(self, user_id):
        ratings = self._user_ratings.get(user_id)
        if not ratings:
            return None
        mu = self._user_mean.get(user_id, 0.0)
        rows, weights = [], []
        for item, r in ratings:
            row = self.i2row_.get(int(item))
            if row is not None:
                rows.append(row)
                weights.append(r - mu)        # centered rating
        if not rows:
            return None
        sub = self.item_features_[rows]                 # sparse (m x d), L2-normalised rows
        w = np.asarray(weights, dtype=np.float64)       # centered ratings (m,)
        prof = np.asarray(sub.T @ w).ravel()            # dense profile (d,)
        norm = np.linalg.norm(prof)
        if norm == 0:
            return None
        return prof / norm                              # L2 so dot == cosine

    def recommend(self, user_id, k=config.TOP_K, exclude_seen=True):
        prof = self._profile(user_id)
        if prof is None:
            return []
        scores = np.asarray(self.item_features_ @ prof).ravel()  # cosine to every item
        seen = self.seen(user_id) if exclude_seen else set()
        order = np.argsort(-scores)
        out = []
        for row in order:
            item = int(self.item_ids_[row])
            if item in seen:
                continue
            out.append((item, float(scores[row])))
            if len(out) >= k:
                break
        return out

    def similar_items(self, item_id, k=10):
        row = self.i2row_.get(int(item_id))
        if row is None:
            return []
        sims = (self.item_features_ @ self.item_features_[row].T).toarray().ravel()
        order = np.argsort(-sims)
        return [(int(self.item_ids_[r]), float(sims[r])) for r in order if r != row][:k]
