from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_verified_email
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.recipe import ParsedRecipe
from app.schemas.recipe_store import RecipeDetailResponse
from app.schemas.share import SharedRecipeResponse
from app.schemas.shop import InstacartLinkResponse
from app.services.instacart import get_or_create_instacart_link
from app.services.recipe_icons import icon_public_url
from app.services.step_images import copy_step_images, enrich_recipe_step_urls

router = APIRouter(prefix="/r", tags=["share"])


def _author_name(user: User) -> str:
    if user.display_name:
        return user.display_name
    return user.email.split("@")[0]


def _get_public_recipe(db: Session, slug: str) -> Recipe:
    row = (
        db.query(Recipe)
        .options(joinedload(Recipe.user))
        .filter(Recipe.share_slug == slug, Recipe.is_public.is_(True))
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared recipe not found")
    return row


@router.get("/{slug}", response_model=SharedRecipeResponse)
def get_shared_recipe(slug: str, db: Session = Depends(get_db)) -> SharedRecipeResponse:
    row = _get_public_recipe(db, slug)
    parsed = ParsedRecipe.model_validate(row.parsed_json)
    parsed = enrich_recipe_step_urls(parsed)
    return SharedRecipeResponse(
        slug=slug,
        title=row.title,
        recipe=parsed,
        author_name=_author_name(row.user),
        step_count=len(parsed.steps),
        used_ai=row.used_ai,
        source_type=row.source_type,
        source_url=row.source_url,
        icon_url=icon_public_url(row.icon_path),
    )


@router.post("/{slug}/instacart-link", response_model=InstacartLinkResponse)
def create_shared_instacart_link(slug: str, db: Session = Depends(get_db)) -> InstacartLinkResponse:
    row = _get_public_recipe(db, slug)
    recipe = ParsedRecipe.model_validate(row.parsed_json)
    partner_url = f"{settings.frontend_url.rstrip('/')}/r/{slug}"
    url, cached = get_or_create_instacart_link(row, recipe, partner_linkback_url=partner_url)
    if not cached:
        db.commit()
    return InstacartLinkResponse(url=url, cached=cached)


@router.post("/{slug}/save", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def save_shared_recipe(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_email),
) -> RecipeDetailResponse:
    source = _get_public_recipe(db, slug)
    if source.user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This recipe is already in your library")

    row = Recipe(
        user_id=user.id,
        title=source.title,
        raw_text=source.raw_text,
        source_type=source.source_type,
        source_url=source.source_url,
        parsed_json=source.parsed_json,
        used_ai=source.used_ai,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    recipe = ParsedRecipe.model_validate(row.parsed_json)
    if any(step.image_url or step.clip_url for step in recipe.steps):
        recipe = copy_step_images(source.id, row.id, recipe)
        row.parsed_json = recipe.model_dump()
        db.commit()
        db.refresh(row)

    parsed = enrich_recipe_step_urls(recipe)
    return RecipeDetailResponse(
        id=str(row.id),
        title=row.title,
        raw_text=row.raw_text,
        source_type=row.source_type,
        source_url=row.source_url,
        used_ai=row.used_ai,
        recipe=parsed,
        created_at=row.created_at.isoformat(),
        is_public=False,
        share_slug=None,
        share_url=None,
    )
