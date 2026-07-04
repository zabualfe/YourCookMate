"""Send a test email to verify SMTP settings.

Usage:
  cd backend && python -m app.scripts.test_smtp you@example.com
"""

from __future__ import annotations

import sys

from app.config import settings
from app.services.email import _email_configured, email_transport, send_email


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m app.scripts.test_smtp <recipient@email.com>")
        sys.exit(1)

    if not _email_configured():
        print("Email is not configured. Set EMAIL_API_URL + EMAIL_API_SECRET, or RESEND_API_KEY, in backend/.env")
        sys.exit(1)

    transport = email_transport()
    recipient = sys.argv[1]
    print(f"Sending test email via {transport} to {recipient}…")

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
