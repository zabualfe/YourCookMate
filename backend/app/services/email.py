from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def _smtp_connection():
    use_ssl = settings.smtp_use_ssl or settings.smtp_port == 465
    if use_ssl:
        return smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30)

    server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30)
    if settings.smtp_use_tls:
        server.starttls()
    return server


def send_email(*, to_email: str, subject: str, body: str, html: str | None = None) -> None:
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

    logger.info("Email sent to %s", to_email)


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

    if not settings.smtp_host:
        logger.warning("SMTP not configured — verification link for %s: %s", to_email, verify_url)
        print(f"\n[Your Cook Mate] Verify email for {to_email}:\n{verify_url}\n")
        return False

    try:
        send_email(to_email=to_email, subject=subject, body=body, html=html)
        return True
    except Exception as exc:
        logger.exception("Failed to send verification email to %s", to_email)
        print(f"\n[Your Cook Mate] SMTP failed ({exc}) — verify email for {to_email}:\n{verify_url}\n")
        return False
