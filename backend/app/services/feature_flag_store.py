from __future__ import annotations

import time
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.feature_flag import FeatureFlag

FLAG_KEYS = ("auth", "registration", "ai", "social_ingest", "community", "instacart")

_DEFAULTS: dict[str, bool] = {
    "auth": True,
    "registration": True,
    "ai": True,
    "social_ingest": True,
    "community": True,
    "instacart": False,
}

_ENV_FALLBACK = {
    "auth": lambda: settings.feature_auth_enabled,
    "registration": lambda: settings.feature_registration_enabled,
    "ai": lambda: settings.feature_ai_enabled,
    "social_ingest": lambda: settings.feature_social_ingest_enabled,
    "community": lambda: settings.feature_community_enabled,
    "instacart": lambda: settings.feature_instacart_enabled,
}

_cache: dict[str, bool] | None = None
_cache_at: float = 0.0
_CACHE_TTL_SECONDS = 15.0


def _env_defaults() -> dict[str, bool]:
    return {key: getter() for key, getter in _ENV_FALLBACK.items()}


def seed_feature_flags(db: Session) -> None:
    for key in FLAG_KEYS:
        existing = db.get(FeatureFlag, key)
        if existing is None:
            db.add(FeatureFlag(key=key, enabled=_DEFAULTS[key]))
    db.commit()


def _load_from_db(db: Session) -> dict[str, bool]:
    rows = db.query(FeatureFlag).all()
    if not rows:
        return _env_defaults()

    values = _env_defaults()
    for row in rows:
        if row.key in values:
            values[row.key] = row.enabled
    return values


def get_flag_values(*, force_refresh: bool = False) -> dict[str, bool]:
    global _cache, _cache_at

    now = time.monotonic()
    if not force_refresh and _cache is not None and (now - _cache_at) < _CACHE_TTL_SECONDS:
        return dict(_cache)

    db = SessionLocal()
    try:
        values = _load_from_db(db)
    finally:
        db.close()

    _cache = values
    _cache_at = now
    return dict(values)


def invalidate_flag_cache() -> None:
    global _cache, _cache_at
    _cache = None
    _cache_at = 0.0


def is_feature_enabled(key: str) -> bool:
    return get_flag_values().get(key, _DEFAULTS.get(key, True))


def update_flags(db: Session, updates: dict[str, bool]) -> dict[str, bool]:
    for key, enabled in updates.items():
        if key not in FLAG_KEYS:
            continue
        row = db.get(FeatureFlag, key)
        if row is None:
            row = FeatureFlag(key=key, enabled=enabled)
            db.add(row)
        else:
            row.enabled = enabled
    db.commit()
    invalidate_flag_cache()
    return get_flag_values(force_refresh=True)


def get_admin_flag_rows(db: Session) -> list[FeatureFlag]:
    seed_feature_flags(db)
    return db.query(FeatureFlag).filter(FeatureFlag.key.in_(FLAG_KEYS)).order_by(FeatureFlag.key).all()
