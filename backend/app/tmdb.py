"""Server-side TMDB poster/overview resolver.

Resolves a MovieLens tmdbId to public CDN image URLs (and overview), so the
TMDB key stays on the server. Poster paths are immutable, so results are cached
aggressively with lru_cache.
"""

from __future__ import annotations

import os
from functools import lru_cache

import httpx

IMG = "https://image.tmdb.org/t/p/w342"
BACK = "https://image.tmdb.org/t/p/w780"


@lru_cache(maxsize=60000)
def fetch_movie(tmdb_id: int) -> dict | None:
    token = os.environ.get("TMDB_READ_TOKEN")
    key = os.environ.get("TMDB_API_KEY")
    headers, params = {}, {}
    if token:
        headers = {"Authorization": f"Bearer {token}"}
    elif key:
        params = {"api_key": key}
    else:
        return None
    try:
        r = httpx.get(f"https://api.themoviedb.org/3/movie/{int(tmdb_id)}",
                      headers=headers, params=params, timeout=6.0)
        if r.status_code != 200:
            return None
        d = r.json()
        return {
            "poster_url": IMG + d["poster_path"] if d.get("poster_path") else None,
            "backdrop_url": BACK + d["backdrop_path"] if d.get("backdrop_path") else None,
            "overview": d.get("overview") or None,
            "tmdb_rating": d.get("vote_average"),
        }
    except Exception:
        return None
