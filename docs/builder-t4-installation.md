# L6 installation and rollout plan

**Status: F in progress. Nothing from L6 is installed or deployed.** L5 (`48823c6`) remains live. This plan turns the verified fixture work (A–E) into an ordered, reversible installation for the coordinated L6 rollout (G). Read it with [the Claude checklist](handover/l6-t4-claude-tasks.md) and the guides linked below.

## Deployment is currently blocked, safely

GitHub `main` and `stage` both point to `afb9d3a`, the consolidation commit, pushed with `[skip ci]`. Its `.github/workflows/deploy.yml` activates releases through `sudo -n /usr/local/sbin/kaizen-public-deploy`.

On the VPS that launcher is **not installed**, and sudo only allows `nginx -t` and `nginx -s reload` for `kaizen-deploy`. The last deployment ran for `48823c6` on 14 September, and no launcher attempt has been logged since.

**What this means:**

- **Blocked updates:** the next push to `main` or `stage`, a Sanity content update, or a builder publish dispatch will fail before activation. The live websites stay unchanged, but those updates cannot reach them until G installs the launcher together with the L6 migrations.
- **Why not revert:** do not restore the L5 workflow on `main` to unblock updates. A successful deployment of today's `main` would publish unreleased L6 frontend and worker code before its database migrations. Coordinated rollout (below) is the fix.

## Current server inventory

Read-only inspection of `kaizen-vps` on 15 September:

