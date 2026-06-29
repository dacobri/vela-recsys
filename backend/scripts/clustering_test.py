"""Find a segfault-free clustering path; cache embeddings for reuse."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from recsys import config, data  # noqa: E402
from recsys.semantic import embed_movies  # noqa: E402

emb_path = config.ARTIFACTS_DIR / "emb_small.npy"
ids_path = config.ARTIFACTS_DIR / "ids_small.npy"
if emb_path.exists():
    emb, ids = np.load(emb_path), np.load(ids_path)
else:
    r = data.filter_kcore(data.load_ratings("small"), 5, 5)
    m = data.build_movies_table("small", ratings=r)
    emb, ids = embed_movies(m)
    np.save(emb_path, emb)
    np.save(ids_path, ids)
print("emb", emb.shape, flush=True)

from sklearn.cluster import KMeans  # noqa: E402

km = KMeans(n_clusters=30, random_state=42, n_init=10).fit(emb)
print("kmeans_ok clusters=", len(set(km.labels_)), flush=True)

from recsys.clustering import knn_graph_edges  # noqa: E402

edges, weights = knn_graph_edges(emb, 15)
print("edges", len(edges), flush=True)

import igraph as ig  # noqa: E402

g = ig.Graph(n=len(emb), edges=edges, directed=False)
g.es["weight"] = weights
g.simplify(combine_edges="max")
print("graph", g.vcount(), g.ecount(), flush=True)
part = g.community_leiden(objective_function="modularity", weights="weight")
print("igraph_native_leiden_ok clusters=", len(part), flush=True)
print("CTEST_DONE", flush=True)
