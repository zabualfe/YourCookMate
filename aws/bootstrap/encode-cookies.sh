#!/usr/bin/env bash
# Print base64 cookie blob for GitHub secret AWS_YTDLP_COOKIES_B64
set -euo pipefail

COOKIE_FILE="${1:-backend/cookies.social.txt}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PATH_FILE="$ROOT/$COOKIE_FILE"

if [[ ! -f "$PATH_FILE" ]]; then
  echo "Cookie file not found: $PATH_FILE" >&2
  echo "Usage: ./aws/bootstrap/encode-cookies.sh [path/to/cookies.social.txt]" >&2
  exit 1
fi

echo "Add GitHub secret AWS_YTDLP_COOKIES_B64 with this value:"
echo ""
base64 < "$PATH_FILE" | tr -d '\n'
echo ""
echo ""
echo "Then redeploy AWS (push to main or re-run deploy-aws job)."
