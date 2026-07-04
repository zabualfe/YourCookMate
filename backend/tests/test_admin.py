from types import SimpleNamespace

from app.config import settings
from app.services.admin import is_admin_user


def _user(email: str):
    return SimpleNamespace(email=email)


def test_is_admin_user_default_email():
    assert is_admin_user(_user("zabualfe@gmail.com")) is True


def test_is_admin_user_rejects_others():
    assert is_admin_user(_user("other@gmail.com")) is False


def test_is_admin_user_supports_list(monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "zabualfe@gmail.com,admin@example.com")
    assert is_admin_user(_user("admin@example.com")) is True
