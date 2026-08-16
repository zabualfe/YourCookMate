from __future__ import annotations

import hashlib
import re
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

_TIKTOK_ID = re.compile(r"/(?:video|photo)/(\d{10,})")
_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_IG_CODE = re.compile(r"/(?:share/)?(?:reel|p|tv)/([A-Za-z0-9_-]+)")
_FB_VIDEO = re.compile(r"/(?:videos|reel|watch)/(\d{8,})")
_PIN_ID = re.compile(r"/pin/(\d+)")
_VIMEO_ID = re.compile(r"/(?:video/)?(\d{6,})")

_IDENTITY_QUERY = {
    "youtube.com": ("v",),
    "m.youtube.com": ("v",),
    "music.youtube.com": ("v",),
    "facebook.com": ("v", "story_fbid"),
    "m.facebook.com": ("v", "story_fbid"),
    "web.facebook.com": ("v", "story_fbid"),
    "fb.watch": ("v",),
    "fb.com": ("v",),
}


def normalize_source_url(url: str) -> str:
    cleaned = (url or "").strip()
    if not cleaned:
        return ""
    parsed = urlparse(cleaned if "://" in cleaned else f"https://{cleaned}")
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return cleaned
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/") or "/"
    query = _identity_query(host, parsed.query)
    return urlunparse(("https", host, path, "", query, ""))


def _identity_query(host: str, query: str) -> str:
    keep = _IDENTITY_QUERY.get(host)
    if not keep or not query:
        return ""
    parsed = parse_qs(query, keep_blank_values=False)
    kept = [(name, parsed[name][0]) for name in keep if name in parsed and parsed[name]]
    return urlencode(kept)


def classify_host(url: str) -> str:
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = parsed.netloc.lower().removeprefix("www.")
    if host in {"instagram.com", "instagr.am", "l.instagram.com"}:
        return "instagram"
    if host.endswith("tiktok.com") or host in {"vm.tiktok.com", "vt.tiktok.com"}:
        return "tiktok"
    if host in {"youtube.com", "m.youtube.com", "music.youtube.com"} or host == "youtu.be":
        return "youtube"
    if host in {"facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch", "fb.com", "l.facebook.com"}:
        return "facebook"
    if "pinterest.com" in host or host == "pin.it":
        return "pinterest"
    if host in {"vimeo.com", "player.vimeo.com"}:
        return "vimeo"
    return "video"


def _tiktok_id(path: str) -> str | None:
    match = _TIKTOK_ID.search(path)
    return match.group(1) if match else None


def _youtube_id(url: str) -> str | None:
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = parsed.netloc.lower().removeprefix("www.")
    path = parsed.path.rstrip("/")
    if host == "youtu.be":
        candidate = path.lstrip("/").split("/")[0]
        return candidate if _YOUTUBE_ID.match(candidate) else None
    if "youtube.com" in host:
        query = parse_qs(parsed.query)
        candidate = (query.get("v") or [None])[0]
        if candidate and _YOUTUBE_ID.match(candidate):
            return candidate
        shorts = re.match(r"^/shorts/([A-Za-z0-9_-]{11})", path)
        if shorts:
            return shorts.group(1)
        live = re.match(r"^/live/([A-Za-z0-9_-]{11})", path)
        if live:
            return live.group(1)
    return None


def _facebook_id(url: str) -> str | None:
    parsed = urlparse(url if "://" in url else f"https://{url}")
    query = parse_qs(parsed.query)
    for name in ("v", "story_fbid"):
        value = (query.get(name) or [None])[0]
        if value and value.isdigit() and len(value) >= 8:
            return value
    match = _FB_VIDEO.search(parsed.path)
    return match.group(1) if match else None


def _media_id(url: str, kind: str, video_id: str | None = None) -> str | None:
    parsed = urlparse(url if "://" in url else f"https://{url}")
    path = parsed.path.rstrip("/") or "/"
    if video_id and video_id.strip():
        cleaned = video_id.strip()
        if kind == "youtube" and not _YOUTUBE_ID.match(cleaned):
            cleaned = None
        if cleaned:
            return cleaned
    if kind == "tiktok":
        return _tiktok_id(path)
    if kind == "youtube":
        return _youtube_id(url)
    if kind == "instagram":
        match = _IG_CODE.search(path)
        return match.group(1) if match else None
    if kind == "facebook":
        return _facebook_id(url)
    if kind == "pinterest":
        match = _PIN_ID.search(path)
        return match.group(1) if match else None
    if kind == "vimeo":
        match = _VIMEO_ID.search(path)
        return match.group(1) if match else None
    return None


def has_stable_media_id(url: str, source_type: str | None = None) -> bool:
    kind = (source_type or classify_host(url)).lower()
    return _media_id(url, kind) is not None


def canonical_source_key(
    url: str,
    source_type: str | None = None,
    video_id: str | None = None,
) -> str | None:
    normalized = normalize_source_url(url)
    if not normalized:
        return None
    parsed = urlparse(normalized)
    host = parsed.netloc.lower().removeprefix("www.")
    path = parsed.path.rstrip("/") or "/"
    kind = (source_type or classify_host(normalized)).lower()
    media_id = _media_id(url, kind, video_id) or _media_id(normalized, kind, video_id)
    if media_id:
        return f"{kind}:{media_id}"
    digest = hashlib.sha256(f"{kind}:{host}{path.lower()}".encode("utf-8")).hexdigest()[:20]
    return f"{kind}:{digest}"


def expand_source_url(url: str) -> str:
    """Follow redirects for any link that doesn't already have a stable media id."""
    normalized = normalize_source_url(url) or (url or "").strip()
    if not normalized:
        return normalized
    if has_stable_media_id(normalized):
        return normalized
    try:
        import httpx

        headers = {"User-Agent": "Mozilla/5.0"}
        with httpx.Client(follow_redirects=True, timeout=5.0, headers=headers) as client:
            response = client.head(normalized)
            if response.status_code >= 400:
                response = client.get(normalized)
            expanded = normalize_source_url(str(response.url))
        if expanded and (has_stable_media_id(expanded) or expanded != normalized):
            return expanded
    except Exception:
        return normalized
    return normalized


def source_lookup_keys(
    url: str,
    source_type: str | None = None,
    video_id: str | None = None,
) -> list[str]:
    keys: list[str] = []
    kind = (source_type or classify_host(url)).lower()

    def _add(key: str | None) -> None:
        if key and key not in keys:
            keys.append(key)

    media_id = _media_id(url, kind, video_id)
    if media_id:
        _add(f"{kind}:{media_id}")
    _add(canonical_source_key(url, kind, video_id))
    _add(canonical_source_key(url, kind, None))
    normalized = normalize_source_url(url)
    if normalized:
        _add(canonical_source_key(normalized, kind, video_id))
        _add(canonical_source_key(normalized, kind, None))
    return keys


def all_source_lookup_keys(
    url: str,
    source_type: str | None = None,
    video_id: str | None = None,
    expanded: str | None = None,
) -> list[str]:
    resolved = expanded if expanded is not None else expand_source_url(url)
    keys: list[str] = []
    for candidate in (url, resolved):
        if not candidate:
            continue
        for key in source_lookup_keys(candidate, source_type or classify_host(candidate), video_id):
            if key not in keys:
                keys.append(key)
    return keys
