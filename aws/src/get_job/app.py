from __future__ import annotations

import json
import re
from typing import Any

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
    job_id = (event.get("pathParameters") or {}).get("job_id", "").strip()
    if not JOB_ID_PATTERN.match(job_id):
        return _response(400, {"detail": "Invalid job_id"})

    # Phase 1 stub until Supabase jobs table is wired in the worker.
    return _response(
        200,
        {
            "job_id": job_id,
            "status": "queued",
            "result": None,
            "error": None,
            "note": "Job status persistence (Supabase) coming in the next AWS integration step.",
        },
    )
