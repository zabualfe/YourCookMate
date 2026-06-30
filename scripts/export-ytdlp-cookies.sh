#!/usr/bin/env bash
# Export browser cookies for yt-dlp (Instagram/Facebook import).
# Usage: ./scripts/export-ytdlp-cookies.sh [chrome|safari|brave|firefox|edge]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
BROWSER="${1:-chrome}"
FULL="$BACKEND/cookies.txt"
FILTERED="$BACKEND/cookies.social.txt"

cd "$BACKEND"

echo "Exporting cookies from $BROWSER → $FULL"
python3 -m yt_dlp \
  --cookies-from-browser "$BROWSER" \
  --cookies "$FULL" \
  --skip-download \
  "https://www.youtube.com/watch?v=jNQXAC9IVRw" >/dev/null 2>&1 || true

if [[ ! -s "$FULL" ]]; then
  echo "Failed to export cookies. Log into Instagram in $BROWSER, then retry." >&2
  exit 1
fi

python3 <<'PY'
from pathlib import Path

src = Path("cookies.txt")
domains = ("instagram.com", "facebook.com", "fb.com", "fb.watch")
entries = []
for line in src.read_text(encoding="utf-8", errors="replace").splitlines():
    if not line.strip() or line.startswith("#"):
        continue
    domain = line.split("\t", 1)[0].lower()
    if any(d in domain for d in domains):
        entries.append(line)

out = Path("cookies.social.txt")
header = [
    "# Netscape HTTP Cookie File",
    "# Instagram/Facebook only",
    "",
]
out.write_text("\n".join(header + entries) + "\n", encoding="utf-8")
print(f"Wrote {len(entries)} social cookies to {out.resolve()} ({out.stat().st_size} bytes)")
PY

echo "Add to backend/.env:  YTDLP_COOKIES_FILE=./cookies.social.txt"
echo "For Render, paste cookies.social.txt into the YTDLP_COOKIES env var."
