"""Data loading, merging, splitting and matrix construction.

Loads MovieLens (ratings/movies/tags/links), optionally enriches the movie table
with IMDb (basics + ratings) and the MovieLens tag genome (from ml-25m), and
produces leakage-free train/test splits plus sparse user-item matrices for the
collaborative and matrix-factorisation models.
"""

from __future__ import annotations

import re

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix

from . import config

_YEAR_RE = re.compile(r"\((\d{4})\)\s*$")


# --------------------------------------------------------------------------- #
# raw loaders                                                                  #
# --------------------------------------------------------------------------- #

def load_ratings(dataset: str | None = None) -> pd.DataFrame:
    path = config.dataset_dir(dataset) / "ratings.csv"
    df = pd.read_csv(
        path,
        dtype={config.USER_COL: "int64", config.ITEM_COL: "int64",
               config.RATING_COL: "float32", config.TS_COL: "int64"},
    )
    return df


def load_movies(dataset: str | None = None) -> pd.DataFrame:
    path = config.dataset_dir(dataset) / "movies.csv"
    df = pd.read_csv(path)
    df["year"] = df[config.TITLE_COL].str.extract(_YEAR_RE)[0].astype("Int64")
    df["title_clean"] = df[config.TITLE_COL].str.replace(_YEAR_RE, "", regex=True).str.strip()
    df["genres_list"] = df[config.GENRES_COL].apply(_parse_genres)
    return df


def _parse_genres(g: str) -> list[str]:
    if not isinstance(g, str) or g == config.NO_GENRES:
        return []
    return [t for t in g.split("|") if t]


def load_links(dataset: str | None = None) -> pd.DataFrame:
    path = config.dataset_dir(dataset) / "links.csv"
    df = pd.read_csv(path, dtype={"movieId": "int64", "imdbId": "Int64", "tmdbId": "Int64"})
    # MovieLens stores imdbId as a bare int; IMDb's tconst is 'tt' + zero-pad(>=7).
    df["tconst"] = df["imdbId"].apply(
        lambda x: f"tt{int(x):07d}" if pd.notna(x) else None
    )
    return df


def load_tags(dataset: str | None = None) -> pd.DataFrame | None:
    path = config.dataset_dir(dataset) / "tags.csv"
    if not path.exists():
        return None
    return pd.read_csv(path)


def load_imdb() -> pd.DataFrame | None:
    """IMDb basics (movie titles + runtime/year) joined with global IMDb ratings."""
    if not config.IMDB_BASICS.exists():
        return None
    basics = pd.read_csv(
        config.IMDB_BASICS, sep="\t", na_values="\\N",
        usecols=["tconst", "titleType", "startYear", "runtimeMinutes", "genres"],
        dtype={"tconst": "string", "titleType": "string", "startYear": "Int64",
               "runtimeMinutes": "Int64", "genres": "string"},
    )
    basics = basics[basics["titleType"] == "movie"].drop(columns="titleType")
    if config.IMDB_RATINGS.exists():
        rat = pd.read_csv(
            config.IMDB_RATINGS, sep="\t", na_values="\\N",
            dtype={"tconst": "string", "averageRating": "float32", "numVotes": "Int64"},
        )
        basics = basics.merge(rat, on="tconst", how="left")
    return basics.rename(columns={
        "startYear": "imdb_year", "runtimeMinutes": "imdb_runtime",
        "genres": "imdb_genres", "averageRating": "imdb_rating", "numVotes": "imdb_votes",
    })


def load_genome_top_tags(top_n: int = 15) -> dict[int, list[str]] | None:
    """Top-N relevance-weighted genome tags per movie (from ml-25m)."""
    scores = config.GENOME_DIR / "genome-scores.csv"
    tags = config.GENOME_DIR / "genome-tags.csv"
    if not scores.exists() or not tags.exists():
        return None
    tag_map = pd.read_csv(tags).set_index("tagId")["tag"].to_dict()
    s = pd.read_csv(scores, dtype={"movieId": "int32", "tagId": "int16", "relevance": "float32"})
    s = s.sort_values("relevance", ascending=False)
    top = s.groupby("movieId", sort=False).head(top_n)
    out: dict[int, list[str]] = {}
    for mid, grp in top.groupby("movieId", sort=False):
        out[int(mid)] = [tag_map[t] for t in grp["tagId"].tolist()]
    return out


# --------------------------------------------------------------------------- #
# unified movie table                                                          #
# --------------------------------------------------------------------------- #

def build_movies_table(
    dataset: str | None = None,
    *,
    ratings: pd.DataFrame | None = None,
    with_imdb: bool = False,
    with_genome: bool = False,
) -> pd.DataFrame:
    """Canonical item table: MovieLens spine left-joined with links/IMDb/genome
    and popularity stats. External enrichments are optional (off for fast dev)."""
    movies = load_movies(dataset)
    links = load_links(dataset)
    movies = movies.merge(links, on=config.ITEM_COL, how="left")

    if with_imdb:
        imdb = load_imdb()
        if imdb is not None:
            movies = movies.merge(imdb, on="tconst", how="left")

    if with_genome:
        top = load_genome_top_tags()
        if top is not None:
            movies["genome_top_tags"] = movies[config.ITEM_COL].map(top)

    if ratings is not None:
        movies = add_popularity(movies, ratings)
    return movies


