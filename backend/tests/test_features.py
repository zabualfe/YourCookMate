from app.config import settings
from app.main import features
from app.services.instacart import instacart_shopping_available
from app.services.instacart_connect import connect_is_configured


def test_features_all_off_by_default(monkeypatch):
    monkeypatch.setattr(settings, "instacart_enabled", False)
    monkeypatch.setattr(settings, "instacart_api_key", None)
    monkeypatch.setattr(settings, "instacart_connect_client_id", None)
    monkeypatch.setattr(settings, "instacart_connect_client_secret", None)
    monkeypatch.setattr(settings, "instacart_connect_authorize_url", None)

    result = features()
    assert result.instacart is False
    assert result.instacart_shopping is False
    assert result.instacart_connect is False


def test_features_shopping_when_enabled_with_key(monkeypatch):
    monkeypatch.setattr(settings, "instacart_enabled", True)
    monkeypatch.setattr(settings, "instacart_api_key", "keys.test")
    assert instacart_shopping_available() is True

    result = features()
    assert result.instacart is True
    assert result.instacart_shopping is True
    assert result.instacart_connect is connect_is_configured()
