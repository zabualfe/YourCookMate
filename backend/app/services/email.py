from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _smtp_connection():
    use_ssl = settings.smtp_use_ssl or settings.smtp_port == 465
    if use_ssl:
        return smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30)

    server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30)
    if settings.smtp_use_tls:
        server.starttls()
    return server


def _send_via_email_api(
    *,
    to_email: str,
    subject: str,
    body: str,
    html: str | None = None,
) -> None:
    base = (settings.email_api_url or "").rstrip("/")
    secret = settings.email_api_secret
    if not base or not secret:
        raise RuntimeError("EMAIL_API_URL and EMAIL_API_SECRET must both be set")

    payload: dict = {
        "to": to_email,
        "subject": subject,
        "text": body,
    }
    if html:
        payload["html"] = html

    response = httpx.post(
        f"{base}/email/send",
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if response.status_code >= 400:
        detail = response.text.strip() or response.reason_phrase
        raise RuntimeError(f"Email API error ({response.status_code}): {detail}")

    logger.info("Email sent via API Gateway to %s", to_email)


def _send_via_resend_api(
    *,
    to_email: str,
    subject: str,
    body: str,
    html: str | None = None,
) -> None:
    api_key = settings.resend_api_key
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured")

    payload: dict = {
        "from": f"Your Cook Mate <{settings.smtp_from}>",
        "to": [to_email],
        "subject": subject,
        "text": body,
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

    logger.info("Email sent via Resend API to %s", to_email)


def _send_via_smtp(
    *,
    to_email: str,
    subject: str,
    body: str,
    html: str | None = None,
) -> None:
    if not settings.smtp_host:
        raise RuntimeError("SMTP_HOST is not configured")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"Your Cook Mate <{settings.smtp_from}>"
    msg["To"] = to_email
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    with _smtp_connection() as server:
        password = settings.smtp_pass
        if settings.smtp_user and password:
            server.login(settings.smtp_user, password)
        server.send_message(msg)

    logger.info("Email sent via SMTP to %s", to_email)


def send_email(*, to_email: str, subject: str, body: str, html: str | None = None) -> None:
    if settings.email_api_url and settings.email_api_secret:
        _send_via_email_api(to_email=to_email, subject=subject, body=body, html=html)
        return

    if settings.resend_api_key:
        _send_via_resend_api(to_email=to_email, subject=subject, body=body, html=html)
        return

    _send_via_smtp(to_email=to_email, subject=subject, body=body, html=html)


def _email_configured() -> bool:
    if settings.email_api_url and settings.email_api_secret:
        return True
    if settings.resend_api_key:
        return True
    return bool(settings.smtp_host and settings.smtp_pass)


def email_transport() -> str:
    if settings.email_api_url and settings.email_api_secret:
        return "api_gateway"
    if settings.resend_api_key:
        return "resend_api"
    if settings.smtp_host:
        return "smtp"
    return "none"


def send_verification_email(to_email: str, verify_url: str) -> bool:
    subject = "Verify your Your Cook Mate email"
    body = f"""Hi,

Thanks for signing up for Your Cook Mate!

Verify your email by opening this link (valid for 24 hours):
{verify_url}

If you didn't create an account, you can ignore this email.

— Your Cook Mate
"""
    html = f"""\
<p>Thanks for signing up for <strong>Your Cook Mate</strong>!</p>
<p><a href="{verify_url}">Verify your email address</a> (link valid for 24 hours).</p>
<p>If you didn't create an account, you can ignore this email.</p>
"""

    if not _email_configured():
        logger.warning("Email not configured — verification link for %s: %s", to_email, verify_url)
        print(f"\n[Your Cook Mate] Verify email for {to_email}:\n{verify_url}\n")
        return False

    try:
        send_email(to_email=to_email, subject=subject, body=body, html=html)
        return True
    except Exception as exc:
        logger.exception("Failed to send verification email to %s", to_email)
        print(f"\n[Your Cook Mate] Email failed ({exc}) — verify email for {to_email}:\n{verify_url}\n")
        return False
