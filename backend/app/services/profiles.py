from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.share import CommunityRecipeSummary
from app.schemas.users import PublicUserCard
from app.services.billing import recipe_is_locked
from app.services.recipe_icons import icon_public_url


def author_name(user: User) -> str:
    if user.display_name and user.display_name.strip():
        return user.display_name.strip()
    if user.username:
        return user.username
    return user.email.split("@")[0]


def public_user_card(user: User) -> PublicUserCard:
    return PublicUserCard(
        username=user.username or "",
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        author_name=author_name(user),
    )


def community_recipe_summary(row: Recipe) -> Optional[CommunityRecipeSummary]:
    if not row.share_slug:
        return None
    if recipe_is_locked(row.user, row):
        return None
    return CommunityRecipeSummary(
        slug=row.share_slug,
        title=row.title,
        author_name=author_name(row.user),
        author_username=row.user.username,
        author_avatar_url=row.user.avatar_url,
        step_count=len(row.parsed_json.get("steps", [])),
        used_ai=row.used_ai,
        created_at=row.created_at.isoformat(),
        icon_url=icon_public_url(row.icon_path),
        id=str(row.id),
        pinned_rank=row.pinned_rank,
    )


def community_recipes_for_user(db: Session, user: User) -> list[CommunityRecipeSummary]:
    rows = (
        db.query(Recipe)
        .options(joinedload(Recipe.user))
        .filter(
            Recipe.user_id == user.id,
            Recipe.shared_to_community.is_(True),
            Recipe.share_slug.isnot(None),
        )
        .order_by(Recipe.created_at.desc())
        .all()
    )
    rows.sort(
        key=lambda row: (
            row.pinned_rank is None,
            row.pinned_rank or 0,
            -(row.created_at.timestamp() if row.created_at else 0),
        )
    )
    items: list[CommunityRecipeSummary] = []
    for row in rows:
        summary = community_recipe_summary(row)
        if summary:
            items.append(summary)
    return items
