from __future__ import annotations

import re
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User

USERNAME_MIN = 3
USERNAME_MAX = 20
USERNAME_RE = re.compile(r"^[a-z0-9_]+$")

RESERVED_USERNAMES = frozenset(
    {
        "about",
        "admin",
        "api",
        "apple",
        "auth",
        "billing",
        "collections",
        "community",
        "cook",
        "features",
        "follow",
        "followers",
        "following",
        "google",
        "health",
        "help",
        "ingest",
        "login",
        "me",
        "mod",
        "moderator",
        "new",
        "null",
        "oauth",
        "plans",
        "profile",
        "r",
        "recipe",
        "recipes",
        "register",
        "root",
        "settings",
        "share",
        "shared",
        "support",
        "system",
        "u",
        "undefined",
        "upload",
        "user",
        "users",
        "verify",
        "www",
        "yourcookmate",
    }
)


class UsernameError(ValueError):
    """Invalid username format or reserved word."""


class UsernameTakenError(UsernameError):
    """Username is already assigned to another account."""


def normalize_username(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    value = raw.strip().lstrip("@").lower()
    return value or None


def validate_username(raw: str) -> str:
    value = normalize_username(raw)
    if not value:
        raise UsernameError("Username is required")
    if len(value) < USERNAME_MIN or len(value) > USERNAME_MAX:
        raise UsernameError(f"Username must be {USERNAME_MIN}–{USERNAME_MAX} characters")
    if not USERNAME_RE.fullmatch(value):
        raise UsernameError("Use only lowercase letters, numbers, and underscores")
    if value in RESERVED_USERNAMES:
        raise UsernameError("That username is reserved")
    return value


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    value = normalize_username(username)
    if not value:
        return None
    return db.query(User).filter(User.username == value).first()


def username_availability(
    db: Session,
    raw: str,
    exclude_user_id: Optional[UUID] = None,
) -> tuple[bool, Optional[str], Optional[str]]:
    try:
        value = validate_username(raw)
    except UsernameError as exc:
        return False, None, str(exc)

    existing = get_user_by_username(db, value)
    if existing and existing.id != exclude_user_id:
        return False, value, "Username already taken"
    return True, value, None


def assign_username(db: Session, user: User, raw: str) -> str:
    value = validate_username(raw)
    if user.username == value:
        return value
    existing = get_user_by_username(db, value)
    if existing and existing.id != user.id:
        raise UsernameTakenError("Username already taken")
    user.username = value
    return value
