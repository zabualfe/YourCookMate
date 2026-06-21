from __future__ import annotations

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings


class GoogleAuthError(Exception):
    pass


def _google_client_ids() -> list[str]:
    ids: list[str] = []
    if settings.google_client_id:
        ids.append(settings.google_client_id)
    if settings.google_ios_client_id:
        ids.append(settings.google_ios_client_id)
    return ids


def verify_google_id_token(token: str) -> dict:
    client_ids = _google_client_ids()
    if not client_ids:
        raise GoogleAuthError("Google sign-in is not configured")

    last_error: Exception | None = None
    idinfo = None
    for client_id in client_ids:
        try:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
            break
        except ValueError as exc:
            last_error = exc
            continue

    if idinfo is None:
        raise GoogleAuthError("Invalid Google token") from last_error

    if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise GoogleAuthError("Invalid token issuer")

    email = idinfo.get("email")
    if not email:
        raise GoogleAuthError("Google account has no email")

    return {
        "subject": idinfo["sub"],
        "email": email.lower(),
        "display_name": idinfo.get("name"),
        "avatar_url": idinfo.get("picture"),
    }
