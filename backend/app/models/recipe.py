from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func, JSON
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

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), default="text", nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    parsed_json: Mapped[dict] = mapped_column(JSONStore, nullable=False)
    used_ai: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    share_slug: Mapped[Optional[str]] = mapped_column(String(32), unique=True, nullable=True, index=True)
    icon_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    instacart_link_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    instacart_ingredients_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="recipes")
    collection_recipes: Mapped[list["CollectionRecipe"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan"
    )
    collections: Mapped[list["Collection"]] = relationship(
        secondary="collection_recipes", back_populates="recipes", viewonly=True
    )
