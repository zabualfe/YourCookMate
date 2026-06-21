from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User

TOKEN_BYTES = 32
TOKEN_TTL_HOURS = 24


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_verification_token(db: Session, user: User) -> str:
    db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete()

    raw = secrets.token_urlsafe(TOKEN_BYTES)
    row = EmailVerificationToken(
        user_id=user.id,
        token_hash=_hash_token(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS),
    )
    db.add(row)
    db.flush()
    return raw


def verify_email_token(db: Session, raw_token: str) -> Optional[User]:
    row = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token_hash == _hash_token(raw_token))
        .first()
    )
    if row is None:
        return None

    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        db.delete(row)
        return None

    user = db.query(User).filter(User.id == row.user_id).first()
    if user is None:
        return None

    user.email_verified = True
    db.delete(row)
    db.flush()
    return user
