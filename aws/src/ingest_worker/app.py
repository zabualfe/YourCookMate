from __future__ import annotations

import json
import logging
import os
from typing import Any
from uuid import UUID

import httpx

from shared.jobs_db import dumps_result, get_job, update_job_status

logger = logging.getLogger()
logger.setLevel(logging.INFO)

INGEST_API_URL = os.environ.get("INGEST_API_URL", "").strip().rstrip("/")
INGEST_TIMEOUT_SECONDS = float(os.environ.get("INGEST_TIMEOUT_SECONDS", "600"))


def _run_ingest(url: str, caption: str | None) -> dict[str, Any]:
    if not INGEST_API_URL:
        raise RuntimeError("INGEST_API_URL is not configured on the worker")

    body: dict[str, Any] = {"url": url}
    if caption:
        body["caption"] = caption

    with httpx.Client(timeout=INGEST_TIMEOUT_SECONDS) as client:
        response = client.post(f"{INGEST_API_URL}/ingest/link", json=body)
        if response.status_code >= 400:
            detail = response.text
            try:
                payload = response.json()
                if isinstance(payload, dict) and payload.get("detail"):
                    detail = payload["detail"]
            except Exception:
                pass
            raise RuntimeError(str(detail))
        return response.json()


def _process_job(message: dict[str, Any]) -> None:
    job_id = UUID(message["job_id"])
    payload = message.get("payload") or {}
    url = payload.get("url")
    caption = payload.get("caption")

    logger.info("processing job_id=%s url=%s", job_id, url)
    update_job_status(job_id, "processing")

    try:
        if not isinstance(url, str):
            raise ValueError("Missing url in job payload")
        result = _run_ingest(url, caption if isinstance(caption, str) else None)
        update_job_status(job_id, "completed", result=dumps_result(result))
        logger.info("job_id=%s completed", job_id)
    except Exception as exc:
        logger.exception("job_id=%s failed", job_id)
        update_job_status(job_id, "failed", error=str(exc))
        raise


def handler(event, context):
    failures: list[dict[str, str]] = []
    for record in event.get("Records", []):
        body = json.loads(record["body"])
        job_id = body.get("job_id", "unknown")
        try:
            _process_job(body)
        except Exception:
            failures.append({"itemIdentifier": record["messageId"]})
            logger.error("job_id=%s will retry or go to DLQ", job_id)
    return {"batchItemFailures": failures}
