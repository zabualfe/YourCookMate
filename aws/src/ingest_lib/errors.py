from __future__ import annotations


class IngestError(Exception):
    """User-facing ingest failure."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message
