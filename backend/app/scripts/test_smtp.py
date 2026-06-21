"""Send a test email to verify SMTP settings.

Usage:
  cd backend && python -m app.scripts.test_smtp you@example.com
"""

from __future__ import annotations

import sys

from app.config import settings
from app.services.email import send_email


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m app.scripts.test_smtp <recipient@email.com>")
        sys.exit(1)

    if not settings.smtp_host:
        print("SMTP is not configured. Set RESEND_API_KEY (or SMTP_PASSWORD) and SMTP_HOST in backend/.env")
        sys.exit(1)

    recipient = sys.argv[1]
    print(f"Sending test email via {settings.smtp_host}:{settings.smtp_port} to {recipient}…")

    try:
        send_email(
            to_email=recipient,
            subject="Your Cook Mate — SMTP test",
            body="If you received this, SMTP is configured correctly.",
            html="<p>If you received this, <strong>SMTP is configured correctly</strong>.</p>",
        )
    except Exception as exc:
        print(f"Failed: {exc}")
        sys.exit(1)

    print("Test email sent successfully.")


if __name__ == "__main__":
    main()
