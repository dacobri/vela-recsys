"""Catalog cartography — the "movie galaxy".

Builds a k-nearest-neighbour graph over the semantic movie embeddings, runs the
Leiden community-detection algorithm to find clusters ("micro-genres / vibes"),
projects everything to 2D for the scatter view, and summarises each cluster by
its dominant genres and most-central movies. Inspired by the embedding +
community-detection approach in the reference reel, grounded in the course's
content/similarity material.

Robustness notes: real embeddings contain near-duplicate vectors, which produce
parallel edges / self-loops that crash igraph+leidenalg. We therefore build a
deduplicated, self-loop-free, strictly-positive-weight undirected graph and
``simplify`` it before partitioning.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import config


def knn_graph_edges(embeddings: np.ndarray, k: int = 15):
    """Deduplicated undirected top-k cosine kNN edges (embeddings L2-normalised)."""
    import faiss

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)
    sims, idx = index.search(embeddings, k + 1)        # +1: self is included
    seen: set[tuple[int, int]] = set()
    edges, weights = [], []
    for i in range(idx.shape[0]):
        for j, s in zip(idx[i], sims[i]):
            j = int(j)
            if j < 0 or j == i:
                continue
            a, b = (i, j) if i < j else (j, i)
            if (a, b) in seen:
                continue
            seen.add((a, b))
            edges.append((a, b))
            weights.append(max(float(s), 1e-6))         # strictly positive
    return edges, weights


def leiden_clusters(embeddings: np.ndarray, k: int = 15, resolution: float = 1.0,
                    seed: int = config.RANDOM_STATE) -> np.ndarray:
    """Cluster label per row via Leiden on the kNN graph (falls back to one
    cluster if the optional graph libs are unavailable)."""
    try:
        import igraph as ig
    except Exception:  # pragma: no cover
        return np.zeros(embeddings.shape[0], dtype=int)

    n = embeddings.shape[0]
    edges, weights = knn_graph_edges(embeddings, k)
    g = ig.Graph(n=n, edges=edges, directed=False)
    g.es["weight"] = weights
    g.simplify(combine_edges="max")                     # drop any residual multi-edges
    # igraph's native Leiden (the standalone `leidenalg` binary segfaults on this graph)
    part = g.community_leiden(objective_function="modularity", weights="weight",
                              resolution=resolution, n_iterations=-1)
    return np.asarray(part.membership, dtype=int)


def layout_2d(embeddings: np.ndarray, method: str = "pca",
              seed: int = config.RANDOM_STATE) -> np.ndarray:
    """2D projection for the galaxy scatter. 'pca' (default, fast, dependency-light),
    'tsne' (sklearn, nicer separation, slower) or 'umap'."""
    if method == "umap":
        import umap

        return umap.UMAP(n_components=2, metric="cosine",
                         random_state=seed).fit_transform(embeddings).astype(np.float32)
    if method == "tsne":
        from sklearn.decomposition import PCA
        from sklearn.manifold import TSNE

        pre = PCA(n_components=50, random_state=seed).fit_transform(embeddings)
        return TSNE(n_components=2, init="pca", random_state=seed).fit_transform(pre).astype(np.float32)
    from sklearn.decomposition import PCA

    return PCA(n_components=2, random_state=seed).fit_transform(embeddings).astype(np.float32)


def summarise_clusters(movies: pd.DataFrame, labels: np.ndarray, embeddings: np.ndarray,
                       top_genres: int = 3, reps: int = 8) -> list[dict]:
    """Per-cluster: size, dominant genres, and the most central representative movies."""
    df = movies.copy().reset_index(drop=True)
    df["cluster"] = labels
    out = []
    for cid, grp in df.groupby("cluster"):
        rows = grp.index.to_numpy()
        centroid = embeddings[rows].mean(axis=0)
        centroid /= (np.linalg.norm(centroid) or 1.0)
        central = rows[np.argsort(-(embeddings[rows] @ centroid))][:reps]
        genres = pd.Series([g for lst in grp["genres_list"] for g in lst]).value_counts()
        out.append({
            "cluster": int(cid),
            "size": int(len(grp)),
            "top_genres": genres.head(top_genres).index.tolist(),
            "representatives": [
                {"movieId": int(df.loc[r, config.ITEM_COL]),
                 "title": str(df.loc[r, config.TITLE_COL])}
                for r in central
            ],
        })
    return sorted(out, key=lambda c: -c["size"])


def build_galaxy(movies: pd.DataFrame, embeddings: np.ndarray, item_ids: np.ndarray,
                 k: int = 15, resolution: float = 1.0, layout: str = "pca") -> dict:
    """Full galaxy payload: per-movie cluster + 2D coords, plus cluster summaries."""
    movies = movies.set_index(config.ITEM_COL).loc[item_ids].reset_index()
    labels = leiden_clusters(embeddings, k=k, resolution=resolution)
    coords = layout_2d(embeddings, method=layout)
    points = [
        {"movieId": int(item_ids[i]), "title": str(movies.loc[i, config.TITLE_COL]),
         "x": float(coords[i, 0]), "y": float(coords[i, 1]), "cluster": int(labels[i])}
        for i in range(len(item_ids))
    ]
    return {
        "n_clusters": int(labels.max() + 1),
        "points": points,
        "clusters": summarise_clusters(movies, labels, embeddings),
    }
