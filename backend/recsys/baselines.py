"""Non-personalised baselines.

These set the floor every personalised method must beat on accuracy — and that
look poor on coverage/novelty, which is the point of "accuracy is not enough".
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import config
from .base import Recommender


def _topk_from_ranking(ranking, score_map, seen, k):
    out = []
    for item in ranking:
        if item in seen:
            continue
        out.append((int(item), float(score_map.get(item, 0.0))))
        if len(out) >= k:
            break
    return out


class MostPopular(Recommender):
    """Rank items by how many users rated them (training set)."""

    name = "popularity"

    def fit(self, train: pd.DataFrame, movies=None):
        self._record_seen(train)
        pop = train[config.ITEM_COL].value_counts()
        self.ranking_ = pop.index.to_numpy()
        mx = float(pop.iloc[0]) if len(pop) else 1.0
        self._score_map = {int(i): float(c) / mx for i, c in pop.items()}
        return self

    def recommend(self, user_id, k=config.TOP_K, exclude_seen=True):
        seen = self.seen(user_id) if exclude_seen else set()
        return _topk_from_ranking(self.ranking_, self._score_map, seen, k)


class DampedMean(Recommender):
    """Highest average rating with a Bayesian shrinkage toward the global mean
    (the IMDb weighted-rating formula):  WR = v/(v+m)*R + m/(v+m)*C.
    ``m`` (prior strength) defaults to a high quantile of the rating-count
    distribution so thinly-rated movies can't dominate the top."""

    name = "damped_mean"

    def __init__(self, m_quantile: float = 0.9, m: float | None = None):
        self.m_quantile = m_quantile
        self.m = m

    def fit(self, train: pd.DataFrame, movies=None):
        self._record_seen(train)
        g = train.groupby(config.ITEM_COL)[config.RATING_COL].agg(["count", "mean"])
        g.columns = ["v", "R"]
        C = float(train[config.RATING_COL].mean())
        m = self.m if self.m is not None else float(g["v"].quantile(self.m_quantile))
        wr = (g["v"] / (g["v"] + m)) * g["R"] + (m / (g["v"] + m)) * C
        wr = wr.sort_values(ascending=False)
        self.ranking_ = wr.index.to_numpy()
        self._score_map = {int(i): float(s) for i, s in wr.items()}
        self.m_, self.C_ = m, C
        return self

    def recommend(self, user_id, k=config.TOP_K, exclude_seen=True):
        seen = self.seen(user_id) if exclude_seen else set()
        return _topk_from_ranking(self.ranking_, self._score_map, seen, k)


class RandomRec(Recommender):
    """Random unseen items — the absolute floor baseline for evaluation."""

    name = "random"

    def __init__(self, random_state: int = config.RANDOM_STATE):
        self.random_state = random_state

    def fit(self, train: pd.DataFrame, movies=None):
        self._record_seen(train)
        self.items_ = train[config.ITEM_COL].unique()
        return self

    def recommend(self, user_id, k=config.TOP_K, exclude_seen=True):
        rng = np.random.default_rng(self.random_state + (abs(hash(user_id)) % 100000))
        seen = self.seen(user_id) if exclude_seen else set()
        cands = self.items_[~np.isin(self.items_, list(seen))] if seen else self.items_
        cands = cands.copy()
        rng.shuffle(cands)
        return [(int(i), 0.0) for i in cands[:k]]
