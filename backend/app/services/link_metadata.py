from __future__ import annotations

import html
import json
import logging
import re
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Generic "chrome" maps to the newest desktop Chrome, which TikTok currently
# answers with a 537-byte "Site Maintenance" page. Pin versions that still work.
_IMPERSONATE_CANDIDATES = (
    "chrome131",
    "chrome136",
    "chrome124",
    "chrome131_android",
    "safari18_0_ios",
    "safari17_2_ios",
)

_META_PROP = re.compile(
    r'<meta\b(?=[^>]*\b(?:property|name)=["\']([^"\']+)["\'])(?=[^>]*\bcontent=["\']([^"\']*)["\'])[^>]*>',
    re.I,
)
_META_PROP_REV = re.compile(
    r'<meta\b(?=[^>]*\bcontent=["\']([^"\']*)["\'])(?=[^>]*\b(?:property|name)=["\']([^"\']+)["\'])[^>]*>',
    re.I,
)
_VIDEO_URL_PATTERNS = (
    re.compile(r'"downloadAddr"\s*:\s*"([^"]+)"'),
    re.compile(r'"playAddr"\s*:\s*"([^"]+)"'),
    re.compile(r'"video_url"\s*:\s*"([^"]+)"'),
    re.compile(r'"play_url"\s*:\s*"([^"]+)"'),
    re.compile(r'"url_list"\s*:\s*\[\s*"([^"]+)"'),
)


def prefers_direct_download(url: str) -> bool:
    """TikTok/Instagram: page JSON + TLS impersonation is much faster than yt-dlp."""
    host = urlparse(url if "://" in url else f"https://{url}").netloc.lower().removeprefix("www.")
    return (
        host.endswith("tiktok.com")
        or host in {"instagram.com", "instagr.am", "l.instagram.com"}
        or "instagram.com" in host
    )


def needs_redirect_resolution(url: str) -> bool:
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = parsed.netloc.lower().removeprefix("www.")
    path = parsed.path.lower()
    if host in {"vm.tiktok.com", "vt.tiktok.com", "pin.it", "l.instagram.com", "l.facebook.com"}:
        return True
    if "/share/" in path:
        return True
    if host.endswith("tiktok.com") and path.startswith("/t/"):
        return True
    return False


def resolve_public_url(url: str, *, timeout: float = 20.0) -> str:
    """Follow share/short-link redirects so yt-dlp sees a canonical reel/video URL."""
    if not needs_redirect_resolution(url):
        return url
    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=timeout,
            headers=_BROWSER_HEADERS,
        ) as client:
            response = client.get(url)
            final = str(response.url).split("#")[0]
            if final.startswith("http"):
                return final
    except Exception as exc:
        logger.info("Could not resolve short URL %s: %s", url, exc)
    return url


def parse_open_graph(page_html: str, page_url: str) -> Optional[dict]:
    tags: dict[str, str] = {}
    for match in _META_PROP.finditer(page_html):
        tags[match.group(1).lower()] = html.unescape(match.group(2)).strip()
    for match in _META_PROP_REV.finditer(page_html):
        tags.setdefault(match.group(2).lower(), html.unescape(match.group(1)).strip())

    title = tags.get("og:title") or tags.get("twitter:title")
    description = tags.get("og:description") or tags.get("twitter:description") or tags.get("description")
    image = tags.get("og:image") or tags.get("twitter:image")
    if not any((title, description, image)):
        return None
    return {
        "id": None,
        "title": title or None,
        "description": description or "",
        "caption": description or "",
        "uploader": None,
        "thumbnail": image or None,
        "webpage_url": page_url,
        "duration": None,
    }


def _tiktok_oembed(url: str) -> Optional[dict]:
    try:
        response = httpx.get(
            "https://www.tiktok.com/oembed",
            params={"url": url},
            timeout=15,
            follow_redirects=True,
            headers=_BROWSER_HEADERS,
        )
        if response.status_code >= 400:
            return None
        data = response.json()
    except Exception:
        return None
    title = data.get("title") if isinstance(data, dict) else None
    author = data.get("author_name") if isinstance(data, dict) else None
    thumb = data.get("thumbnail_url") if isinstance(data, dict) else None
    if not isinstance(title, str) and not isinstance(author, str):
        return None
    caption = title.strip() if isinstance(title, str) else ""
    return {
        "id": None,
        "title": caption or None,
        "description": caption,
        "caption": caption,
        "uploader": author.strip() if isinstance(author, str) else None,
        "thumbnail": thumb if isinstance(thumb, str) else None,
        "webpage_url": url,
        "duration": None,
    }


