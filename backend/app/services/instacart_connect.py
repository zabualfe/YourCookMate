from __future__ import annotations

import secrets
import time
from typing import Any, Optional
from urllib.parse import urlencode
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.models.oauth_account import OAuthAccount
from app.models.user import User

_oauth_states: dict[str, tuple[str, str, float]] = {}
_STATE_TTL_SECONDS = 600
_PROVIDER = "instacart"


def connect_is_configured() -> bool:
    return bool(
        settings.instacart_enabled
        and settings.instacart_connect_client_id
        and settings.instacart_connect_client_secret
        and settings.instacart_connect_authorize_url
    )


def connect_redirect_uri() -> str:
    return f"{settings.api_base_url.rstrip('/')}/auth/instacart/connect/callback"


def connect_user_id(user: User) -> str:
    return str(user.id)


def _connect_api_base() -> str:
    return settings.instacart_connect_api_base.rstrip("/")


def _cleanup_states() -> None:
    now = time.time()
    for key in [k for k, (_, _, exp) in _oauth_states.items() if exp <= now]:
        del _oauth_states[key]


def _require_connect_config() -> None:
    if not connect_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Instacart account linking is not configured. "
                "Set INSTACART_CONNECT_CLIENT_ID, INSTACART_CONNECT_CLIENT_SECRET, "
                "and INSTACART_CONNECT_AUTHORIZE_URL in backend/.env "
                "(from your Instacart Connect partner application)."
            ),
        )


def get_fulfillment_access_token() -> str:
    _require_connect_config()
    url = f"{_connect_api_base()}/v2/oauth/token"
    payload = {
        "client_id": settings.instacart_connect_client_id,
        "client_secret": settings.instacart_connect_client_secret,
        "grant_type": "client_credentials",
        "scope": "connect:fulfillment",
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(url, json=payload, headers={"Accept": "application/json"})
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach Instacart Connect: {exc}",
        ) from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Instacart Connect authentication failed.",
        )

    token = response.json().get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Instacart Connect did not return an access token.",
        )
    return str(token)


def ensure_connect_user(user: User, fulfillment_token: str) -> None:
    user_id = connect_user_id(user)
    url = f"{_connect_api_base()}/v2/fulfillment/users"
    payload: dict[str, Any] = {"user_id": user_id}
    if user.display_name:
        parts = user.display_name.split(maxsplit=1)
        payload["first_name"] = parts[0]
        if len(parts) > 1:
            payload["last_name"] = parts[1]

    with httpx.Client(timeout=15.0) as client:
        response = client.post(
            url,
            json=payload,
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {fulfillment_token}",
                "Content-Type": "application/json",
            },
        )

    if response.status_code in {200, 201}:
        return
    if response.status_code == 400:
        try:
            message = response.json().get("error", {}).get("message", "")
        except Exception:
            message = ""
        if "already" in message.lower() or "exists" in message.lower():
            return
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not create Instacart Connect user.",
        )


def exchange_linking_token(code: str) -> str:
    _require_connect_config()
    url = f"{_connect_api_base()}/v2/oauth/token"
    payload = {
        "grant_type": "authorization_code",
        "client_id": settings.instacart_connect_client_id,
        "client_secret": settings.instacart_connect_client_secret,
        "code": code,
        "redirect_uri": connect_redirect_uri(),
    }
    with httpx.Client(timeout=15.0) as client:
        response = client.post(
            url,
            json=payload,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Instacart authorization failed or expired. Try linking again.",
        )

    linking_token = response.json().get("access_token")
    if not linking_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Instacart did not return a linking token.",
        )
    return str(linking_token)


def link_connect_user(user_id: str, linking_token: str, fulfillment_token: str) -> None:
    url = f"{_connect_api_base()}/v2/fulfillment/users/{user_id}/link"
    with httpx.Client(timeout=15.0) as client:
        response = client.post(
            url,
            json={"linking_token": linking_token},
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {fulfillment_token}",
                "Content-Type": "application/json",
            },
        )

    if response.status_code >= 400:
        detail = "Could not link Instacart account."
        try:
            message = response.json().get("error", {}).get("message")
            if message:
                detail = str(message)
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def fetch_link_status(user_id: str, fulfillment_token: str) -> Optional[dict[str, Any]]:
    url = f"{_connect_api_base()}/v2/fulfillment/users/{user_id}/link"
    with httpx.Client(timeout=15.0) as client:
        response = client.get(
            url,
            headers={"Accept": "application/json", "Authorization": f"Bearer {fulfillment_token}"},
        )

    if response.status_code == 200:
        return response.json()
    return None


