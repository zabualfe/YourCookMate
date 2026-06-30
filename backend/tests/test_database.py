from app.config import normalize_database_url


def test_normalize_postgres_scheme():
    url = "postgres://postgres:secret@db.abc.supabase.co:5432/postgres"
    assert normalize_database_url(url) == (
        "postgresql://postgres:secret@db.abc.supabase.co:5432/postgres"
    )


def test_normalize_postgresql_unchanged():
    url = "postgresql://postgres:secret@db.abc.supabase.co:5432/postgres"
    assert normalize_database_url(url) == url


def test_normalize_sqlite_unchanged():
    url = "sqlite:///./yourcookmate.db"
    assert normalize_database_url(url) == url
