from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

JSONStore = JSON().with_variant(JSONB, "postgresql")


class SourceImport(Base):
    """Immutable AI-generated snapshot for a source URL. Never updated from user edits."""

    __tablename__ = "source_imports"

    source_key: Mapped[str] = mapped_column(String(128), primary_key=True)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="video")
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    generated_json: Mapped[dict] = mapped_column(JSONStore, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    used_ai: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    aliases: Mapped[list["SourceImportAlias"]] = relationship(back_populates="source_import", cascade="all, delete-orphan")


class SourceImportAlias(Base):
    """Extra URL forms (short links, tracking params) that point at the same generated import."""

    __tablename__ = "source_import_aliases"

    alias_key: Mapped[str] = mapped_column(String(128), primary_key=True)
    source_key: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("source_imports.source_key", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_import: Mapped[SourceImport] = relationship(back_populates="aliases")
