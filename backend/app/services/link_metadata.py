from __future__ import annotations

import html
import logging
import re
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

_META_PROP = re.compile(
    r'<meta\b(?=[^>]*\b(?:property|name)=["\']([^"\']+)["\'])(?=[^>]*\bcontent=["\']([^"\']*)["\'])[^>]*>',
    re.I,
)
_META_PROP_REV = re.compile(
    r'<meta\b(?=[^>]*\bcontent=["\']([^"\']*)["\'])(?=[^>]*\b(?:property|name)=["\']([^"\']+)["\'])[^>]*>',
    re.I,
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


def _fetch_html(url: str) -> Optional[str]:
    try:
        from curl_cffi import requests as cfreq

        response = cfreq.get(url, impersonate="chrome", timeout=20, allow_redirects=True)
        if response.status_code == 200 and len(response.text or "") > 400:
            return response.text
    except Exception:
        pass
    try:
        response = httpx.get(url, headers=_BROWSER_HEADERS, timeout=20, follow_redirects=True)
        if response.status_code == 200 and len(response.text or "") > 400:
            return response.text
    except Exception:
        return None
    return None


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
        # Login walls still have generic OG tags — skip those.
        title = (parsed.get("title") or "").lower()
        if "login" in title or title in {"instagram", "instagram • photos and videos"}:
            if not parsed.get("description"):
                return None
    return parsed
