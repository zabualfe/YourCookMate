from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

connect_args: dict = {}
engine_kwargs: dict = {"pool_pre_ping": True}
if settings.uses_sqlite:
    connect_args["check_same_thread"] = False
elif settings.uses_supabase:
    connect_args["sslmode"] = "require"
    engine_kwargs["pool_recycle"] = 3600

if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    from sqlalchemy.pool import NullPool

    engine_kwargs["poolclass"] = NullPool

engine = create_engine(
    settings.resolved_database_url,
    connect_args=connect_args,
    **engine_kwargs,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_schema() -> None:
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "users" not in insp.get_table_names():
        return

    user_cols = {c["name"] for c in insp.get_columns("users")}
    with engine.begin() as conn:
        if "email_verified" not in user_cols:
            if settings.uses_sqlite:
                conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT 0"))
                conn.execute(text("UPDATE users SET email_verified = 1"))
            else:
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE")
                )
                conn.execute(text("UPDATE users SET email_verified = TRUE"))
        if "stripe_customer_id" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255)"))
        if "stripe_subscription_id" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255)"))
        if "plan" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN plan VARCHAR(32) NOT NULL DEFAULT 'free'"))
        if "subscription_status" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN subscription_status VARCHAR(32)"))
        if "subscription_current_period_end" not in user_cols:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN subscription_current_period_end TIMESTAMP WITH TIME ZONE")
            )
        if "cancel_at_period_end" not in user_cols:
            if settings.uses_sqlite:
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT 0")
                )
            else:
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE")
                )
        if "username" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(20)"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))

    if "recipes" in insp.get_table_names():
        recipe_cols = {c["name"] for c in insp.get_columns("recipes")}
        with engine.begin() as conn:
            if "is_public" not in recipe_cols:
                if settings.uses_sqlite:
                    conn.execute(text("ALTER TABLE recipes ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT 0"))
                else:
                    conn.execute(text("ALTER TABLE recipes ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE"))
            if "shared_to_community" not in recipe_cols:
                if settings.uses_sqlite:
                    conn.execute(
                        text("ALTER TABLE recipes ADD COLUMN shared_to_community BOOLEAN NOT NULL DEFAULT 0")
                    )
                else:
                    conn.execute(
                        text("ALTER TABLE recipes ADD COLUMN shared_to_community BOOLEAN NOT NULL DEFAULT FALSE")
                    )
            if "share_slug" not in recipe_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN share_slug VARCHAR(32)"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_recipes_share_slug ON recipes (share_slug)"))
            if "icon_path" not in recipe_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN icon_path VARCHAR(512)"))
            if "source_url" not in recipe_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN source_url VARCHAR(2048)"))
            if "instacart_link_url" not in recipe_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN instacart_link_url VARCHAR(2048)"))
            if "instacart_ingredients_hash" not in recipe_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN instacart_ingredients_hash VARCHAR(64)"))
            if "expires_at" not in recipe_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE"))
            if "source_key" not in recipe_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN source_key VARCHAR(128)"))
            if "pinned_rank" not in recipe_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN pinned_rank INTEGER"))
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_recipes_user_pinned_rank "
                        "ON recipes (user_id, pinned_rank)"
                    )
                )
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_recipes_source_key ON recipes (source_key)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_recipes_source_url ON recipes (source_url)"))


def _backfill_source_keys() -> None:
    from sqlalchemy import inspect

    insp = inspect(engine)
    if "recipes" not in insp.get_table_names():
        return
    recipe_cols = {c["name"] for c in insp.get_columns("recipes")}
    if "source_key" not in recipe_cols:
        return

    from app.models.recipe import Recipe
    from app.services.source_key import canonical_source_key

    db = SessionLocal()
    try:
        rows = (
            db.query(Recipe)
            .filter(Recipe.source_url.isnot(None), Recipe.source_key.is_(None))
            .all()
        )
        changed = False
        for row in rows:
            key = canonical_source_key(row.source_url or "", row.source_type)
            if key:
                row.source_key = key
                changed = True
        if changed:
            db.commit()
    finally:
        db.close()


def init_db() -> None:
    from app.models import collection, email_verification_token, feature_flag, follow, job, oauth_account, recipe, source_import, usage, user  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_schema()
    _backfill_source_keys()

    from app.services.feature_flag_store import seed_feature_flags

    db = SessionLocal()
    try:
        seed_feature_flags(db)
    finally:
        db.close()
