# Client publication on a managed Nginx host

Unity's local companion can publish a frozen saved client project to a dedicated Nginx destination. The server release engine and CLI also accept independently built static artifacts. The hosted API/queue/worker and operator recovery are described in [hosted client publication](hosted-client-publication.md). The hosted APIs and production worker are installed; an explicitly provisioned client destination and its complete publication acceptance are still outstanding. Kaizen's original production site uses its separate verified CI release path.

The CLI does not build source, install dependencies, commit or push. Build through the local companion or the destination repository's normal build command first. Keep the editable `.kaizen/project.zip` and repository source outside public output. A client release contains only the reviewed static files. Use this path on the host that owns the release store; SSH and server administration credentials belong to the operator, never to browser settings.

## Configure a new destination

Copy [the registry example](client-destinations.example.json) to a server-owned file, for example `/etc/kaizen/client-destinations.json`. Replace the example IDs with the real client project's UUID and a new destination UUID. Choose the actual HTTPS origin and a dedicated absolute release store outside the public web root. Staging and production require different origins, destination IDs and stores. The registry refuses duplicate origins, overlapping stores or multiple destinations for one project/environment. There is no default target.

The file contains no secret values, but only the deployment operator should be able to edit it: it controls where publication is allowed. `BUILDER_CLIENT_DESTINATIONS_FILE` can provide its absolute path instead of `--config`. Store paths are omitted from the public destination projection. Hosted membership enforcement is a separate required integration, not supplied by this local server CLI.

For the first staging destination in the example, run these commands from the Kaizen tooling checkout on the server, after building the client repository separately:

```sh
node scripts/client-publication.mjs bind --config /etc/kaizen/client-destinations.json --destination 22222222-2222-4222-8222-222222222222
node scripts/client-publication.mjs stage --config /etc/kaizen/client-destinations.json --destination 22222222-2222-4222-8222-222222222222 --source /srv/client-source/dist --redirects /srv/client-source/hosting/redirects.json --id initial-client-release
node scripts/client-publication.mjs init --config /etc/kaizen/client-destinations.json --destination 22222222-2222-4222-8222-222222222222 --id initial-client-release
```

`bind` accepts only a new empty store or the exact existing binding. It cannot claim an existing Kaizen release store or change the client/environment of a retained store. `stage` copies and hashes the artifact; optional `--redirects` reads the reviewed redirect JSON from the website export/integration and generates the Nginx rules and corresponding HTTP checks. Without that flag, existing `redirects.generated.conf/json` in the build are used if present, otherwise the release has no redirects. Only use trusted, reviewed build input and host snippets.

`init` writes the first `active.conf` and reports **setup_required**. It does not activate or verify a server. In the dedicated site's existing Nginx server block, replace its previous root and generated-redirect include with the release include. Retain the site's TLS and other required host configuration. Do not duplicate existing location blocks:

```nginx
include /srv/client-releases/example-staging/active.conf;
index index.html;
location / { try_files $uri $uri/ =404; }
```

Test and reload Nginx through the host's normal administration process, then verify:

```sh
node scripts/client-publication.mjs verify-live --config /etc/kaizen/client-destinations.json --destination 22222222-2222-4222-8222-222222222222 --id initial-client-release
```

Only a successful `verify-live` proves that initial setup serves this release. Configure DNS/TLS, disable HTML/marker response transformations or caching that would change verification bytes, and allow the deployment process to fetch the configured origin. Subsequent activation needs permission to run `nginx -t` and reload Nginx; the default Linux adapter uses the current root account or noninteractive `sudo -n nginx`.

## Publish and recover

### From Unity on the local companion

Set `BUILDER_CLIENT_DESTINATIONS_FILE` to the absolute server-owned registry path before starting `pnpm dev`. The companion must run on the machine that owns the configured stores and can test/reload the destination Nginx server. A workstation companion cannot write a remote VPS's filesystem. For a separately configured Nginx installation, `BUILDER_CLIENT_NGINX_PREFIX` supplies its absolute prefix containing `nginx.conf`, and `BUILDER_CLIENT_NGINX_BINARY` supplies its executable. These are server configuration, never editable browser fields. Normal Linux installations use the release engine's existing Nginx adapter.

Open the client project and select **Releases**. The page editor's **Publish** button first saves the page and opens this same whole-project review. Explicitly choose staging or production, review the saved pages and destination, then publish. New projects have no default target. A review expires after 15 minutes and becomes invalid if drafts, selected live artifact or destination configuration change before starting.

The trusted renderer compiles the captured pages, shared design, redirects and configured services without running uploaded code or repository scripts. Registered media is checked against its uploaded checksum. Built-in samples, Unsplash images and images from the project's configured public Sanity dataset can be bundled; other remote media must first be imported into that project's Asset library. Any failed media download stops the release. Connected CMS blocks require a captured catalogue from the explicitly configured public dataset. The publication is a snapshot of that content.

Release history shows queued/building/activation/verification states, persistent logs, verified releases and failures. It prevents a second operation while one is pending for the selected destination. Verification uses actual served bytes. Restoring a retained release and unpublishing use the same checks. Saving newer drafts during publication, rollback or unpublication preserves those edits and their revision history. Production page badges derive from a separately retained verified snapshot; staging releases do not mark production pages published.

