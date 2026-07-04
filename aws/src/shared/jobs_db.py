from __future__ import annotations

import json
import os
from contextlib import contextmanager
from typing import Any, Iterator, Optional
from uuid import UUID

import psycopg2
from psycopg2.extras import Json, RealDictCursor


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    return url


@contextmanager
def _connection() -> Iterator[Any]:
    conn = psycopg2.connect(_database_url(), sslmode=os.environ.get("DATABASE_SSLMODE", "require"))
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def ensure_jobs_table() -> None:
    with _connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id UUID PRIMARY KEY,
                    user_id UUID NULL,
                    job_type VARCHAR(64) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    payload JSONB NOT NULL DEFAULT '{}',
                    result JSONB NULL,
                    error TEXT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS ix_jobs_status ON jobs (status)")


def create_job(job_id: UUID, job_type: str, payload: dict[str, Any], user_id: Optional[UUID] = None) -> None:
    ensure_jobs_table()
    with _connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO jobs (id, user_id, job_type, status, payload)
                VALUES (%s, %s, %s, 'queued', %s)
                """,
                (str(job_id), str(user_id) if user_id else None, job_type, Json(payload)),
            )


def update_job_status(
    job_id: UUID,
    status: str,
    *,
    result: Optional[dict[str, Any]] = None,
    error: Optional[str] = None,
) -> None:
    with _connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE jobs
                SET status = %s,
                    result = %s,
                    error = %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (status, Json(result) if result is not None else None, error, str(job_id)),
            )


def get_job(job_id: UUID) -> Optional[dict[str, Any]]:
    ensure_jobs_table()
    with _connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, user_id, job_type, status, payload, result, error, created_at, updated_at
                FROM jobs WHERE id = %s
                """,
                (str(job_id),),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "job_id": str(row["id"]),
                "status": row["status"],
                "job_type": row["job_type"],
                "payload": row["payload"] or {},
                "result": row["result"],
                "error": row["error"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }


def dumps_result(result: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(result))
