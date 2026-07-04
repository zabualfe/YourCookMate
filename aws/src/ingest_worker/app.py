from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from ingest_lib.errors import IngestError
from ingest_lib.social_ingest import ingest_social_link
from shared.jobs_db import dumps_result, update_job_status

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _process_job(message: dict[str, Any]) -> None:
    job_id = UUID(message["job_id"])
    payload = message.get("payload") or {}
    url = payload.get("url")
    caption = payload.get("caption")

    logger.info("processing job_id=%s url=%s", job_id, url)
    update_job_status(job_id, "processing")

    if not isinstance(url, str):
        raise ValueError("Missing url in job payload")

    result = ingest_social_link(url, caption if isinstance(caption, str) else None)
    update_job_status(job_id, "completed", result=dumps_result(result))
    logger.info("job_id=%s completed", job_id)


def handler(event, context):
    failures: list[dict[str, str]] = []
    for record in event.get("Records", []):
        body = json.loads(record["body"])
        job_id_raw = body.get("job_id", "")
        try:
            _process_job(body)
        except IngestError as exc:
            logger.warning("job_id=%s ingest error: %s", job_id_raw, exc.message)
            update_job_status(UUID(job_id_raw), "failed", error=exc.message)
        except Exception as exc:
            logger.exception("job_id=%s failed", job_id_raw)
            try:
                update_job_status(UUID(job_id_raw), "failed", error=str(exc))
            except Exception:
                pass
            failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}
