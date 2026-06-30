"""Exploratory data analysis — the required dataset summary + distributions.

Computes #users / #items / #ratings / sparsity, the rating-value distribution,
the most-active users and most-popular items, and saves tables + plots to
results/ for the report (section 3).

Usage:  .venv/bin/python scripts/eda.py --dataset small
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from recsys import config, data  # noqa: E402

ACCENT = "#F2C14E"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="small")
    args = ap.parse_args()
    ds = args.dataset

    ratings = data.load_ratings(ds)
    movies = data.load_movies(ds)
    title = movies.set_index(config.ITEM_COL)["title_clean"]
    s = data.describe(ratings)

    rd = ratings[config.RATING_COL].value_counts().sort_index()
    active = ratings[config.USER_COL].value_counts().head(15)
    popular = ratings[config.ITEM_COL].value_counts().head(15)
    per_user = ratings[config.USER_COL].value_counts()
    per_item = ratings[config.ITEM_COL].value_counts()

    out = config.PROJECT_ROOT / "results"
    out.mkdir(exist_ok=True)

    lines = [f"# EDA — {ds}\n",
             "| stat | value |", "|---|---|",
             f"| users | {s['n_users']:,} |",
             f"| items | {s['n_items']:,} |",
             f"| ratings | {s['n_ratings']:,} |",
             f"| sparsity | {s['sparsity']:.4%} |",
             f"| mean rating | {s['rating_mean']:.3f} |",
             f"| ratings / user (avg) | {s['ratings_per_user']:.1f} |",
             f"| ratings / item (avg) | {s['ratings_per_item']:.1f} |",
             "\n## Rating distribution\n", "| rating | count |", "|---|---|"]
    lines += [f"| {r:.1f} | {int(c):,} |" for r, c in rd.items()]
    lines += ["\n## Most active users (by #ratings)\n", "| userId | #ratings |", "|---|---|"]
    lines += [f"| {u} | {int(c):,} |" for u, c in active.items()]
    lines += ["\n## Most popular items (by #ratings)\n", "| movie | #ratings |", "|---|---|"]
    lines += [f"| {title.get(i, i)} | {int(c):,} |" for i, c in popular.items()]
    (out / f"eda_{ds}.md").write_text("\n".join(lines))
    print("\n".join(lines))

    # plots
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar([f"{r:.1f}" for r in rd.index], rd.to_numpy(), color=ACCENT)
    ax.set_title(f"Rating distribution — {ds}")
    ax.set_xlabel("rating")
    ax.set_ylabel("count")
    plt.tight_layout()
    fig.savefig(out / f"eda_rating_dist_{ds}.png", dpi=130)

    fig2, ax2 = plt.subplots(figsize=(7, 4))
    ax2.plot(range(1, len(per_item) + 1), per_item.sort_values(ascending=False).to_numpy(),
             color=ACCENT)
    ax2.set_xscale("log")
    ax2.set_yscale("log")
    ax2.set_title(f"Item popularity (long tail) — {ds}")
    ax2.set_xlabel("item rank (log)")
    ax2.set_ylabel("#ratings (log)")
    plt.tight_layout()
    fig2.savefig(out / f"eda_long_tail_{ds}.png", dpi=130)

    fig3, ax3 = plt.subplots(figsize=(7, 4))
    ax3.hist(per_user.to_numpy(), bins=50, color=ACCENT)
    ax3.set_title(f"Ratings per user — {ds}")
    ax3.set_xlabel("#ratings by a user")
    ax3.set_ylabel("# users")
    plt.tight_layout()
    fig3.savefig(out / f"eda_activity_{ds}.png", dpi=130)

    print(f"\nsaved EDA tables + plots -> {out}")
    print("EDA_DONE")


if __name__ == "__main__":
    main()