Private snapshots, editable backups and job history remain in the selected project's `publication/` directory. Never serve that directory publicly. The UI calls the active pointer **Last verified baseline**: it is not a continuous uptime check. External CLI/administrator changes do not automatically reconcile that pointer. Keep the project publication directory and destination transaction journals intact when investigating an interrupted job.

### Recover an interrupted companion publication

After restarting the companion, an unfinished job whose recorded process is proven stopped on the same host offers **Check and reconcile interrupted release**. New publications to that destination remain blocked until reconciliation. This action holds both companion and server recovery guards, keeps the original locks in place, and accepts only that job's requested artifact or its recorded previous artifact. It tests Nginx configuration, reloads the selected include and checks every served file before reconciling the matching retained editable snapshot. Drafts and revision history are untouched. If the previous artifact is still selected, the failed attempt is recorded as restored rather than published.

A failed check retains the stopped owner's lock and exposes the error for another recovery attempt. Locks owned by a running process, a different host, an unidentifiable process or another job are not reclaimed. Elapsed time never proves a process stopped. Missing snapshot evidence, unrelated selected artifacts, corrupt lock metadata or changes to destination identity require operator inspection. If recovery itself was terminated, retry **Check and reconcile interrupted release** after the recorded recovery process is proven stopped on this host. An additional exclusive guard protects each stopped guard; original ownership records stay intact until the operation succeeds. Concurrent retries are refused. Up to eight nested interrupted guards can be retried; deeper chains or guards without usable ownership records require operator inspection. Do not manually delete guards to bypass these checks. Recovery never replaces an externally edited include or deletes release artifacts.

### From the server CLI

For another revision, build again and stage with a **new** release ID. Then run `activate` with that ID and the same explicit destination arguments. IDs cannot overwrite retained releases. Each client artifact and public release marker identifies its project, destination, environment and origin. Verification checks every served file and all redirect responses, including preserved query parameters.

`activate` checks the current baseline, writes the selected include, tests and reloads Nginx, and checks HTTP output before reporting `live`. Failure restores and rechecks the previous release. External include edits or uncertain finalization produce `recovery_required`; inspect the transaction and server before retrying. An activation lock is never reclaimed merely because it is old. Inspect its recorded process and journal first.

Use `list` to inspect selected configuration and transaction history. Selection alone is not proof that the server is serving it. Use `verify-live` for the actual output. `rollback --id <retained-id>` activates that exact retained artifact through the same verification path. `unpublish --id <new-id>` creates and activates a noindex unavailable page; former page routes return 404. Roll back to a prior release to restore them.

Retained releases and immutable `/_astro/` and `/assets/` files let older open pages finish loading after activation. New exports include content hashes in media filenames. Reusing an immutable path for changed bytes is refused. Unpublishing pages does not erase retained public assets or CDN/browser caches; removal of previously public media requires a separate retention/purge operation. No cleanup is performed automatically.

For server-only interrupted activation, `reconcile --id <selected-id>` uses the same stopped-process checks, configuration validation, reload and served-output verification, including retry of stopped recovery guards. It does not change the selected include. The CLI never edits builder drafts, the editable backup or Unity's last verified baseline. Use Unity's companion recovery when its publication metadata must be reconciled too. Hosted queue/membership integration is implemented separately and still requires live acceptance. A passing local Nginx test is not production deployment evidence.

## Local evidence

The companion validates saved job identities, project/destination ownership, release IDs, timestamps, rollback references and active-baseline pointers before using publication history. Retained snapshots must be regular files with a valid project workspace and an action-compatible payload. A damaged index or snapshot stops the operation with a recovery message. A missing index is only initialized for an empty publication directory; retained jobs, snapshots or locks prevent treating lost history as a new project. Preserve the complete publication directory and release store for operator inspection. Do not delete the index or locks to bypass these checks; restore known-good metadata and verify the selected/served artifact before reconciling.

`tests/builder/client-publication.spec.ts` additionally drives Unity's editor Publish → destination review → publish through real isolated Nginx, imports an SVG, verifies a two-page site at desktop/mobile widths, rejects a missing-media build, publishes again, rolls back and unpublishes while preserving newer drafts. It also terminates a separate publisher process after an actual Nginx reload and recovers that interrupted job through Unity, and rejects another project's use of the destination. `client-publisher.spec.ts` exercises stale reviews, destination locking, persisted baselines after companion restart, staging separation, failed-verification restoration, before/after-selection crash recovery, concurrent recovery refusal and live/foreign process-lock protection; its Nginx adapters are test doubles, unlike the browser scenario.

`tests/builder/verify-client-releases.mjs <built-repository>` runs three isolated Nginx sites and checks separate client/staging/production identities, the CLI registry/stage/list/verification path, activation, every-file checks, redirects, failed-release recovery, unpublication, rollback and desktop/mobile browser navigation. Set `KAIZEN_NGINX_BINARY` when Nginx is not on PATH. Windows verification used the [official Nginx download](https://nginx.org/en/download.html) in an OS-temporary tools directory. Linux CI installs Nginx and runs this test against the independently built Astro fixture. Remote CI and production execution remain unverified.
