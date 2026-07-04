from __future__ import annotations

import json
import re
from typing import Any
from uuid import UUID

from shared.jobs_db import get_job

JOB_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


def handler(event, context):
    job_id_raw = (event.get("pathParameters") or {}).get("job_id", "").strip()
    if not JOB_ID_PATTERN.match(job_id_raw):
        return _response(400, {"detail": "Invalid job_id"})

    job = get_job(UUID(job_id_raw))
    if not job:
        return _response(404, {"detail": "Job not found"})

    return _response(
        200,
        {
            "job_id": job["job_id"],
            "status": job["status"],
            "result": job.get("result"),
            "error": job.get("error"),
        },
    )
