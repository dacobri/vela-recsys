"""Evaluation metrics for top-N recommendation.

Two groups:
  * accuracy / ranking — Precision@K, Recall@K, F1@K, HitRate@K, MAP@K, MRR, NDCG@K
    (+ RMSE/MAE for rating prediction).
  * beyond-accuracy — catalog coverage, intra-list diversity, novelty, personalization.

All list-based functions take a ranked list of recommended item ids and a set of
relevant item ids, and are deliberately simple/pure so they can be unit-tested
against hand-computed values. Aggregation across users happens in ``evaluation.py``.

Conventions (stated for the report):
  * relevance is binary: an item is relevant if its held-out rating >= threshold.
  * Recall@K = hits / |relevant|  (standard); IDCG is truncated at min(K, |relevant|).
  * metrics are macro-averaged (per user, then mean over users).
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

import numpy as np

# --------------------------------------------------------------------------- #
# ranking / accuracy metrics (per user)                                        #
# --------------------------------------------------------------------------- #

def precision_at_k(recommended: Sequence, relevant: Iterable, k: int) -> float:
    if k <= 0:
        return 0.0
    rel = set(relevant)
    rec_k = list(recommended)[:k]
    hits = sum(1 for i in rec_k if i in rel)
    return hits / k


def recall_at_k(recommended: Sequence, relevant: Iterable, k: int) -> float:
    rel = set(relevant)
    if not rel:
        return 0.0
    rec_k = list(recommended)[:k]
    hits = sum(1 for i in rec_k if i in rel)
    return hits / len(rel)


def f1_at_k(recommended: Sequence, relevant: Iterable, k: int) -> float:
    p = precision_at_k(recommended, relevant, k)
    r = recall_at_k(recommended, relevant, k)
    return 0.0 if (p + r) == 0 else 2 * p * r / (p + r)


def hit_rate_at_k(recommended: Sequence, relevant: Iterable, k: int) -> float:
    rel = set(relevant)
    return 1.0 if any(i in rel for i in list(recommended)[:k]) else 0.0


def average_precision_at_k(recommended: Sequence, relevant: Iterable, k: int) -> float:
    """AP@K — mean of precision@i at each rank i where a relevant item appears."""
    rel = set(relevant)
    if not rel:
        return 0.0
    score, hits = 0.0, 0
    for idx, item in enumerate(list(recommended)[:k], start=1):
        if item in rel:
            hits += 1
            score += hits / idx
    return score / min(len(rel), k)


def reciprocal_rank(recommended: Sequence, relevant: Iterable, k: int) -> float:
    """1 / rank of the first relevant item (0 if none in top-K)."""
    rel = set(relevant)
    for idx, item in enumerate(list(recommended)[:k], start=1):
        if item in rel:
            return 1.0 / idx
    return 0.0


def dcg_at_k(gains: Sequence[float], k: int) -> float:
    g = np.asarray(list(gains)[:k], dtype=float)
    if g.size == 0:
        return 0.0
    discounts = 1.0 / np.log2(np.arange(2, g.size + 2))
    return float((g * discounts).sum())


def ndcg_at_k(recommended: Sequence, relevant: Iterable, k: int) -> float:
    rel = set(relevant)
    if not rel:
        return 0.0
    gains = [1.0 if i in rel else 0.0 for i in list(recommended)[:k]]
    dcg = dcg_at_k(gains, k)
    ideal = [1.0] * min(len(rel), k)        # IDCG truncated at the same K
    idcg = dcg_at_k(ideal, k)
    return 0.0 if idcg == 0 else dcg / idcg


# --------------------------------------------------------------------------- #
# rating-prediction metrics                                                    #
# --------------------------------------------------------------------------- #

def rmse(preds: Sequence[float], truths: Sequence[float]) -> float:
    p, t = np.asarray(preds, float), np.asarray(truths, float)
    return float(np.sqrt(np.mean((p - t) ** 2))) if p.size else 0.0


def mae(preds: Sequence[float], truths: Sequence[float]) -> float:
    p, t = np.asarray(preds, float), np.asarray(truths, float)
    return float(np.mean(np.abs(p - t))) if p.size else 0.0


# --------------------------------------------------------------------------- #
# beyond-accuracy metrics (aggregate over all users' recommendation lists)     #
# --------------------------------------------------------------------------- #

def catalog_coverage(all_recommended: Iterable[Iterable], catalog: Iterable) -> float:
    """Fraction of the catalog that appears in at least one recommendation list."""
    cat = set(catalog)
    if not cat:
        return 0.0
    rec = set()
    for lst in all_recommended:
        rec.update(lst)
    return len(rec & cat) / len(cat)


def novelty(all_recommended: Iterable[Iterable], popularity: dict, n_users: int) -> float:
    """Mean self-information  -log2(p(item))  over all recommended items.

    popularity: item -> number of users who interacted with it (training set).
    Rare items score higher; a list of blockbusters scores low.
    """
    if n_users <= 0:
        return 0.0
    vals: list[float] = []
    for lst in all_recommended:
        for item in lst:
            p = popularity.get(item, 0) / n_users
            if p > 0:
                vals.append(-np.log2(p))
    return float(np.mean(vals)) if vals else 0.0


def intra_list_diversity(rec_list: Sequence, feature_matrix, item_index: dict) -> float:
    """1 - mean pairwise cosine similarity among recommended items.

    feature_matrix: (n_items x d) array/sparse of item feature vectors (e.g. genres).
    item_index: movieId -> row index in feature_matrix.
    """
    rows = [item_index[i] for i in rec_list if i in item_index]
    if len(rows) < 2:
        return 0.0
    from sklearn.metrics.pairwise import cosine_similarity

    sub = feature_matrix[rows]
    sim = cosine_similarity(sub)
    n = sim.shape[0]
    iu = np.triu_indices(n, k=1)
    mean_sim = float(sim[iu].mean()) if iu[0].size else 0.0
    return 1.0 - mean_sim


def personalization(all_recommended: list[list]) -> float:
    """1 - mean pairwise overlap (cosine on binary indicator vectors) between users'
    lists. Near 1 => users receive different recommendations."""
    lists = [lst for lst in all_recommended if lst]
    if len(lists) < 2:
        return 0.0
    items = sorted({i for lst in lists for i in lst})
    idx = {it: j for j, it in enumerate(items)}
    from scipy.sparse import lil_matrix
    from sklearn.metrics.pairwise import cosine_similarity

    M = lil_matrix((len(lists), len(items)), dtype=float)
    for r, lst in enumerate(lists):
        for it in lst:
            M[r, idx[it]] = 1.0
    sim = cosine_similarity(M.tocsr())
    n = sim.shape[0]
    iu = np.triu_indices(n, k=1)
    return 1.0 - float(sim[iu].mean())
