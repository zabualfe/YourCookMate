from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import stripe
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.services.billing import PRO_STATUSES, is_pro

_price_cache: dict[str, str] = {}


def stripe_ready() -> bool:
    return bool(settings.stripe_secret_key and settings.stripe_price_id)


def _configure() -> None:
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured yet.",
        )
    stripe.api_key = settings.stripe_secret_key


def require_stripe() -> None:
    _configure()
    if not settings.stripe_price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe price is not configured.",
        )


def pro_price_display() -> Optional[str]:
    if settings.stripe_pro_price_label:
        return settings.stripe_pro_price_label
    if not stripe_ready():
        return None
    cached = _price_cache.get(settings.stripe_price_id)
    if cached:
        return cached
    try:
        _configure()
        price = stripe.Price.retrieve(settings.stripe_price_id)
        amount = (price.unit_amount or 0) / 100
        interval = "month"
        recurring = getattr(price, "recurring", None)
        if isinstance(recurring, dict):
            interval = recurring.get("interval") or interval
        elif recurring is not None:
            interval = getattr(recurring, "interval", None) or interval
        if amount == int(amount):
            label = f"${int(amount)}/{interval}"
        else:
            label = f"${amount:.2f}/{interval}"
        _price_cache[settings.stripe_price_id] = label
        return label
    except Exception:
        return None


def _absolute_url(path: str) -> str:
    base = settings.frontend_url.rstrip("/")
    cleaned = path if path.startswith("/") else f"/{path}"
    return f"{base}{cleaned}"


def get_or_create_customer(db: Session, user: User) -> str:
    require_stripe()
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(
        email=user.email,
        name=user.display_name or None,
        metadata={"user_id": str(user.id)},
    )
    user.stripe_customer_id = customer.id
    db.add(user)
    db.flush()
    return customer.id


def create_checkout_session(db: Session, user: User, success_path: str, cancel_path: str) -> str:
    require_stripe()
    if is_pro(user):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already have Pro.")

    customer_id = get_or_create_customer(db, user)
    success_url = _absolute_url(success_path)
    if "{CHECKOUT_SESSION_ID}" not in success_url:
        joiner = "&" if "?" in success_url else "?"
        success_url = f"{success_url}{joiner}session_id={{CHECKOUT_SESSION_ID}}"

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=_absolute_url(cancel_path),
        client_reference_id=str(user.id),
        metadata={"user_id": str(user.id)},
        allow_promotion_codes=True,
        automatic_tax={"enabled": True},
        customer_update={"address": "auto", "name": "auto"},
        subscription_data={"metadata": {"user_id": str(user.id)}},
    )
    if not session.url:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe did not return a checkout URL.")
    return session.url


def create_portal_session(user: User) -> str:
    require_stripe()
    if not user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing account yet. Subscribe to Pro first.",
        )
    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=_absolute_url("/plans"),
    )
    return session.url


def _active_subscription_id(user: User) -> str:
    if user.stripe_subscription_id:
        return user.stripe_subscription_id
    if user.stripe_customer_id:
        subscriptions = stripe.Subscription.list(customer=user.stripe_customer_id, status="all", limit=10)
        for subscription in getattr(subscriptions, "data", []) or []:
            status_value = str(getattr(subscription, "status", "") or "").lower()
            if status_value in PRO_STATUSES:
                user.stripe_subscription_id = subscription.id
                return subscription.id
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No Pro subscription to update.",
    )


def set_cancel_at_period_end(db: Session, user: User, cancel: bool) -> User:
    require_stripe()
    if not is_pro(user) and cancel:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You don't have an active Pro plan.")
    subscription_id = _active_subscription_id(user)
    try:
        modifier = getattr(stripe.Subscription, "modify", None) or stripe.Subscription.update
        subscription = modifier(subscription_id, cancel_at_period_end=cancel)
    except stripe.StripeError as exc:
        message = getattr(exc, "user_message", None) or "Could not update your subscription."
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from exc
    apply_subscription(user, subscription)
    db.add(user)
    db.flush()
    return user


