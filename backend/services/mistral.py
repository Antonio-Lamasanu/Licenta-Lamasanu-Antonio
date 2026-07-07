import json
import logging

import requests

from config import MISTRAL_API_KEY, MISTRAL_CHAT_URL, MISTRAL_MODEL

logger = logging.getLogger(__name__)

_BASE_SYSTEM_PROMPT = (
    "You are a songwriting and poetry assistant. Help the user write lyrics, verses, "
    "and poetry in any genre or style. If asked to write code, functions, or "
    "technical/programming content, decline and steer back to lyrics - even a song "
    "about coding should stay in lyric form, not actual code and so on.\n\n"
    "You are never given the user's full note automatically - only what they explicitly "
    "paste or select. If a request gives you very little to work with (a single word or "
    "line, or a rewrite request with no surrounding context) and you genuinely need more "
    "of the song/poem to answer well, ask the user for that context instead of guessing. "
    "You can mention that they can paste in their full note using the 'Insert into Chat' "
    "button above the editor."
)


def _profile_summary(profile: dict | None) -> str | None:
    """Build a one-line profile summary for the system prompt, or None if the
    profile is missing or has no non-null fields."""
    if not profile:
        return None
    clauses: list[str] = []
    if profile.get("genres"):
        clauses.append(f"writes mostly {', '.join(profile['genres'])}")
    if profile.get("experience_level"):
        clauses.append(f"{profile['experience_level']} level")
    if profile.get("goal"):
        clauses.append(f"current goal is to {profile['goal']}")
    if profile.get("hardest_part"):
        clauses.append(f"finds {profile['hardest_part']} hardest")
    if profile.get("blocker"):
        clauses.append(f"most often blocked by {profile['blocker']}")
    if profile.get("frustration"):
        clauses.append(f"currently frustrated by {profile['frustration']}")
    if not clauses:
        return None
    return "About this user: " + "; ".join(clauses) + "."


def build_system_prompt(profile: dict | None) -> str:
    parts = [_BASE_SYSTEM_PROMPT]
    summary = _profile_summary(profile)
    if summary:
        parts.append(summary)
    return "\n\n".join(parts)


def auto_title(text: str, max_words: int = 6) -> str:
    words = text.split()
    title = " ".join(words[:max_words])
    return title + "…" if len(words) > max_words else title


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def stream_chat_completion(messages: list[dict]) -> requests.Response:
    """POST a streaming chat completion request to Mistral.

    Raises requests.RequestException on failure; caller is responsible for
    closing the returned response.
    """
    resp = requests.post(
        MISTRAL_CHAT_URL,
        headers={
            "Authorization": f"Bearer {MISTRAL_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"model": MISTRAL_MODEL, "messages": messages, "stream": True},
        stream=True,
        timeout=60,
    )
    resp.raise_for_status()
    return resp
