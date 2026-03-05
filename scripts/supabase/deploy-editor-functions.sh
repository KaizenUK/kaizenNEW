#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=""
WITH_ALERTS="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      continue
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --with-alerts)
      WITH_ALERTS="1"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--env-file path] [--with-alerts]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ENV_FILE" ]]; then
  if [[ -f ".env.supabase.editor" ]]; then
    ENV_FILE=".env.supabase.editor"
  else
    ENV_FILE="scripts/supabase/editor-secrets.env"
  fi
fi

if [[ -f "$ENV_FILE" ]]; then
  echo "Loading env vars from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "Linking Supabase project $SUPABASE_PROJECT_REF"
  corepack pnpm dlx supabase link --project-ref "$SUPABASE_PROJECT_REF"
fi

functions=(draft preview-blog deploy)
if [[ "$WITH_ALERTS" == "1" ]]; then
  functions+=(contact-alert scanner-alert newsletter-alert)
fi

for fn in "${functions[@]}"; do
  echo "Deploying function: $fn"
  corepack pnpm dlx supabase functions deploy "$fn" --no-verify-jwt
done

echo "Editor API function deployment complete."
corepack pnpm dlx supabase functions list
