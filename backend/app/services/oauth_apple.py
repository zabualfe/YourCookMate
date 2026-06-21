from __future__ import annotations

from typing import Any, Optional

import jwt
from jwt import PyJWKClient

from app.config import settings

APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"


class AppleAuthError(Exception):
    pass


def verify_apple_identity_token(token: str) -> dict[str, Any]:
    if not settings.apple_client_id:
        raise AppleAuthError("Apple sign-in is not configured")

    try:
        jwks_client = PyJWKClient(APPLE_JWKS_URL)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.apple_client_id,
            issuer="https://appleid.apple.com",
        )
    except Exception as exc:
        raise AppleAuthError("Invalid Apple token") from exc

    email = payload.get("email")
    if not email:
        raise AppleAuthError("Apple account has no email (try signing in again to share email)")

    return {
        "subject": payload["sub"],
        "email": email.lower(),
        "display_name": None,
        "avatar_url": None,
    }
