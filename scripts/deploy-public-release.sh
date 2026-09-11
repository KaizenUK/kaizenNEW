#!/usr/bin/env bash
set -euo pipefail

[[ -n "${KAIZEN_NODE_BIN:-}" ]] && export PATH="$KAIZEN_NODE_BIN:$PATH"

# Called by the existing GitHub deployment job. All inputs are explicit environment values.
: "${KAIZEN_APP_DIR:?Set the dedicated VPS application directory}"
: "${KAIZEN_RELEASE_STORE:?Set VPS_RELEASES_DIR_PROD or VPS_RELEASES_DIR_STAGE after the Nginx release-store setup}"
: "${KAIZEN_PUBLIC_DOMAIN:?Set the public domain}"
: "${KAIZEN_DEPLOY_BRANCH:?Set main or stage}"
: "${KAIZEN_DEPLOY_SHA:?Set the checked source commit}"
: "${KAIZEN_RELEASE_ID:?Set a unique release ID}"
[[ "$KAIZEN_DEPLOY_BRANCH" == main || "$KAIZEN_DEPLOY_BRANCH" == stage ]] || { echo "Invalid deployment branch" >&2; exit 1; }
[[ "$KAIZEN_DEPLOY_SHA" =~ ^[a-fA-F0-9]{40}$ ]] || { echo "Invalid source commit" >&2; exit 1; }
[[ "$KAIZEN_RELEASE_ID" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$ ]] || { echo "Invalid release ID" >&2; exit 1; }
[[ -z "${KAIZEN_BUILDER_REQUEST_ID:-}" || "$KAIZEN_BUILDER_REQUEST_ID" =~ ^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$ ]] || { echo "Invalid builder release request ID" >&2; exit 1; }
[[ "$KAIZEN_PUBLIC_DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ ]] || { echo "Use a hostname without a path or scheme" >&2; exit 1; }
[[ "$KAIZEN_APP_DIR" == /* && "$KAIZEN_RELEASE_STORE" == /* ]] || { echo "Deployment directories must be absolute" >&2; exit 1; }
KAIZEN_APP_DIR="$(realpath -e "$KAIZEN_APP_DIR")"
KAIZEN_RELEASE_STORE="$(realpath -e "$KAIZEN_RELEASE_STORE")"
[[ "$KAIZEN_APP_DIR" != / && "$KAIZEN_RELEASE_STORE" != / ]] || { echo "Use dedicated deployment directories" >&2; exit 1; }
case "$KAIZEN_RELEASE_STORE/" in "$KAIZEN_APP_DIR/"*) echo "The release store must be outside the checkout" >&2; exit 1;; esac
case "$KAIZEN_APP_DIR/" in "$KAIZEN_RELEASE_STORE/"*) echo "The checkout must be outside the release store" >&2; exit 1;; esac
[[ -f "$KAIZEN_RELEASE_STORE/active.conf" ]] || { echo "Release store is not initialised. Follow docs/website-releases.md before deploying. The live web root has not been changed." >&2; exit 1; }

cd "$KAIZEN_APP_DIR"
# Serialise every operation on this checkout, including builds. This lock is held by the process, not a timestamp.
exec 9>"$KAIZEN_RELEASE_STORE/build.lock"
flock -n 9 || { echo "Another build/deployment owns this release store" >&2; exit 1; }
git config --global --add safe.directory "$KAIZEN_APP_DIR"
git fetch origin "$KAIZEN_DEPLOY_BRANCH"
git cat-file -e "$KAIZEN_DEPLOY_SHA^{commit}"
git merge-base --is-ancestor "$KAIZEN_DEPLOY_SHA" "origin/$KAIZEN_DEPLOY_BRANCH" || { echo "The requested commit is not on the selected deployment branch" >&2; exit 1; }
git reset --hard "$KAIZEN_DEPLOY_SHA"
# Runtime shims are installed by the server operator, not by the unprivileged deploy user.
corepack pnpm install --frozen-lockfile
corepack pnpm --dir apps/studio install --frozen-lockfile
# A cloud builder deployment freezes its input and promotes database publications only after HTTP verification.
# Sites without the cloud builder still use the retained-artifact activation path.
node scripts/builder-release-worker.mjs
