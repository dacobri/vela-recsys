"""Build the unified movie table + interactions and persist them as Parquet.

Usage (from backend/):
    .venv/bin/python scripts/prepare_data.py --dataset ml-32m --imdb --genome
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from recsys import config, data  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="ml-32m")
    ap.add_argument("--imdb", action="store_true", help="merge IMDb basics + ratings")
    ap.add_argument("--genome", action="store_true", help="merge ml-25m genome top tags")
    args = ap.parse_args()

    out = config.PROCESSED_DIR / args.dataset
    out.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    print(f"loading ratings ({args.dataset}) ...")
    ratings = data.load_ratings(args.dataset)
    print(f"  {len(ratings):,} ratings in {time.time()-t0:.1f}s")

    print("building movie table ...")
    movies = data.build_movies_table(
        args.dataset, ratings=ratings, with_imdb=args.imdb, with_genome=args.genome
    )
    print(f"  {len(movies):,} movies, columns: {list(movies.columns)}")

    ratings.to_parquet(out / "interactions.parquet", index=False)
    movies.to_parquet(out / "movies.parquet", index=False)
    print(f"saved -> {out}  (total {time.time()-t0:.1f}s)")


if __name__ == "__main__":
    main()
