from __future__ import annotations

import secrets
import time
from typing import Optional
from urllib.parse import urlencode, quote

import httpx
from fastapi import HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.services.auth import create_access_token, oauth_login
from app.services.oauth_google import GoogleAuthError, verify_google_id_token

# Dev-only in-memory OAuth state (return_uri + expiry).
_oauth_states: dict[str, tuple[str, float]] = {}
_STATE_TTL_SECONDS = 600


def _google_mobile_redirect_uri() -> str:
    return f"{settings.api_base_url.rstrip('/')}/auth/google/mobile/callback"


def _cleanup_states() -> None:
    now = time.time()
    expired = [key for key, (_, expires) in _oauth_states.items() if expires <= now]
    for key in expired:
        del _oauth_states[key]


def _validate_return_uri(return_uri: str) -> None:
    if return_uri.startswith("yourcookmate://") or return_uri.startswith("exp://"):
        return
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid return_uri")


def google_mobile_start(return_uri: str) -> RedirectResponse:
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_CLIENT_ID is not set in backend/.env",
        )
    if not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_CLIENT_SECRET is not set in backend/.env — copy it from Google Cloud Console → Credentials → Web client → Client secret",
        )

    _validate_return_uri(return_uri)
    _cleanup_states()

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = (return_uri, time.time() + _STATE_TTL_SECONDS)

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": _google_mobile_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


def google_mobile_callback(code: Optional[str], state: Optional[str], error: Optional[str], db: Session) -> RedirectResponse:
    _cleanup_states()

    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Google sign-in failed: {error}")

    if not code or not state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing OAuth code")

    entry = _oauth_states.pop(state, None)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OAuth state")

    return_uri, _ = entry

    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google mobile sign-in is not configured on the server",
        )

    token_response = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": _google_mobile_redirect_uri(),
            "grant_type": "authorization_code",
        },
        timeout=20,
    )

    if token_response.status_code != 200:
        detail = token_response.json().get("error_description", "Token exchange failed")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    id_token = token_response.json().get("id_token")
    if not id_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google did not return an ID token")

    try:
        profile = verify_google_id_token(id_token)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user = oauth_login(db, "google", profile)
    token = create_access_token(user.id)
    separator = "&" if "?" in return_uri else "?"
    redirect_url = f"{return_uri}{separator}token={quote(token)}"
    return RedirectResponse(redirect_url)