def add_popularity(movies: pd.DataFrame, ratings: pd.DataFrame) -> pd.DataFrame:
    stats = ratings.groupby(config.ITEM_COL)[config.RATING_COL].agg(
        n_ratings="count", mean_rating="mean"
    )
    return movies.merge(stats, on=config.ITEM_COL, how="left").fillna(
        {"n_ratings": 0, "mean_rating": 0.0}
    )


# --------------------------------------------------------------------------- #
# filtering & splitting                                                        #
# --------------------------------------------------------------------------- #

def filter_kcore(ratings: pd.DataFrame, k_user: int = 5, k_item: int = 5) -> pd.DataFrame:
    """Iteratively drop users/items with fewer than k interactions until stable."""
    df = ratings
    while True:
        n0 = len(df)
        ic = df[config.ITEM_COL].value_counts()
        df = df[df[config.ITEM_COL].isin(ic[ic >= k_item].index)]
        uc = df[config.USER_COL].value_counts()
        df = df[df[config.USER_COL].isin(uc[uc >= k_user].index)]
        if len(df) == n0:
            return df.reset_index(drop=True)


def temporal_split(ratings: pd.DataFrame, test_frac: float = 0.2,
                   warm_only: bool = True) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Global temporal split: train on the earliest (1-test_frac), test on the most
    recent test_frac of interactions (by timestamp). Avoids the look-ahead leakage
    a random split introduces. When warm_only, test is restricted to users/items
    that appear in train (so CF/MF can score them)."""
    df = ratings.sort_values(config.TS_COL, kind="stable")
    cut = int(len(df) * (1 - test_frac))
    train = df.iloc[:cut].reset_index(drop=True)
    test = df.iloc[cut:].reset_index(drop=True)
    if warm_only:
        users = set(train[config.USER_COL].unique())
        items = set(train[config.ITEM_COL].unique())
        test = test[test[config.USER_COL].isin(users) & test[config.ITEM_COL].isin(items)]
        test = test.reset_index(drop=True)
    return train, test


def leave_last_n_split(ratings: pd.DataFrame, n: int = 1) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Per-user: hold out each user's n most recent interactions as test."""
    df = ratings.sort_values([config.USER_COL, config.TS_COL], kind="stable")
    grp = df.groupby(config.USER_COL, sort=False)
    test = grp.tail(n)
    train = df.drop(test.index).reset_index(drop=True)
    return train, test.reset_index(drop=True)


def temporal_holdout(ratings: pd.DataFrame, frac: float = 0.2,
                     min_train: int = 5) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Per-user temporal hold-out: each user's most recent ``frac`` of ratings go to
    test, the rest to train (keeping >= ``min_train`` per user in train). Leakage-free
    per user and — unlike a global temporal cut — evaluates every active user, which
    makes the top-N comparison stable. Vectorised, so it scales to ml-32m."""
    df = ratings.sort_values([config.USER_COL, config.TS_COL], kind="stable").copy()
    grp = df.groupby(config.USER_COL, sort=False)
    rank = grp.cumcount(ascending=False)                     # 0 == most recent
    n = grp[config.ITEM_COL].transform("size").to_numpy()
    n_test = np.floor(n * frac).astype(int)
    n_test = np.minimum(n_test, np.maximum(n - min_train, 0))
    test_mask = rank.to_numpy() < n_test
    test = df[test_mask].reset_index(drop=True)
    train = df[~test_mask].reset_index(drop=True)
    return train, test


# --------------------------------------------------------------------------- #
# sparse matrices & index maps                                                 #
# --------------------------------------------------------------------------- #

class IndexMaps:
    """Bidirectional user/item id <-> contiguous index maps."""

    def __init__(self, ratings: pd.DataFrame):
        self.users = np.sort(ratings[config.USER_COL].unique())
        self.items = np.sort(ratings[config.ITEM_COL].unique())
        self.u2i = {u: i for i, u in enumerate(self.users)}
        self.i2i = {m: j for j, m in enumerate(self.items)}

    @property
    def n_users(self) -> int:
        return len(self.users)

    @property
    def n_items(self) -> int:
        return len(self.items)


def build_user_item_matrix(ratings: pd.DataFrame, maps: IndexMaps) -> csr_matrix:
    """Sparse (n_users x n_items) matrix of ratings."""
    rows = ratings[config.USER_COL].map(maps.u2i).to_numpy()
    cols = ratings[config.ITEM_COL].map(maps.i2i).to_numpy()
    vals = ratings[config.RATING_COL].to_numpy(dtype=np.float32)
    return csr_matrix((vals, (rows, cols)), shape=(maps.n_users, maps.n_items))


def describe(ratings: pd.DataFrame, movies: pd.DataFrame | None = None) -> dict:
    """Basic dataset statistics for EDA."""
    n_u = ratings[config.USER_COL].nunique()
    n_i = ratings[config.ITEM_COL].nunique()
    n_r = len(ratings)
    return {
        "n_users": int(n_u),
        "n_items": int(n_i),
        "n_ratings": int(n_r),
        "sparsity": 1 - n_r / (n_u * n_i),
        "rating_mean": float(ratings[config.RATING_COL].mean()),
        "ratings_per_user": n_r / n_u,
        "ratings_per_item": n_r / n_i,
    }
