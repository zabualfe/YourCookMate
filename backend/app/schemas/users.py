from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.schemas.share import CommunityRecipeSummary


class PublicUserCard(BaseModel):
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    author_name: str


class PublicProfileResponse(PublicUserCard):
    follower_count: int = 0
    following_count: int = 0
    is_following: bool = False
    is_self: bool = False
    recipes: list[CommunityRecipeSummary] = []


class PublicUserListResponse(BaseModel):
    items: list[PublicUserCard]
    total: int


class UsernameCheckResponse(BaseModel):
    available: bool
    username: Optional[str] = None
    reason: Optional[str] = None


class FollowResponse(BaseModel):
    following: bool
    follower_count: int
