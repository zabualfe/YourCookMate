from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)

STAGE = os.environ.get("STAGE", "prod")
BEDROCK_PARSE_MODEL = os.environ.get("BEDROCK_PARSE_MODEL", "amazon.nova-lite-v1:0")


def _process_job(message: dict[str, Any]) -> None:
    job_id = message.get("job_id")
    job_type = message.get("type")
    payload = message.get("payload") or {}

    logger.info(
        "ingest worker received job_id=%s type=%s url=%s stage=%s model=%s",
        job_id,
        job_type,
        payload.get("url"),
        STAGE,
        BEDROCK_PARSE_MODEL,
    )

    # Phase 1 stub: log and succeed. Next steps wire Supabase jobs table + Bedrock Nova.
    logger.info("job_id=%s status=completed (stub worker)", job_id)


def handler(event, context):
    for record in event.get("Records", []):
        body = json.loads(record["body"])
        _process_job(body)
    return {"batchItemFailures": []}
