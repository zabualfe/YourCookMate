from __future__ import annotations

import re
import threading
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.recipe import Recipe
from app.models.source_import import SourceImport, SourceImportAlias
from app.services.source_key import all_source_lookup_keys, canonical_source_key, normalize_source_url

L1_MAX_ENTRIES = 1024
_GENERIC_HASH = re.compile(r"^[a-f0-9]{20}$")


@dataclass
class CachedSourceRecipe:
    source_key: str
    source_url: str
    source_type: str
    raw_text: str
    title: Optional[str]
    parsed: Optional[dict]
    used_ai: bool
    video_duration: Optional[float] = None
    author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    confidence: float = 1.0


class L1SourceCache:
    """Process-local LRU for AI-generated source imports (not user edits)."""

    def __init__(self, maxsize: int = L1_MAX_ENTRIES):
        self._maxsize = maxsize
        self._lock = threading.RLock()
        self._items: OrderedDict[str, CachedSourceRecipe] = OrderedDict()

    def get(self, key: str) -> Optional[CachedSourceRecipe]:
        if not key:
            return None
        with self._lock:
            cached = self._items.get(key)
            if cached is None:
                return None
            self._items.move_to_end(key)
            return cached

    def set(self, key: str, value: CachedSourceRecipe) -> None:
        if not key:
            return
        with self._lock:
            existing = self._items.get(key)
            if existing is not None and existing.parsed and _has_steps(existing.parsed):
                self._items.move_to_end(key)
                return
            if key in self._items:
                self._items.move_to_end(key)
            self._items[key] = value
            while len(self._items) > self._maxsize:
                self._items.popitem(last=False)

    def remember(self, keys: list[str], value: CachedSourceRecipe) -> None:
        for key in keys:
            self.set(key, value)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


_SOURCE_L1 = L1SourceCache()


def source_l1() -> L1SourceCache:
    return _SOURCE_L1


def reset_source_l1() -> None:
    _SOURCE_L1.clear()


def _has_steps(parsed: Any) -> bool:
    if not isinstance(parsed, dict):
        return False
    steps = parsed.get("steps")
    return isinstance(steps, list) and len(steps) > 0


def _from_import(row: SourceImport) -> Optional[CachedSourceRecipe]:
    generated = row.generated_json if isinstance(row.generated_json, dict) else None
    if not row.raw_text or not _has_steps(generated):
        return None
    return CachedSourceRecipe(
        source_key=row.source_key,
        source_url=row.source_url,
        source_type=(row.source_type or "video").lower(),
        raw_text=row.raw_text,
        title=row.title or (generated.get("title") if generated else None),
        parsed=generated,
        used_ai=bool(row.used_ai),
    )


def lookup_cached_source(
    db: Session,
    url: str,
    source_type: str | None = None,
    video_id: str | None = None,
    expanded: str | None = None,
) -> Optional[CachedSourceRecipe]:
    keys = all_source_lookup_keys(url, source_type, video_id, expanded=expanded)
    for key in keys:
        cached = _SOURCE_L1.get(key)
        if cached is not None and cached.parsed and _has_steps(cached.parsed):
            return cached

    row = _query_generated_import(db, keys)
    cached = _from_import(row) if row is not None else None
    if cached is not None:
        remember_keys = list(keys)
        if cached.source_key not in remember_keys:
            remember_keys.insert(0, cached.source_key)
        _SOURCE_L1.remember(remember_keys, cached)
    return cached


def _source_match_clause(url: str, keys: list[str], extra_urls: Optional[list[str]] = None):
    clauses = []
    if keys:
        clauses.append(Recipe.source_key.in_(keys))
    seen: set[str] = set()
    for candidate in (url, *(extra_urls or [])):
        for value in _url_match_values(candidate):
            if value not in seen:
                seen.add(value)
                clauses.append(Recipe.source_url == value)
    for needle in _source_url_needles(keys):
        clauses.append(Recipe.source_url.contains(needle))
    if not clauses:
        return None
    return or_(*clauses)


def _url_match_values(url: str) -> list[str]:
    values: list[str] = []

    def _add(value: str | None) -> None:
        cleaned = (value or "").strip()
        if cleaned and cleaned not in values:
            values.append(cleaned)

    stripped = (url or "").strip()
    _add(stripped)
    _add(normalize_source_url(stripped))
    for value in list(values):
        if "://www." in value:
            _add(value.replace("://www.", "://", 1))
        elif "://" in value:
            _add(value.replace("://", "://www.", 1))
    return values


def _source_url_needles(keys: list[str]) -> list[str]:
    needles: list[str] = []

    def _add(value: str) -> None:
        if value and value not in needles:
            needles.append(value)

    for key in keys:
        kind, sep, media_id = key.partition(":")
        if not sep or not media_id or media_id.startswith("url:") or _GENERIC_HASH.match(media_id):
            continue
        if kind == "tiktok":
            _add(f"/video/{media_id}")
            _add(f"/photo/{media_id}")
        elif kind == "youtube":
            _add(f"v={media_id}")
            _add(f"youtu.be/{media_id}")
            _add(f"/shorts/{media_id}")
            _add(f"/live/{media_id}")
        elif kind == "instagram":
            _add(f"/reel/{media_id}")
            _add(f"/p/{media_id}")
            _add(f"/tv/{media_id}")
        elif kind == "facebook":
            _add(f"/videos/{media_id}")
            _add(f"/reel/{media_id}")
            _add(f"v={media_id}")
        elif kind == "pinterest":
            _add(f"/pin/{media_id}")
        elif kind == "vimeo":
            _add(f"/video/{media_id}")
            _add(media_id)
        else:
            _add(media_id)
    return needles


