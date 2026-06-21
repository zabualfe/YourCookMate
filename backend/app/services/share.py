from __future__ import annotations

import secrets

from sqlalchemy.orm import Session

from app.models.recipe import Recipe


def generate_share_slug(db: Session) -> str:
    for _ in range(20):
        slug = secrets.token_urlsafe(8)
        exists = db.query(Recipe.id).filter(Recipe.share_slug == slug).first()
        if exists is None:
            return slug
    raise RuntimeError("Could not generate a unique share slug")
