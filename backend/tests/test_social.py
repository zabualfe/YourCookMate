from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.services.usernames import UsernameError, validate_username


def test_validate_username_accepts_handles():
    assert validate_username("Chef_Jane") == "chef_jane"
    assert validate_username("@pasta") == "pasta"


@pytest.mark.parametrize(
    "raw",
    ["ab", "thisusernameiswaytoolong", "Hello!", "admin", "Community", ""],
)
def test_validate_username_rejects_invalid(raw):
    with pytest.raises(UsernameError):
        validate_username(raw)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr("app.main.init_db", lambda: None)
    monkeypatch.setattr("app.services.feature_flags.is_feature_enabled", lambda _key: True)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    from app.models import (  # noqa: F401
        collection,
        email_verification_token,
        feature_flag,
        follow,
        job,
        oauth_account,
        recipe,
        source_import,
        usage,
        user,
    )

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, TestingSession
    app.dependency_overrides.clear()


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str, username: str | None = None, display_name: str | None = None):
    body = {"email": email, "password": "password123"}
    if username:
        body["username"] = username
    if display_name:
        body["display_name"] = display_name
    response = client.post("/auth/register", json=body)
    assert response.status_code == 200, response.text
    data = response.json()
    return data["access_token"], data["user"]


def _verify(session_factory, email: str) -> None:
    db = session_factory()
    try:
        row = db.query(User).filter(User.email == email).first()
        assert row is not None
        row.email_verified = True
        db.commit()
    finally:
        db.close()


def _recipe_payload(title: str) -> dict:
    return {
        "raw_text": f"{title} recipe",
        "used_ai": False,
        "recipe": {
            "title": title,
            "ingredients": [{"name": "salt"}],
            "steps": [{"order": 1, "instruction": "Cook it"}],
        },
    }


def _share_community(client: TestClient, token: str, title: str) -> dict:
    created = client.post("/recipes", json=_recipe_payload(title), headers=_headers(token))
    assert created.status_code == 201, created.text
    recipe_id = created.json()["id"]
    shared = client.post(
        f"/recipes/{recipe_id}/community",
        json={"enabled": True},
        headers=_headers(token),
    )
    assert shared.status_code == 200, shared.text
    return created.json()


def test_username_uniqueness_and_reserved(client):
    test_client, _ = client
    token, user = _register(test_client, "alice@example.com", username="alice")
    assert user["username"] == "alice"

    taken = test_client.post(
        "/auth/register",
        json={"email": "other@example.com", "password": "password123", "username": "Alice"},
    )
    assert taken.status_code == 409

    reserved = test_client.post(
        "/auth/register",
        json={"email": "admin@example.com", "password": "password123", "username": "admin"},
    )
    assert reserved.status_code == 400

    patched = test_client.patch("/auth/me", json={"username": "alice_cook"}, headers=_headers(token))
    assert patched.status_code == 200
    assert patched.json()["username"] == "alice_cook"


def test_cannot_follow_yourself(client):
    test_client, _ = client
    token, _ = _register(test_client, "solo@example.com", username="solo")
    response = test_client.post("/users/solo/follow", headers=_headers(token))
    assert response.status_code == 400


def test_follow_unfollow_and_following_feed(client):
    test_client, sessions = client
    alice_token, _ = _register(test_client, "alice@example.com", username="alice", display_name="Alice")
    bob_token, _ = _register(test_client, "bob@example.com", username="bob", display_name="Bob")
    cara_token, _ = _register(test_client, "cara@example.com", username="cara")

    _verify(sessions, "alice@example.com")
    _verify(sessions, "bob@example.com")
    _verify(sessions, "cara@example.com")

    _share_community(test_client, alice_token, "Alice Pasta")
    _share_community(test_client, bob_token, "Bob Soup")

    follow = test_client.post("/users/alice/follow", headers=_headers(cara_token))
    assert follow.status_code == 200
    assert follow.json()["following"] is True
    assert follow.json()["follower_count"] == 1

    following = test_client.get("/community/recipes?feed=following", headers=_headers(cara_token))
    assert following.status_code == 200
    titles = [item["title"] for item in following.json()["items"]]
    assert titles == ["Alice Pasta"]

    discover = test_client.get("/community/recipes")
    discover_titles = {item["title"] for item in discover.json()["items"]}
    assert discover_titles == {"Alice Pasta", "Bob Soup"}

    search = test_client.get("/community/recipes?q=alice")
    assert [item["title"] for item in search.json()["items"]] == ["Alice Pasta"]
    assert search.json()["items"][0]["author_username"] == "alice"

    profile = test_client.get("/users/alice", headers=_headers(cara_token))
    assert profile.status_code == 200
    assert profile.json()["is_following"] is True
    assert profile.json()["follower_count"] == 1
    assert [item["title"] for item in profile.json()["recipes"]] == ["Alice Pasta"]

    unfollow = test_client.delete("/users/alice/follow", headers=_headers(cara_token))
    assert unfollow.status_code == 200
    assert unfollow.json()["following"] is False
    empty = test_client.get("/community/recipes?feed=following", headers=_headers(cara_token))
    assert empty.json()["items"] == []


