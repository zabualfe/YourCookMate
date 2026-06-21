from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.models.oauth_account import OAuthAccount
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[UUID]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        sub = payload.get("sub")
        return UUID(sub) if sub else None
    except (JWTError, ValueError):
        return None


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower()).first()


def get_user_by_id(db: Session, user_id: UUID) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def create_user(
    db: Session,
    email: str,
    password: Optional[str] = None,
    display_name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    email_verified: bool = False,
) -> User:
    user = User(
        email=email.lower(),
        password_hash=hash_password(password) if password else None,
        display_name=display_name,
        avatar_url=avatar_url,
        email_verified=email_verified,
    )
    db.add(user)
    db.flush()
    return user


def link_oauth_account(
    db: Session,
    user: User,
    provider: str,
    provider_subject: str,
) -> OAuthAccount:
    existing = (
        db.query(OAuthAccount)
        .filter(OAuthAccount.provider == provider, OAuthAccount.provider_subject == provider_subject)
        .first()
    )
    if existing:
        return existing

    account = OAuthAccount(user_id=user.id, provider=provider, provider_subject=provider_subject)
    db.add(account)
    db.flush()
    return account


def oauth_login(db: Session, provider: str, profile: dict) -> User:
    account = (
        db.query(OAuthAccount)
        .filter(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_subject == profile["subject"],
        )
        .first()
    )

    if account:
        account.user.email_verified = True
        db.commit()
        db.refresh(account.user)
        return account.user

    user = get_user_by_email(db, profile["email"])
    if user is None:
        user = create_user(
            db,
            email=profile["email"],
            display_name=profile.get("display_name"),
            avatar_url=profile.get("avatar_url"),
            email_verified=True,
        )
    else:
        user.email_verified = True
        if profile.get("display_name") and not user.display_name:
            user.display_name = profile["display_name"]
        if profile.get("avatar_url") and not user.avatar_url:
            user.avatar_url = profile["avatar_url"]

    link_oauth_account(db, user, provider, profile["subject"])
    db.commit()
    db.refresh(user)
    return user


def user_to_dict(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "email_verified": user.email_verified,
    }
