"""Neighborhood collaborative filtering.

ItemItemCF: adjusted-cosine item similarity (ratings centered by user mean),
top-k neighbors, prediction  score(u,i) = Σ_j sim(i,j) r(u,j) / Σ_j |sim(i,j)|.

UserUserCF: mean-centered cosine (≈ Pearson over co-rated items), optional
Herlocker significance weighting, prediction
  score(u,i) = r̄_u + Σ_v sim(u,v)(r(v,i) - r̄_v) / Σ_v |sim(u,v)|.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize

from . import config
from .base import Recommender
from .data import IndexMaps, build_user_item_matrix


def _center_by_user(R: csr_matrix) -> tuple[csr_matrix, np.ndarray]:
    """Subtract each user's mean rating from their non-zero entries."""
    sums = np.asarray(R.sum(axis=1)).ravel()
    cnt = np.diff(R.indptr)
    means = np.divide(sums, np.maximum(cnt, 1))
    coo = R.tocoo()
    data = coo.data - means[coo.row]
    return csr_matrix((data, (coo.row, coo.col)), shape=R.shape), means


def _sparsify_topk(sim: np.ndarray, k: int) -> csr_matrix:
    """Keep the top-k entries per row (self already zeroed)."""
    n = sim.shape[0]
    rows, cols, vals = [], [], []
    kk = min(k, n - 1) if n > 1 else 0
    for r in range(n):
        if kk <= 0:
            continue
        idx = np.argpartition(sim[r], -kk)[-kk:]
        idx = idx[sim[r, idx] > 0]
        rows.extend([r] * len(idx))
        cols.extend(idx.tolist())
        vals.extend(sim[r, idx].tolist())
    return csr_matrix((vals, (rows, cols)), shape=sim.shape)


class ItemItemCF(Recommender):
    name = "itemcf"

    def __init__(self, k: int = 30, shrink: float = 2.5):
        self.k = k
        self.shrink = shrink  # denominator shrinkage: damps niche items with little neighbor support

    def fit(self, train: pd.DataFrame, movies=None):
        self._record_seen(train)
        self.maps = IndexMaps(train)
        R = build_user_item_matrix(train, self.maps)
        Rc, _ = _center_by_user(R)
        items = normalize(Rc.T.tocsr())                 # (items x users), L2 rows
        sim = cosine_similarity(items)                  # adjusted cosine
        np.fill_diagonal(sim, 0.0)
        self.S = _sparsify_topk(sim, self.k)
        self.Sabs = abs(self.S)
        self._user_ratings = {
            u: list(zip(g[config.ITEM_COL].to_numpy(), g[config.RATING_COL].to_numpy()))
            for u, g in train.groupby(config.USER_COL)
        }
        return self

    def _scores_from(self, rated):
        n_items = self.maps.n_items
        r = np.zeros(n_items, dtype=np.float64)
        mask = np.zeros(n_items, dtype=np.float64)
        for item, rating in rated:
            j = self.maps.i2i.get(int(item))
            if j is not None:
                r[j] = rating
                mask[j] = 1.0
        num = self.S @ r
        den = self.Sabs @ mask + self.shrink
        return np.divide(num, den, out=np.zeros_like(num), where=den > 0)

    def _scores(self, user_id):
        return self._scores_from(self._user_ratings.get(user_id, []))

    def _rank(self, scores, exclude, k):
        out = []
        for row in np.argsort(-scores):
            if scores[row] <= 0:
                break
            item = int(self.maps.items[row])
            if item in exclude:
                continue
            out.append((item, float(scores[row])))
            if len(out) >= k:
                break
        return out

    def recommend(self, user_id, k=config.TOP_K, exclude_seen=True):
        if user_id not in self.maps.u2i:
            return []
        return self._rank(self._scores(user_id), self.seen(user_id) if exclude_seen else set(), k)

    def recommend_from(self, rated, k=config.TOP_K, exclude_ids=None):
        exclude = {int(i) for i, _ in rated} | set(exclude_ids or [])
        return self._rank(self._scores_from(rated), exclude, k)


class UserUserCF(Recommender):
    name = "usercf"

    def __init__(self, k: int = 40, significance: int = 25):
        self.k = k
        self.significance = significance  # beta in min(co_rated, beta)/beta; 0 disables

    def fit(self, train: pd.DataFrame, movies=None):
        self._record_seen(train)
        self.maps = IndexMaps(train)
        R = build_user_item_matrix(train, self.maps)
        Rc, means = _center_by_user(R)
        self.Rc = Rc
        self.user_mean = means
        Un = normalize(Rc)                              # (users x items) L2 rows
        sim = cosine_similarity(Un)
        np.fill_diagonal(sim, 0.0)
        if self.significance:
            ind = (R > 0).astype(np.float32)
            co = (ind @ ind.T).toarray()                # co-rated counts
            sim = sim * np.minimum(co, self.significance) / self.significance
        self.SU = _sparsify_topk(sim, self.k)
        return self

    def recommend(self, user_id, k=config.TOP_K, exclude_seen=True):
        ui = self.maps.u2i.get(user_id)
        if ui is None:
            return []
        row = self.SU.getrow(ui)
        nbr, sims = row.indices, row.data
        if nbr.size == 0:
            return []
        nbr_mat = self.Rc[nbr]                           # (k x n_items) centered neighbour ratings
        num = np.asarray(nbr_mat.T.dot(sims)).ravel()    # Σ_v sim(u,v)(r_vi - r̄_v)
        support = np.asarray((nbr_mat != 0).sum(axis=0)).ravel()  # # neighbours who rated each item
        # Global denominator (constant per item) ranks by the weighted-sum of neighbour
        # deviations. Empirically this beats the per-item-normalised prediction for top-N:
        # per-item normalisation inflates items rated by a single low-sim neighbour (noise).
        den = float(np.abs(sims).sum()) or 1.0
        scores = np.where(support > 0, self.user_mean[ui] + num / den, -np.inf)
        seen = self.seen(user_id) if exclude_seen else set()
        out = []
        for r in np.argsort(-scores):
            if not np.isfinite(scores[r]):
                break
            item = int(self.maps.items[r])
            if item in seen:
                continue
            out.append((item, float(scores[r])))
            if len(out) >= k:
                break
        return out
