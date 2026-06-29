"""Unit tests for the evaluation metrics, checked against hand-computed values.

Run:  cd backend && .venv/bin/python -m pytest -q
"""

import math

from recsys import metrics


REC = ["A", "B", "C", "D", "E"]
REL = {"A", "C", "E"}


def test_precision_recall():
    assert metrics.precision_at_k(REC, REL, 5) == 3 / 5
    assert metrics.precision_at_k(REC, REL, 3) == 2 / 3
    assert metrics.recall_at_k(REC, REL, 5) == 1.0
    assert metrics.recall_at_k(REC, REL, 3) == 2 / 3


def test_hit_and_mrr():
    assert metrics.hit_rate_at_k(REC, REL, 5) == 1.0
    assert metrics.hit_rate_at_k(["B", "D"], REL, 2) == 0.0
    assert metrics.reciprocal_rank(REC, REL, 5) == 1.0          # A at rank 1
    assert metrics.reciprocal_rank(["B", "A", "C"], REL, 3) == 0.5  # first hit rank 2


def test_map():
    # hits at ranks 1,3,5 -> (1/1 + 2/3 + 3/5) / 3
    expected = (1.0 + 2 / 3 + 3 / 5) / 3
    assert math.isclose(metrics.average_precision_at_k(REC, REL, 5), expected, rel_tol=1e-9)


def test_ndcg():
    dcg = 1 / math.log2(2) + 1 / math.log2(4) + 1 / math.log2(6)
    idcg = 1 / math.log2(2) + 1 / math.log2(3) + 1 / math.log2(4)
    assert math.isclose(metrics.ndcg_at_k(REC, REL, 5), dcg / idcg, rel_tol=1e-9)


def test_dcg_zero_and_empty():
    assert metrics.dcg_at_k([], 5) == 0.0
    assert metrics.recall_at_k(REC, set(), 5) == 0.0
    assert metrics.ndcg_at_k(REC, set(), 5) == 0.0


def test_rating_metrics():
    assert math.isclose(metrics.mae([4, 3, 2], [5, 3, 1]), (1 + 0 + 1) / 3, rel_tol=1e-9)
    assert math.isclose(metrics.rmse([4, 3, 2], [5, 3, 1]),
                        math.sqrt((1 + 0 + 1) / 3), rel_tol=1e-9)


def test_coverage():
    cov = metrics.catalog_coverage([["A", "B"], ["B", "C"]], ["A", "B", "C", "D"])
    assert cov == 3 / 4
