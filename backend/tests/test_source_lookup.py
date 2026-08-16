from types import SimpleNamespace

from app.services.source_key import canonical_source_key, normalize_source_url, source_lookup_keys
from app.services.source_lookup import (
    CachedSourceRecipe,
    lookup_cached_source,
    persist_generated_source,
    remember_source,
    reset_source_l1,
    source_l1,
)


def setup_function():
    reset_source_l1()


def test_tiktok_video_id_key_strips_tracking():
    url = "https://www.tiktok.com/@chef/video/7123456789012345678?_t=8abc&_r=1"
    assert canonical_source_key(url) == "tiktok:7123456789012345678"
    assert canonical_source_key(url) == canonical_source_key(
        "https://tiktok.com/@other/video/7123456789012345678"
    )


def test_tiktok_short_link_key():
    key = canonical_source_key("https://vm.tiktok.com/ZMabcdef/")
    assert key.startswith("tiktok:")
    assert key == canonical_source_key("https://vm.tiktok.com/ZMabcdef/?_t=abc")
    assert key != canonical_source_key("https://tiktok.com/@chef/video/7123456789012345678")


def test_tiktok_video_id_alias_preferred():
    keys = source_lookup_keys(
        "https://vm.tiktok.com/ZMabcdef/",
        source_type="tiktok",
        video_id="7123456789012345678",
    )
    assert keys[0] == "tiktok:7123456789012345678"
    assert canonical_source_key("https://vm.tiktok.com/ZMabcdef/") in keys


def test_normalize_source_url():
    assert normalize_source_url("www.tiktok.com/@chef/video/1") == "https://tiktok.com/@chef/video/1"


def test_l1_hit_skips_db():
    payload = CachedSourceRecipe(
        source_key="tiktok:7123456789012345678",
        source_url="https://tiktok.com/@chef/video/7123456789012345678",
        source_type="tiktok",
        raw_text="1 cup flour\nMix and bake.",
        title="Pasta",
        parsed={"title": "Pasta", "ingredients": [], "steps": [{"order": 1, "instruction": "Mix"}]},
        used_ai=True,
    )
    remember_source(payload)

    class BoomDb:
        def query(self, *args, **kwargs):
            raise AssertionError("L1 hit should not query the database")

    cached = lookup_cached_source(
        BoomDb(),
        "https://www.tiktok.com/@chef/video/7123456789012345678?utm_source=share",
        "tiktok",
    )
    assert cached is not None
    assert cached.title == "Pasta"
    assert source_l1().get("tiktok:7123456789012345678") is cached


def test_l1_evicts_oldest():
    cache = source_l1()
    original = cache._maxsize
    cache._maxsize = 2
    try:
        for i in range(3):
            remember_source(
                CachedSourceRecipe(
                    source_key=f"tiktok:{i}",
                    source_url=f"https://tiktok.com/@c/video/{i}",
                    source_type="tiktok",
                    raw_text="recipe",
                    title=str(i),
                    parsed={"title": str(i), "ingredients": [], "steps": [{"order": 1, "instruction": "x"}]},
                    used_ai=True,
                )
            )
        assert cache.get("tiktok:0") is None
        assert cache.get("tiktok:2") is not None
    finally:
        cache._maxsize = original
        reset_source_l1()


def test_db_lookup_uses_generated_snapshot_not_recipe_edits():
    generated = SimpleNamespace(
        source_key="tiktok:7123456789012345678",
        source_url="https://tiktok.com/@chef/video/7123456789012345678",
        source_type="tiktok",
        raw_text="1. Boil pasta",
        generated_json={"title": "Generated Pasta", "ingredients": [], "steps": [{"order": 1, "instruction": "Boil"}]},
        title="Generated Pasta",
        used_ai=True,
    )

    class _ImportQuery:
        def filter(self, *args, **kwargs):
            return self

        def order_by(self, *args, **kwargs):
            return self

        def first(self):
            return generated

    class _Db:
        def query(self, model):
            assert model.__name__ == "SourceImport"
            return _ImportQuery()

    cached = lookup_cached_source(
        _Db(),
        "https://www.tiktok.com/@chef/video/7123456789012345678",
        "tiktok",
    )
    assert cached is not None
    assert cached.title == "Generated Pasta"
    assert cached.parsed["title"] == "Generated Pasta"
    assert source_l1().get("tiktok:7123456789012345678") is not None


