"""Smoke-test the new consumer endpoints (onboarding, For You, similar, diversity, ALS)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

with TestClient(app) as c:
    h = c.get("/health").json()
    print("methods:", h["methods"])

    pop = c.get("/recommend?user_id=414&method=popularity&k=8").json()["items"]
    rated = [{"id": it["id"], "rating": 5.0} for it in pop[:5]]
    print("onboarding seed:", [it["title"] for it in pop[:5]])

    fy = c.post("/session/foryou", json={"ratings": rated}).json()
    print("foryou rows:", [(r["title"], len(r["items"])) for r in fy["rows"]])

    sr = c.post("/session/recommend", json={"ratings": rated, "method": "hybrid", "k": 5}).json()
    print("session hybrid:", [it["title"] for it in sr["items"][:5]])

    srd = c.post("/session/recommend",
                 json={"ratings": rated, "method": "semantic", "k": 5, "diversity": 0.5}).json()
    print("session semantic+div:", [it["title"] for it in srd["items"][:5]])

    sim = c.get(f"/movies/{rated[0]['id']}/similar?k=5").json()
    print("similar:", [it["title"] for it in sim["items"][:5]])

    fyu = c.get("/foryou/414").json()
    print("foryou(user) rows:", [r["title"] for r in fyu["rows"]])

    als = c.get("/recommend?user_id=414&method=als&k=5").json()
    print("als:", [it["title"] for it in als["items"][:5]])

    div = c.get("/recommend?user_id=414&method=itemcf&k=5&diversity=0.6").json()
    print("itemcf+diversity:", [it["title"] for it in div["items"][:5]])

    print("NEW_API_OK")
