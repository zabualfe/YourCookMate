from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.billing import (
    FREE_MAX_VIDEO_SECONDS,
    FREE_UPLOADS_PER_DAY,
    FREE_VISIBILITY_DAYS,
    PRO_MAX_VIDEO_SECONDS,
    PRO_UPLOADS_PER_DAY,
    assert_can_upload,
    assert_recipe_unlocked,
    assert_video_duration_allowed,
    counts_as_upload,
    is_pro,
    max_video_seconds,
    recipe_is_locked,
    uploads_per_day,
    usage_snapshot,
    utc_day_start,
)


def _user(**kwargs):
    defaults = {
        "id": uuid4(),
        "plan": "free",
        "subscription_status": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _recipe(**kwargs):
    defaults = {
        "id": uuid4(),
        "expires_at": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_is_pro_requires_active_status():
    assert is_pro(_user(plan="pro", subscription_status="active")) is True
    assert is_pro(_user(plan="pro", subscription_status="trialing")) is True
    assert is_pro(_user(plan="pro", subscription_status="canceled")) is False
    assert is_pro(_user(plan="free", subscription_status="active")) is False


def test_plan_limits():
    free = _user()
    pro = _user(plan="pro", subscription_status="active")
    assert uploads_per_day(free) == FREE_UPLOADS_PER_DAY
    assert uploads_per_day(pro) == PRO_UPLOADS_PER_DAY
    assert max_video_seconds(free) == FREE_MAX_VIDEO_SECONDS
    assert max_video_seconds(pro) == PRO_MAX_VIDEO_SECONDS


def test_counts_as_upload():
    assert counts_as_upload(True, "text") is True
    assert counts_as_upload(False, "tiktok") is True
    assert counts_as_upload(False, "text") is False


def test_recipe_locks_after_visibility_window():
    now = datetime(2026, 8, 15, tzinfo=timezone.utc)
    recipe = _recipe(expires_at=now - timedelta(seconds=1))
    assert recipe_is_locked(_user(), recipe, now) is True
    assert recipe_is_locked(_user(plan="pro", subscription_status="active"), recipe, now) is False


def test_recipe_without_expiry_stays_open():
    now = datetime(2026, 8, 15, tzinfo=timezone.utc)
    assert recipe_is_locked(_user(), _recipe(expires_at=None), now) is False


def test_assert_video_duration_free_limit():
    assert_video_duration_allowed(_user(), 60)
    with pytest.raises(HTTPException) as exc:
        assert_video_duration_allowed(_user(), 90)
    assert exc.value.status_code == 402
    assert exc.value.detail["code"] == "video_too_long"


def test_assert_video_duration_pro_limit():
    pro = _user(plan="pro", subscription_status="active")
    assert_video_duration_allowed(pro, 180)
    with pytest.raises(HTTPException) as exc:
        assert_video_duration_allowed(pro, 200)
    assert exc.value.detail["code"] == "video_too_long"


def test_assert_recipe_unlocked():
    now = datetime.now(timezone.utc)
    recipe = _recipe(expires_at=now - timedelta(days=1))
    with pytest.raises(HTTPException) as exc:
        assert_recipe_unlocked(_user(), recipe)
    assert exc.value.detail["code"] == "recipe_expired"


class _Query:
    def __init__(self, count_value: int):
        self._count = count_value

    def filter(self, *args, **kwargs):
        return self

    def count(self):
        return self._count


class _Db:
    def __init__(self, used: int):
        self.used = used

    def query(self, model):
        return _Query(self.used)


def test_assert_can_upload_blocks_at_free_limit():
    user = _user()
    with pytest.raises(HTTPException) as exc:
        assert_can_upload(_Db(FREE_UPLOADS_PER_DAY), user)
    assert exc.value.detail["code"] == "daily_upload_limit"


def test_usage_snapshot_remaining():
    user = _user()
    now = datetime(2026, 8, 15, 18, 0, tzinfo=timezone.utc)
    snapshot = usage_snapshot(_Db(1), user, now)
    assert snapshot["uploads_used_today"] == 1
    assert snapshot["uploads_remaining_today"] == 1
    assert snapshot["uploads_limit"] == 2
    assert snapshot["period_end"] == utc_day_start(now).replace(day=16).isoformat()
    assert FREE_VISIBILITY_DAYS == 14


def test_apply_subscription_keeps_pro_when_cancel_at_period_end():
    from app.services.stripe_billing import apply_subscription

    user = _user(
        stripe_customer_id=None,
        stripe_subscription_id=None,
        subscription_current_period_end=None,
        cancel_at_period_end=False,
    )
    period_end = int(datetime(2026, 9, 1, tzinfo=timezone.utc).timestamp())
    apply_subscription(
        user,
        SimpleNamespace(
            id="sub_123",
            customer="cus_123",
            status="active",
            current_period_end=period_end,
            cancel_at_period_end=True,
            items=None,
        ),
    )
    assert user.plan == "pro"
    assert user.subscription_status == "active"
    assert user.cancel_at_period_end is True
    assert is_pro(user) is True
    assert user.subscription_current_period_end == datetime(2026, 9, 1, tzinfo=timezone.utc)


def test_apply_subscription_clears_pro_when_canceled():
    from app.services.stripe_billing import apply_subscription

    user = _user(
        plan="pro",
        subscription_status="active",
        stripe_subscription_id="sub_123",
        stripe_customer_id="cus_123",
        subscription_current_period_end=datetime(2026, 9, 1, tzinfo=timezone.utc),
        cancel_at_period_end=True,
    )
    apply_subscription(
        user,
        SimpleNamespace(
            id="sub_123",
            customer="cus_123",
            status="canceled",
            current_period_end=int(datetime(2026, 9, 1, tzinfo=timezone.utc).timestamp()),
            cancel_at_period_end=False,
            items=None,
        ),
    )
    assert user.plan == "free"
    assert user.cancel_at_period_end is False
    assert is_pro(user) is False


def test_set_cancel_at_period_end_schedules_cancel(monkeypatch):
    from app.services.stripe_billing import set_cancel_at_period_end

    user = _user(
        plan="pro",
        subscription_status="active",
        stripe_subscription_id="sub_123",
        stripe_customer_id="cus_1",
        subscription_current_period_end=None,
        cancel_at_period_end=False,
    )
    period_end = int(datetime(2026, 9, 1, tzinfo=timezone.utc).timestamp())

    def fake_modify(subscription_id, cancel_at_period_end):
        assert subscription_id == "sub_123"
        assert cancel_at_period_end is True
        return SimpleNamespace(
            id=subscription_id,
            customer="cus_1",
            status="active",
            current_period_end=period_end,
            cancel_at_period_end=True,
            items=None,
        )

    monkeypatch.setattr("app.services.stripe_billing.require_stripe", lambda: None)
    monkeypatch.setattr("app.services.stripe_billing.stripe.Subscription.modify", fake_modify)

    result = set_cancel_at_period_end(SimpleNamespace(add=lambda obj: None, flush=lambda: None), user, True)
    assert result.cancel_at_period_end is True
    assert is_pro(result) is True


def test_cancel_requires_active_pro(monkeypatch):
    from app.services.stripe_billing import set_cancel_at_period_end

    monkeypatch.setattr("app.services.stripe_billing.require_stripe", lambda: None)
    with pytest.raises(HTTPException) as exc:
        set_cancel_at_period_end(SimpleNamespace(), _user(plan="free"), True)
    assert exc.value.status_code == 400
