from __future__ import annotations

from typing import Any

import jwt
from jwt import PyJWKClient

from app.config import settings

APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"


class AppleAuthError(Exception):
    pass


def _apple_client_ids() -> list[str]:
    ids: list[str] = []
    if settings.apple_client_id:
        ids.append(settings.apple_client_id)
    if settings.apple_ios_client_id:
        ids.append(settings.apple_ios_client_id)
    return ids


def verify_apple_identity_token(token: str) -> dict[str, Any]:
    client_ids = _apple_client_ids()
    if not client_ids:
        raise AppleAuthError("Apple sign-in is not configured")

    try:
        jwks_client = PyJWKClient(APPLE_JWKS_URL)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
    except Exception as exc:
        raise AppleAuthError("Invalid Apple token") from exc

    payload: dict[str, Any] | None = None
    last_error: Exception | None = None
    for audience in client_ids:
        try:
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=audience,
                issuer="https://appleid.apple.com",
            )
            break
        except Exception as exc:
            last_error = exc
            continue

    if payload is None:
        raise AppleAuthError("Invalid Apple token") from last_error

    email = payload.get("email")
    return {
        "subject": payload["sub"],
        "email": email.lower() if isinstance(email, str) and email.strip() else None,
        "display_name": None,
        "avatar_url": None,
    }
