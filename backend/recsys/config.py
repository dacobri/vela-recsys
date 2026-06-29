"""Project paths, dataset registry and shared constants.

Centralising these means every module, script and the FastAPI app read the same
column names, thresholds and locations. Override the active dataset with the
``VELA_DATASET`` environment variable ("small" for fast dev, "ml-32m" for scale).
"""

from __future__ import annotations

import os
from pathlib import Path

# vela/backend/recsys/config.py -> parents[2] == vela/
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
DEPLOY_DIR = DATA_DIR / "deploy"          # subsampled artifacts shipped to the live demo
ARTIFACTS_DIR = BACKEND_DIR / "artifacts"  # models / embeddings / indexes

for _d in (PROCESSED_DIR, DEPLOY_DIR, ARTIFACTS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ---- dataset registry ----
DATASETS = {
    "small": RAW_DIR / "ml-latest-small",   # 100k ratings, fast dev / CI
    "ml-32m": RAW_DIR / "ml-32m",           # 32M ratings, stable, for offline evaluation
}
GENOME_DIR = RAW_DIR / "ml-25m"             # genome-scores.csv / genome-tags.csv live here
IMDB_BASICS = RAW_DIR / "imdb_title_basics.tsv.gz"
IMDB_RATINGS = RAW_DIR / "imdb_title_ratings.tsv.gz"


def dataset_dir(name: str | None = None) -> Path:
    name = name or os.environ.get("VELA_DATASET", "small")
    if name not in DATASETS:
        raise ValueError(f"Unknown dataset {name!r}; choose from {list(DATASETS)}")
    return DATASETS[name]


# ---- MovieLens column names ----
USER_COL = "userId"
ITEM_COL = "movieId"
RATING_COL = "rating"
TS_COL = "timestamp"
TITLE_COL = "title"
GENRES_COL = "genres"

# ---- evaluation / model defaults ----
TOP_K = 10
RANDOM_STATE = 42
REL_THRESHOLD = 4.0        # a held-out rating >= this counts as "relevant"
NO_GENRES = "(no genres listed)"
