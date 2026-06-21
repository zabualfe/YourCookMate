from __future__ import annotations

from typing import Optional

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.collection import Collection, CollectionRecipe
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.collection import (
    CollectionDetailResponse,
    CollectionListResponse,
    CollectionRecipeSummary,
    CollectionSummary,
    CreateCollectionRequest,
    UpdateCollectionRequest,
)

router = APIRouter(prefix="/collections", tags=["collections"])


def _get_user_collection(db: Session, user: User, collection_id: UUID) -> Collection:
    row = db.query(Collection).filter(Collection.id == collection_id, Collection.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return row


def _get_user_recipe(db: Session, user: User, recipe_id: UUID) -> Recipe:
    row = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return row


@router.get("", response_model=CollectionListResponse)
def list_collections(
    recipe_id: Optional[UUID] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollectionListResponse:
    rows = db.query(Collection).filter(Collection.user_id == user.id).order_by(Collection.created_at.desc()).all()

    member_collection_ids: set[UUID] = set()
    if recipe_id is not None:
        _get_user_recipe(db, user, recipe_id)
        member_collection_ids = {
            link.collection_id
            for link in db.query(CollectionRecipe)
            .filter(CollectionRecipe.recipe_id == recipe_id)
            .all()
        }

    items = [
        CollectionSummary(
            id=str(c.id),
            name=c.name,
            recipe_count=len(c.collection_recipes),
            created_at=c.created_at.isoformat(),
            contains_recipe=c.id in member_collection_ids if recipe_id else None,
        )
        for c in rows
    ]
    return CollectionListResponse(items=items, total=len(items))


@router.post("", response_model=CollectionSummary, status_code=status.HTTP_201_CREATED)
def create_collection(
    body: CreateCollectionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollectionSummary:
    row = Collection(user_id=user.id, name=body.name.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return CollectionSummary(
        id=str(row.id),
        name=row.name,
        recipe_count=0,
        created_at=row.created_at.isoformat(),
    )


@router.get("/{collection_id}", response_model=CollectionDetailResponse)
def get_collection(
    collection_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollectionDetailResponse:
    row = _get_user_collection(db, user, collection_id)
    recipes = [
        CollectionRecipeSummary(
            id=str(link.recipe.id),
            title=link.recipe.title,
            step_count=len(link.recipe.parsed_json.get("steps", [])),
            used_ai=link.recipe.used_ai,
            created_at=link.recipe.created_at.isoformat(),
        )
        for link in sorted(row.collection_recipes, key=lambda x: x.added_at, reverse=True)
    ]
    return CollectionDetailResponse(
        id=str(row.id),
        name=row.name,
        created_at=row.created_at.isoformat(),
        recipes=recipes,
    )


@router.patch("/{collection_id}", response_model=CollectionSummary)
def update_collection(
    collection_id: UUID,
    body: UpdateCollectionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollectionSummary:
    row = _get_user_collection(db, user, collection_id)
    row.name = body.name.strip()
    db.commit()
    db.refresh(row)
    return CollectionSummary(
        id=str(row.id),
        name=row.name,
        recipe_count=len(row.collection_recipes),
        created_at=row.created_at.isoformat(),
    )


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    row = _get_user_collection(db, user, collection_id)
    db.delete(row)
    db.commit()


@router.post("/{collection_id}/recipes/{recipe_id}", status_code=status.HTTP_201_CREATED)
def add_recipe_to_collection(
    collection_id: UUID,
    recipe_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    collection = _get_user_collection(db, user, collection_id)
    recipe = _get_user_recipe(db, user, recipe_id)

    existing = (
        db.query(CollectionRecipe)
        .filter(CollectionRecipe.collection_id == collection.id, CollectionRecipe.recipe_id == recipe.id)
        .first()
    )
    if existing:
        return {"message": "Recipe already in collection"}

    db.add(CollectionRecipe(collection_id=collection.id, recipe_id=recipe.id))
    db.commit()
    return {"message": "Recipe added to collection"}


@router.delete("/{collection_id}/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_recipe_from_collection(
    collection_id: UUID,
    recipe_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    collection = _get_user_collection(db, user, collection_id)
    _get_user_recipe(db, user, recipe_id)

    link = (
        db.query(CollectionRecipe)
        .filter(CollectionRecipe.collection_id == collection.id, CollectionRecipe.recipe_id == recipe_id)
        .first()
    )
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not in collection")
    db.delete(link)
    db.commit()
