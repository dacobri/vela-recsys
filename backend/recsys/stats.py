"""Statistical rigor for offline evaluation.

Turns per-user metric vectors into bootstrap confidence intervals and paired
significance tests (the unit of analysis is the per-user metric, so model
comparisons are PAIRED — same users scored by both models). Following Smucker
et al. (2007), the paired t-test leads; Wilcoxon is reported alongside for
transparency. Multiple comparisons are corrected with Holm-Bonferroni.
"""

from __future__ import annotations

import numpy as np
from scipy import stats as sps


def bootstrap_ci(values, n_boot: int = 10000, alpha: float = 0.05,
                 seed: int = 42) -> tuple[float, float, float]:
    """(mean, lo, hi) percentile bootstrap CI of the mean over per-user values."""
    v = np.asarray(values, dtype=float)
    v = v[~np.isnan(v)]
    if v.size == 0:
        return 0.0, 0.0, 0.0
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, v.size, size=(n_boot, v.size))
    boot = v[idx].mean(axis=1)
    lo, hi = np.percentile(boot, [100 * alpha / 2, 100 * (1 - alpha / 2)])
    return float(v.mean()), float(lo), float(hi)


def paired_test(a, b) -> dict:
    """Paired comparison of two methods' per-user metric vectors (same users)."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]
    diff = a - b
    if np.allclose(diff, 0):
        return {"mean_diff": 0.0, "t_p": 1.0, "wilcoxon_p": 1.0, "n": int(n)}
    t_p = float(sps.ttest_rel(a, b).pvalue)
    try:
        w_p = float(sps.wilcoxon(a, b, zero_method="wilcox").pvalue)
    except ValueError:
        w_p = 1.0
    return {"mean_diff": float(diff.mean()), "t_p": t_p, "wilcoxon_p": w_p, "n": int(n)}


def holm_bonferroni(pvals, alpha: float = 0.05) -> tuple[list[bool], list[float]]:
    """Holm-Bonferroni step-down correction. Returns (significant, adjusted_p)."""
    p = np.asarray(pvals, dtype=float)
    m = p.size
    order = np.argsort(p)
    adj = np.empty(m)
    running = 0.0
    for rank, idx in enumerate(order):
        running = max(running, (m - rank) * p[idx])
        adj[idx] = min(running, 1.0)
    return (adj < alpha).tolist(), adj.tolist()


def stars(p: float) -> str:
    return "***" if p < 0.001 else "**" if p < 0.01 else "*" if p < 0.05 else "ns"
