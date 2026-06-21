from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.collection import Collection, CollectionRecipe
from app.schemas.collection import RecipeCollectionTag


def collections_for_recipe_ids(
    db: Session, recipe_ids: list[UUID]
) -> dict[UUID, list[RecipeCollectionTag]]:
    if not recipe_ids:
        return {}

    rows = (
        db.query(CollectionRecipe.recipe_id, Collection.id, Collection.name)
        .join(Collection, CollectionRecipe.collection_id == Collection.id)
        .filter(CollectionRecipe.recipe_id.in_(recipe_ids))
        .order_by(Collection.name)
        .all()
    )

    result: dict[UUID, list[RecipeCollectionTag]] = {rid: [] for rid in recipe_ids}
    for recipe_id, collection_id, name in rows:
        result[recipe_id].append(RecipeCollectionTag(id=str(collection_id), name=name))
    return result


def collections_for_recipe(db: Session, recipe_id: UUID) -> list[RecipeCollectionTag]:
    return collections_for_recipe_ids(db, [recipe_id]).get(recipe_id, [])
