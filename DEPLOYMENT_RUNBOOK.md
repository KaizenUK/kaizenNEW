# Deployment Runbook (Astro Static + CloudPanel VPS)

This runbook is for the static architecture:

- Public site: static Astro output served by Nginx
- Studio: static Vite output staged into `/studio/` inside the same public deploy
- Editor backend APIs (`/draft`, `/preview-blog/*`, `/deploy`): Supabase Edge functions

## Baseline

- Node: `22.x` (build tooling only)
- Package manager: `pnpm` via `corepack`
- Public app repo dir on VPS: `VPS_APP_DIR_PROD` / `VPS_APP_DIR_STAGE`
- Public web roots: `VPS_WEB_ROOT_PROD` / `VPS_WEB_ROOT_STAGE`
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

Important: current Studio config uses `basePath: "/studio"`. The root `pnpm build` now stages Studio output into `dist/studio/`, so you deploy one artifact to one web root.

## Build and Deploy Model

CI workflow now does:

1. `pnpm install --frozen-lockfile`
2. `pnpm build` (public site + Studio staged into `dist/studio/`)
3. SSH to VPS
4. Pull latest branch
5. Build again on VPS
6. `rsync` static output into the public web root
7. Install `dist/redirects.generated.conf` into Nginx include path (if configured)
8. Reload Nginx

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

  # Forward editor API calls to Supabase Edge Functions.
  location /editor-api/ {
    proxy_pass https://kbqraygsegcclzhsmpvz.functions.supabase.co/;
    proxy_set_header Host kbqraygsegcclzhsmpvz.functions.supabase.co;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_ssl_server_name on;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

`www` -> apex redirect server should remain as-is.

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
rm -rf dist .astro apps/studio/dist
corepack pnpm run build

mkdir -p "$WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT/"

sudo install -m 0644 dist/redirects.generated.conf "$REDIRECTS_INCLUDE"
sudo nginx -t
sudo systemctl reload nginx

curl -fsS -H "Host: kaizenweb.co.uk" http://127.0.0.1/ >/dev/null
curl -fsS -H "Host: kaizenweb.co.uk" http://127.0.0.1/studio/ >/dev/null
```

## Supabase Edge Functions (Editor API)

Deploy and configure these functions:

- `draft`
- `preview-blog`
- `deploy`

These endpoints are called from browser navigation/fetch. Keep JWT verification disabled, and expose them through a first-party domain/path (recommended: `https://kaizenweb.co.uk/editor-api`) so editor session cookies are sent.

Recommended Nginx path proxy:

```nginx
location /editor-api/ {
  proxy_pass https://kbqraygsegcclzhsmpvz.functions.supabase.co/;
  proxy_set_header Host kbqraygsegcclzhsmpvz.functions.supabase.co;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_ssl_server_name on;
}
```

### One-time project link

```bash
corepack enable
corepack pnpm dlx supabase login
corepack pnpm dlx supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
```

If you prefer non-interactive auth, set `SUPABASE_ACCESS_TOKEN` in your env file instead of running `supabase login`.

### Recommended shortcut workflow (repo scripts)

1. Copy [scripts/supabase/editor-secrets.env.example](/Users/seanmcdonnell/Documents/GitHub/kaizenNEW/scripts/supabase/editor-secrets.env.example) to `scripts/supabase/editor-secrets.env` and fill real values.
2. Run:

```bash
pnpm supabase:editor:secrets -- --env-file scripts/supabase/editor-secrets.env
pnpm supabase:editor:deploy -- --env-file scripts/supabase/editor-secrets.env
pnpm supabase:editor:smoke https://kaizenweb.co.uk/editor-api
```

### Set required Supabase secrets

Run once, then re-run when values change:

```bash
corepack pnpm dlx supabase secrets set \
  SANITY_PROJECT_ID=your_project_id \
  SANITY_DATASET=production \
  SANITY_API_TOKEN=your_sanity_token \
  ALLOWED_STUDIO_ORIGINS=https://kaizenweb.co.uk,http://localhost:3333 \
  VITE_PUBLIC_SITE_ORIGIN=https://kaizenweb.co.uk \
  VITE_EDITOR_API_ORIGIN=https://kaizenweb.co.uk/editor-api \
  VITE_STUDIO_ORIGIN=https://kaizenweb.co.uk \
  PUBLIC_STUDIO_URL=https://kaizenweb.co.uk/studio \
  VITE_EDITOR_COOKIE_DOMAIN=.kaizenweb.co.uk \
  GITHUB_DEPLOY_TOKEN=your_github_token \
  GITHUB_DEPLOY_REPO=YOUR_ORG/KaizenNEW \
  GITHUB_DEPLOY_EVENT_TYPE=sanity-update \
  GITHUB_DEPLOY_TARGET=main
```

### Deploy edge functions

```bash
corepack pnpm dlx supabase functions deploy draft --no-verify-jwt
corepack pnpm dlx supabase functions deploy preview-blog --no-verify-jwt
corepack pnpm dlx supabase functions deploy deploy --no-verify-jwt
```

Optional (if you use alert functions in production):

```bash
corepack pnpm dlx supabase functions deploy contact-alert --no-verify-jwt
corepack pnpm dlx supabase functions deploy scanner-alert --no-verify-jwt
corepack pnpm dlx supabase functions deploy newsletter-alert --no-verify-jwt
```

### Verify deployment

```bash
corepack pnpm dlx supabase functions list
```

Using your first-party editor API path, smoke-test:

```bash
curl -i "https://kaizenweb.co.uk/editor-api/draft?path=/blog"
```

Expected unauthenticated response: `401` JSON (`Studio authentication required`).

### Required secrets/env recap

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
