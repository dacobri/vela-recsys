"""Quick tuning sweep for item-CF shrinkage and MF size (small dataset)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from recsys import data  # noqa: E402
from recsys.collaborative import ItemItemCF  # noqa: E402
from recsys.evaluation import EvalContext, evaluate_model  # noqa: E402
from recsys.matrix_factorization import MF  # noqa: E402

r = data.filter_kcore(data.load_ratings("small"), 5, 5)
movies = data.build_movies_table("small", ratings=r)
train, test = data.temporal_holdout(r, frac=0.2)
ctx = EvalContext(train, test, movies)

print("== item-CF shrinkage ==")
for shrink in [0.0, 2.5, 5.0, 10.0, 25.0]:
    m = ItemItemCF(k=30, shrink=shrink).fit(train)
    res = evaluate_model(m, ctx, k=10, max_users=400)
    print(f"  shrink={shrink:>5}: P@10={res['precision@k']:.4f} NDCG={res['ndcg@k']:.4f} "
          f"cov={res['coverage']:.3f} nov={res['novelty']:.2f}", flush=True)

print("== MF size ==")
for nf, ne in [(32, 12), (64, 20), (64, 30), (100, 30)]:
    m = MF(n_factors=nf, n_epochs=ne).fit(train)
    res = evaluate_model(m, ctx, k=10, max_users=400)
    print(f"  f={nf:>3} e={ne:>2}: P@10={res['precision@k']:.4f} NDCG={res['ndcg@k']:.4f} "
          f"cov={res['coverage']:.3f}", flush=True)
print("TUNE_DONE", flush=True)
