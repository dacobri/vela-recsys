"""Train every recommender on one split and print the methods x metrics table.

Usage (from backend/):
    .venv/bin/python scripts/run_benchmark.py --dataset small --k 10
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # make `recsys` importable

import pandas as pd  # noqa: E402

from recsys import config, data  # noqa: E402
from recsys.baselines import DampedMean, MostPopular, RandomRec  # noqa: E402
from recsys.collaborative import ItemItemCF, UserUserCF  # noqa: E402
from recsys.content import ContentBased  # noqa: E402
from recsys.evaluation import run_benchmark  # noqa: E402
from recsys.matrix_factorization import MF  # noqa: E402


def build_models() -> dict:
    return {
        "random": RandomRec(),
        "popularity": MostPopular(),
        "damped_mean": DampedMean(),
        "content": ContentBased(),
        "itemcf": ItemItemCF(k=30),
        "usercf": UserUserCF(k=40),
        "mf": MF(n_factors=32, n_epochs=12),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="small")
    ap.add_argument("--k", type=int, default=config.TOP_K)
    ap.add_argument("--kcore", type=int, default=5)
    ap.add_argument("--max-users", type=int, default=None)
    args = ap.parse_args()

    t0 = time.time()
    ratings = data.load_ratings(args.dataset)
    ratings = data.filter_kcore(ratings, args.kcore, args.kcore)
    movies = data.build_movies_table(args.dataset, ratings=ratings)
    train, test = data.temporal_holdout(ratings, frac=0.2)

    print("=== dataset:", args.dataset, "===")
    print(data.describe(ratings))
    print(f"train={len(train):,}  test={len(test):,}  loaded in {time.time()-t0:.1f}s\n")

    models = build_models()
    for name, m in models.items():
        ts = time.time()
        m.fit(train, movies=movies)
        print(f"fit {name:<12} {time.time()-ts:5.1f}s")

    print("\nevaluating...")
    table = run_benchmark(models, train, test, movies, k=args.k, max_users=args.max_users)
    pd.set_option("display.width", 200, "display.max_columns", 20)
    print("\n" + table.round(4).to_string())

    out_dir = config.PROJECT_ROOT / "results"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"benchmark_{args.dataset}_k{args.k}.csv"
    table.to_csv(out)
    print(f"\nsaved -> {out}")


if __name__ == "__main__":
    main()
