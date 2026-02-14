# Deployment Runbook (Astro SSR + PM2 + cPanel VPS)

This is the known-good deployment and recovery workflow for this project.

## Baseline

- Node: `20.x`
- Package manager: `pnpm@10.14.0` via `corepack`
- Stage app dir: `/home/kaizenweb/apps/kaizen-stage`
- Prod app dir: `/home/kaizenweb/apps/kaizen-prod`
- Stage port: `4322`
- Prod port: `4321`
- PM2 app names: `kaizen-stage`, `kaizen-prod`
- Sanity env required at build time:
  - `PUBLIC_SANITY_PROJECT_ID` (or fallback secret `SANITY_PROJECT_ID`)
  - `PUBLIC_SANITY_DATASET` (or fallback secret `SANITY_DATASET`, default `production`)

## Important Guardrails

1. Always build and run as `kaizenweb` (not `root`).
2. Keep ownership correct:
   - `sudo chown -R kaizenweb:kaizenweb /home/kaizenweb/apps/kaizen-stage`
   - `sudo chown -R kaizenweb:kaizenweb /home/kaizenweb/apps/kaizen-prod`
3. Clean `dist` and `.astro` before each build.
4. Start PM2 with explicit env (`HOST`, `PORT`, `NODE_ENV`).
5. Health-check both IPv4 and IPv6 loopback.

## One-Command Stage Redeploy (Manual Recovery)

Run as `kaizenweb`:

```bash
cd /home/kaizenweb/apps/kaizen-stage
pm2 delete kaizen-stage || true
rm -rf dist .astro
git fetch origin stage --prune
git reset --hard origin/stage
corepack pnpm install --frozen-lockfile
NODE_OPTIONS="--max-old-space-size=6144" corepack pnpm run build
HOST=0.0.0.0 PORT=4322 NODE_ENV=production pm2 start dist/server/entry.mjs --name kaizen-stage --cwd /home/kaizenweb/apps/kaizen-stage --update-env
pm2 save
curl -fsS --max-time 10 http://127.0.0.1:4322/ >/dev/null || curl -g -fsS --max-time 10 http://[::1]:4322/ >/dev/null
echo "stage ok"
```

## Fast Debug Commands

```bash
pm2 status
pm2 describe kaizen-stage
pm2 logs kaizen-stage --lines 120 --nostream
ss -lntp | grep -E "4322|4321|node" || true
```

## Known Past Failure Modes (Now Addressed)

1. `TypeError: util.inherits is not a function`
   - Root cause: SSR runtime config conflict in `astro.config.mjs` (polyfill/env override path).
   - Fix: remove Vite `nodePolyfills` + `define: { "process.env": {} }` from Astro config.

0. `https://missing-project-id.api.sanity.io/...` in browser network
   - Root cause: Sanity project ID missing at build/runtime env resolution.
   - Fix: set `PUBLIC_SANITY_PROJECT_ID` (or `SANITY_PROJECT_ID`) and redeploy.

2. `Connection refused` while PM2 looked online
   - Root cause: port/env mismatch or IPv6-only bind.
   - Fix: explicit PM2 env + health checks for `127.0.0.1`, `localhost`, `[::1]`.

3. `ERR_MODULE_NOT_FOUND` for `dist/server/entry.mjs` or `manifest_*.mjs`
   - Root cause: stale/mixed build artifacts or wrong ownership.
   - Fix: clean build folders each deploy and enforce non-root ownership.
