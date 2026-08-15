from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class FeatureFlagItem(BaseModel):
    key: str
    enabled: bool
    label: str
    description: str


class AdminFeatureFlagsResponse(BaseModel):
    flags: list[FeatureFlagItem]
    updated_at: Optional[str] = None


class AdminFeatureFlagsUpdate(BaseModel):
    auth: Optional[bool] = None
    registration: Optional[bool] = None
    ai: Optional[bool] = None
    social_ingest: Optional[bool] = None
    community: Optional[bool] = None
    instacart: Optional[bool] = None
    aws_transcribe: Optional[bool] = None


class AdminStatusResponse(BaseModel):
    is_admin: bool