- **Filesystem:** one filesystem, `/dev/sda1`, 96 GiB with 46 GiB free, holds `/srv`, `/var/lib`, `/opt` and `/tmp`. Every producer therefore shares headroom, so enable [shared storage admission](builder-quotas.md#shared-storage-admission-and-native-inventory-coverage).
- **Enabled services:** `kaizen-hosted-helper`, `kaizen-nginx` (ports 8091 production, 8092 client-demo, 8093 staging, 8094 domains), `kaizen-client-worker.timer`, `kaizen-backup.timer`, `kaizen-ops-monitor.timer`, `kaizen-client-demo-tls.timer`.
- **Installed but disabled:** `kaizen-domain-worker.timer`.
- **Not installed:** the upload worker and its `kaizen-upload` account, native release maintenance, native cleanup, `/opt/kaizen-native-release`, `/etc/kaizen/native-deploy.json`, `/var/lib/kaizen-native` and the public deployment launcher.
- **Accounts:** `kaizen-helper`, `kaizen-deploy`, `kaizen-builder`.
- **Configuration files** (names only; values were not read): `/etc/kaizen/{production.env, staging.env, client-worker.env, client-destinations.json, domain-worker.json}` and `/etc/kaizen-helper/{helper.env, projects.json, credentials}`.

| Producer | Identity | Retained roots |
| --- | --- | --- |
| Hosted helper (Kaizen project, `stage` branch) | `kaizen-helper`; native worker `kaizen-native-helper` | `/var/lib/kaizen-helper/work/projects/kaizen/checkout` (repository, including `.kaizen/build-recovery`), `…/drafts` (all accounts), plus `build-home` and `build-temp` (charged, reclaimed per D3) |
| Production deployment | `kaizen-deploy`; `kaizen-production-release` | `/srv/kaizen/production` (repository), `/var/lib/kaizen/production` (release store, including `requests/`), `/var/lib/kaizen-native/production/candidates` (to be created) |
| Staging deployment | `kaizen-deploy`; `kaizen-staging-release` | `/srv/kaizen/staging`, `/var/lib/kaizen/staging`, `/var/lib/kaizen-native/staging/candidates` |
| Legacy baseline | none (read-only source) | `/var/lib/kaizen/legacy-baseline-source` |
| Client worker (client scopes, not native) | `kaizen-builder`; `clients-vps-1` example | `/var/lib/kaizen-client-releases/client-demo` store; `/var/lib/kaizen-client-worker/jobs` |
| Domain worker (root) | root | `/var/lib/kaizen-domains`, Nginx `/etc/nginx/kaizen-domains.conf` |

No native client repository projects are configured; `projects.json` lists only `kaizen`.

**Leftovers for operator review (not removed):**

- `/var/lib/kaizen-billing-check-*` (six directories);
- `/var/lib/kaizen-domain-provider-check-*` (three directories);
- `/opt/kaizen-builder-before-1179886`;
- a stale failed `kaizen-l5-helper-fixture.service` entry;
- the exited transient `kaizen-helper-dependencies-8eef7de.service`.

These appear to come from earlier disposable fixtures and a helper upgrade. Confirm each before deleting it.

## One native configuration

[`deploy/systemd/native-cleanup.kaizenweb.json`](../deploy/systemd/native-cleanup.kaizenweb.json) describes those real roots and producers. It validates with `nativeAssetInventory`, producing configuration fingerprint:

```text
b22051b93705bf000369bc3609974bde0c97c7725d34c367af179d7d3adfac29
```

- **Where the value goes:** install the file root-owned as `/etc/kaizen/native-cleanup.json`. Use the fingerprint as `BUILDER_NATIVE_CONFIGURATION` for the helper (`BUILDER_NATIVE_WORKER_ID=kaizen-native-helper`), the production and staging deployment environments, and the root cleanup service.
- **Keeping it in sync:** any change to a root or producer changes the fingerprint and invalidates earlier cleanup clearance. Update every consumer together, and keep the old configuration registered until retained coverage is confirmed ([native coordination](builder-quotas.md#native-operation-and-cleanup-coordination)).

## Functions to redeploy with L6

Every `builder-*` Edge function imports a module that changed since L5, directly or through `_shared`:

- `builder-projects`, `builder-publish`, `builder-account`, `builder-invite`, `builder-content`, `builder-contact`;
- `builder-billing` and `builder-billing-webhook`;
- the new `builder-report`.

## Installation order (G)

Each step is verified before the next. None enables automatic cleanup until the last step.

1. **Recovery point.** Record the live revisions, run `kaizen-backup.service` once and verify its receipt, and confirm the Supabase backup status. **Rollback:** restore from that point.
2. **Database.** Apply the modified `202609120001` capabilities migration check, then `202609150001` through `202609150021` in order, each in its own transaction, and verify the migration ledger. **Rollback:** migrations are forward-only; a failed migration rolls back on its own, and a later problem is restored from step 1.
3. **Edge functions.** Deploy all functions listed above together, then set `BUILDER_REPORT_ORIGINS` and the billing and signup settings. **Rollback:** redeploy the L5 versions from `48823c6`.
4. **Shared storage admission.** Create group `kaizen-storage`, then `/var/lib/kaizen-storage-admission` (root:kaizen-storage, mode 2770). Add `SupplementaryGroups=kaizen-storage` to the helper, client worker, deployment and upload units, and set `KAIZEN_STORAGE_ADMISSION_DIRECTORY` in their environments. **Rollback:** unset the variable; behaviour returns to per-service monitoring.
5. **Upload service.** Create the `kaizen-upload` account, `/var/lib/kaizen-uploads` and `/opt/kaizen-upload-worker` (the bundle from `scripts/build-upload-worker.mjs`), plus `/etc/kaizen/upload-worker.env` (0600). Install `kaizen-upload-worker.service`, add the Apache/DirectAdmin proxy route to `127.0.0.1:4336`, verify, then enable. **Rollback:** disable the unit and remove the proxy route.
6. **Native deployment runtime.** Install `/opt/kaizen-native-release` (the worker bundle and preflight), `/etc/kaizen/native-deploy.json`, `/usr/local/sbin/kaizen-public-deploy` (from `scripts/ops/run_public_deployment.py`, root 0755), and the sudoers entry (checked with `visudo -c`). Create `/var/lib/kaizen-native/{production,staging}` (kaizen-deploy, 0700) and add `BUILDER_NATIVE_*` with `BUILDER_RELEASE_RETENTION_ENABLED=0` to both deployment environments. Run the launcher in `--mode preflight` for both branches. **Rollback:** remove the sudoers entry; deployments stay blocked exactly as today.
7. **Helper.** Add `BUILDER_NATIVE_WORKER_ID` and `BUILDER_NATIVE_CONFIGURATION`, then restart, preserving Sean's pending About edit, drafts and recovery files as in earlier rollouts. **Rollback:** remove both variables and restart.
8. **Client worker.** Add the retention settings (`BUILDER_RELEASE_RETENTION_ENABLED=0`) and the admission settings to `/etc/kaizen/client-worker.env`, and update `/opt/kaizen-builder` to the release revision. **Rollback:** restore the previous checkout.
9. **Milestone CI and frontend.** Push the release revision without `[skip ci]` so `builder-checks` and the deployment workflow run. Deploy staging first through the installed launcher, then production. Verify the origin checks, the release head and publication history. **Rollback:** the launcher's recorded rollback to the previous retained release.
10. **Scheduled workers.** Enable `kaizen-domain-worker.timer`; public domain acceptance needs Cloudflare access (human). Install `kaizen-native-maintenance@{main,stage}` and `kaizen-native-cleanup` with the inventory above, keeping both timers disabled. Run each once manually and confirm it reports disabled or idle.
11. **Turn on retention.** Only after staging publication, rollback, history availability and upload/copy checks pass: set `BUILDER_RELEASE_RETENTION_ENABLED=1` for the deployments and client worker, then enable the maintenance and native cleanup timers. **Rollback:** set it back to `0`; any owned attempt still finishes safely.

## Evidence so far

**Fixture and local proof** (details in each guide):

- the complete application suite (1,534 cases, actual Nginx);
- the Edge suite (11 tests, 72 steps);
- 26 actual PostgreSQL 17 contention groups;
- killed-service recovery for native and client retirement;
- real-Nginx serving and rollback after retention;
- the browser journeys for release history, suspension and the earlier L6 flows.

**Still required as live proof during G:**

- real Supabase Storage upload, resume and cancel, copy, and cleanup against disposable objects;
- the installed launcher and helper with the real fingerprint;
- a real custom-domain lifecycle (Cloudflare);
- Stripe checkout in test mode, then live;
- signup email delivery.

## Human-only items collected so far

- **Approve starting the production rollout (G).** Content updates stay blocked until then.
- **Payments:** Stripe live keys, webhook secret, price IDs, and the decision to charge real customers.
- **Signup email:** sender and SMTP provider for signup confirmation.
- **Custom domains:** Cloudflare access for DNS acceptance.
- **Wording and placement:** final Terms and Privacy wording, and where the public "Report a website" page goes.
- **Backups:** paid point-in-time recovery and always-on offsite storage.
- **Acceptance:** Sean's hands-on use of the finished product.
