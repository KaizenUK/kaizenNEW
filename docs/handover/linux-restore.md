# Restore and resume on Linux

Read `HANDOVER.md` first. The original full goal is unfinished and work is paused at Sean's request. This guide restores the existing work; it does not authorise restarting the implementation before Sean is ready.

## Before wiping Windows

Two different things must survive:

1. **GitHub repository**: code, this handover, the original request, Claude's brief, tests and documentation. The handover is pushed to `main` with `[skip ci]`; production stays on the last verified release.
2. **Private migration bundle**: `KAIZEN-PRIVATE-MIGRATION-2026-09-11.zip` in the project root (and its unpacked folder). It is intentionally ignored by Git. Sean will upload it to private cloud storage before wiping. **A copy left only on this PC will be erased.**

The ZIP contains credentials and private project data and is not password-encrypted. Keep it in private, access-controlled storage. Do not attach it to a public issue, share a public link, commit it, or include it in website output. Download/read back the cloud copy and compare its SHA-256 to `KAIZEN-PRIVATE-MIGRATION-2026-09-11.sha256` before wiping.

The bundle contains:

- `.kaizen-builder/`: all 14 saved local workspace/catalogue/asset files found at the pause (7,762,300 bytes before packaging). This is the personal local state, not the test workspace. Eleven asset files and one additional local project's workspace are included.
- `config-kaizen/access-handoff.json`: supplied provider/access details. Its contents remain private.
- `config-kaizen/staging.env`: private Supabase settings used for production despite the filename.
- `config-kaizen/supabase-access-token.txt`: portable copy of the available Supabase management credential. The Windows credential helper cannot be relied on after a wipe or on Linux; the actual token was not printed or committed.
- `config-kaizen/supabase-readonly.ps1`: original Windows helper for reference only; do not expect its Windows credential-store integration to work on Linux.
- CI SSH key pair, client-demo operator metadata and migration-version metadata from the private Kaizen configuration folder.
- `ssh/`: the existing Kaizen SSH key pair, config and known-hosts file. These are private. Preserve host-key verification.
- A restore README and SHA-256 inventory so the copied bytes can be checked.

Not included: browser passwords/sessions, arbitrary other client repositories, OS/application settings, all Codex/Claude history, `node_modules`, build output, caches, temporary fixtures and bulk diagnostic logs. GitHub Desktop and browser sessions will need re-authentication. The repo handover is the durable agent context. If you have other client checkouts, unsaved browser work or unrelated files you need, back those up separately.

No saved source-draft files were present in the personal `.kaizen-builder` tree when it was packaged; the native source-draft acceptance files were isolated test data. Any source editing done after the bundle was made needs another backup.

## Fresh checkout and runtime

Use a normal Linux filesystem location rather than the soon-to-be-wiped Windows path. Install Git, OpenSSH and a supported Node runtime through your normal Linux setup. Known tested runtimes here were Node 22.23.2 on the VPS and Node 24.18.0 on Windows. Use Node 22 or 24 at a version satisfying the locked packages' engines, not an older distribution default.

```sh
git clone https://github.com/KaizenUK/kaizenNEW.git
cd kaizenNEW
git switch main
git pull --ff-only
git status --short
node --version
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm --version
pnpm install --frozen-lockfile
pnpm --dir apps/studio install --frozen-lockfile
```

Root `package.json` pins pnpm 10.32.1; Studio has its own package manager declaration and lockfile. If your Node installation omits Corepack, install/enable Corepack through its supported setup before running these commands. Do not delete lockfiles or run a blanket dependency upgrade as a migration workaround. Preserve `patches/` and the Puck patch configuration.

The application is now Astro 7.3.2, React 19, Tailwind 4.3.3, Vite 8.3.0 and Sanity 5.13.0. It remains a static Astro site with React islands, plus a separate Studio app. Older text saying Astro 6 has been superseded by the authorised upgrade.

## Restore private data carefully

Extract the private ZIP outside the public web root. With `kaizenNEW` freshly cloned and no development server running, copy the bundled `.kaizen-builder` directory into the repository root. Refuse/backup an existing `.kaizen-builder` rather than merging or replacing it blindly. Leave it ignored by Git.

Restore `config-kaizen` files to `~/.config/kaizen/`. Restrict that directory to your Linux user (`chmod 700`) and credential files to `chmod 600`. Never paste secret values into the handover, terminal transcripts or `.env.example`.

Restore the SSH key pair under `~/.ssh/` only after checking whether that Linux installation already has keys. Do not overwrite a different identity. You can instead name the restored key `id_ed25519_kaizen` and point the `kaizen-server` alias to it. Example config (adjust the identity filename):

```sshconfig
Host kaizen-server
  HostName 144.91.72.17
  User root
  IdentityFile ~/.ssh/id_ed25519_kaizen
  IdentitiesOnly yes
```

