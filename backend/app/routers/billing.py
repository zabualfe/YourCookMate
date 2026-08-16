from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.billing import (
    BillingPlansResponse,
    CheckUploadRequest,
    CheckoutRequest,
    CheckoutResponse,
    PlanLimits,
    PortalResponse,
    UsageSnapshot,
)
from app.services.billing import (
    FREE_MAX_VIDEO_SECONDS,
    FREE_UPLOADS_PER_DAY,
    FREE_VISIBILITY_DAYS,
    PRO_MAX_VIDEO_SECONDS,
    PRO_UPLOADS_PER_DAY,
    assert_can_upload,
    assert_video_duration_allowed,
    billing_configured,
    is_pro,
    usage_snapshot,
)
from app.services.stripe_billing import (
    construct_event,
    create_checkout_session,
    create_portal_session,
    handle_webhook_event,
    pro_price_display,
    set_cancel_at_period_end,
)

router = APIRouter(prefix="/billing", tags=["billing"])


def _plans() -> list[PlanLimits]:
    return [
        PlanLimits(
            id="free",
            name="Free",
            uploads_per_day=FREE_UPLOADS_PER_DAY,
            max_video_seconds=FREE_MAX_VIDEO_SECONDS,
            visibility_days=FREE_VISIBILITY_DAYS,
            price_display="Free",
        ),
        PlanLimits(
            id="pro",
            name="Pro",
            uploads_per_day=PRO_UPLOADS_PER_DAY,
            max_video_seconds=PRO_MAX_VIDEO_SECONDS,
            visibility_days=None,
            price_display=pro_price_display(),
        ),
    ]


def _plans_response(db: Session, user: User) -> BillingPlansResponse:
    snapshot = usage_snapshot(db, user)
    ends = getattr(user, "subscription_current_period_end", None)
    return BillingPlansResponse(
        current_plan="pro" if is_pro(user) else "free",
        is_pro=is_pro(user),
        billing_configured=billing_configured(),
        plans=_plans(),
        usage=UsageSnapshot(**snapshot),
        cancel_at_period_end=bool(getattr(user, "cancel_at_period_end", False)),
        subscription_ends_at=ends.isoformat() if ends else None,
    )


@router.get("/plans", response_model=BillingPlansResponse)
def get_plans(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BillingPlansResponse:
    return _plans_response(db, user)


@router.get("/usage", response_model=UsageSnapshot)
def get_usage(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UsageSnapshot:
    return UsageSnapshot(**usage_snapshot(db, user))


@router.post("/check-upload", response_model=UsageSnapshot)
def check_upload(
    body: CheckUploadRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UsageSnapshot:
    snapshot = assert_can_upload(db, user)
    assert_video_duration_allowed(user, body.video_duration)
    return UsageSnapshot(**snapshot)


@router.post("/checkout", response_model=CheckoutResponse)
def start_checkout(
    body: CheckoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CheckoutResponse:
    url = create_checkout_session(db, user, body.success_path, body.cancel_path)
    db.commit()
    return CheckoutResponse(url=url)


@router.post("/portal", response_model=PortalResponse)
def start_portal(user: User = Depends(get_current_user)) -> PortalResponse:
    return PortalResponse(url=create_portal_session(user))


@router.post("/cancel", response_model=BillingPlansResponse)
def cancel_plan(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BillingPlansResponse:
    set_cancel_at_period_end(db, user, True)
    db.commit()
    db.refresh(user)
    return _plans_response(db, user)


@router.post("/resume", response_model=BillingPlansResponse)
def resume_plan(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BillingPlansResponse:
    set_cancel_at_period_end(db, user, False)
    db.commit()
    db.refresh(user)
    return _plans_response(db, user)


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    payload = await request.body()
    event = construct_event(payload, request.headers.get("stripe-signature"))
    handle_webhook_event(db, event)
    db.commit()
    return {"received": True}
