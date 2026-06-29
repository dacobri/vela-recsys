"""Common recommender interface.

Every recommender — non-personalised, content-based, collaborative, matrix
factorisation, semantic, hybrid — implements the same two methods so they can be
swapped, compared and served behind one API:

    model.fit(train_ratings, movies=None)
    model.recommend(user_id, k=10, exclude_seen=True) -> [(movieId, score), ...]

``recommend`` always returns items ranked best-first, already excluding items the
user interacted with in the training set (when ``exclude_seen`` is True).
"""

from __future__ import annotations

import pandas as pd

from . import config


class Recommender:
    name: str = "base"

    def fit(self, train: pd.DataFrame, movies: pd.DataFrame | None = None) -> "Recommender":
        raise NotImplementedError

    def recommend(self, user_id, k: int = config.TOP_K, exclude_seen: bool = True):
        raise NotImplementedError

    # -- shared helpers -------------------------------------------------
    def _record_seen(self, train: pd.DataFrame) -> None:
        """Cache the set of items each user touched in training (to exclude later)."""
        self._seen = train.groupby(config.USER_COL)[config.ITEM_COL].agg(set).to_dict()

    def seen(self, user_id) -> set:
        return getattr(self, "_seen", {}).get(user_id, set())

    def __repr__(self) -> str:  # pragma: no cover
        return f"<{type(self).__name__} name={self.name!r}>"
