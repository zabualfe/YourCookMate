from app.config import settings
from app.services.instacart import instacart_shopping_available, require_instacart_shopping


def test_instacart_shopping_unavailable_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "instacart_enabled", False)
    monkeypatch.setattr(settings, "instacart_api_key", "keys.test")
    assert instacart_shopping_available() is False


def test_instacart_shopping_unavailable_without_key(monkeypatch):
    monkeypatch.setattr(settings, "instacart_enabled", True)
    monkeypatch.setattr(settings, "instacart_api_key", None)
    assert instacart_shopping_available() is False


def test_instacart_shopping_available(monkeypatch):
    monkeypatch.setattr(settings, "instacart_enabled", True)
    monkeypatch.setattr(settings, "instacart_api_key", "keys.test")
    assert instacart_shopping_available() is True


def test_require_instacart_shopping_disabled(monkeypatch):
    import pytest
    from fastapi import HTTPException

    monkeypatch.setattr(settings, "instacart_enabled", False)
    with pytest.raises(HTTPException) as exc:
        require_instacart_shopping()
    assert exc.value.status_code == 503
    assert "disabled" in str(exc.value.detail).lower()
