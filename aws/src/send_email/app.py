from __future__ import annotations

import json
import os
import re

import httpx

from shared.http_response import json_response

RESEND_API_URL = "https://api.resend.com/emails"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _headers(event: dict) -> dict[str, str]:
    raw = event.get("headers") or {}
    return {str(k).lower(): str(v) for k, v in raw.items()}


def _authorized(event: dict) -> bool:
    secret = os.environ.get("EMAIL_API_SECRET", "").strip()
    if not secret:
        return False

    headers = _headers(event)
    auth = headers.get("authorization", "")
    if auth == f"Bearer {secret}":
        return True
    return headers.get("x-email-api-secret") == secret


def _send_via_resend(*, to_email: str, subject: str, text: str, html: str | None) -> None:
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured on the email Lambda")

    from_addr = os.environ.get("SMTP_FROM", "noreply@yourcookmate.com").strip()
    payload: dict = {
        "from": f"Your Cook Mate <{from_addr}>",
        "to": [to_email],
        "subject": subject,
        "text": text,
    }
    if html:
        payload["html"] = html

    response = httpx.post(
        RESEND_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if response.status_code >= 400:
        detail = response.text.strip() or response.reason_phrase
        raise RuntimeError(f"Resend API error ({response.status_code}): {detail}")


def handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return json_response(204, {})

    if not _authorized(event):
        return json_response(401, {"detail": "Unauthorized"})

    try:
        payload = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return json_response(400, {"detail": "Invalid JSON body"})

    to_email = payload.get("to")
    subject = payload.get("subject")
    text = payload.get("text")
    html = payload.get("html")

    if not isinstance(to_email, str) or not EMAIL_RE.match(to_email.strip()):
        return json_response(422, {"detail": "to must be a valid email address"})
    if not isinstance(subject, str) or not subject.strip():
        return json_response(422, {"detail": "subject is required"})
    if not isinstance(text, str) or not text.strip():
        return json_response(422, {"detail": "text is required"})
    if html is not None and not isinstance(html, str):
        return json_response(422, {"detail": "html must be a string"})

    try:
        _send_via_resend(
            to_email=to_email.strip(),
            subject=subject.strip(),
            text=text,
            html=html,
        )
    except Exception as exc:
        return json_response(502, {"detail": str(exc)})

    return json_response(200, {"ok": True})