def _user_by_id(db: Session, user_id: str) -> Optional[User]:
    try:
        return db.query(User).filter(User.id == UUID(user_id)).first()
    except (ValueError, TypeError):
        return None


def _user_by_customer(db: Session, customer_id: Optional[str]) -> Optional[User]:
    if not customer_id:
        return None
    return db.query(User).filter(User.stripe_customer_id == customer_id).first()


def _user_by_subscription(db: Session, subscription_id: Optional[str]) -> Optional[User]:
    if not subscription_id:
        return None
    return db.query(User).filter(User.stripe_subscription_id == subscription_id).first()


def apply_subscription(user: User, subscription: Any) -> None:
    status_value = str(getattr(subscription, "status", "") or "").lower()
    user.stripe_subscription_id = getattr(subscription, "id", None) or user.stripe_subscription_id
    customer_id = getattr(subscription, "customer", None)
    if isinstance(customer_id, str):
        user.stripe_customer_id = customer_id
    user.subscription_status = status_value or None
    user.plan = "pro" if status_value in PRO_STATUSES else "free"
    period_end = getattr(subscription, "current_period_end", None)
    if not period_end:
        items = getattr(subscription, "items", None)
        data = items.data if items is not None and hasattr(items, "data") else None
        if data:
            period_end = getattr(data[0], "current_period_end", None)
    if period_end:
        user.subscription_current_period_end = datetime.fromtimestamp(int(period_end), tz=timezone.utc)
    user.cancel_at_period_end = bool(getattr(subscription, "cancel_at_period_end", False)) and status_value in PRO_STATUSES


def _apply_checkout_session(db: Session, session: Any) -> None:
    user = None
    metadata = getattr(session, "metadata", None) or {}
    user_id = metadata.get("user_id") if isinstance(metadata, dict) else None
    if user_id:
        user = _user_by_id(db, user_id)
    if user is None:
        user = _user_by_customer(db, getattr(session, "customer", None))
    if user is None:
        return

    customer_id = getattr(session, "customer", None)
    if isinstance(customer_id, str):
        user.stripe_customer_id = customer_id
    subscription_id = getattr(session, "subscription", None)
    if isinstance(subscription_id, str):
        user.stripe_subscription_id = subscription_id
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            apply_subscription(user, subscription)
            return
        except Exception:
            pass
    if getattr(session, "mode", None) == "subscription" and getattr(session, "status", None) == "complete":
        user.plan = "pro"
        user.subscription_status = "active"


def handle_webhook_event(db: Session, event: Any) -> None:
    event_type = event["type"] if isinstance(event, dict) else event.type
    data_object = event["data"]["object"] if isinstance(event, dict) else event.data.object

    if event_type == "checkout.session.completed":
        _apply_checkout_session(db, data_object)
        return

    if event_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        user = _user_by_subscription(db, getattr(data_object, "id", None))
        if user is None:
            metadata = getattr(data_object, "metadata", None) or {}
            user_id = metadata.get("user_id") if isinstance(metadata, dict) else None
            if user_id:
                user = _user_by_id(db, user_id)
        if user is None:
            user = _user_by_customer(db, getattr(data_object, "customer", None))
        if user is None:
            return
        apply_subscription(user, data_object)
        return

    if event_type == "invoice.payment_failed":
        customer_id = getattr(data_object, "customer", None)
        user = _user_by_customer(db, customer_id if isinstance(customer_id, str) else None)
        if user is None:
            return
        user.subscription_status = "past_due"


def construct_event(payload: bytes, signature: Optional[str]) -> Any:
    require_stripe()
    if not settings.stripe_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhook secret is not configured.",
        )
    if not signature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature.")
    try:
        return stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except stripe.SignatureVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature.") from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe webhook.") from exc