def test_pin_top_three_recipes(client):
    test_client, sessions = client
    token, _ = _register(test_client, "pinner@example.com", username="pinner")
    _verify(sessions, "pinner@example.com")

    first = _share_community(test_client, token, "One")
    second = _share_community(test_client, token, "Two")
    third = _share_community(test_client, token, "Three")
    fourth = _share_community(test_client, token, "Four")

    unshared = test_client.post("/recipes", json=_recipe_payload("Private"), headers=_headers(token))
    assert unshared.status_code == 201
    blocked = test_client.post(
        f"/recipes/{unshared.json()['id']}/pin",
        json={"enabled": True},
        headers=_headers(token),
    )
    assert blocked.status_code == 400
    assert blocked.json()["detail"]["code"] == "community_required"

    for recipe in (first, second, third):
        pinned = test_client.post(
            f"/recipes/{recipe['id']}/pin",
            json={"enabled": True},
            headers=_headers(token),
        )
        assert pinned.status_code == 200, pinned.text
        assert pinned.json()["pinned_rank"] in {1, 2, 3}

    over = test_client.post(
        f"/recipes/{fourth['id']}/pin",
        json={"enabled": True},
        headers=_headers(token),
    )
    assert over.status_code == 400
    assert over.json()["detail"]["code"] == "pin_limit"

    profile = test_client.get("/users/pinner")
    titles = [item["title"] for item in profile.json()["recipes"]]
    assert titles[:3] == ["One", "Two", "Three"]
    assert [item["pinned_rank"] for item in profile.json()["recipes"][:3]] == [1, 2, 3]
    assert titles[3] == "Four"

    unpinned = test_client.post(
        f"/recipes/{first['id']}/pin",
        json={"enabled": False},
        headers=_headers(token),
    )
    assert unpinned.status_code == 200
    assert unpinned.json()["pinned_rank"] is None

    profile = test_client.get("/users/pinner")
    pinned_items = [item for item in profile.json()["recipes"] if item["pinned_rank"]]
    assert [item["title"] for item in pinned_items] == ["Two", "Three"]
    assert [item["pinned_rank"] for item in pinned_items] == [1, 2]


def test_community_share_requires_username(client):
    test_client, sessions = client
    token, user = _register(test_client, "noname@example.com")
    assert user["username"] is None
    _verify(sessions, "noname@example.com")

    created = test_client.post("/recipes", json=_recipe_payload("Secret Stew"), headers=_headers(token))
    assert created.status_code == 201
    shared = test_client.post(
        f"/recipes/{created.json()['id']}/community",
        json={"enabled": True},
        headers=_headers(token),
    )
    assert shared.status_code == 400
    assert shared.json()["detail"]["code"] == "username_required"

    test_client.patch("/auth/me", json={"username": "stewfan"}, headers=_headers(token))
    shared_ok = test_client.post(
        f"/recipes/{created.json()['id']}/community",
        json={"enabled": True},
        headers=_headers(token),
    )
    assert shared_ok.status_code == 200
    assert shared_ok.json()["shared_to_community"] is True


def test_following_feed_requires_auth(client):
    test_client, _ = client
    response = test_client.get("/community/recipes?feed=following")
    assert response.status_code == 401