def find_user_recipe_id(
    db: Session,
    user_id: UUID,
    url: str,
    source_type: str | None = None,
    video_id: str | None = None,
    expanded: str | None = None,
) -> Optional[UUID]:
    keys = all_source_lookup_keys(url, source_type, video_id, expanded=expanded)
    match = _source_match_clause(url, keys, extra_urls=[expanded] if expanded else None)
    if match is None:
        return None
    row = (
        db.query(Recipe.id)
        .filter(Recipe.user_id == user_id, match)
        .order_by(Recipe.created_at.desc())
        .first()
    )
    return row[0] if row else None


def remember_source(
    payload: CachedSourceRecipe,
    extra_keys: Optional[list[str]] = None,
) -> None:
    keys = [payload.source_key]
    if extra_keys:
        keys.extend(extra_keys)
    url_key = canonical_source_key(payload.source_url, payload.source_type)
    if url_key:
        keys.append(url_key)
    _SOURCE_L1.remember(keys, payload)


def remember_ingest_result(
    result: dict,
    extra_keys: Optional[list[str]] = None,
    parsed: Optional[dict] = None,
) -> CachedSourceRecipe | None:
    source_url = str(result.get("source_url") or "")
    source_type = str(result.get("source_type") or "video")
    video_id = result.get("canonical_id")
    source_key = canonical_source_key(
        source_url,
        source_type,
        video_id if isinstance(video_id, str) else None,
    )
    if not source_key:
        return None
    existing = _SOURCE_L1.get(source_key)
    if existing and existing.parsed and _has_steps(existing.parsed):
        return existing
    if not parsed or not _has_steps(parsed):
        return existing
    payload = CachedSourceRecipe(
        source_key=source_key,
        source_url=source_url,
        source_type=source_type,
        raw_text=str(result.get("raw_text") or ""),
        title=result.get("title") if isinstance(result.get("title"), str) else parsed.get("title"),
        parsed=parsed,
        used_ai=True,
        video_duration=result.get("video_duration") if isinstance(result.get("video_duration"), (int, float)) else None,
        author=result.get("author") if isinstance(result.get("author"), str) else None,
        thumbnail_url=result.get("thumbnail_url") if isinstance(result.get("thumbnail_url"), str) else None,
        confidence=float(result.get("confidence") or 1.0),
    )
    keys = all_source_lookup_keys(
        source_url,
        source_type,
        video_id if isinstance(video_id, str) else None,
    )
    if extra_keys:
        keys.extend(extra_keys)
    remember_source(payload, keys)
    return payload


def persist_generated_source(
    db: Session,
    payload: CachedSourceRecipe,
    extra_keys: Optional[list[str]] = None,
) -> None:
    """Store the AI-generated recipe once. User edits never overwrite this row."""
    if not payload.parsed or not _has_steps(payload.parsed):
        return
    existing = db.query(SourceImport).filter(SourceImport.source_key == payload.source_key).first()
    if existing is not None:
        remember_source(_from_import(existing) or payload, extra_keys)
        _persist_aliases(db, existing.source_key, extra_keys)
        return
    db.add(
        SourceImport(
            source_key=payload.source_key,
            source_url=payload.source_url,
            source_type=payload.source_type,
            raw_text=payload.raw_text,
            generated_json=payload.parsed,
            title=payload.title,
            used_ai=payload.used_ai,
        )
    )
    remember_source(payload, extra_keys)
    _persist_aliases(db, payload.source_key, extra_keys)


def cached_to_ingest_response(cached: CachedSourceRecipe, *, existing_recipe_id: Optional[str] = None) -> dict:
    notes = ["Reused the original generated import of this video — skipped a new download."]
    payload: dict[str, Any] = {
        "raw_text": cached.raw_text,
        "source_type": cached.source_type,
        "source_url": cached.source_url,
        "title": cached.title,
        "author": cached.author,
        "thumbnail_url": cached.thumbnail_url,
        "video_duration": cached.video_duration,
        "extraction_notes": notes,
        "confidence": cached.confidence,
        "from_cache": True,
        "existing_recipe_id": existing_recipe_id,
        "used_ai": cached.used_ai,
    }
    if cached.parsed and _has_steps(cached.parsed):
        payload["recipe"] = cached.parsed
    return payload


def _query_generated_import(db: Session, keys: list[str]) -> Optional[SourceImport]:
    if not keys:
        return None
    row = (
        db.query(SourceImport)
        .filter(SourceImport.source_key.in_(keys))
        .order_by(SourceImport.created_at.asc())
        .first()
    )
    if row is not None:
        return row
    alias = (
        db.query(SourceImportAlias)
        .filter(SourceImportAlias.alias_key.in_(keys))
        .first()
    )
    if alias is None:
        return None
    return db.query(SourceImport).filter(SourceImport.source_key == alias.source_key).first()


def _persist_aliases(db: Session, source_key: str, extra_keys: Optional[list[str]]) -> None:
    if not extra_keys:
        return
    seen: set[str] = set()
    for key in extra_keys:
        if not key or key == source_key or key in seen:
            continue
        seen.add(key)
        exists = (
            db.query(SourceImportAlias.alias_key)
            .filter(SourceImportAlias.alias_key == key)
            .first()
        )
        if exists is not None:
            continue
        db.add(SourceImportAlias(alias_key=key, source_key=source_key))
