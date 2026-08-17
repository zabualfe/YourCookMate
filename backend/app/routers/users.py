from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_optional_user
from app.models.user import User
from app.schemas.users import (
    FollowResponse,
    PublicProfileResponse,
    PublicUserListResponse,
    UsernameCheckResponse,
)
from app.services.feature_flags import require_community_enabled
from app.services.follows import (
    FollowError,
    follow_user,
    follower_count,
    following_count,
    is_following,
    list_followers,
    list_following,
    unfollow_user,
)
from app.services.profiles import community_recipes_for_user, public_user_card
from app.services.usernames import get_user_by_username, username_availability

router = APIRouter(prefix="/users", tags=["users"])


def _require_public_user(db: Session, username: str) -> User:
    user = get_user_by_username(db, username)
    if user is None or not user.username:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cook not found")
    return user


@router.get("/check-username", response_model=UsernameCheckResponse)
def check_username(
    username: str = Query(min_length=1, max_length=32),
    db: Session = Depends(get_db),
    viewer: Optional[User] = Depends(get_optional_user),
) -> UsernameCheckResponse:
    available, normalized, reason = username_availability(
        db, username, exclude_user_id=viewer.id if viewer else None
    )
    return UsernameCheckResponse(available=available, username=normalized, reason=reason)


@router.get("/{username}", response_model=PublicProfileResponse)
def get_public_profile(
    username: str,
    db: Session = Depends(get_db),
    viewer: Optional[User] = Depends(get_optional_user),
) -> PublicProfileResponse:
    require_community_enabled()
    user = _require_public_user(db, username)
    card = public_user_card(user)
    return PublicProfileResponse(
        **card.model_dump(),
        follower_count=follower_count(db, user.id),
        following_count=following_count(db, user.id),
        is_following=bool(viewer and is_following(db, viewer.id, user.id)),
        is_self=bool(viewer and viewer.id == user.id),
        recipes=community_recipes_for_user(db, user),
    )


@router.post("/{username}/follow", response_model=FollowResponse)
def follow_cook(
    username: str,
    db: Session = Depends(get_db),
    viewer: User = Depends(get_current_user),
) -> FollowResponse:
    require_community_enabled()
    user = _require_public_user(db, username)
    try:
        follow_user(db, viewer, user)
        db.commit()
    except FollowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IntegrityError:
        db.rollback()
    return FollowResponse(following=True, follower_count=follower_count(db, user.id))


@router.delete("/{username}/follow", response_model=FollowResponse)
def unfollow_cook(
    username: str,
    db: Session = Depends(get_db),
    viewer: User = Depends(get_current_user),
) -> FollowResponse:
    require_community_enabled()
    user = _require_public_user(db, username)
    unfollow_user(db, viewer, user)
    db.commit()
    return FollowResponse(following=False, follower_count=follower_count(db, user.id))


@router.get("/{username}/followers", response_model=PublicUserListResponse)
def get_followers(
    username: str,
    db: Session = Depends(get_db),
) -> PublicUserListResponse:
    require_community_enabled()
    user = _require_public_user(db, username)
    items = [public_user_card(row) for row in list_followers(db, user.id) if row.username]
    return PublicUserListResponse(items=items, total=len(items))


@router.get("/{username}/following", response_model=PublicUserListResponse)
def get_following(
    username: str,
    db: Session = Depends(get_db),
) -> PublicUserListResponse:
    require_community_enabled()
    user = _require_public_user(db, username)
    items = [public_user_card(row) for row in list_following(db, user.id) if row.username]
    return PublicUserListResponse(items=items, total=len(items))