def test_l1_keeps_generated_snapshot_over_later_payload():
    generated = CachedSourceRecipe(
        source_key="tiktok:1",
        source_url="https://tiktok.com/@c/video/1",
        source_type="tiktok",
        raw_text="generated",
        title="Generated",
        parsed={"title": "Generated", "ingredients": [], "steps": [{"order": 1, "instruction": "Mix"}]},
        used_ai=True,
    )
    remember_source(generated)
    remember_source(
        CachedSourceRecipe(
            source_key="tiktok:1",
            source_url="https://tiktok.com/@c/video/1",
            source_type="tiktok",
            raw_text="user edited",
            title="Edited",
            parsed={"title": "Edited", "ingredients": [], "steps": [{"order": 1, "instruction": "Skip"}]},
            used_ai=True,
        )
    )
    cached = source_l1().get("tiktok:1")
    assert cached is not None
    assert cached.title == "Generated"
    assert cached.parsed["title"] == "Generated"


def _recipe(source_key: str, source_url: str, source_type: str, title: str) -> CachedSourceRecipe:
    return CachedSourceRecipe(
        source_key=source_key,
        source_url=source_url,
        source_type=source_type,
        raw_text=f"1. Make {title}",
        title=title,
        parsed={"title": title, "ingredients": [], "steps": [{"order": 1, "instruction": "Mix"}]},
        used_ai=True,
    )


def test_youtube_watch_and_short_url_share_key():
    watch = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxx"
    short = "https://youtu.be/dQw4w9WgXcQ?si=abc"
    shorts = "https://youtube.com/shorts/dQw4w9WgXcQ"
    assert canonical_source_key(watch) == "youtube:dQw4w9WgXcQ"
    assert canonical_source_key(short) == "youtube:dQw4w9WgXcQ"
    assert canonical_source_key(shorts) == "youtube:dQw4w9WgXcQ"


def test_instagram_reel_and_share_share_key():
    reel = "https://www.instagram.com/reel/AbC123xyz/?igsh=abc"
    share = "https://www.instagram.com/share/reel/AbC123xyz"
    post = "https://instagram.com/p/AbC123xyz/"
    assert canonical_source_key(reel) == "instagram:AbC123xyz"
    assert canonical_source_key(share) == "instagram:AbC123xyz"
    assert canonical_source_key(post) == "instagram:AbC123xyz"


def test_facebook_watch_and_videos_share_key():
    watch = "https://www.facebook.com/watch/?v=123456789012345"
    videos = "https://www.facebook.com/someone/videos/123456789012345/"
    reel = "https://www.facebook.com/reel/123456789012345"
    assert canonical_source_key(watch) == "facebook:123456789012345"
    assert canonical_source_key(videos) == "facebook:123456789012345"
    assert canonical_source_key(reel) == "facebook:123456789012345"


def test_pinterest_and_vimeo_and_generic_keys():
    pin = "https://www.pinterest.com/pin/987654321/"
    assert canonical_source_key(pin) == "pinterest:987654321"
    vimeo = "https://vimeo.com/123456789"
    player = "https://player.vimeo.com/video/123456789"
    assert canonical_source_key(vimeo) == "vimeo:123456789"
    assert canonical_source_key(player) == "vimeo:123456789"
    generic = "https://cdn.example.com/recipes/garlic-pasta.mp4?token=abc"
    same = "https://cdn.example.com/recipes/garlic-pasta.mp4"
    other = "https://cdn.example.com/recipes/other.mp4"
    assert canonical_source_key(generic) == canonical_source_key(same)
    assert canonical_source_key(generic).startswith("video:")
    assert canonical_source_key(generic) != canonical_source_key(other)


def test_l1_reuses_generated_recipe_across_url_forms():
    remember_source(
        _recipe(
            "youtube:dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "youtube",
            "Pasta",
        )
    )

    class BoomDb:
        def query(self, *args, **kwargs):
            raise AssertionError("L1 hit should not query the database")

    cached = lookup_cached_source(BoomDb(), "https://youtu.be/dQw4w9WgXcQ", "youtube")
    assert cached is not None
    assert cached.title == "Pasta"


