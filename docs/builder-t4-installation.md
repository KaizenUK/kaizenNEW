# L6 installation and rollout plan

**Status: G complete except retention. L6 is installed and live.** Production serves release `l6-main-2` and staging `l6-stage-14`, both from `615db73`. Release retention and native cleanup remain switched off, and the remaining items are the human-only ones below. This plan turns the verified fixture work (A–E) into an ordered, reversible installation for the coordinated L6 rollout (G). Read it with [the Claude checklist](handover/l6-t4-claude-tasks.md) and the guides linked below.

## Deployments now work through the installed launcher

`/usr/local/sbin/kaizen-public-deploy` is installed with its sudoers entry, so `.github/workflows/deploy.yml` can activate releases again, and a Sanity content update or builder publish reaches the live websites. GitHub `main` and `stage` both point at `615db73`.

- **How this rollout deployed:** the launcher was driven directly on the server (`--mode deploy --branch stage|main`) rather than through the workflow, because the release commits were pushed with `[skip ci]`. The workflow path is unchanged and remains available.
- **Rolling back:** `--mode reconcile --restore <retained release>` with `--release <currently selected release>`; both directions are verified on staging. The launcher refuses a restore whose `--release` no longer names the selected release.

## Current server inventory

Read-only inspection of `kaizen-vps` on 15 September:

