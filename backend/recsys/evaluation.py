"""Offline evaluation: turn a fitted model + a held-out test set into a row of
accuracy and beyond-accuracy metrics, and benchmark many models into one table.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix

from . import config, metrics
from .base import Recommender


def relevant_by_user(test: pd.DataFrame, threshold: float = config.REL_THRESHOLD) -> dict:
    """Each user's held-out relevant items (rating >= threshold)."""
    rel = test[test[config.RATING_COL] >= threshold]
    return {u: set(g[config.ITEM_COL].to_numpy())
            for u, g in rel.groupby(config.USER_COL)}


def build_genre_features(movies: pd.DataFrame):
    """Multi-hot genre matrix + movieId->row index, for intra-list diversity."""
    genres = sorted({g for lst in movies["genres_list"] for g in lst})
    gi = {g: j for j, g in enumerate(genres)}
    rows, cols = [], []
    ids = movies[config.ITEM_COL].to_numpy()
    for r, lst in enumerate(movies["genres_list"]):
        for g in lst:
            rows.append(r)
            cols.append(gi[g])
    M = csr_matrix((np.ones(len(rows)), (rows, cols)), shape=(len(ids), len(genres)))
    return M, {int(m): r for r, m in enumerate(ids)}


class EvalContext:
    """Shared structures computed once and reused for every model."""

    def __init__(self, train: pd.DataFrame, test: pd.DataFrame, movies: pd.DataFrame,
                 threshold: float = config.REL_THRESHOLD):
        self.relevant = relevant_by_user(test, threshold)
        self.popularity = train[config.ITEM_COL].value_counts().to_dict()
        self.n_users = train[config.USER_COL].nunique()
        self.catalog = set(train[config.ITEM_COL].unique())
        self.genre_features, self.genre_index = build_genre_features(movies)


def evaluate_model(model: Recommender, ctx: EvalContext, k: int = config.TOP_K,
                   max_users: int | None = None) -> dict:
    users = list(ctx.relevant.keys())
    if max_users and len(users) > max_users:
        rng = np.random.default_rng(config.RANDOM_STATE)
        users = list(rng.choice(users, size=max_users, replace=False))

    P = R = F = N = M = MR = H = 0.0
    div_vals: list[float] = []
    all_recs: list[list] = []
    n = 0
    for u in users:
        rel = ctx.relevant[u]
        if not rel:
            continue
        n += 1                                    # every user with held-out relevant items counts
        recs = [it for it, _ in model.recommend(u, k=k, exclude_seen=True)]
        if not recs:                              # abstention scores 0 (fair across methods)
            continue
        P += metrics.precision_at_k(recs, rel, k)
        R += metrics.recall_at_k(recs, rel, k)
        F += metrics.f1_at_k(recs, rel, k)
        N += metrics.ndcg_at_k(recs, rel, k)
        M += metrics.average_precision_at_k(recs, rel, k)
        MR += metrics.reciprocal_rank(recs, rel, k)
        H += metrics.hit_rate_at_k(recs, rel, k)
        div_vals.append(metrics.intra_list_diversity(recs, ctx.genre_features, ctx.genre_index))
        all_recs.append(recs)

    n = max(n, 1)
    return {
        "precision@k": P / n,
        "recall@k": R / n,
        "f1@k": F / n,
        "ndcg@k": N / n,
        "map@k": M / n,
        "mrr": MR / n,
        "hit_rate@k": H / n,
        "coverage": metrics.catalog_coverage(all_recs, ctx.catalog),
        "novelty": metrics.novelty(all_recs, ctx.popularity, ctx.n_users),
        "diversity": float(np.mean(div_vals)) if div_vals else 0.0,
        "personalization": metrics.personalization(all_recs),
        "arp": metrics.average_recommendation_popularity(all_recs, ctx.popularity, ctx.n_users),
        "gini": metrics.gini_exposure(all_recs, ctx.catalog),
        "n_eval_users": n,
    }


def evaluate_per_user(model: Recommender, ctx: EvalContext, k: int = config.TOP_K,
                      users: list | None = None) -> pd.DataFrame:
    """Per-user metric vectors (rows=users) — the basis for CIs + paired tests.
    Pass the SAME `users` list to every model so comparisons stay paired. Users
    with held-out relevant items but empty recommendations score 0 (not dropped)."""
    if users is None:
        users = [u for u, rel in ctx.relevant.items() if rel]
    rows = []
    for u in users:
        rel = ctx.relevant.get(u)
        if not rel:
            continue
        recs = [it for it, _ in model.recommend(u, k=k, exclude_seen=True)]
        rows.append({
            "user": u,
            "precision": metrics.precision_at_k(recs, rel, k) if recs else 0.0,
            "recall": metrics.recall_at_k(recs, rel, k) if recs else 0.0,
            "ndcg": metrics.ndcg_at_k(recs, rel, k) if recs else 0.0,
            "map": metrics.average_precision_at_k(recs, rel, k) if recs else 0.0,
            "mrr": metrics.reciprocal_rank(recs, rel, k) if recs else 0.0,
            "hit": metrics.hit_rate_at_k(recs, rel, k) if recs else 0.0,
        })
    return pd.DataFrame(rows).set_index("user")


def run_benchmark(models: dict[str, Recommender], train: pd.DataFrame, test: pd.DataFrame,
                  movies: pd.DataFrame, k: int = config.TOP_K,
                  max_users: int | None = None) -> pd.DataFrame:
    ctx = EvalContext(train, test, movies)
    rows = []
    for name, model in models.items():
        res = evaluate_model(model, ctx, k=k, max_users=max_users)
        res = {"method": name, **res}
        rows.append(res)
    df = pd.DataFrame(rows).set_index("method")
    return df.sort_values("ndcg@k", ascending=False)
