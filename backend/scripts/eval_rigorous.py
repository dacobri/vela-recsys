"""Rigorous offline evaluation: methods x metrics with bootstrap 95% CIs and
paired significance tests (Holm-corrected) vs the best method, plus beyond-accuracy
metrics and trade-off plots. Writes results/ outputs for the report.

Usage:  OMP_NUM_THREADS=1 KMP_DUPLICATE_LIB_OK=TRUE .venv/bin/python scripts/eval_rigorous.py --dataset small
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from recsys import config, data, stats  # noqa: E402
from recsys.baselines import DampedMean, MostPopular, RandomRec  # noqa: E402
from recsys.collaborative import ItemItemCF, UserUserCF  # noqa: E402
from recsys.content import ContentBased  # noqa: E402
from recsys.evaluation import EvalContext, evaluate_model, evaluate_per_user  # noqa: E402
from recsys.matrix_factorization import ALS, MF  # noqa: E402
from recsys.semantic import SemanticRecommender  # noqa: E402

ACC = ["precision", "recall", "ndcg", "map", "mrr", "hit"]
BEYOND = ["coverage", "novelty", "diversity", "personalization", "arp", "gini"]


def load_semantic_emb(movies):
    ep, ip = config.ARTIFACTS_DIR / "emb_small.npy", config.ARTIFACTS_DIR / "ids_small.npy"
    if not ep.exists():
        return None
    emb, ids = np.load(ep), np.load(ip)
    order = movies[config.ITEM_COL].to_numpy()
    if not np.array_equal(ids, order):
        pos = {int(m): i for i, m in enumerate(ids)}
        emb = np.vstack([emb[pos[int(m)]] if int(m) in pos
                         else np.zeros(emb.shape[1], dtype=emb.dtype) for m in order])
    return emb


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="small")
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--kcore", type=int, default=5)
    args = ap.parse_args()

    ratings = data.filter_kcore(data.load_ratings(args.dataset), args.kcore, args.kcore)
    movies = data.build_movies_table(args.dataset, ratings=ratings)
    train, test = data.temporal_holdout(ratings, frac=0.2)
    ctx = EvalContext(train, test, movies)
    users = [u for u, rel in ctx.relevant.items() if rel]   # fixed -> paired comparisons
    print(f"dataset={args.dataset}  eval_users={len(users)}  k={args.k}", flush=True)

    models = {
        "random": RandomRec(), "popularity": MostPopular(), "damped_mean": DampedMean(),
        "content": ContentBased(), "itemcf": ItemItemCF(k=30, shrink=2.5),
        "usercf": UserUserCF(k=40), "mf": MF(n_factors=50, n_epochs=20),
        "als": ALS(factors=64, iterations=20, alpha=20.0),
    }
    emb = load_semantic_emb(movies)
    if emb is not None:
        models["semantic"] = SemanticRecommender()

    per_user, agg = {}, {}
    for name, model in models.items():
        model.fit(train, movies, embeddings=emb) if name == "semantic" else model.fit(train, movies)
        per_user[name] = evaluate_per_user(model, ctx, k=args.k, users=users)
        agg[name] = evaluate_model(model, ctx, k=args.k)
        print(f"  evaluated {name}", flush=True)

    # table: mean [95% CI] per accuracy metric + beyond-accuracy
    rows = []
    for name in models:
        df = per_user[name]
        row = {"method": name}
        for m in ACC:
            mean, lo, hi = stats.bootstrap_ci(df[m].to_numpy())
            row[m] = round(mean, 4)
            row[f"{m}_CI"] = f"[{lo:.4f}, {hi:.4f}]"
        for c in BEYOND:
            row[c] = round(agg[name][c], 4)
        rows.append(row)
    table = pd.DataFrame(rows).set_index("method").sort_values("ndcg", ascending=False)

    # paired significance vs the best method on per-user NDCG (Holm-corrected)
    best = table.index[0]
    others = [m for m in table.index if m != best]
    tests = {m: stats.paired_test(per_user[best]["ndcg"].to_numpy(),
                                  per_user[m]["ndcg"].to_numpy()) for m in others}
    sig, adj = stats.holm_bonferroni([tests[m]["t_p"] for m in others])
    sig_map = {m: (s, p) for m, s, p in zip(others, sig, adj)}

    out = config.PROJECT_ROOT / "results"
    out.mkdir(exist_ok=True)
    table.to_csv(out / f"eval_rigorous_{args.dataset}.csv")

    # markdown report
    lines = [f"# Rigorous evaluation — {args.dataset} (k={args.k}, {len(users)} users)\n",
             f"Best method by NDCG@{args.k}: **{best}**. Significance vs best is a paired "
             "t-test on per-user NDCG, Holm-Bonferroni corrected.\n",
             "| method | P@k | Recall@k | NDCG@k (95% CI) | MAP | MRR | Coverage | Novelty | "
             "Diversity | ARP↓ | Gini↓ | vs best |",
             "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for name in table.index:
        r = table.loc[name]
        vs = "— (best)" if name == best else (
            f"{stats.stars(sig_map[name][1])} (p={sig_map[name][1]:.3g})")
        lines.append(f"| {name} | {r['precision']:.4f} | {r['recall']:.4f} | "
                     f"{r['ndcg']:.4f} {r['ndcg_CI']} | {r['map']:.4f} | {r['mrr']:.4f} | "
                     f"{r['coverage']:.3f} | {r['novelty']:.2f} | {r['diversity']:.3f} | "
                     f"{r['arp']:.4f} | {r['gini']:.3f} | {vs} |")
    (out / f"eval_rigorous_{args.dataset}.md").write_text("\n".join(lines))
    print("\n".join(lines))

    # plots
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        order = list(table.index)
        means = [table.loc[m, "ndcg"] for m in order]
        errs = [[table.loc[m, "ndcg"] - stats.bootstrap_ci(per_user[m]["ndcg"].to_numpy())[1]
                 for m in order],
                [stats.bootstrap_ci(per_user[m]["ndcg"].to_numpy())[2] - table.loc[m, "ndcg"]
                 for m in order]]
        fig, ax = plt.subplots(figsize=(8, 4.5))
        ax.bar(order, means, yerr=errs, capsize=4, color="#F2C14E")
        ax.set_ylabel(f"NDCG@{args.k}")
        ax.set_title("Ranking accuracy with 95% bootstrap CIs")
        plt.xticks(rotation=40, ha="right")
        plt.tight_layout()
        fig.savefig(out / f"ndcg_ci_{args.dataset}.png", dpi=130)

        fig2, ax2 = plt.subplots(figsize=(7, 5))
        for m in order:
            ax2.scatter(table.loc[m, "diversity"], table.loc[m, "ndcg"], s=60, color="#F2C14E")
            ax2.annotate(m, (table.loc[m, "diversity"], table.loc[m, "ndcg"]),
                         fontsize=8, xytext=(4, 4), textcoords="offset points")
        ax2.set_xlabel("Intra-list diversity")
        ax2.set_ylabel(f"NDCG@{args.k}")
        ax2.set_title("Accuracy vs diversity trade-off")
        plt.tight_layout()
        fig2.savefig(out / f"tradeoff_{args.dataset}.png", dpi=130)
        print(f"\nsaved plots + tables -> {out}")
    except Exception as e:  # pragma: no cover
        print(f"(plots skipped: {e})")

    print("EVAL_RIGOROUS_DONE")


if __name__ == "__main__":
    main()
