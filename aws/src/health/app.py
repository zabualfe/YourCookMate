from __future__ import annotations

import json


def handler(event, context):
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({"status": "ok", "service": "yourcookmate-aws"}),
    }
