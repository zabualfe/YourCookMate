from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class PlanLimits(BaseModel):
    id: str
    name: str
    uploads_per_day: int
    max_video_seconds: int
    visibility_days: Optional[int] = None
    price_display: Optional[str] = None


class UsageSnapshot(BaseModel):
    plan: str
    is_pro: bool
    uploads_used_today: int
    uploads_remaining_today: int
    uploads_limit: int
    max_video_seconds: int
    visibility_days: Optional[int] = None
    period_end: str
    billing_configured: bool = False


class BillingPlansResponse(BaseModel):
    current_plan: str
    is_pro: bool
    billing_configured: bool
    plans: list[PlanLimits]
    usage: UsageSnapshot
    cancel_at_period_end: bool = False
    subscription_ends_at: Optional[str] = None


class CheckUploadRequest(BaseModel):
    video_duration: Optional[float] = Field(default=None, ge=0)


class CheckoutRequest(BaseModel):
    success_path: str = "/billing/success"
    cancel_path: str = "/profile"


class CheckoutResponse(BaseModel):
    url: str


class PortalResponse(BaseModel):
    url: str