def has_local_instacart_link(db: Session, user_id: UUID) -> bool:
    return (
        db.query(OAuthAccount)
        .filter(OAuthAccount.user_id == user_id, OAuthAccount.provider == _PROVIDER)
        .first()
        is not None
    )


def save_local_instacart_link(db: Session, user: User) -> None:
    db.query(OAuthAccount).filter(
        OAuthAccount.user_id == user.id,
        OAuthAccount.provider == _PROVIDER,
    ).delete()
    db.add(
        OAuthAccount(
            user_id=user.id,
            provider=_PROVIDER,
            provider_subject=connect_user_id(user),
        )
    )


def remove_local_instacart_link(db: Session, user_id: UUID) -> None:
    db.query(OAuthAccount).filter(
        OAuthAccount.user_id == user_id,
        OAuthAccount.provider == _PROVIDER,
    ).delete()


def build_authorize_url(state: str) -> str:
    _require_connect_config()
    params = {
        "response_type": "code",
        "client_id": settings.instacart_connect_client_id,
        "scope": "account_linking",
        "state": state,
        "redirect_uri": connect_redirect_uri(),
    }
    base = settings.instacart_connect_authorize_url or ""
    separator = "&" if "?" in base else "?"
    return f"{base}{separator}{urlencode(params)}"


def start_connect_flow(user: User, return_to: str) -> str:
    _require_connect_config()
    if not return_to.startswith("/") and not return_to.startswith("http"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid return_to")

    _cleanup_states()
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = (str(user.id), return_to, time.time() + _STATE_TTL_SECONDS)
    return build_authorize_url(state)


def complete_connect_callback(
    code: Optional[str],
    state: Optional[str],
    error: Optional[str],
    db: Session,
) -> RedirectResponse:
    _cleanup_states()

    default_return = f"{settings.frontend_url.rstrip('/')}/profile"

    if error:
        target = f"{default_return}?instacart=error&message={error}"
        return RedirectResponse(target)

    if not code or not state:
        return RedirectResponse(f"{default_return}?instacart=error&message=missing_code")

    entry = _oauth_states.pop(state, None)
    if entry is None:
        return RedirectResponse(f"{default_return}?instacart=error&message=invalid_state")

    user_id_str, return_to, _ = entry
    return_target = return_to if return_to.startswith("http") else f"{settings.frontend_url.rstrip('/')}{return_to}"

    user = db.query(User).filter(User.id == UUID(user_id_str)).first()
    if user is None:
        return RedirectResponse(f"{return_target}?instacart=error&message=user_not_found")

    try:
        linking_token = exchange_linking_token(code)
        fulfillment_token = get_fulfillment_access_token()
        connect_id = connect_user_id(user)
        ensure_connect_user(user, fulfillment_token)
        link_connect_user(connect_id, linking_token, fulfillment_token)
        save_local_instacart_link(db, user)
        db.commit()
    except HTTPException as exc:
        message = str(exc.detail).replace(" ", "+")
        return RedirectResponse(f"{return_target}?instacart=error&message={message}")

    return RedirectResponse(f"{return_target}?instacart=linked")


def get_connect_status(db: Session, user: User) -> dict[str, Any]:
    if not settings.instacart_enabled:
        return {
            "configured": False,
            "linked": False,
            "instacart_plus_member": None,
            "expired_at": None,
        }

    if not connect_is_configured():
        return {
            "configured": False,
            "linked": False,
            "instacart_plus_member": None,
            "expired_at": None,
        }

    linked_locally = has_local_instacart_link(db, user.id)
    instacart_plus_member: Optional[bool] = None
    expired_at: Optional[str] = None

    if linked_locally:
        try:
            fulfillment_token = get_fulfillment_access_token()
            remote = fetch_link_status(connect_user_id(user), fulfillment_token)
            if remote:
                instacart_plus_member = remote.get("instacartplus_member")
                expired_at = remote.get("expired_at")
            else:
                linked_locally = False
                remove_local_instacart_link(db, user.id)
                db.commit()
        except HTTPException:
            pass

    return {
        "configured": True,
        "linked": linked_locally,
        "instacart_plus_member": instacart_plus_member,
        "expired_at": expired_at,
    }
