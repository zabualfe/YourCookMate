from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_optional_user
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.share import CommunityRecipeListResponse
from app.services.feature_flags import require_community_enabled
from app.services.follows import followed_user_ids
from app.services.profiles import community_recipe_summary

router = APIRouter(prefix="/community", tags=["community"])


@router.get("/recipes", response_model=CommunityRecipeListResponse)
def list_community_recipes(
    q: Optional[str] = Query(default=None, max_length=200),
    feed: str = Query(default="discover"),
    db: Session = Depends(get_db),
    viewer: Optional[User] = Depends(get_optional_user),
) -> CommunityRecipeListResponse:
    require_community_enabled()
    feed_key = (feed or "discover").strip().lower()
    if feed_key not in {"discover", "following"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="feed must be discover or following",
        )
    if feed_key == "following" and viewer is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to see cooks you follow",
        )

    query = (
        db.query(Recipe)
        .join(User, Recipe.user_id == User.id)
        .options(joinedload(Recipe.user))
        .filter(
            Recipe.shared_to_community.is_(True),
            Recipe.share_slug.isnot(None),
        )
    )
    if feed_key == "following" and viewer is not None:
        followed_ids = followed_user_ids(db, viewer.id)
        if not followed_ids:
            return CommunityRecipeListResponse(items=[], total=0)
        query = query.filter(Recipe.user_id.in_(followed_ids))
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Recipe.title.ilike(term),
                User.username.ilike(term),
                User.display_name.ilike(term),
            )
        )
    rows = query.order_by(Recipe.created_at.desc()).all()

    items = [summary for row in rows if (summary := community_recipe_summary(row))]
    return CommunityRecipeListResponse(items=items, total=len(items))