def _json_unescape(value: str) -> str:
    try:
        return json.loads(f'"{value}"')
    except Exception:
        return (
            bytes(value, "utf-8")
            .decode("unicode_escape")
            .replace("\\/", "/")
            .replace("\\u0026", "&")
        )


def extract_direct_video_urls(page_html: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for pattern in _VIDEO_URL_PATTERNS:
        for match in pattern.finditer(page_html):
            raw = html.unescape(_json_unescape(match.group(1))).strip()
            if not raw.startswith("http"):
                continue
            if raw in seen:
                continue
            seen.add(raw)
            found.append(raw)
    return found


def _is_mp4(payload: bytes) -> bool:
    return len(payload) > 64 and (payload[4:8] == b"ftyp" or payload.startswith(b"\x00\x00\x00"))


def _fetch_html(url: str) -> Optional[str]:
    html_text, _session = _fetch_page_session(url)
    return html_text


def _fetch_page_session(url: str):
    try:
        from curl_cffi import requests as cfreq
    except Exception:
        cfreq = None

    if cfreq is not None:
        for impersonate in _IMPERSONATE_CANDIDATES:
            try:
                session = cfreq.Session(impersonate=impersonate)
                response = session.get(url, timeout=12, allow_redirects=True)
                text = response.text or ""
                if response.status_code == 200 and len(text) > 2000 and "Site Maintenance" not in text:
                    return text, session
            except Exception:
                continue

    try:
        response = httpx.get(url, headers=_BROWSER_HEADERS, timeout=20, follow_redirects=True)
        text = response.text or ""
        if response.status_code == 200 and len(text) > 2000 and "Site Maintenance" not in text:
            return text, None
    except Exception:
        return None, None
    return None, None


_MAX_DIRECT_BYTES = 20 * 1024 * 1024


def _write_limited(response, dest: Path) -> bool:
    payload = response.content or b""
    if not _is_mp4(payload):
        return False
    dest.write_bytes(payload[:_MAX_DIRECT_BYTES])
    return dest.is_file() and dest.stat().st_size > 64


def download_direct_mp4(page_url: str, dest: Path) -> bool:
    """Download the mp4 from page JSON when yt-dlp cannot (TikTok TLS blocks)."""
    page_html, session = _fetch_page_session(page_url)
    if not page_html:
        return False
    urls = extract_direct_video_urls(page_html)
    if not urls:
        return False

    headers = {**_BROWSER_HEADERS, "Referer": "https://www.tiktok.com/"}
    for media_url in urls[:2]:
        try:
            if session is not None:
                response = session.get(media_url, timeout=45, headers=headers, allow_redirects=True)
                status = response.status_code
                ok = status < 400 and _write_limited(response, dest)
            else:
                response = httpx.get(media_url, timeout=45, headers=headers, follow_redirects=True)
                status = response.status_code
                ok = status < 400 and _write_limited(response, dest)
        except Exception as exc:
            logger.info("Direct video download failed: %s", exc)
            continue
        if ok:
            return True
    return False


def webpage_fallback_info(url: str, source_type: str) -> Optional[dict]:
    """Caption/title/thumbnail when yt-dlp cannot extract (IG/TikTok blocks)."""
    if source_type == "tiktok":
        info = _tiktok_oembed(url)
        if info and (info.get("description") or info.get("title")):
            return info
    page = _fetch_html(url)
    if not page:
        return None
    parsed = parse_open_graph(page, url)
    if parsed and source_type == "instagram":
        title = (parsed.get("title") or "").lower()
        if "login" in title or title in {"instagram", "instagram • photos and videos"}:
            if not parsed.get("description"):
                return None
    return parsed
