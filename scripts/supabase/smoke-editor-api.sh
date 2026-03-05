#!/usr/bin/env bash
set -euo pipefail

API_ORIGIN="${1:-${VITE_EDITOR_API_ORIGIN:-}}"

if [[ -z "$API_ORIGIN" ]]; then
  echo "Usage: $0 <api-origin>" >&2
  echo "Example: $0 https://kbqraygsegcclzhsmpvz.functions.supabase.co" >&2
  exit 1
fi

API_ORIGIN="${API_ORIGIN%/}"
TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

echo "Smoke check: GET $API_ORIGIN/draft?path=/blog (unauthenticated)"
STATUS="$(curl -sS -o "$TMP_BODY" -w "%{http_code}" "$API_ORIGIN/draft?path=/blog")"
BODY="$(cat "$TMP_BODY")"

echo "Status: $STATUS"
echo "Body: $BODY"

if [[ "$STATUS" != "401" ]]; then
  echo "Expected 401 for unauthenticated draft toggle."
  exit 1
fi

echo "Smoke check passed."
