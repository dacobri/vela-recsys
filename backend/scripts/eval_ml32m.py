"""Scale evaluation on MovieLens ml-32m (32M ratings).

The pure-Python neighbourhood (user-user, O(users^2)) and SGD-MF methods don't
scale to 32M ratings in a prototype, so we evaluate the SCALABLE methods
(popularity, damped-mean, content, item-CF, implicit ALS) on a documented dense
subset — every filtering step is logged (no silent truncation) — with the same
bootstrap-CI + paired-test rigor as the full small-dataset comparison.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from recsys import config, data, stats  # noqa: E402
from recsys.baselines import DampedMean, MostPopular, RandomRec  # noqa: E402
from recsys.collaborative import ItemItemCF  # noqa: E402
from recsys.content import ContentBased  # noqa: E402
from recsys.evaluation import EvalContext, evaluate_model, evaluate_per_user  # noqa: E402
from recsys.matrix_factorization import ALS  # noqa: E402

ITEM_MIN, USER_MIN = 100, 20
MAX_ITEMS, MAX_USERS = 6000, 30000
EVAL_USERS = 4000
ACC = ["precision", "recall", "ndcg", "map", "mrr", "hit"]


def subset(ratings: pd.DataFrame) -> pd.DataFrame:
    log = lambda m, df: print(f"  {m}: {len(df):,} ratings, "  # noqa: E731
                              f"{df[config.USER_COL].nunique():,} users, "
                              f"{df[config.ITEM_COL].nunique():,} items", flush=True)
    log("raw", ratings)
    ic = ratings[config.ITEM_COL].value_counts()
    ratings = ratings[ratings[config.ITEM_COL].isin(ic[ic >= ITEM_MIN].index)]
    log(f"items>={ITEM_MIN}", ratings)
    uc = ratings[config.USER_COL].value_counts()
    ratings = ratings[ratings[config.USER_COL].isin(uc[uc >= USER_MIN].index)]
    log(f"users>={USER_MIN}", ratings)
    ic = ratings[config.ITEM_COL].value_counts()
    if ic.size > MAX_ITEMS:
        ratings = ratings[ratings[config.ITEM_COL].isin(ic.head(MAX_ITEMS).index)]
        log(f"top {MAX_ITEMS} items", ratings)
    uc = ratings[config.USER_COL].value_counts()
    if uc.size > MAX_USERS:
        rng = np.random.default_rng(config.RANDOM_STATE)
        keep = rng.choice(uc.index.to_numpy(), size=MAX_USERS, replace=False)
        ratings = ratings[ratings[config.USER_COL].isin(keep)]
        log(f"sample {MAX_USERS} users", ratings)
    return data.filter_kcore(ratings, USER_MIN, ITEM_MIN // 2).reset_index(drop=True)


def main():
    t0 = time.time()
    print("loading ml-32m ratings ...", flush=True)
    ratings = data.load_ratings("ml-32m")
    ratings = ratings.astype({config.USER_COL: "int32", config.ITEM_COL: "int32"})
    print(f"  loaded {len(ratings):,} in {time.time()-t0:.0f}s", flush=True)

    sub = subset(ratings)
    del ratings
    movies_all = data.build_movies_table("ml-32m", ratings=sub)
    movies = movies_all[movies_all[config.ITEM_COL].isin(sub[config.ITEM_COL].unique())].reset_index(drop=True)
    train, test = data.temporal_holdout(sub, frac=0.2)
    ctx = EvalContext(train, test, movies)
    users = [u for u, rel in ctx.relevant.items() if rel]
    if len(users) > EVAL_USERS:
        rng = np.random.default_rng(config.RANDOM_STATE)
        users = list(rng.choice(users, size=EVAL_USERS, replace=False))
    print(f"subset ready: train={len(train):,} test={len(test):,} eval_users={len(users)}\n", flush=True)

    models = {
        "random": RandomRec(), "popularity": MostPopular(), "damped_mean": DampedMean(),
        "content": ContentBased(), "itemcf": ItemItemCF(k=30, shrink=2.5),
        "als": ALS(factors=64, iterations=20, alpha=20.0),
    }
    per_user, agg = {}, {}
    for name, model in models.items():
        ts = time.time()
        model.fit(train, movies)
        per_user[name] = evaluate_per_user(model, ctx, k=10, users=users)
        agg[name] = evaluate_model(model, ctx, k=10, max_users=EVAL_USERS)
        print(f"  {name:<11} fit+eval {time.time()-ts:5.0f}s", flush=True)

    rows = []
    for name in models:
        df = per_user[name]
        row = {"method": name}
        for m in ACC:
            mean, lo, hi = stats.bootstrap_ci(df[m].to_numpy())
            row[m] = round(mean, 4)
            row[f"{m}_CI"] = f"[{lo:.4f}, {hi:.4f}]"
        row.update({c: round(agg[name][c], 4) for c in ["coverage", "novelty", "diversity"]})
        rows.append(row)
    table = pd.DataFrame(rows).set_index("method").sort_values("ndcg", ascending=False)
    best = table.index[0]
    others = [m for m in table.index if m != best]
    tests = {m: stats.paired_test(per_user[best]["ndcg"].to_numpy(),
                                  per_user[m]["ndcg"].to_numpy()) for m in others}
    sig, adj = stats.holm_bonferroni([tests[m]["t_p"] for m in others])
    sig_map = {m: p for m, p in zip(others, adj)}

    out = config.PROJECT_ROOT / "results"
    out.mkdir(exist_ok=True)
    table.to_csv(out / "eval_ml32m.csv")
    lines = [f"# Scale evaluation — ml-32m subset (k=10, {len(users)} eval users)\n",
             f"Subset: items>={ITEM_MIN} ratings, users>={USER_MIN}, capped at "
             f"{MAX_ITEMS} items / {MAX_USERS} users. train={len(train):,} test={len(test):,}.\n",
             f"Best by NDCG: **{best}** (paired t-test on per-user NDCG vs best, Holm-corrected).\n",
             "| method | P@10 | Recall@10 | NDCG@10 (95% CI) | MAP | MRR | Coverage | Novelty | vs best |",
             "|---|---|---|---|---|---|---|---|---|"]
    for name in table.index:
        r = table.loc[name]
        vs = "— (best)" if name == best else f"{stats.stars(sig_map[name])} (p={sig_map[name]:.3g})"
        lines.append(f"| {name} | {r['precision']:.4f} | {r['recall']:.4f} | "
                     f"{r['ndcg']:.4f} {r['ndcg_CI']} | {r['map']:.4f} | {r['mrr']:.4f} | "
                     f"{r['coverage']:.3f} | {r['novelty']:.2f} | {vs} |")
    (out / "eval_ml32m.md").write_text("\n".join(lines))
    print("\n".join(lines))
    print(f"\ntotal {time.time()-t0:.0f}s — saved -> {out}")
    print("EVAL_ML32M_DONE")


if __name__ == "__main__":
    main()
