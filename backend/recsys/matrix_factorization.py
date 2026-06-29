"""Matrix factorization.

MF: the biased latent-factor model (Koren/Funk)  r̂(u,i) = μ + b_u + b_i + p_u·q_i,
trained by SGD with L2 regularization. Fully explainable and dependency-free —
ideal for the report's "explain your choices" requirement.

ALS: an optional implicit-feedback alternating-least-squares wrapper (via the
`implicit` library) for the large ml-32m scale path.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import config
from .base import Recommender
from .data import IndexMaps


class MF(Recommender):
    name = "mf"

    def __init__(self, n_factors: int = 32, n_epochs: int = 15, lr: float = 0.01,
                 reg: float = 0.05, random_state: int = config.RANDOM_STATE):
        self.n_factors = n_factors
        self.n_epochs = n_epochs
        self.lr = lr
        self.reg = reg
        self.random_state = random_state

    def fit(self, train: pd.DataFrame, movies=None):
        self._record_seen(train)
        self.maps = IndexMaps(train)
        u = train[config.USER_COL].map(self.maps.u2i).to_numpy()
        i = train[config.ITEM_COL].map(self.maps.i2i).to_numpy()
        r = train[config.RATING_COL].to_numpy(dtype=np.float64)
        n_u, n_i, f = self.maps.n_users, self.maps.n_items, self.n_factors

        rng = np.random.default_rng(self.random_state)
        P = rng.normal(0, 0.1, (n_u, f))
        Q = rng.normal(0, 0.1, (n_i, f))
        bu = np.zeros(n_u)
        bi = np.zeros(n_i)
        mu = float(r.mean())
        lr, reg = self.lr, self.reg
        order = np.arange(len(r))

        for _ in range(self.n_epochs):
            rng.shuffle(order)
            for n in order:
                uu, ii = u[n], i[n]
                err = r[n] - (mu + bu[uu] + bi[ii] + P[uu] @ Q[ii])
                bu[uu] += lr * (err - reg * bu[uu])
                bi[ii] += lr * (err - reg * bi[ii])
                puu = P[uu].copy()
                P[uu] += lr * (err * Q[ii] - reg * P[uu])
                Q[ii] += lr * (err * puu - reg * Q[ii])

        self.P, self.Q, self.bu, self.bi, self.mu = P, Q, bu, bi, mu
        return self

    def predict(self, user_id, item_id) -> float:
        ui = self.maps.u2i.get(user_id)
        ii = self.maps.i2i.get(int(item_id))
        if ui is None or ii is None:
            return self.mu
        val = self.mu + self.bu[ui] + self.bi[ii] + self.P[ui] @ self.Q[ii]
        return float(np.clip(val, 0.5, 5.0))

    def recommend(self, user_id, k=config.TOP_K, exclude_seen=True):
        ui = self.maps.u2i.get(user_id)
        if ui is None:
            return []
        scores = self.mu + self.bu[ui] + self.bi + self.Q @ self.P[ui]
        seen = self.seen(user_id) if exclude_seen else set()
        out = []
        for row in np.argsort(-scores):
            item = int(self.maps.items[row])
            if item in seen:
                continue
            out.append((item, float(np.clip(scores[row], 0.5, 5.0))))
            if len(out) >= k:
                break
        return out


class ALS(Recommender):
    """Implicit-feedback ALS (Hu/Koren) via the `implicit` library — for scale."""

    name = "als"

    def __init__(self, factors: int = 64, regularization: float = 0.05,
                 iterations: int = 20, alpha: float = 20.0):
        self.factors = factors
        self.regularization = regularization
        self.iterations = iterations
        self.alpha = alpha

    def fit(self, train: pd.DataFrame, movies=None):
        from implicit.als import AlternatingLeastSquares

        self._record_seen(train)
        self.maps = IndexMaps(train)
        from .data import build_user_item_matrix
        R = build_user_item_matrix(train, self.maps)        # users x items
        self._R = (R * self.alpha).tocsr()
        self.model = AlternatingLeastSquares(
            factors=self.factors, regularization=self.regularization,
            iterations=self.iterations, random_state=config.RANDOM_STATE,
        )
        self.model.fit(self._R, show_progress=False)
        return self

    def recommend(self, user_id, k=config.TOP_K, exclude_seen=True):
        ui = self.maps.u2i.get(user_id)
        if ui is None:
            return []
        ids, scores = self.model.recommend(
            ui, self._R[ui], N=k, filter_already_liked_items=exclude_seen
        )
        return [(int(self.maps.items[j]), float(s)) for j, s in zip(ids, scores)]
