from __future__ import annotations

import json
import logging
import os
from typing import Any

from ingest_lib.social_ingest import preview_link_metadata
from shared.http_response import json_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_lambda_client = None


def _warm_ingest_worker() -> None:
    """Kick the fat ingest Lambda while preview runs so Create is not a cold start."""
    name = (os.environ.get("INGEST_WORKER_FUNCTION_NAME") or "").strip()
    if not name:
        return
    global _lambda_client
    try:
        if _lambda_client is None:
            import boto3

            _lambda_client = boto3.client("lambda")
        _lambda_client.invoke(
            FunctionName=name,
            InvocationType="Event",
            Payload=b'{"Records":[]}',
        )
    except Exception:
        logger.info("ingest worker warmup skipped", exc_info=True)


def handler(event, context):
    try:
        payload = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return json_response(400, {"detail": "Invalid JSON body"})

    url = payload.get("url")
    if not isinstance(url, str):
        return json_response(422, {"detail": "url is required"})
    if len(url.strip()) < 10:
        return json_response(422, {"detail": "url is too short"})
    if len(url) > 2048:
        return json_response(422, {"detail": "url is too long"})

    _warm_ingest_worker()
    result: dict[str, Any] = preview_link_metadata(url)
    return json_response(200, result)
