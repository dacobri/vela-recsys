"""Smoke-test the modern layer: semantic embeddings + FAISS, Leiden galaxy, LLM."""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from recsys import data  # noqa: E402
from recsys.clustering import build_galaxy  # noqa: E402
from recsys.llm import get_llm  # noqa: E402
from recsys.semantic import SemanticRecommender, embed_movies  # noqa: E402

t0 = time.time()
ratings = data.filter_kcore(data.load_ratings("small"), 5, 5)
movies = data.build_movies_table("small", ratings=ratings)
train, _ = data.temporal_holdout(ratings, frac=0.2)
print(f"data ready {time.time()-t0:.1f}s; movies={len(movies)}")

t0 = time.time()
emb, ids = embed_movies(movies)
print(f"embedded {emb.shape} in {time.time()-t0:.1f}s")

sem = SemanticRecommender().fit(train, movies, embeddings=emb)
u = int(train["userId"].iloc[0])
recs = sem.recommend(u, k=5)
titles = movies.set_index("movieId")["title"]
print(f"semantic recs for user {u}:", [titles.get(i) for i, _ in recs])

t0 = time.time()
gal = build_galaxy(movies, emb, ids, k=15, resolution=1.0)
print(f"galaxy: {gal['n_clusters']} clusters in {time.time()-t0:.1f}s")
for c in gal["clusters"][:5]:
    print(f"  cluster {c['cluster']:>2} (n={c['size']:>4}) {c['top_genres']} "
          f"e.g. {[r['title'] for r in c['representatives'][:3]]}")

llm = get_llm()
print("llm available:", llm.available, "model:", llm.model)
if llm.available:
    ex = llm.explain(["The Matrix", "Inception", "Interstellar"],
                     {"id": 1, "title": "Blade Runner", "genres": ["Sci-Fi", "Thriller"]})
    print("llm explain:", ex)

print("SMOKE_OK")
