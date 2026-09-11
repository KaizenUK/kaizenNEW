#!/usr/bin/env bash
set -euo pipefail

# Run on the destination host, before fetching, resetting, building or activating.
fail() { printf 'Deployment preflight: %s\n' "$*" >&2; exit 1; }
[[ -n "${KAIZEN_NODE_BIN:-}" ]] && export PATH="$KAIZEN_NODE_BIN:$PATH"
for variable in KAIZEN_APP_DIR KAIZEN_RELEASE_STORE KAIZEN_PUBLIC_DOMAIN; do
  [[ -n "${!variable:-}" ]] || fail "$variable is missing. Configure the selected environment's GitHub Actions secrets."
done
[[ "$KAIZEN_APP_DIR" == /* && "$KAIZEN_RELEASE_STORE" == /* ]] || fail 'Application and release directories must be absolute.'
[[ -d "$KAIZEN_APP_DIR/.git" ]] || fail "No application checkout at $KAIZEN_APP_DIR."
[[ -w "$KAIZEN_APP_DIR" ]] || fail 'The SSH user cannot write the application checkout.'
[[ -f "$KAIZEN_RELEASE_STORE/active.conf" ]] || fail "No initialised release store at $KAIZEN_RELEASE_STORE. Follow docs/website-releases.md."
[[ -w "$KAIZEN_RELEASE_STORE" ]] || fail 'The SSH user cannot write the release store.'
command -v node >/dev/null || fail 'Node.js is not installed on the destination host.'
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || fail 'The destination needs Node.js 22 or later. Set VPS_NODE_BIN to its bin directory.'
for executable in corepack git flock nginx; do
  command -v "$executable" >/dev/null || fail "Required destination executable is missing: $executable"
done
if [[ $(id -u) == 0 ]]; then
  nginx -t || fail 'Nginx configuration validation failed.'
else
  sudo -n nginx -t || fail 'Nginx configuration validation failed; check configuration and noninteractive sudo permission.'
fi
printf 'Deployment preflight passed on %s as %s (%s).\n' "$(hostname)" "$(id -un)" "$(node --version)"
