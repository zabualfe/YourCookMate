from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import boto3

from shared.jobs_db import create_job

sqs = boto3.client("sqs")
QUEUE_URL = os.environ["INGEST_QUEUE_URL"]


def _response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


def _validate_url(url: str) -> str | None:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return "url must be a valid http(s) link"
    if len(url) < 10 or len(url) > 2048:
        return "url length must be between 10 and 2048 characters"
    return None


def handler(event, context):
    try:
        payload = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"detail": "Invalid JSON body"})

    url = payload.get("url")
    if not isinstance(url, str):
        return _response(422, {"detail": "url is required"})

    url_error = _validate_url(url)
    if url_error:
        return _response(422, {"detail": url_error})

    caption = payload.get("caption")
    if caption is not None and not isinstance(caption, str):
        return _response(422, {"detail": "caption must be a string"})
    if isinstance(caption, str) and len(caption) > 50000:
        return _response(422, {"detail": "caption is too long"})

    job_id = uuid.uuid4()
    message = {
        "job_id": str(job_id),
        "type": "ingest_link",
        "payload": {"url": url.strip(), "caption": caption},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    create_job(job_id, "ingest_link", message["payload"])
    sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=json.dumps(message))

    return _response(
        202,
        {
            "job_id": str(job_id),
            "status": "queued",
        },
    )
