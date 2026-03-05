#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=""

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
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--env-file path]" >&2
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
else
  echo "No env file found at $ENV_FILE; using current shell environment only."
fi

require_var() {
  local key="$1"
  local value="${!key:-}"
  if [[ -z "$value" ]]; then
    echo "Missing required env var: $key" >&2
    exit 1
  fi
}

# Required variables
require_var SANITY_PROJECT_ID
require_var SANITY_DATASET
require_var SANITY_API_TOKEN
require_var ALLOWED_STUDIO_ORIGINS
require_var VITE_PUBLIC_SITE_ORIGIN
require_var VITE_EDITOR_API_ORIGIN
require_var VITE_STUDIO_ORIGIN
require_var VITE_EDITOR_COOKIE_DOMAIN
require_var GITHUB_DEPLOY_TOKEN
require_var GITHUB_DEPLOY_REPO
require_var GITHUB_DEPLOY_EVENT_TYPE
require_var GITHUB_DEPLOY_TARGET

if [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "Linking Supabase project $SUPABASE_PROJECT_REF"
  corepack pnpm dlx supabase link --project-ref "$SUPABASE_PROJECT_REF"
fi

echo "Setting Supabase secrets for editor APIs"
corepack pnpm dlx supabase secrets set \
  SANITY_PROJECT_ID="$SANITY_PROJECT_ID" \
  SANITY_DATASET="$SANITY_DATASET" \
  SANITY_API_TOKEN="$SANITY_API_TOKEN" \
  ALLOWED_STUDIO_ORIGINS="$ALLOWED_STUDIO_ORIGINS" \
  VITE_PUBLIC_SITE_ORIGIN="$VITE_PUBLIC_SITE_ORIGIN" \
  VITE_EDITOR_API_ORIGIN="$VITE_EDITOR_API_ORIGIN" \
  VITE_STUDIO_ORIGIN="$VITE_STUDIO_ORIGIN" \
  VITE_EDITOR_COOKIE_DOMAIN="$VITE_EDITOR_COOKIE_DOMAIN" \
  GITHUB_DEPLOY_TOKEN="$GITHUB_DEPLOY_TOKEN" \
  GITHUB_DEPLOY_REPO="$GITHUB_DEPLOY_REPO" \
  GITHUB_DEPLOY_EVENT_TYPE="$GITHUB_DEPLOY_EVENT_TYPE" \
  GITHUB_DEPLOY_TARGET="$GITHUB_DEPLOY_TARGET"

echo "Secrets updated successfully."