Use mode 700 for `~/.ssh`, 600 for private keys/config and 644 for public keys. Merge known-host entries if other hosts already exist. Verify existing host keys; do not bypass verification just to make SSH connect. The CI key is distinct from your interactive SSH key; existing GitHub Actions secrets remain on GitHub and do not need replacing merely because the workstation changed.

The portable Supabase management credential can be loaded without echoing it:

```sh
export SUPABASE_ACCESS_TOKEN="$(cat "$HOME/.config/kaizen/supabase-access-token.txt")"
pnpm dlx supabase@2.117.0 functions list --project-ref kbqraygsegcclzhsmpvz
unset SUPABASE_ACCESS_TOKEN
```

That list is read-only. If the token no longer works, sign in or obtain a fresh token; do not expose it in chat. GitHub/Git authentication should be re-established normally; browser/OAuth sessions were not exported. `staging.env` is private input, not something to source into a frontend wholesale. Use `.env.example` and expose only documented public frontend variables if needed.

## Start and test the actual local companion

```sh
pnpm dev
```

The terminal should say `http://127.0.0.1:4321/` and tell you to keep it running. The launcher intentionally stays in the foreground. Closing it stops the companion. It should fail clearly if that port is occupied. For another port use `pnpm dev --port 4325` and enter that address in the hosted builder.

1. Sign in at <https://kaizenweb.co.uk/builder/> with Sean's account.
2. Open the intended client project, then **Export & handoff**.
3. Use the current local address and click **Connect helper**. Allow the companion window if the browser blocks popups.
4. Check the displayed hosted origin/account/project, enter the new **Linux absolute repository path**, and approve it. Keep both the terminal and companion window open.
5. Inspect the repository and check that source fields load. This confirms today's implemented companion flow; it is **not** acceptance of the missing native WYSIWYG feature.

Do not reuse the old Windows pairing URL fragment. Browser local storage, build job IDs, popup handles, tokens and old absolute checkout paths are not portable sessions. Rebuild to create new local preview jobs. If restored metadata references Windows roots, inspect and rebind deliberately; do not search-and-replace every JSON file or discard saved data to make it disappear. Native backups can restore supported source drafts into a newly chosen folder, but a general cross-OS path migration has not been tested.

## Verification commands

Run resource-heavy checks sequentially. Windows previously ran out of native/page-file memory; the limits below are optional resource bounds, not secrets.

```sh
export NODE_OPTIONS='--max-old-space-size=4096 --v8-pool-size=1'
export RAYON_NUM_THREADS=2
pnpm test -- --maxWorkers=1
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm exec playwright test --config playwright.builder.config.ts
pnpm dlx deno@2.9.6 check --config supabase/functions/builder-projects/deno.json supabase/functions/builder-projects/index.ts
```

Install Chromium's OS dependencies using the supported Playwright/Linux setup if required. Base browser config uses an isolated workspace under `test-results/` and port 4322, with a companion cross-origin fixture at 4323. It does not use the personal `.kaizen-builder`. Tests must not be pointed at production or Sean's real client sources. The optional real-Nginx scenario requires a working local Nginx binary; the external asset-pack scenario needs its actual fixtures. Explain skips rather than counting them as passes.

Do not edit source while a Vite/browser scenario is running; HMR previously invalidated an acceptance run. If an observation times out, check the same live process before restarting it. Do not broadly kill Node/browser processes or delete locks to recover tests.

## Production read-only checks

```sh
ssh kaizen-server 'readlink -f /opt/kaizen-builder'
ssh kaizen-server 'systemctl is-active kaizen-client-worker.timer kaizen-client-demo-tls.timer'
```

At handover the resolved worker path was `/opt/kaizen-builder-releases/1179886`. The publication CLI's entry-point guard compares its real module URL with argv, so invoking it by the symlink path can produce no output. Resolve the path first and use the actual release path. Do not treat empty CLI output as verification.

Read the current selected artifact with `client-publication.mjs list`, then run `verify-live` against that exact ID. For the handover artifact the read-only command was:

```sh
ssh kaizen-server '/opt/kaizen-runtime/node/bin/node /opt/kaizen-builder-releases/1179886/scripts/client-publication.mjs verify-live --config /etc/kaizen/client-destinations.json --destination d2dc035d-1f2c-4fcf-8404-4194786f512f --id 300d7710-69c9-46fe-82ed-5e940997d80d'
```

Do not blindly rerun old ignored acceptance helpers: some create users, publish, roll back or unpublish. Temporary publishing credentials were intentionally removed. Use the normal signed-in UI or reviewed isolated tests when resuming.

## Resume prompt

Give the new agent this request:

> Read HANDOVER.md, docs/handover/original-request.txt and docs/handover/claude-ux-brief.md. Resume the original Kaizen multi-project builder goal from the current repository and production state. The top priority is actual WYSIWYG editing of existing Astro/React sites; the current source-content form and separate selection popup do not satisfy it. Coordinate the visual/UX pass, preserve original code and data, and verify the actual hosted-to-Linux companion workflow. Commit 1486788 contains tested but undeployed publication warnings. Do not claim the goal complete from old tests, and keep private migration files out of Git.
