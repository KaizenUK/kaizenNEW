# Retained website releases

The public deployment workflow now stages a complete build outside the live web root, records checksums and switches one Nginx include. It does not copy a candidate over the live files. The original static HTML, CMS content, generated redirects and build assets are retained for rollback. There is no automatic pruning.

`scripts/kaizen-releases.mjs` provides `stage`, `init`, `activate`, `rollback`, `list` and `verify-live`. It uses Node 22 or later and ordinary filesystem operations. Activation runs `nginx -t` and `nginx -s reload`, using `sudo -n` when the deploy user is not root. [Nginx documents its configuration validation and graceful reload behaviour here](https://nginx.org/en/docs/control.html).

## Builder browser origins

Each service has one server-side allowlist. Supply the helper setting in the environment of the process running `pnpm dev`; set the two function settings through Supabase's function secrets. These are public origin names, not credentials, but they control server access and must not use a `VITE_` prefix.

| Service | Setting | Default when absent |
| --- | --- | --- |
| Local helper | `BUILDER_COMPANION_ORIGINS` | `https://kaizenweb.co.uk` |
| Editor/Studio functions | `ALLOWED_STUDIO_ORIGINS` | `https://kaizenweb.co.uk,http://localhost:3333` (the existing editor configuration example) |
| Builder contact receiver | `BUILDER_CONTACT_ORIGINS` | `https://kaizenweb.co.uk,https://www.kaizenweb.co.uk` |

A configured comma-separated list **replaces** the default; an explicitly empty list allows no browser origins. Use complete HTTPS origins, without a path, query, fragment, credentials or wildcard. Plain HTTP is accepted only for `localhost`, `127.0.0.1` or `[::1]`. Root trailing slashes, host casing and standard ports are normalised; duplicates are removed. Invalid entries reject configuration instead of falling back, and errors never echo the entered values.

For example, `BUILDER_COMPANION_ORIGINS=https://builder.example pnpm dev` accepts pairing from that hosted origin after the normal explicit folder approval. It does not grant account access, approve a folder automatically or change loopback/Host checks. `BUILDER_COMPANION_TEST_ORIGIN` remains a test-only supplement that accepts only an exact HTTP loopback origin; a remote origin cannot enter through it.

`PUBLIC_SITE_ORIGIN`, `VITE_PUBLIC_SITE_ORIGIN`, Studio URLs and redirect/cookie settings no longer add allowed origins implicitly. When deploying this change, explicitly include every authorised production, staging and Studio origin in `ALLOWED_STUDIO_ORIGINS`. Those URL settings still select their original redirect destinations; they simply do not grant browser access. Restart the helper or redeploy the affected functions after changing these values. Origin checks complement authentication and project membership; requests without an Origin retain the existing authenticated server-request behaviour.

## Required one-time VPS setup

**Complete this before deploying the updated workflow.** The workflow fails before changing the live files if its release store is absent. The current production host configuration is recorded below; new hosts still need the setup in this section.

1. Choose a dedicated directory outside all public web roots and outside the Git checkout. Use different directories for production and staging, for example `/var/lib/kaizen/production` and `/var/lib/kaizen/staging`. The deployment user must own the directory; Nginx workers need read/traverse access. Do not expose the store itself through a server root or alias. Only the selected `site/` and shared `_astro/` assets are public.
2. From a reviewed checkout containing these scripts, capture the **currently served** static directory as the baseline. It must contain `index.html` and `builder/index.html`. Ensure its `redirects.generated.conf` matches the current generated redirect include; if the live include is stored elsewhere, copy that file into a separate baseline copy first. Leave the existing live directory intact.

   ```bash
   node scripts/kaizen-releases.mjs stage --source /existing/public/web-root --store /var/lib/kaizen/production --id baseline
   node scripts/kaizen-releases.mjs init --store /var/lib/kaizen/production --id baseline
   ```

3. In the intended Nginx server block, replace its existing `root` directive and generated-redirect include with:

   ```nginx
   include /var/lib/kaizen/production/active.conf;
   ```

   Keep the site's TLS, security headers, location routing, error pages and `index index.html` configuration. The managed include supplies `root`, the release's redirects, `location ^~ /_astro/` and the exact release-marker location. Remove duplicate definitions of those locations. Do not leave an old `root` override in the location serving builder pages. Nginx validation and the public response checks must pass before proceeding. The first setup switches to a retained copy of the baseline; it does not delete the old live directory.

   ```bash
   sudo nginx -t
   sudo nginx -s reload
   node scripts/kaizen-releases.mjs verify-live --store /var/lib/kaizen/production --id baseline --origin https://kaizenweb.co.uk
   ```

4. Add `VPS_RELEASES_DIR_PROD` and, if used, `VPS_RELEASES_DIR_STAGE` to the existing GitHub Actions secrets. Keep the existing VPS SSH, application-directory and public-domain settings. The old `VPS_WEB_ROOT_*` and generated-redirect include secrets are no longer used by the public deployment step. Grant the deployment user permission to run the two specific Nginx commands without an interactive password. Do not grant a broad privileged Node command.

Repeat the baseline setup for staging before enabling staging deployment. Existing separate Studio hosting remains optional. It receives the exact Studio files from the retained public release; that separate copy still uses its existing rsync mechanism. The public release, including `/builder/` and its bundled `/studio/`, uses the new activation mechanism.

## Deployment and verification

### Current DirectAdmin production host

Production uses `144.91.72.17` with the dedicated `kaizen-deploy` SSH user. The application checkout is `/srv/kaizen/production` and the retained store is `/var/lib/kaizen/production`. GitHub Actions holds a separate deployment key, the verified SSH host fingerprint, and these paths. `VPS_NODE_BIN=/opt/kaizen-runtime/node/bin` selects the dedicated Node 22 runtime without changing the host's system Node installation. Runtime shims are installed by the operator; deployment runs without permission to modify that runtime.

Apache/DirectAdmin continues to own ports 80/443, TLS, the `/editor-api/` proxy and `/cms/` routing. Only the main Kaizen website is proxied to the `kaizen-nginx` systemd service on `127.0.0.1:8091`. The domain's custom HTTPD template retains this route across DirectAdmin regeneration. The Nginx binary was extracted from Ubuntu's signed package repository into `/opt/kaizen-runtime/nginx`; the operator must update that isolated package when Ubuntu publishes security updates. The deployment user can validate and gracefully reload this Nginx service through two specific sudo commands.

The original Apache web root remains intact. Configuration backups and the original homepage comparison are in `/etc/kaizen-backups/20260911-deployment`. `legacy-baseline-20260911` retains the old static site, with an explicit temporary builder placeholder because the legacy site had no builder entry. It provides the initial verified rollback artifact.

Cloudflare injects a changing browser-check script into HTML. Consequently the VPS resolves `kaizenweb.co.uk` to its own address in `/etc/hosts`: the release engine validates full response hashes over the HTTPS **origin**. This does not verify CDN-transformed HTML. Verify the public Cloudflare release marker and browser routes independently after deployment; do not disable Cloudflare protection or treat origin verification alone as CDN verification.

The workflow forwards the existing Sanity and public Supabase build settings to the server, including the Studio dataset. Server-only cloud publication credentials remain a separate operator setup. A normal code deployment does not enable the cloud builder coordinator automatically.

Manual workflow runs support `preflight_only` to validate access, the release store, Node and Nginx without a build or activation. `tests/deploy/preflight.sh` exercises missing configuration, unsupported Node, rejected Nginx configuration, and a valid destination. Staging hosting remains separate and is not configured or deployed by this production repair.

The workflow resolves main/stage once, checks out that branch, records its exact commit and uses the same commit on the VPS. A repository dispatch targeting staging cannot also deploy production because the workflow happens to run on the default branch. Root and Studio dependencies are installed before the complete build. A process-held `flock` serialises use of the VPS checkout through staging and activation.

Each release lives under `releases/<id>/` with:

- `site/`: complete static output, including a public `.well-known/kaizen-release.json` marker containing only release ID, creation time and source commit.
- `redirects.conf`: the exact generated redirect rules, outside the served site.
- `release.json`: the file list, SHA-256 checksums, redirect checksum and expected public HTML responses, outside the served site.

Staging rejects symlinks, file traversal, missing entry pages and local workspace/server files. Activation rechecks every retained file, verifies the currently served baseline, installs immutable hashed build assets, writes `active.conf` atomically, validates Nginx and reloads it. It then checks the public release marker and the complete HTTP bodies for the home page, builder entry and every generated builder page. It uses fresh connections, bypasses normal caches and waits briefly for graceful reloads. A marker alone is insufficient to report success.

Shared `_astro/` files remain available to visitors with an earlier page open. Existing names must have identical bytes; a content collision fails activation. Assets are added through complete temporary copies before selection. Retained release files are not modified when switching or rolling back.

Transactions under `transactions/` record checking, activating, verifying and live states. A failed candidate restores the previous include, validates and reloads Nginx, and verifies the previous public responses. Only then does it record `rolled_back`. If the include was changed by an administrator, or recovery cannot be verified, it records `recovery_required` and reports the exact transaction; it does not claim the old site was restored. A candidate can be briefly served during its final HTTP verification; failure recovery returns serving to the prior release.

The generated redirect rules support exact internal paths with letters, numbers, slashes, dots, hyphens and underscores, with 301/302 responses. Invalid paths, configuration injection, duplicate sources and cycles fail the build. External redirects, query strings and regex patterns require deliberate additional support rather than raw Nginx interpolation.

## Hosted repository transport

The L1 client calls `POST /editor-api/builder-repository` on the builder's own origin. Each JSON request preserves its existing `repository-*` action fields and adds the selected `projectId`. The bearer token comes from the current Supabase session, is sent only to this fixed first-party endpoint, and is never forwarded across redirects. Neither the query string nor a local folder preference supplies an endpoint. Explicit developer tabs use `helper=local` and the existing approved companion window instead; transport selection is fixed for the document's lifetime.

The initial `repository-connect` action must verify the session, current project membership and configured working copy before returning `{ projectId, root, expiresAt }`. `root` identifies that project's folder and must stay the same within the connection; `expiresAt` is an absolute Unix timestamp in milliseconds. The client bounds the lease by the JWT expiry and rejects a mismatched project, expired lease or changed folder. Other actions return the existing helper result shape, or a non-2xx JSON `{ error }`. Every call still needs a server-side membership/path/plan check; browser checks are not an authorization boundary.

401/403, unavailable-service responses and connection loss end the client's connection while preserving recovery. Conflicts keep their original message. A timeout or account change can leave an already accepted write's outcome unknown; the client does not resend it automatically. Token refresh and return from the browser's page cache establish a fresh connection. Failed requests use the safe operator diagnostics path.

The endpoint is the contract for L1-T2, not a deployed Supabase function. Add an exact proxy route to the new loopback hosted-helper service ahead of the existing `/editor-api/` Supabase proxy when rolling out L1. Do not deploy the new client default by itself. The real working-copy service, deployment/authentication checks and operational configuration remain L1-T2–T7.

Hosted preview URLs must be on the builder's origin under `/editor-preview/<project>/…`. The client refuses another project, outside origin, credentials or escaped path separators and uses an opaque `allow-scripts` sandbox, including previews opened in a window. L1-T4 must make the authenticated HTML and module/asset delivery work in that sandbox while enforcing the editor cookie and membership on reads. The browser fixtures use an isolated HTTP adapter and CORS headers around real temporary-repository snapshots to exercise the client; they are not a production proxy or cookie policy.

## Builder error visibility

The default error sink is `public.builder_client_errors` in the existing Supabase project. This follows L0-T4 without adding another service. A hosted error service is an optional later alternative if Sean wants its search/alerting features; keep the same safe fields and access/retention boundary if changing the sink. No third-party error service is configured.

Apply `202609120002_builder_client_errors.sql` and `202609120003_builder_error_retention.sql` after the project-capabilities migration, then deploy the updated `builder-projects` function and frontend together. Migration 003 requires `pg_cron` and fails if the hourly cleanup cannot be scheduled. Supabase provides the scheduler; self-hosted Postgres must install it first. The syntax follows [Supabase's Cron installation](https://supabase.com/docs/guides/cron/install) and [job quickstart](https://supabase.com/docs/guides/cron/quickstart). Neither migration contains credentials.

The function accepts authenticated `record-error` actions, takes the account ID from the verified token and rechecks current membership and archived state in the recording transaction. A project lock serializes recording with membership changes. Each record contains project/user IDs, a server receipt time, fixed error category/source, known screen, optional page ID/route hash, browser family/major version/platform, and helper mode/state. No raw message, stack, URL, source path, build log, title or arbitrary JSON is stored. There is no diagnostic email or Slack integration.

Only database operators (SQL editor or a server-side service-role client) can read these records. Builder owners and editors cannot select, insert, update or delete them, impersonate an actor through the RPC, or run retention cleanup. Service-role recording must use the guarded RPC; it has no direct table write grant. The client uses explicit event-time authentication and drops pending sends on account changes. No extra secret belongs in the frontend.

Inspect the most recent records for one project using a bound project parameter in an operator SQL client:

```sql
select created_at, project_id, user_id, category, source, screen,
       page_id, route_hash, browser_family, browser_version, platform,
       helper_mode, helper_status
from public.builder_client_errors
where project_id = $1 and created_at >= now() - interval '14 days'
order by created_at desc, id desc
limit 100;
```

The route hash can be matched against a user's copied report. It does not recover the route or error text. Membership permits recording even without publish permission. Revoked members and archived projects are refused. Writes are capped at 20 per account/project per hour and 2,000 per project per day, checked against server receipt times under the project lock. Dropped duplicates/rate-limited events are not counted elsewhere. The browser also limits attempts, deduplicates a repeated category/source/page for one minute, bounds concurrent sends and abandons a slow request. This is troubleshooting evidence, not complete analytics or an availability monitor.

`builder-client-error-retention` runs hourly and physically removes records older than 14 days, including projects with no recent activity. With the job operating, deletion occurs at its next hourly run (up to 14 days plus one hour after receipt). Removing an account or project also deletes its records through foreign keys. This policy covers the live error table; database backups follow the separate backup-retention policy.

Before enabling beta recording, and after database maintenance, verify the job is active and inspect its latest execution in Supabase Cron. Check the actual deployment with:

```sql
select jobid, jobname, schedule, active, command
from cron.job where jobname = 'builder-client-error-retention';

select status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'builder-client-error-retention')
order by start_time desc limit 5;

select count(*) as overdue
from public.builder_client_errors
where created_at < now() - interval '14 days 1 hour';
```

An inactive/failed job or overdue records require operator action. Correct the job or database issue, run `select public.builder_prune_client_errors();`, then verify the next scheduled run succeeds and `overdue` is zero. Do not claim retention is active based on applying the table migration alone. The database test executes the real schema, access rules, quotas and deletion function; PGlite substitutes only the unavailable `pg_cron` scheduler, so live scheduling still needs this deployment check.

## Rollback and operations

Inspect retained versions, then reactivate the chosen artifact without a build or CMS fetch:

```bash
node scripts/kaizen-releases.mjs list --store /var/lib/kaizen/production
node scripts/kaizen-releases.mjs rollback --store /var/lib/kaizen/production --id PREVIOUS_RELEASE_ID --origin https://kaizenweb.co.uk
```

The selected configuration is not itself proof that Nginx serves it. Use `verify-live` to check the server response. Keep release records and files together. Monitor storage usage: retained artifacts and immutable assets are not automatically removed.

An activation lock includes its owning process ID, host and creation time. Do not clear it because it is old. Inspect the process on that host and its transaction. If the process is confirmed stopped, preserve the orphaned lock and transaction for diagnosis, inspect the selected include and public marker, and recover under a maintenance window without competing deployments. There is no automatic stale-lock takeover. Interrupted or externally modified configurations require operator recovery.

For a coordinated cloud builder, use **Builder → Releases → Review rollback**. The raw filesystem rollback command above is an operator recovery tool: it does not reconcile Supabase by itself, and a later coordinated deployment will reject a mismatch between the serving artifact and database head. Rolling back files does not roll back database migrations, enquiries or external services.

## Coordinated builder publication

The hosted publish function now saves an immutable private request rather than promoting a draft immediately. The request freezes the selected resolved pages, image variants and shared design, with optimistic checks on page versions, site state and asset metadata. A queue entry contains the full candidate publication set, including unchanged live pages. Ordinary code/CMS-triggered deployments enter the same queue and use only the last verified publications. A pending editor release blocks a competing deployment instead of leaking through its build.

Roll out the following together, after the Nginx/store setup above:

1. Apply `202609100008_builder_releases.sql` after the earlier builder migrations, and deploy the updated `builder-publish` function. This adds the private release queue, one active release per workspace, editor-only status RPC, service-only worker operations and guards against legacy writes during deployment.
2. Set `BUILDER_RELEASE_SERVICE_ROLE_KEY` in the VPS checkout's private `.env`, alongside its existing `VITE_SUPABASE_URL` and `VITE_BUILDER_CLOUD=1`. This credential is only read by the Node worker. Never put it in browser configuration or give it a `VITE_` prefix. The queue and its lock owner are not readable by anonymous or authenticated clients; editors use the limited status RPC.
3. Deploy the updated workflow and `scripts/builder-release-worker.mjs`. Repository dispatch forwards a validated release request UUID. The worker claims that exact request, writes its private input under the release store's `requests/`, then runs the complete build with `BUILDER_RELEASE_SNAPSHOT_FILE`. The build refuses an invalid or missing configured snapshot rather than falling back to mutable publications. The redundant preliminary GitHub build is removed; the pinned VPS build is the deployed build.
4. Set `BUILDER_RELEASE_COORDINATOR=1` in the publishing function's secrets once this worker path is ready. Until this is enabled, hosted Publish returns a setup error and does not modify published data. Keep the existing GitHub deployment credentials there.
5. Use separate Supabase workspaces for production and staging. One database represents one independently deployed site; sharing a publication head between different origins is unsupported.

The worker progresses through queued, building, activating and verifying. Only after retained-file and complete public HTTP checks does it commit the candidate publication set and shared design in one database transaction. Current drafts, draft versions and newer autosaves remain intact. Published snapshots and bounded publication revisions are updated separately. Old data is not promoted simply because GitHub accepted a dispatch or the static build succeeded.

**Builder → Releases** polls status while visible, shows the currently verified release, exposes actionable recorded errors and lets an editor retry an unclaimed dispatch. Rollback and unpublish have explicit review steps. Rollback selects the original retained artifact without rebuilding or refetching CMS content and reconciles its publication snapshots into the database after verification. Unpublish removes the selected page from the candidate publication set while preserving its draft/history; it does not automatically add a redirect. The separate optional Studio hostname is not rolled back by a builder rollback; the public release's `/studio/` files are part of its retained artifact.

CMS bindings are frozen as page configuration for the worker, then resolved during that build. The retained artifact contains the exact resulting HTML. A subsequent new code/CMS deployment can legitimately resolve newer published CMS content; an explicit rollback uses the retained bytes. Builder redirect drafts and saved private previews are described in the [builder guide](visual-builder.md).

There is no atomic transaction spanning PostgreSQL and Nginx. If database promotion is definitively rejected, the activation code restores and checks the old artifact before recording recovery. If its acknowledgement is lost, the worker reads back the request: a confirmed committed release remains live. If the database cannot be reached to establish the outcome, the already verified candidate stays selected and the release remains pending with a local `recovery_required` transaction. It does not blindly restore files that may now disagree with a committed database. New deployments stay blocked until the owner/operator reconciles actual state. Never clear a queue entry or take over a worker based solely on elapsed time.

Setup/SSH failures before the worker can claim a request leave it queued. Inspect the GitHub workflow and VPS logs before using Retry dispatch; this UI does not yet fetch GitHub job diagnostics. A crash after claiming likewise requires inspection of the actual worker, serving marker and transaction. No automatic takeover or recovery CLI is provided yet. Historical release artifacts and private request files are retained without automatic pruning.

### Coordinator verification

PostgreSQL tests apply the actual migration in PGlite, including permissions, immutable request/claim retries, single ownership, draft preservation, stale workspace rejection, failures staying out of later builds, rollback reconciliation, unpublish, route reservation and normal deployment queue isolation. Worker integration tests use real retained files and HTTP responses with a controlled Nginx adapter, covering accepted/rejected database promotion, lost acknowledgements and unavailable outcome checks. A Chromium test mounts the shipped Releases panel with a controlled service boundary and exercises observed progress, review/confirm actions, pending-state controls and service errors. These checks do not establish hosted authentication or a real VPS deployment as verified.

### Retained artifact checks

Local unit tests exercise real files and HTTP responses with an Nginx control adapter: activation, exact rollback, failed configuration/reload/health checks, immutable assets, changed archives, locks and external-edit recovery. `tests/builder/verify-releases.mjs` exercises the same activation code with a real Nginx process in an isolated directory on a temporary loopback port. It verifies a successful release, invalid-config recovery, wrong-route/content recovery, 301 redirects, old asset availability and rollback to the original CMS markup. The test stops only the Nginx instance it starts.

The real smoke test passed locally with the official Windows Nginx binary. Builder CI now runs it with Ubuntu's Nginx package. Linux CI, actual VPS configuration, hosted editor authentication/storage, production release activation and live rollback remain to be verified after deployment access and setup are available. No public release, remote configuration change or GitHub push was made for this increment.

## Builder redirects

Builder → Redirects provides a separate saved draft, a review of added/changed/removed rules and explicit publication. Both forms of a directory URL (with or without a trailing slash) receive the chosen 301/302 response, preserving query parameters. Temporary 302 is the default because browser caches can retain a permanent 301 after it is changed. History restoration changes the draft only. There is a 200-rule limit; paths are internal, at most 200 characters and use letters, digits, slashes, dots, underscores and hyphens. External URLs, query-specific rules and regular expressions are unsupported.

Install `202609100010_builder_routes.sql` after migrations 001–009, with no pending release, alongside the updated publishing function, generator and worker. Do not reapply an earlier backup migration over the wrapper functions added by 010. Anonymous access exposes only published rules; draft editing and backup access require editor membership. Queued releases freeze redirect rules, ordinary page/site/code releases retain the published set, and verified rollback restores the retained release's rules while preserving newer drafts. A missing redirect field in an older retained snapshot means no builder redirects.

A redirect cannot replace a current builder page or protected existing Astro/editor route. Publish a moved page's new URL first, then publish a redirect from the old URL. Published and pending sources are reserved against page edits. Build-time validation checks conflicts and cycles across builder, Sanity and fixed site redirects and verifies that every builder destination chain ends at an emitted public path. A missing destination fails the build and preserves the previous live site. Removing a page that is still a redirect destination therefore requires updating or removing the redirect first.

The generated `redirects.generated.json` records status, destination and query-preservation checks. Staging stores those checks in the private release manifest and excludes both generated redirect files from the served site. Verification requests both URL aliases with query parameters, checks the exact Location and status without following redirects, and includes these responses in publication evidence. Failure triggers the same retained-release recovery as a bad page response. Legacy artifacts without this metadata retain their previous page checks.

Local checks cover database permissions, draft and release isolation, backup restoration, redirects through a real Nginx process and recovery from a redirect that loses query parameters. The hosted migration, actual VPS activation and live cloud rollback still require deployment and verification.