- **Filesystem:** one filesystem, `/dev/sda1`, 96 GiB with 46 GiB free, holds `/srv`, `/var/lib`, `/opt` and `/tmp`. Every producer therefore shares headroom, so enable [shared storage admission](builder-quotas.md#shared-storage-admission-and-native-inventory-coverage).
- **Enabled services:** `kaizen-hosted-helper`, `kaizen-nginx` (ports 8091 production, 8092 client-demo, 8093 staging, 8094 domains), `kaizen-client-worker.timer`, `kaizen-backup.timer`, `kaizen-ops-monitor.timer`, `kaizen-client-demo-tls.timer`.
- **Installed but disabled:** `kaizen-domain-worker.timer`.
- **Installed during this rollout** (absent in the 15 September inventory above): the upload worker and its `kaizen-upload` account, native release maintenance and cleanup units, `/opt/kaizen-native-release`, `/etc/kaizen/native-deploy.json`, `/etc/kaizen/native-cleanup.json`, `/var/lib/kaizen-native`, the shared admission directory, and the public deployment launcher.
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
3. **Edge functions.** Deploy all functions listed above together, then set `BUILDER_REPORT_ORIGINS` and the billing and signup settings. `builder-billing`, `builder-billing-webhook` and `builder-report` are new to the live project; the other six replace recorded L5 versions. `builder-report` needs no key of its own: its reporter hashes are keyed with the existing service role key. **Rollback:** redeploy the L5 versions from `48823c6`, and delete the three new functions.
4. **Shared storage admission.** Create group `kaizen-storage`, then `/var/lib/kaizen-storage-admission` (root:kaizen-storage, mode 2770). Add `SupplementaryGroups=kaizen-storage` through a drop-in for the helper, client worker and upload units, and give `kaizen-helper`, `kaizen-builder`, `kaizen-upload` and `kaizen-deploy` membership. Deployments receive the group from the launcher's own `storageGroup` field instead of a unit file. Set `KAIZEN_STORAGE_ADMISSION_DIRECTORY` in every one of those environments, including `/etc/kaizen/production.env` and `staging.env`, which the release worker loads. **Rollback:** unset the variable; behaviour returns to per-service monitoring.
5. **Upload service.** Create the `kaizen-upload` account, `/var/lib/kaizen-uploads` and `/opt/kaizen-upload-worker` (the bundle from `scripts/build-upload-worker.mjs`), plus `/etc/kaizen/upload-worker.env` (0600). Install `kaizen-upload-worker.service`, add the Apache/DirectAdmin proxy route to `127.0.0.1:4336`, verify, then enable. **Rollback:** disable the unit and remove the proxy route.
6. **Native deployment runtime.** Install `/opt/kaizen-native-release` (the worker bundle and preflight), `/etc/kaizen/native-deploy.json` (including `"storageGroup": "kaizen-storage"`), `/usr/local/sbin/kaizen-public-deploy` (from `scripts/ops/run_public_deployment.py`, root 0755), and the sudoers entry (checked with `visudo -c`). Create `/var/lib/kaizen-native/{production,staging}` (kaizen-deploy, 0700) and add `BUILDER_NATIVE_*` with `BUILDER_RELEASE_RETENTION_ENABLED=0` to both deployment environments. Run the launcher in `--mode preflight` for both branches. **Rollback:** remove the sudoers entry; deployments stay blocked exactly as today.
7. **Helper.** Add `BUILDER_NATIVE_WORKER_ID` and `BUILDER_NATIVE_CONFIGURATION`, then restart, preserving Sean's pending About edit, drafts and recovery files as in earlier rollouts. **Rollback:** remove both variables and restart.
8. **Client worker.** Add the retention settings (`BUILDER_RELEASE_RETENTION_ENABLED=0`) and the admission settings to `/etc/kaizen/client-worker.env`, and update `/opt/kaizen-builder` to the release revision. **Rollback:** restore the previous checkout.
9. **Milestone CI and frontend.** Push the release revision **to the branch being deployed**: the deployment clones that single branch and refuses a commit that is not an ancestor of it, so `stage` must carry the revision before a staging deployment and `main` before production. Push without `[skip ci]` when `builder-checks` and the deployment workflow should run. Deploy staging first through the installed launcher, then production. Verify the origin checks, the release head and publication history. **Rollback:** the launcher's recorded rollback to the previous retained release.
9a. **Register the native configuration.** Deployments refuse to start until the database knows this host's configuration and its producers: call `builder_native_asset_configure('kaizen-native-cleanup', <fingerprint>, array['kaizen'], <producers>, false)` with the service credential, keeping cleanup disabled. The producers are the three worker identities in the inventory. Until then every deployment fails with `Configured native website producer required`. **Rollback:** repeat the call with the previous values; it refuses while any operation is active.

10. **Scheduled workers.** Enable `kaizen-domain-worker.timer`; public domain acceptance needs Cloudflare access (human). Install `kaizen-native-maintenance@{main,stage}` and `kaizen-native-cleanup` with the inventory above, keeping both timers disabled. Install the inventory as `/etc/kaizen/native-cleanup.json` root-owned **0600**; the worker refuses a group-readable file. Run maintenance once for each branch and confirm it reports `{"phase":"disabled"}`. The cleanup worker cannot be checked the same way: its database calls require cleanup to be enabled, so leave that service unrun until step 11.
11. **Turn on retention** (not done; publication and rollback pass, the editor's own upload, publish and history checks are still outstanding). In order:
    1. set `BUILDER_RELEASE_RETENTION_ENABLED=1` in `/etc/kaizen/production.env`, `/etc/kaizen/staging.env` and `/etc/kaizen/client-worker.env`;
    2. re-register the native configuration with cleanup allowed — the same `builder_native_asset_configure` call as step 9a with its last argument `true`; the cleanup worker's database calls refuse to run while it is `false`, so that service cannot be smoke-tested before this;
    3. `systemctl enable --now kaizen-native-maintenance@main.timer kaizen-native-maintenance@stage.timer kaizen-native-cleanup.timer`;
    4. watch the first run of each, then confirm retained releases and rollback targets still exist.

    **Rollback:** set the variable back to `0` and disable those timers; re-register with `false`. Any attempt already under way finishes safely.

    **Left behind until then:** the staging store keeps the releases from this rollout's failed attempts (`l6-stage-10`, `l6-stage-12`, `l6-stage-13`) alongside the live `l6-stage-14` and the previous `gh-34909251210-1`. Retention removes them once it is on; do not delete them by hand.

## How public requests already reach the server

The DirectAdmin Apache vhost for `www.kaizenweb.co.uk` is the single public entrance, and it already routes by path:

| Public path | Destination |
| --- | --- |
| `/editor-api/` | `https://kbqraygsegcclzhsmpvz.functions.supabase.co/` (Edge functions, so the new report function answers at `/editor-api/builder-report`) |
| `/editor-api/builder-repository`, `/editor-preview/` | the hosted helper on `127.0.0.1:4334` |
| `/cms/`, `/.well-known/acme-challenge/` | served locally, never proxied |
| `/` | production Nginx on `127.0.0.1:8091` |

- **Step 5 adds one sibling rule:** `/editor-uploads/` to `127.0.0.1:4336`, with its matching `ProxyPassReverse`, placed with the other path rules ahead of `/`. Nothing else in the vhost changes, and `stage.kaizenweb.co.uk`, `client-demo.kaizenweb.co.uk` and the client sites keep their own vhosts.
- **Step 3 report origins:** set `BUILDER_REPORT_ORIGINS` to the public site origins that may submit reports (`https://kaizenweb.co.uk,https://www.kaizenweb.co.uk`), since the function checks the browser's origin before accepting anything.
- **Runtime already present:** `/opt/kaizen-runtime/node-v22.23.2-immutable`, which the upload unit's `ExecStart` expects.

## Recovery point recorded (step 1)

- **Live before L6:** production release `gh-34909251359-1`, staging `gh-34909251210-1`, client-demo `300d7710-69c9-46fe-82ed-5e940997d80d`; migration ledger latest `202609140005`; GitHub `main`/`stage` at `afb9d3a`; two builder projects; no pending hosted or client jobs.
- **Forced capture:** `status verified`, snapshot `a75e485a4591b4fcc863e767f80b28293f917eef939b324ec8b8fafe181ec322`, 18,126 files across 43 sources, including the configured Supabase capture.
- **Recorded L5 function bodies:** the six live `builder-*` functions were saved before any deployment.
- **`202609120001`** differs from the applied version only by a removed trailing blank line, so it is not reapplied.

## The upload cutover window

[`202609150013`](../supabase/migrations/202609150013_builder_storage_cutover.sql) removes direct browser writes to the builder buckets, so every upload reserves its allowance through the upload worker instead. During this rollout that window lasted from applying the migrations until the upload service was enabled about twenty minutes later, with no upload attempted in between. Keep steps 2, 3, 5 and 9 together in any future installation.

## What the live rollout produced (16 September)

| Step | State | Evidence |
| --- | --- | --- |
| 1 Recovery point | done | verified capture `a75e485a…`, 18,126 files, 43 sources, six L5 function bodies saved |
| 2 Database | done | migrations `202609150001`–`021` recorded with exact sources; 51 builder tables with row-level security, 3 new private tables closed to signed-in users, 236 functions with no anonymous execute, 4 retention schedules |
| 3 Edge functions | done | nine functions ACTIVE without JWT gating; `builder-billing`, `builder-billing-webhook` and `builder-report` new at v1; `BUILDER_HOSTED_BILLING_KEY` generated on the server and matched in the helper, `BUILDER_REPORT_ORIGINS` set |
| 4 Shared storage admission | done | group `kaizen-storage` with all four accounts, `/var/lib/kaizen-storage-admission` 2770, drop-ins for helper/client worker/upload, `storageGroup` for deployments |
| 5 Upload service | done | `kaizen-upload-worker` enabled, local health `running`, public `/editor-uploads` answers 412 rather than 503 |
| 6 Native deployment runtime | done | launcher and sudoers installed (`visudo -c` clean), state directories created, preflight passes for both branches |
| 7 Helper | done | restarted on `615db73` with the native identity and admission; Sean's draft and recovery files preserved |
| 8 Client worker | done | `/opt/kaizen-builder` switched to `615db73`, run reports success |
| 9a Native configuration | done | `builder_native_asset_configure` registered the fingerprint and three producers with cleanup disabled |
| 9 Frontend | done | staging then production activated and verified; rollback to the previous release and forward again both verified on staging |
| 10 Scheduled workers | done | domain worker timer enabled and idle; maintenance reports `{"phase":"disabled"}` for both branches; cleanup and maintenance timers stay disabled |
| 11 Retention | **not enabled** | still gated on a real upload, publish and copy through the live editor |

**Defects found and fixed during the rollout** (each with a test): the browser account fixture applied later migrations before the billing tables existed and seeded stored files without verified sizes; its client release stub lacked the suspension lookup; the report function would have demanded a login; storage measurement failed when a package manager made files vanish underneath it; and the published release identity file inherited the deployment service's private file mask, so every activation rolled back with a refused live check.

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

## Database advisories after the rollout

Supabase's own linters were read after the migrations landed. Everything actionable was fixed; the rest is recorded here so nobody re-investigates it.

- **Fixed:** the legal version trigger was the only builder function resolving names through the caller's search path ([`202609160001`](../supabase/migrations/202609160001_builder_legal_trigger_path.sql)). The access matrix test now checks every function, not only the security-definer ones.
- **By design, 38 "row-level security enabled, no policy" notices:** the private tables have no policies precisely because nothing but the service role may read them. The access matrix test pins that.
- **By design, one "security definer view" error** for `builder_public_redirects`: visitors must read published redirect rules without reading the private draft table behind them. The view keeps `security_barrier` and only exposes the published projection.
- **By design, 22 "security definer function executable by authenticated"** notices: those are the reviewed browser RPCs, and the same test pins exactly which ones signed-in people may call.
- **Needs a paid plan:** leaked-password protection (checking new passwords against known breaches) returns "payment required" on the current plan. Minimum password length is already 12.
- **56 performance notices** are unindexed foreign keys and unused indexes on tables that are currently almost empty. Revisit when there is real traffic rather than guessing now.

## Sign-up is switched off in Supabase Auth

`disable_signup` is **true** and no SMTP sender is configured, so the builder's sign-up flow cannot create an account or send a confirmation email today. Both belong together: enabling sign-up without a sender would create accounts that can never confirm. Decide the sender first, then enable sign-up.

## Human-only items collected so far

- **Use the finished product once** (sign in, edit, upload an image, publish, roll back). That is the last gate before release retention and native cleanup are switched on.
- **Studio subdomain:** `studio.kaizenweb.co.uk` has an Apache vhost but no DNS record anywhere, so the Studio is unreachable by that name.
- **Continuous integration:** `builder-checks` runs only on a pull request, and this rollout pushed straight to `main`/`stage` with `[skip ci]`. Open a pull request (or dispatch the workflow) when a full CI record is wanted.
- **Git credential:** the repository remote carried an embedded password; it has been removed from the remote URL. Treat that password as exposed.
- **Payments:** Stripe live keys, webhook secret, price IDs, and the decision to charge real customers.
- **Signup email and sign-up itself:** choose the sender and SMTP provider, then switch `disable_signup` off. Until both are done, only existing accounts can sign in.
- **Paid plan decision:** leaked-password protection and always-on point-in-time recovery both need a paid Supabase plan.
- **Custom domains:** Cloudflare access for DNS acceptance.
- **Wording and placement:** final Terms and Privacy wording, and where the public "Report a website" page goes.
- **Backups:** paid point-in-time recovery and always-on offsite storage.
- **Acceptance:** Sean's hands-on use of the finished product.