def test_persist_generated_source_is_first_write_wins():
    from app.models import collection, email_verification_token, oauth_account, user  # noqa: F401

    stored: dict = {"aliases": []}

    class _Query:
        def filter(self, *args, **kwargs):
            return self

        def first(self):
            return stored.get("row")

    class _Db:
        def query(self, model):
            return _Query()

        def add(self, row):
            if getattr(row, "generated_json", None) is not None:
                stored["row"] = row
            else:
                stored["aliases"].append(row)

    first = _recipe("tiktok:9", "https://tiktok.com/@c/video/9", "tiktok", "Generated")
    persist_generated_source(_Db(), first)
    persist_generated_source(
        _Db(),
        _recipe("tiktok:9", "https://tiktok.com/@c/video/9", "tiktok", "Edited"),
    )
    assert stored["row"].title == "Generated"
    assert stored["row"].generated_json["title"] == "Generated"


def test_persist_adds_aliases_for_new_url_forms():
    from app.models import collection, email_verification_token, oauth_account, user  # noqa: F401

    stored: dict = {"aliases": [], "alias_keys": set()}

    class _Query:
        def __init__(self, model):
            self.model = model

        def filter(self, *args, **kwargs):
            return self

        def first(self):
            name = getattr(self.model, "__name__", "")
            if name == "SourceImport":
                return stored.get("row")
            return object() if stored["alias_keys"] else None

    class _Db:
        def query(self, model):
            return _Query(model)

        def add(self, row):
            if getattr(row, "generated_json", None) is not None:
                stored["row"] = row
            else:
                stored["aliases"].append(row.alias_key)
                stored["alias_keys"].add(row.alias_key)

    persist_generated_source(
        _Db(),
        _recipe("youtube:dQw4w9WgXcQ", "https://youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "Pasta"),
        extra_keys=["youtube:dQw4w9WgXcQ", "video:deadbeef"],
    )
    persist_generated_source(
        _Db(),
        _recipe("youtube:dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "youtube", "Edited"),
        extra_keys=["youtube:dQw4w9WgXcQ", "video:deadbeef"],
    )
    assert stored["row"].title == "Pasta"
    assert stored["aliases"] == ["video:deadbeef"]


def test_lookup_follows_alias_to_generated_import():
    short = "https://example.com/s/abcxyz"
    alias_key = canonical_source_key(short)
    generated = SimpleNamespace(
        source_key="youtube:dQw4w9WgXcQ",
        source_url="https://youtube.com/watch?v=dQw4w9WgXcQ",
        source_type="youtube",
        raw_text="1. Boil pasta",
        generated_json={"title": "Generated Pasta", "ingredients": [], "steps": [{"order": 1, "instruction": "Boil"}]},
        title="Generated Pasta",
        used_ai=True,
    )
    alias = SimpleNamespace(alias_key=alias_key, source_key="youtube:dQw4w9WgXcQ")

    class _Query:
        def __init__(self, model, db):
            self.model = model
            self.db = db

        def filter(self, *args, **kwargs):
            return self

        def order_by(self, *args, **kwargs):
            return self

        def first(self):
            name = getattr(self.model, "__name__", "")
            if name == "SourceImportAlias":
                return alias
            if name == "SourceImport":
                self.db.import_hits += 1
                if self.db.import_hits == 1:
                    return None
                return generated
            return None

    class _Db:
        def __init__(self):
            self.import_hits = 0

        def query(self, model):
            return _Query(model, self)

    cached = lookup_cached_source(_Db(), short, expanded=short)
    assert cached is not None
    assert cached.title == "Generated Pasta"
    assert cached.source_key == "youtube:dQw4w9WgXcQ"


def test_tiktok_lookup_keys_and_url_needles():
    from app.services.source_key import all_source_lookup_keys
    from app.services.source_lookup import _source_url_needles, _url_match_values

    url = "https://www.tiktok.com/@chef_natalie_/video/7345364902468472106"
    keys = all_source_lookup_keys(url, expanded=url)
    assert "tiktok:7345364902468472106" in keys
    assert "/video/7345364902468472106" in _source_url_needles(keys)
    variants = _url_match_values(url)
    assert "https://tiktok.com/@chef_natalie_/video/7345364902468472106" in variants
    assert url in variants
    tracked = "https://www.tiktok.com/@chef_natalie_/video/7345364902468472106?is_from_webapp=1"
    assert any("/video/7345364902468472106" in value for value in _url_match_values(tracked) + [tracked])
