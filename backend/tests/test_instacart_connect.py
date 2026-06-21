from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services import instacart_connect as svc


@pytest.fixture
def user():
    uid = uuid4()
    return SimpleNamespace(id=uid, display_name="Jane Cook", email="chef@example.com")


def test_connect_is_configured_false_when_missing(monkeypatch):
    monkeypatch.setattr(svc.settings, "instacart_connect_client_id", None)
    monkeypatch.setattr(svc.settings, "instacart_connect_client_secret", None)
    monkeypatch.setattr(svc.settings, "instacart_connect_authorize_url", None)
    assert svc.connect_is_configured() is False


def test_connect_is_configured_true(monkeypatch):
    monkeypatch.setattr(svc.settings, "instacart_enabled", True)
    monkeypatch.setattr(svc.settings, "instacart_connect_client_id", "cid")
    monkeypatch.setattr(svc.settings, "instacart_connect_client_secret", "secret")
    monkeypatch.setattr(svc.settings, "instacart_connect_authorize_url", "https://instacart.test/oauth")
    assert svc.connect_is_configured() is True


def test_build_authorize_url(monkeypatch):
    monkeypatch.setattr(svc.settings, "instacart_enabled", True)
    monkeypatch.setattr(svc.settings, "instacart_connect_client_id", "cid")
    monkeypatch.setattr(svc.settings, "instacart_connect_client_secret", "secret")
    monkeypatch.setattr(svc.settings, "instacart_connect_authorize_url", "https://instacart.test/oauth")
    monkeypatch.setattr(svc.settings, "api_base_url", "http://localhost:8000")

    url = svc.build_authorize_url("state123")
    assert "client_id=cid" in url
    assert "scope=account_linking" in url
    assert "state=state123" in url
    assert "redirect_uri=" in url


def test_start_connect_flow_returns_url(user, monkeypatch):
    monkeypatch.setattr(svc.settings, "instacart_enabled", True)
    monkeypatch.setattr(svc.settings, "instacart_connect_client_id", "cid")
    monkeypatch.setattr(svc.settings, "instacart_connect_client_secret", "secret")
    monkeypatch.setattr(svc.settings, "instacart_connect_authorize_url", "https://instacart.test/oauth")
    monkeypatch.setattr(svc.settings, "api_base_url", "http://localhost:8000")

    url = svc.start_connect_flow(user, "/profile")
    assert "https://instacart.test/oauth" in url
    assert "state=" in url


def test_get_connect_status_disabled(monkeypatch, user):
    monkeypatch.setattr(svc.settings, "instacart_enabled", False)
    db = MagicMock()
    status = svc.get_connect_status(db, user)
    assert status["configured"] is False
    assert status["linked"] is False


def test_get_connect_status_unconfigured(monkeypatch):
    monkeypatch.setattr(svc, "connect_is_configured", lambda: False)
    db = MagicMock()
    user = SimpleNamespace(id=uuid4())
    status = svc.get_connect_status(db, user)
    assert status == {
        "configured": False,
        "linked": False,
        "instacart_plus_member": None,
        "expired_at": None,
    }


def test_get_connect_status_linked_locally(monkeypatch, user):
    monkeypatch.setattr(svc.settings, "instacart_enabled", True)
    monkeypatch.setattr(svc, "connect_is_configured", lambda: True)
    monkeypatch.setattr(svc, "has_local_instacart_link", lambda db, uid: True)
    monkeypatch.setattr(svc, "get_fulfillment_access_token", lambda: "ftok")
    monkeypatch.setattr(
        svc,
        "fetch_link_status",
        lambda uid, tok: {"instacartplus_member": True, "expired_at": "2026-12-31"},
    )

    db = MagicMock()
    status = svc.get_connect_status(db, user)
    assert status["configured"] is True
    assert status["linked"] is True
    assert status["instacart_plus_member"] is True
    assert status["expired_at"] == "2026-12-31"


def test_require_connect_config_raises(monkeypatch):
    monkeypatch.setattr(svc, "connect_is_configured", lambda: False)
    with pytest.raises(HTTPException) as exc:
        svc._require_connect_config()
    assert exc.value.status_code == 503
