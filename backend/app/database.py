from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args)
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
    if "email_verified" not in user_cols:
        with engine.begin() as conn:
            if settings.database_url.startswith("sqlite"):
                conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT 0"))
            else:
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE")
                )
            conn.execute(text("UPDATE users SET email_verified = 1"))

    if "recipes" in insp.get_table_names():
        recipe_cols = {c["name"] for c in insp.get_columns("recipes")}
        with engine.begin() as conn:
            if "is_public" not in recipe_cols:
                if settings.database_url.startswith("sqlite"):
                    conn.execute(text("ALTER TABLE recipes ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT 0"))
                else:
                    conn.execute(text("ALTER TABLE recipes ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE"))
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


def init_db() -> None:
    from app.models import collection, email_verification_token, oauth_account, recipe, user  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_schema()
