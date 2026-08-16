from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.recipe import Recipe
from app.models.usage import UsageRecord
from app.models.user import User

USAGE_UPLOAD = "upload"

FREE_UPLOADS_PER_DAY = 2
PRO_UPLOADS_PER_DAY = 10
FREE_MAX_VIDEO_SECONDS = 60
PRO_MAX_VIDEO_SECONDS = 180
FREE_VISIBILITY_DAYS = 14

PRO_STATUSES = frozenset({"active", "trialing", "past_due"})
SOCIAL_SOURCE_TYPES = frozenset(
    {"instagram", "tiktok", "youtube", "facebook", "pinterest", "vimeo", "video"}
)
DURATION_GRACE_SECONDS = 1.0


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_day_start(now: Optional[datetime] = None) -> datetime:
    current = _aware(now or utc_now())
    return datetime(current.year, current.month, current.day, tzinfo=timezone.utc)


def is_pro(user: User) -> bool:
    plan = (getattr(user, "plan", None) or "free").lower()
    status_value = (getattr(user, "subscription_status", None) or "").lower()
    return plan == "pro" and status_value in PRO_STATUSES


def uploads_per_day(user: User) -> int:
    return PRO_UPLOADS_PER_DAY if is_pro(user) else FREE_UPLOADS_PER_DAY


def max_video_seconds(user: User) -> int:
    return PRO_MAX_VIDEO_SECONDS if is_pro(user) else FREE_MAX_VIDEO_SECONDS


def visibility_days(user: User) -> Optional[int]:
    return None if is_pro(user) else FREE_VISIBILITY_DAYS


def billing_configured() -> bool:
    return bool(settings.stripe_secret_key and settings.stripe_price_id)


def counts_as_upload(used_ai: bool, source_type: str) -> bool:
    return bool(used_ai) or (source_type or "").lower() in SOCIAL_SOURCE_TYPES


def recipe_is_locked(owner: User, recipe: Recipe, now: Optional[datetime] = None) -> bool:
    if is_pro(owner):
        return False
    expires_at = getattr(recipe, "expires_at", None)
    if expires_at is None:
        return False
    return _aware(expires_at) <= (now or utc_now())


def recipe_visible_until(owner: User, recipe: Recipe) -> Optional[datetime]:
    if is_pro(owner):
        return None
    return getattr(recipe, "expires_at", None)


def billing_limit_error(code: str, message: str, extra: Optional[dict[str, Any]] = None) -> HTTPException:
    detail: dict[str, Any] = {"code": code, "message": message}
    if extra:
        detail.update(extra)
    return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=detail)


def uploads_used_today(db: Session, user_id: UUID, now: Optional[datetime] = None) -> int:
    start = utc_day_start(now)
    return (
        db.query(UsageRecord)
        .filter(
            UsageRecord.user_id == user_id,
            UsageRecord.usage_type == USAGE_UPLOAD,
            UsageRecord.recorded_at >= start,
        )
        .count()
    )


def usage_snapshot(db: Session, user: User, now: Optional[datetime] = None) -> dict[str, Any]:
    current = now or utc_now()
    used = uploads_used_today(db, user.id, current)
    limit = uploads_per_day(user)
    remaining = max(0, limit - used)
    next_day = utc_day_start(current) + timedelta(days=1)
    return {
        "plan": "pro" if is_pro(user) else "free",
        "is_pro": is_pro(user),
        "uploads_used_today": used,
        "uploads_remaining_today": remaining,
        "uploads_limit": limit,
        "max_video_seconds": max_video_seconds(user),
        "visibility_days": visibility_days(user),
        "period_end": next_day.isoformat(),
        "billing_configured": billing_configured(),
    }


def assert_can_upload(db: Session, user: User, now: Optional[datetime] = None) -> dict[str, Any]:
    snapshot = usage_snapshot(db, user, now)
    if snapshot["uploads_remaining_today"] <= 0:
        limit = snapshot["uploads_limit"]
        raise billing_limit_error(
            "daily_upload_limit",
            f"You've used all {limit} upload{'s' if limit != 1 else ''} for today. "
            "Upgrade to Pro for 10 uploads a day, or try again tomorrow.",
            snapshot,
        )
    return snapshot


def assert_video_duration_allowed(user: User, duration_seconds: Optional[float]) -> None:
    if duration_seconds is None or duration_seconds <= 0:
        return
    limit = max_video_seconds(user)
    if duration_seconds > limit + DURATION_GRACE_SECONDS:
        minutes = limit // 60
        plan_label = "Pro" if is_pro(user) else "the free plan"
        raise billing_limit_error(
            "video_too_long",
            f"This video is longer than the {minutes}-minute limit on {plan_label}. "
            + (
                "Upgrade to Pro to import videos up to 3 minutes."
                if not is_pro(user)
                else "Pick a shorter clip."
            ),
            {
                "max_video_seconds": limit,
                "video_duration": duration_seconds,
                "is_pro": is_pro(user),
            },
        )


def assert_recipe_unlocked(owner: User, recipe: Recipe) -> None:
    if recipe_is_locked(owner, recipe):
        raise billing_limit_error(
            "recipe_expired",
            "This recipe is past the 14-day free viewing window. Upgrade to Pro to open it again.",
            {
                "recipe_id": str(recipe.id),
                "visible_until": recipe.expires_at.isoformat() if recipe.expires_at else None,
            },
        )


def record_upload(db: Session, user: User, recipe: Optional[Recipe] = None, now: Optional[datetime] = None) -> None:
    current = now or utc_now()
    db.add(
        UsageRecord(
            user_id=user.id,
            usage_type=USAGE_UPLOAD,
            recipe_id=recipe.id if recipe is not None else None,
            recorded_at=current,
        )
    )
    if recipe is None:
        return
    if not is_pro(user):
        recipe.expires_at = current + timedelta(days=FREE_VISIBILITY_DAYS)
    else:
        recipe.expires_at = None
