"""Resolve TMDB poster/backdrop/overview for every movie once, in parallel, and
cache to Parquet so the live API enriches recommendations from memory (no network
per request). Run offline whenever the dataset changes."""
from __future__ import annotations

import concurrent.futures as cf
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from app import tmdb  # noqa: E402
from recsys import config, data  # noqa: E402

DATASET = sys.argv[1] if len(sys.argv) > 1 else "small"
movies = data.build_movies_table(DATASET, ratings=data.load_ratings(DATASET))
pairs = [(int(m), int(t)) for m, t in zip(movies[config.ITEM_COL], movies["tmdbId"])
         if pd.notna(t)]
print(f"resolving {len(pairs)} posters for '{DATASET}' ...", flush=True)


def fetch(mt):
    mid, tid = mt
    info = tmdb.fetch_movie(tid) or {}
    return {"movieId": mid, "poster_url": info.get("poster_url"),
            "backdrop_url": info.get("backdrop_url"), "overview": info.get("overview")}


rows = []
with cf.ThreadPoolExecutor(max_workers=24) as ex:
    for i, r in enumerate(ex.map(fetch, pairs), 1):
        rows.append(r)
        if i % 1000 == 0:
            print(f"  {i}/{len(pairs)}", flush=True)

df = pd.DataFrame(rows)
out = config.ARTIFACTS_DIR / f"posters_{DATASET}.parquet"
df.to_parquet(out, index=False)
print(f"saved {out}  ({df['poster_url'].notna().sum()}/{len(df)} have posters)", flush=True)
print("POSTERS_DONE", flush=True)
