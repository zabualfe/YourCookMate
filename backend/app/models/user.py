from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.types import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.follow import Follow


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True, index=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    plan: Mapped[str] = mapped_column(String(32), default="free", nullable=False)
    subscription_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    subscription_current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    verification_tokens: Mapped[list["EmailVerificationToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    recipes: Mapped[list["Recipe"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    collections: Mapped[list["Collection"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    usage_records: Mapped[list["UsageRecord"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    following_links: Mapped[list["Follow"]] = relationship(
        foreign_keys="Follow.follower_id",
        back_populates="follower",
        cascade="all, delete-orphan",
    )
    follower_links: Mapped[list["Follow"]] = relationship(
        foreign_keys="Follow.followee_id",
        back_populates="followee",
        cascade="all, delete-orphan",
    )
