"""End-to-end API smoke test via FastAPI TestClient (exercises the lifespan load)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

with TestClient(app) as c:
    h = c.get("/health").json()
    print("health:", h["status"], "| llm:", h["llm"], "| movies:", h["n_movies"])

    us = c.get("/users?limit=3").json()
    u = us["users"][0]["id"]
    print("users total:", us["total"], "| sample user:", u)

    for method in ["usercf", "semantic", "mf", "hybrid"]:
        r = c.get(f"/recommend?user_id={u}&method={method}&k=5").json()
        items = r["items"]
        poster = bool(items[0].get("poster_url")) if items else False
        print(f"  {method:<9}", [it['title'] for it in items[:4]], "| poster:", poster)

    t = c.get(f"/taste/{u}").json()
    print("taste top genres:", t["top_genres"][:3])

    a = c.post("/arena", json={"user_id": u, "methods": ["usercf", "semantic"], "k": 3}).json()
    print("arena methods:", list(a["results"]))

    g = c.get("/galaxy").json()
    print("galaxy clusters:", g["n_clusters"], "points:", len(g["points"]))

    rr = c.get(f"/recommend?user_id={u}&method=llm_rerank&k=5").json()
    print("llm_rerank llm=", rr["llm"], "| top:", [it["title"] for it in rr["items"][:3]])
    if rr["items"]:
        print("  reason:", rr["items"][0].get("reason"))

    ch = c.post("/chat", json={"user_id": u, "message": "something funny and light",
                               "history": []}).json()
    print("chat llm=", ch["llm"], "| reply:", ch["reply"][:120])

    print("API_SMOKE_OK")
