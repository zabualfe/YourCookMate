from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_optional_user
from app.models.recipe import Recipe
from app.models.user import User
from app.routers.share import _author_name
from app.schemas.share import CommunityRecipeListResponse, CommunityRecipeSummary
from app.services.recipe_icons import icon_public_url

router = APIRouter(prefix="/community", tags=["community"])


@router.get("/recipes", response_model=CommunityRecipeListResponse)
def list_community_recipes(
    q: Optional[str] = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> CommunityRecipeListResponse:
    query = (
        db.query(Recipe)
        .options(joinedload(Recipe.user))
        .filter(Recipe.is_public.is_(True), Recipe.share_slug.isnot(None))
    )
    if user is not None:
        query = query.filter(Recipe.user_id != user.id)
    if q:
        query = query.filter(Recipe.title.ilike(f"%{q}%"))
    rows = query.order_by(Recipe.created_at.desc()).all()

    items = [
        CommunityRecipeSummary(
            slug=row.share_slug,
            title=row.title,
            author_name=_author_name(row.user),
            step_count=len(row.parsed_json.get("steps", [])),
            used_ai=row.used_ai,
            created_at=row.created_at.isoformat(),
            icon_url=icon_public_url(row.icon_path),
        )
        for row in rows
        if row.share_slug
    ]
    return CommunityRecipeListResponse(items=items, total=len(items))
