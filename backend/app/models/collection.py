from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.types import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.recipe import Recipe
    from app.models.user import User


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="collections")
    collection_recipes: Mapped[list["CollectionRecipe"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan"
    )
    recipes: Mapped[list["Recipe"]] = relationship(
        secondary="collection_recipes", back_populates="collections", viewonly=True
    )


class CollectionRecipe(Base):
    __tablename__ = "collection_recipes"
    __table_args__ = (UniqueConstraint("collection_id", "recipe_id", name="uq_collection_recipe"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipe_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    collection: Mapped["Collection"] = relationship(back_populates="collection_recipes")
    recipe: Mapped["Recipe"] = relationship(back_populates="collection_recipes")
