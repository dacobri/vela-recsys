"""Claude layer: re-ranking, natural-language explanations and conversational
recommendation — grounded to a supplied candidate list so it cannot hallucinate
movies that don't exist.

Budget guards (the key was shared with a small cap): in-memory response cache,
hard daily request cap, capped max_tokens, ephemeral prompt caching on the system
block, and graceful fallback to the non-LLM result on any error or when the cap
is hit. Every LLM-touched result carries an ``llm`` boolean.
"""

from __future__ import annotations

import hashlib
import json
import os
import time

SYSTEM_RERANK = (
    "You re-rank a fixed list of candidate movies for a user and briefly justify each. "
    "Only use the movies provided; never invent titles. Return strict JSON."
)
SYSTEM_CHAT = (
    "You are Vela, a knowledgeable, concise movie-recommendation assistant. "
    "Recommend only from the provided candidate movies; never invent titles."
)


def _today() -> str:
    return time.strftime("%Y-%m-%d")


class LLMService:
    def __init__(self):
        self.api_key = os.environ.get("ANTHROPIC_API_KEY")
        self.model = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5")
        self.max_tokens = int(os.environ.get("LLM_MAX_TOKENS", "400"))
        self.daily_cap = int(os.environ.get("LLM_DAILY_REQUEST_CAP", "300"))
        self._cache: dict[str, object] = {}
        self._day = {"date": _today(), "count": 0}
        self._client = None
        if self.api_key:
            try:
                import anthropic

                self._client = anthropic.Anthropic(api_key=self.api_key)
            except Exception:  # pragma: no cover
                self._client = None

    # -- budget helpers --------------------------------------------------
    @property
    def available(self) -> bool:
        return self._client is not None

    def _bump(self) -> bool:
        if self._day["date"] != _today():
            self._day = {"date": _today(), "count": 0}
        if self._day["count"] >= self.daily_cap:
            return False
        self._day["count"] += 1
        return True

    def _call(self, system: str, user: str, max_tokens: int | None = None) -> str | None:
        if not self.available or not self._bump():
            return None
        try:
            msg = self._client.messages.create(
                model=self.model,
                max_tokens=max_tokens or self.max_tokens,
                system=[{"type": "text", "text": system,
                         "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": user}],
            )
            return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        except Exception:
            return None

    # -- public API ------------------------------------------------------
    def rerank(self, profile: str, candidates: list[dict], k: int = 10) -> dict:
        """Re-rank candidates (each {id,title,genres}) and attach short reasons."""
        cands = candidates[:25]
        key = "rr:" + hashlib.sha256(
            json.dumps([profile, [c["id"] for c in cands], k], sort_keys=True).encode()
        ).hexdigest()
        if key in self._cache:
            return {"items": self._cache[key], "llm": True, "cached": True}

        listing = "\n".join(f'{c["id"]}: {c["title"]} [{", ".join(c.get("genres", []))}]'
                            for c in cands)
        prompt = (
            f"User taste: {profile}\n\nCandidate movies:\n{listing}\n\n"
            f"Return JSON: {{\"ranked\": [{{\"id\": <id>, \"reason\": \"<=12 words\"}}]}} "
            f"with the top {k} ids, best first."
        )
        raw = self._call(SYSTEM_RERANK, prompt, max_tokens=512)
        parsed = _safe_json(raw)
        if not parsed or "ranked" not in parsed:
            fallback = [{"id": c["id"], "reason": ""} for c in cands[:k]]
            return {"items": fallback, "llm": False}
        self._cache[key] = parsed["ranked"][:k]
        return {"items": parsed["ranked"][:k], "llm": True, "cached": False}

    def explain(self, liked_titles: list[str], movie: dict) -> dict:
        key = "ex:" + hashlib.sha256(
            json.dumps([sorted(liked_titles)[:10], movie["id"]], sort_keys=True).encode()
        ).hexdigest()
        if key in self._cache:
            return {"text": self._cache[key], "llm": True, "cached": True}
        prompt = (
            f"User liked: {', '.join(liked_titles[:8])}.\n"
            f"Recommend '{movie['title']}' ({', '.join(movie.get('genres', []))}) "
            f"in ONE friendly sentence starting with 'Because'."
        )
        text = self._call("Write one concise, specific recommendation sentence.", prompt, 120)
        if not text:
            shared = ", ".join(movie.get("genres", [])[:2])
            return {"text": f"Recommended for its {shared} feel." if shared else "", "llm": False}
        self._cache[key] = text.strip()
        return {"text": text.strip(), "llm": True, "cached": False}

    def chat(self, message: str, candidates: list[dict], history: list | None = None) -> dict:
        listing = "\n".join(f'{c["id"]}: {c["title"]} [{", ".join(c.get("genres", []))}]'
                            for c in candidates[:25])
        convo = ""
        for turn in (history or [])[-6:]:
            convo += f'{turn.get("role")}: {turn.get("content")}\n'
        prompt = (
            f"{convo}user: {message}\n\nCandidate movies you may recommend:\n{listing}\n\n"
            "Reply helpfully in 2-4 sentences and, if relevant, mention a few candidate "
            "titles by name."
        )
        text = self._call(SYSTEM_CHAT, prompt, max_tokens=600)
        if not text:
            return {"reply": "The recommendation assistant is unavailable right now, "
                             "but here are some picks based on your request.", "llm": False}
        return {"reply": text.strip(), "llm": True}


def _safe_json(raw: str | None):
    if not raw:
        return None
    try:
        start, end = raw.find("{"), raw.rfind("}")
        return json.loads(raw[start:end + 1]) if start >= 0 else None
    except Exception:
        return None


_service: LLMService | None = None


def get_llm() -> LLMService:
    global _service
    if _service is None:
        _service = LLMService()
    return _service
