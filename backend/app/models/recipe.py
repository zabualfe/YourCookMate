from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func, JSON
from sqlalchemy.types import Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

JSONStore = JSON().with_variant(JSONB, "postgresql")

if TYPE_CHECKING:
    from app.models.collection import Collection, CollectionRecipe
    from app.models.user import User


class Recipe(Base):
    __tablename__ = "recipes"
    __table_args__ = (UniqueConstraint("user_id", "pinned_rank", name="uq_recipes_user_pinned_rank"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), default="text", nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True, index=True)
    source_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    parsed_json: Mapped[dict] = mapped_column(JSONStore, nullable=False)
    used_ai: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Legacy flag — link access is gated by share_slug alone (unlisted). Kept for older rows.
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Opt-in listing in the Community tab. Community cards open /r/{share_slug}.
    shared_to_community: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Unlisted share link. Anyone with the slug can view; does not imply community listing.
    share_slug: Mapped[Optional[str]] = mapped_column(String(32), unique=True, nullable=True, index=True)
    pinned_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    icon_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    instacart_link_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    instacart_ingredients_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="recipes")
    collection_recipes: Mapped[list["CollectionRecipe"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan"
    )
    collections: Mapped[list["Collection"]] = relationship(
        secondary="collection_recipes", back_populates="recipes", viewonly=True
    )
