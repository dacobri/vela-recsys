"""Vela recommender-systems engine.

A from-scratch, explainable implementation of the recommendation families taught
in the ESADE Recommender Systems course, plus modern extensions, all over the
MovieLens data. Designed so every method exposes the same ``fit`` / ``recommend``
contract and can be compared on identical splits and metrics.
"""

from . import config

__all__ = ["config"]
__version__ = "0.1.0"
