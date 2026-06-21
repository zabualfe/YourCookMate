from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class InstacartConnectStatusResponse(BaseModel):
    configured: bool
    linked: bool
    instacart_plus_member: Optional[bool] = None
    expired_at: Optional[str] = None


class InstacartConnectStartResponse(BaseModel):
    authorize_url: str
