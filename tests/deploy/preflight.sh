#!/usr/bin/env bash
set -euo pipefail
preflight="$(cd "$(dirname "$0")/../.." && pwd)/scripts/preflight-public-deploy.sh"
temporary=$(mktemp -d /tmp/kaizen-preflight-test.XXXXXX)
trap 'rm -rf -- "$temporary"' EXIT
mkdir -p "$temporary/bin" "$temporary/app/.git" "$temporary/releases"
touch "$temporary/releases/active.conf"
cat > "$temporary/bin/node" <<'MOCK'
#!/usr/bin/env bash
if [[ "$1" == --version ]]; then echo v22.23.2; else exit "${MOCK_NODE_OLD:-0}"; fi
MOCK
cat > "$temporary/bin/nginx" <<'MOCK'
#!/usr/bin/env bash
exit "${MOCK_NGINX_FAIL:-0}"
MOCK
cat > "$temporary/bin/sudo" <<'MOCK'
#!/usr/bin/env bash
shift
exec "$@"
MOCK
printf '#!/usr/bin/env bash\nexit 0\n' > "$temporary/bin/corepack"
chmod +x "$temporary/bin/"*
export KAIZEN_NODE_BIN="$temporary/bin" KAIZEN_APP_DIR="$temporary/app"
export KAIZEN_RELEASE_STORE="$temporary/releases" KAIZEN_PUBLIC_DOMAIN=example.test
expect_failure() {
  local expected=$1; shift
  if "$@" > "$temporary/output" 2>&1; then echo "Unexpected preflight success: $expected" >&2; exit 1; fi
  grep -Fq "$expected" "$temporary/output" || { cat "$temporary/output"; exit 1; }
}
expect_failure 'KAIZEN_RELEASE_STORE is missing' env -u KAIZEN_RELEASE_STORE bash "$preflight"
expect_failure 'No application checkout' env KAIZEN_APP_DIR="$temporary/missing" bash "$preflight"
expect_failure 'No initialised release store' env KAIZEN_RELEASE_STORE="$temporary/missing" bash "$preflight"
expect_failure 'Node.js 22 or later' env MOCK_NODE_OLD=1 bash "$preflight"
expect_failure 'Nginx configuration validation failed' env MOCK_NGINX_FAIL=1 bash "$preflight"
bash "$preflight"
echo 'All deployment preflight cases passed.'
