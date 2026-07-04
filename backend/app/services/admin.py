from __future__ import annotations

from app.config import settings
from app.models.user import User

FLAG_METADATA: dict[str, dict[str, str]] = {
    "auth": {
        "label": "Sign in",
        "description": "Email, Google, and Apple login",
    },
    "registration": {
        "label": "Registration",
        "description": "New account sign-up (requires sign in)",
    },
    "ai": {
        "label": "AI",
        "description": "OpenAI parsing, transcription, and video analysis",
    },
    "social_ingest": {
        "label": "Video import",
        "description": "Import recipes from Instagram, TikTok, YouTube links",
    },
    "community": {
        "label": "Community",
        "description": "Public community recipes page",
    },
    "instacart": {
        "label": "Instacart",
        "description": "Instacart shopping and account linking UI",
    },
}


def admin_emails() -> set[str]:
    raw = settings.admin_emails.strip()
    if not raw:
        return set()
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def is_admin_user(user: User) -> bool:
    return user.email.lower() in admin_emails()
