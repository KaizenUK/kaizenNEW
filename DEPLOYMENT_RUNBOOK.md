# Deployment Runbook (Astro Static + CloudPanel VPS)

This runbook is for the static architecture:

- Public site: static Astro output served by Nginx
- Studio: static Vite output served on `studio.*`
- Editor backend APIs (`/draft`, `/preview-blog/*`, `/deploy`): Supabase Edge functions

## Baseline

- Node: `22.x` (build tooling only)
- Package manager: `pnpm` via `corepack`
- Public app repo dir on VPS: `VPS_APP_DIR_PROD` / `VPS_APP_DIR_STAGE`
- Public web roots: `VPS_WEB_ROOT_PROD` / `VPS_WEB_ROOT_STAGE`
- Studio web roots: `VPS_STUDIO_WEB_ROOT_PROD` / `VPS_STUDIO_WEB_ROOT_STAGE`
- Optional redirects include path:
  - `VPS_NGINX_REDIRECTS_INCLUDE_PROD`
  - `VPS_NGINX_REDIRECTS_INCLUDE_STAGE`

## Required GitHub Secrets

Public deploy:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_PORT` (optional, default `22`)
- `VPS_APP_DIR_PROD`
- `VPS_APP_DIR_STAGE`
- `VPS_WEB_ROOT_PROD`
- `VPS_WEB_ROOT_STAGE`
- `VPS_PUBLIC_DOMAIN_PROD` (optional, default `kaizenweb.co.uk`)
- `VPS_PUBLIC_DOMAIN_STAGE` (optional, default `stage.kaizenweb.co.uk`)
- `VPS_NGINX_REDIRECTS_INCLUDE_PROD` (optional)
- `VPS_NGINX_REDIRECTS_INCLUDE_STAGE` (optional)

Studio deploy (optional but recommended):

- `VPS_STUDIO_WEB_ROOT_PROD`
- `VPS_STUDIO_WEB_ROOT_STAGE`
- `VPS_STUDIO_DOMAIN_PROD` (optional, default `studio.kaizenweb.co.uk`)
- `VPS_STUDIO_DOMAIN_STAGE` (optional, default `studio-stage.kaizenweb.co.uk`)

Important: current Studio config uses `basePath: "/studio"`. Deploy Studio build output into a `studio/` subdirectory under the Studio vhost root.

## Build and Deploy Model

CI workflow now does:

1. `pnpm install --frozen-lockfile`
2. `pnpm build` (public static)
3. `pnpm --dir apps/studio install --frozen-lockfile`
4. `pnpm --dir apps/studio build`
5. SSH to VPS
6. Pull latest branch
7. Build again on VPS
8. `rsync` static output into Nginx web root
9. Install `dist/redirects.generated.conf` into Nginx include path (if configured)
10. Reload Nginx

No PM2 runtime is required for the public site or Studio.

## CloudPanel Nginx Shape (Public Site)

Replace proxy-based location with static root serving.
Repo template: `scripts/nginx/public-static.server.conf.example`

Example server block (adjust paths):

```nginx
server {
  listen 80;
  listen [::]:80;
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;

  server_name kaizenweb.co.uk;

  {{ssl_certificate_key}}
  {{ssl_certificate}}

  root /home/kaizenweb/public_html/kaizenweb.co.uk;
  index index.html;

  {{nginx_access_log}}
  {{nginx_error_log}}

  if ($scheme != "https") {
    return 301 https://$host$request_uri;
  }

  location ~ /.well-known {
    auth_basic off;
    allow all;
  }

  # Generated from scripts/generate-nginx-redirects.mjs
  include /etc/nginx/snippets/kaizen-redirects.generated.conf;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

`www` -> apex redirect server should remain as-is.

## CloudPanel Nginx Shape (Studio)

Studio should be a separate vhost (recommended `studio.kaizenweb.co.uk`):
Repo template: `scripts/nginx/studio-static.server.conf.example`

```nginx
server {
  listen 80;
  listen [::]:80;
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;

  server_name studio.kaizenweb.co.uk;

  root /home/kaizenweb/public_html/studio.kaizenweb.co.uk;
  index index.html;

  location = / {
    return 302 /studio/;
  }

  location /studio/ {
    try_files $uri $uri/ /studio/index.html;
  }
}
```

## Manual Production Redeploy (Public Static)

Run as your deploy user:

```bash
set -euo pipefail
APP_DIR="/home/kaizenweb/apps/kaizen-prod"
WEB_ROOT="/home/kaizenweb/public_html/kaizenweb.co.uk"
REDIRECTS_INCLUDE="/etc/nginx/snippets/kaizen-redirects.generated.conf"

cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main
corepack enable
corepack pnpm install --frozen-lockfile
rm -rf dist .astro
corepack pnpm run build

mkdir -p "$WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT/"

sudo install -m 0644 dist/redirects.generated.conf "$REDIRECTS_INCLUDE"
sudo nginx -t
sudo systemctl reload nginx

curl -fsS -H "Host: kaizenweb.co.uk" http://127.0.0.1/ >/dev/null
```

## Manual Production Redeploy (Studio Static)

```bash
set -euo pipefail
APP_DIR="/home/kaizenweb/apps/kaizen-prod"
STUDIO_ROOT="/home/kaizenweb/public_html/studio.kaizenweb.co.uk"

cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main
corepack enable
corepack pnpm --dir apps/studio install --frozen-lockfile
rm -rf apps/studio/dist
corepack pnpm --dir apps/studio run build

mkdir -p "$STUDIO_ROOT/studio"
rsync -a --delete apps/studio/dist/ "$STUDIO_ROOT/studio/"

curl -fsS -H "Host: studio.kaizenweb.co.uk" http://127.0.0.1/studio/ >/dev/null
```

## Supabase Edge Functions (Editor API)

Deploy and configure:

- `draft`
- `preview-blog`
- `deploy`

Minimum secrets/env on Supabase project:

- `SANITY_PROJECT_ID` or `PUBLIC_SANITY_PROJECT_ID`
- `SANITY_DATASET` or `PUBLIC_SANITY_DATASET`
- `SANITY_API_TOKEN`
- `ALLOWED_STUDIO_ORIGINS`
- `VITE_PUBLIC_SITE_ORIGIN`
- `VITE_EDITOR_API_ORIGIN`
- `VITE_STUDIO_ORIGIN`
- `VITE_EDITOR_COOKIE_DOMAIN`
- GitHub dispatch secrets for deploy endpoint (if enabled)

## Known Failure Modes

1. White screen after load
   - Cause: invalid island hydration props
   - Status: fixed by routing component resolution by path in `client/static/RoutedReactPage.tsx`

2. Dev crash with `exports is not defined` from `util`
   - Cause: browser polyfill rewrote Node util for Astro runtime
   - Status: fixed by removing node polyfill plugin from `astro.config.mjs`

3. Redirects not applying
   - Cause: generated include not copied into Nginx include path
   - Fix: set `VPS_NGINX_REDIRECTS_INCLUDE_*` secrets and verify `include` in vhost

4. 404 on deep links
   - Cause: static vhost missing `try_files ... /index.html` fallback where needed
   - Fix: add `try_files $uri $uri/ /index.html;`
