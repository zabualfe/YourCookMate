import inspect

from app.config import normalize_database_url
from app.database import _backfill_source_keys, _migrate_schema


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


def test_stripe_columns_migrate_in_schema_not_backfill():
    schema_src = inspect.getsource(_migrate_schema)
    backfill_src = inspect.getsource(_backfill_source_keys)
    assert "stripe_customer_id" in schema_src
    assert "stripe_customer_id" not in backfill_src
    assert "from sqlalchemy import inspect, text" in schema_src
