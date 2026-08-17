from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.recipe import Recipe
from app.models.user import User

MAX_PINNED_RECIPES = 3


class PinError(ValueError):
    def __init__(self, message: str, code: str = "pin_error"):
        super().__init__(message)
        self.code = code


def _pinned_rows(db: Session, user_id: UUID) -> list[Recipe]:
    return (
        db.query(Recipe)
        .filter(Recipe.user_id == user_id, Recipe.pinned_rank.isnot(None))
        .order_by(Recipe.pinned_rank.asc())
        .all()
    )


def compact_pins(db: Session, user_id: UUID) -> None:
    rows = _pinned_rows(db, user_id)
    for row in rows:
        row.pinned_rank = None
    db.flush()
    for index, row in enumerate(rows, start=1):
        row.pinned_rank = index
    db.flush()


def clear_pin(db: Session, recipe: Recipe) -> Recipe:
    if recipe.pinned_rank is None:
        return recipe
    user_id = recipe.user_id
    recipe.pinned_rank = None
    db.flush()
    compact_pins(db, user_id)
    return recipe


def pin_recipe(db: Session, user: User, recipe: Recipe) -> Recipe:
    if recipe.user_id != user.id:
        raise PinError("Recipe not found", "not_found")
    if not recipe.shared_to_community or not recipe.share_slug:
        raise PinError("Share this recipe with the community before pinning it.", "community_required")
    if recipe.pinned_rank is not None:
        return recipe

    pinned = _pinned_rows(db, user.id)
    if len(pinned) >= MAX_PINNED_RECIPES:
        raise PinError("You can pin up to 3 recipes on your profile.", "pin_limit")

    used = {row.pinned_rank for row in pinned if row.pinned_rank is not None}
    recipe.pinned_rank = next(slot for slot in range(1, MAX_PINNED_RECIPES + 1) if slot not in used)
    db.flush()
    return recipe


def unpin_recipe(db: Session, user: User, recipe: Recipe) -> Recipe:
    if recipe.user_id != user.id:
        raise PinError("Recipe not found", "not_found")
    return clear_pin(db, recipe)
