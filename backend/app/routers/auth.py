from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    OAuthTokenRequest,
    RegisterRequest,
    UserResponse,
    VerifyEmailRequest,
)
from app.schemas.instacart_connect import InstacartConnectStartResponse, InstacartConnectStatusResponse
from app.services.auth import (
    create_access_token,
    create_user,
    get_user_by_email,
    oauth_login,
    user_to_dict,
    verify_password,
)
from app.services.email import send_verification_email
from app.services.oauth_apple import AppleAuthError, verify_apple_identity_token
from app.services.oauth_google import GoogleAuthError, verify_google_id_token
from app.services.verification import create_verification_token, verify_email_token

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(user: User, verification_url: Optional[str] = None) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserResponse(**user_to_dict(user)),
        verification_url=verification_url,
    )


def _verification_url(raw_token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/verify-email/confirm?token={raw_token}"


def _send_verification(db: Session, user: User) -> tuple[str, bool]:
    raw_token = create_verification_token(db, user)
    verify_url = _verification_url(raw_token)
    sent = send_verification_email(user.email, verify_url)
    return verify_url, sent


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    if get_user_by_email(db, body.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = create_user(db, email=body.email, password=body.password, display_name=body.display_name)
    verify_url, sent = _send_verification(db, user)
    db.commit()
    db.refresh(user)
    return _auth_response(user, verification_url=None if sent else verify_url)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = get_user_by_email(db, body.email)
    if user is None or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    return _auth_response(user)


def _oauth_login(db: Session, provider: str, profile: dict) -> AuthResponse:
    user = oauth_login(db, provider, profile)
    return _auth_response(user)


@router.get("/google/mobile/start")
def google_mobile_start(return_uri: str):
    from app.services.google_mobile_oauth import google_mobile_start as start

    return start(return_uri)


@router.get("/google/mobile/callback")
def google_mobile_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from app.services.google_mobile_oauth import google_mobile_callback as callback

    return callback(code, state, error, db)


@router.post("/google", response_model=AuthResponse)
def google_auth(body: OAuthTokenRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        profile = verify_google_id_token(body.id_token)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _oauth_login(db, "google", profile)


@router.post("/apple", response_model=AuthResponse)
def apple_auth(body: OAuthTokenRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        profile = verify_apple_identity_token(body.id_token)
    except AppleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _oauth_login(db, "apple", profile)


@router.post("/verify-email", response_model=AuthResponse)
def verify_email(body: VerifyEmailRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = verify_email_token(db, body.token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link. Request a new one from your account.",
        )

    db.commit()
    db.refresh(user)
    return _auth_response(user)


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if user.email_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already verified")

    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses social sign-in and does not need email verification.",
        )

    verify_url, sent = _send_verification(db, user)
    db.commit()
    message = "Verification email sent" if sent else "Email could not be delivered — use the link below"
    return MessageResponse(message=message, verification_url=None if sent else verify_url)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(**user_to_dict(user))


@router.get("/instacart/connect/status", response_model=InstacartConnectStatusResponse)
def instacart_connect_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstacartConnectStatusResponse:
    from app.services.instacart_connect import get_connect_status

    return InstacartConnectStatusResponse(**get_connect_status(db, user))


@router.post("/instacart/connect/start", response_model=InstacartConnectStartResponse)
def instacart_connect_start(
    return_to: str = "/profile",
    user: User = Depends(get_current_user),
) -> InstacartConnectStartResponse:
    from app.services.instacart_connect import start_connect_flow

    authorize_url = start_connect_flow(user, return_to)
    return InstacartConnectStartResponse(authorize_url=authorize_url)


@router.get("/instacart/connect/callback")
def instacart_connect_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from app.services.instacart_connect import complete_connect_callback

    return complete_connect_callback(code, state, error, db)


@router.delete("/instacart/connect", response_model=InstacartConnectStatusResponse)
def instacart_connect_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstacartConnectStatusResponse:
    from app.services.instacart_connect import get_connect_status, remove_local_instacart_link

    remove_local_instacart_link(db, user.id)
    db.commit()
    return InstacartConnectStatusResponse(**get_connect_status(db, user))
