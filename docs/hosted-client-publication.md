# Hosted client publication

The hosted project API now creates frozen, project-scoped publication reviews and queues. A trusted Node worker on the destination host compiles the snapshot, downloads that project's private media, activates its bound Nginx store, verifies served bytes and commits only the live baseline. Saving newer drafts does not change the queued snapshot and publication never writes over the workspace.

This path has local PostgreSQL/worker protocol coverage, a standalone renderer-loader check and real process-crash recovery against isolated Nginx. The migrations and functions are now installed on the selected Supabase project, and real unrelated-account API/database/private-storage isolation checks pass. A provisioned production client destination and supervised worker publication still require acceptance. Recovery is an explicit operator action on the original host; the browser cannot reclaim worker ownership.

Removing a member denies new API/database access and new signed media URLs. Previously downloaded/cached files and already-issued signed URLs cannot be recalled; signed display URLs expire after one hour. Hosted acceptance checks a fresh authenticated Storage request as well as new URL signing after revocation.

## Required server configuration

Use a trusted, dependency-installed tooling checkout with Node 22 or later. The worker must run on the host owning the destination stores. Its configuration contains:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Explicit hosted Supabase origin. |
| `BUILDER_RELEASE_SERVICE_ROLE_KEY` | Server-only service credential; never a `VITE_` variable or browser setting. |
| `BUILDER_CLIENT_WORKER_ID` | Stable worker identifier, such as `clients-vps-1`. |
| `BUILDER_CLIENT_DESTINATIONS_FILE` | Absolute path to the operator-owned destination registry. |
| `BUILDER_CLIENT_WORK_DIRECTORY` | Dedicated private absolute directory, outside every release store and public web root, for snapshots, backups, build output and ownership locks. |

Do not put the service credential in the registry, repository, exported website or editable backup. Provide it privately to the process. The worker creates private work directories with owner-only access; its retained release files must remain readable by Nginx. Configure permission to validate and reload Nginx as described in [client publication](client-publication.md).

Apply the repository migrations through `202609110004_builder_client_history.sql` to the explicitly selected Supabase project, then deploy `builder-projects` with the matching shared files. This Edge function verifies the bearer token through Auth before using service-only RPCs; database checks repeat project membership, publish permission, archive state and destination ownership under locks. Its project access helper supports PostgREST's JSON `request.jwt.claims` setting as well as the prior individual claim setting. See [PostgREST transaction settings](https://postgrest.org/en/stable/references/transactions.html#request-headers-cookies-and-jwt-claims).

Authenticated members may read their destination metadata and release history. They cannot insert destinations, execute worker mutations, read worker ownership tokens or choose worker routing. Only an operator with the server credential provisions destinations. All client origins registered in this hosted database use HTTPS.

## Provision and run

First bind, stage, initialise and connect each dedicated Nginx store using the [client destination setup](client-publication.md). Use the hosted project's actual UUID and a new destination UUID. Staging and production require different origins and stores. A new client never defaults to Kaizen's site.

With the server variables set, provision one explicit destination:

```sh
pnpm exec tsx scripts/builder-client-worker.ts --provision DESTINATION_UUID
```

Provisioning checks the actual served baseline before recording the binding in Supabase. It rejects an existing destination assigned to different identity, worker or baseline. It does not change Nginx selection or publish client drafts.

The worker can process up to 20 queued jobs assigned to it and exit, or process one explicit job:

```sh
pnpm exec tsx scripts/builder-client-worker.ts --once
pnpm exec tsx scripts/builder-client-worker.ts JOB_UUID
```

Run `--once` through the service configuration below. Jobs remain visibly queued while no worker is running. Keep the worker's working directory at its trusted checkout; it loads that renderer without scanning client repositories or executing uploaded scripts. Each job uses an ownership token persisted with its process identity. The database refuses another claim or an overlapping pending release for the same destination. A failed queue item is recorded and processing continues with the remaining assigned jobs; the process exits nonzero if any item failed.

Open the hosted client project, choose **Releases**, select the explicit staging/production origin and review the saved project. The API checks publish permission again when starting. A changed workspace invalidates a publication review; a later save after starting stays a draft. Staging releases do not mark production pages published. Rollback uses a previously verified artifact and snapshot for the same destination; unpublication installs an unavailable page and clears only the projected live baseline.

## Supervised execution on Linux

The repository supplies [a service](../deploy/systemd/kaizen-client-worker.service), [a timer](../deploy/systemd/kaizen-client-worker.timer) and [an environment template](../deploy/systemd/client-worker.env.example). The timer waits 30 seconds after each run finishes, and systemd does not start another instance while that service is active. This follows the [systemd timer semantics](https://github.com/systemd/systemd/blob/main/man/systemd.timer.xml). These units are templates for the selected host, not evidence of an installed service.

Prepare a dedicated `kaizen-builder` system user, a reviewed checkout at `/opt/kaizen-builder`, and Node 22 or later at `/usr/bin/node` (adjust the unit if the host uses another explicit path). Install all locked dependencies, including development dependencies needed by the renderer. Keep source files operator-owned; grant the worker write access to `node_modules/.vite-client-worker`, its dedicated release stores and `/var/lib/kaizen-client-worker`. Create the private work directory with mode `0700`. The worker refuses work storage overlapping any registered release store or passing through linked paths. Public artifacts need Nginx read access; private workspace storage must never be included in a web root.

Install the real environment file at `/etc/kaizen/client-worker.env` with root ownership and mode `0600`. Keep the destination registry operator-owned and readable by the worker. Provide the existing narrowly scoped, noninteractive Nginx validation/reload permission described in the client publication guide. Do not grant a general passwordless shell. Provision each destination using that same worker identity and configuration before enabling the timer.

After adapting and reviewing the unit paths, install both units with mode `0644` in `/etc/systemd/system`, then:

```sh
sudo systemd-analyze verify /etc/systemd/system/kaizen-client-worker.service /etc/systemd/system/kaizen-client-worker.timer
sudo systemctl daemon-reload
sudo systemctl start kaizen-client-worker.service
sudo journalctl -u kaizen-client-worker.service -n 50 --no-pager
sudo systemctl enable --now kaizen-client-worker.timer
sudo systemctl list-timers kaizen-client-worker.timer
```

The service has a 15-minute run limit and terminates its process group if stopped. An interrupted claimed job remains protected and requires recovery. Timer runs do not automatically reclaim it. Monitor failed service runs through the host's existing monitoring. Before updating the tooling checkout, stop the timer and let the active service finish; install and verify the new locked dependencies before restarting it. This client worker does not pull, reset, commit or push any client repository.

## Failures and operator recovery

Build failures and unclaimed-job failures are recorded without changing the live baseline. A failed served-output check restores the previous Nginx artifact before recording rollback. Revocation or archive changes are checked before activation and finalization. A lost finalization acknowledgement is treated as uncertain: retain the verified serving artifact and ownership evidence for reconciliation, rather than blindly reverting it.

A crashed worker or uncertain commit can leave a job pending or marked `recovery_required`. Preserve its private job directory, Nginx transaction journal and database row. Stop the timer and allow any active worker service to finish before recovery. On the original host, with the same configured worker user, registry, work directory and server environment, run:

```sh
pnpm exec tsx scripts/builder-client-worker.ts --recover JOB_UUID
```

The command proves the recorded process has stopped on the same host and requires its original token to match the database claim. It holds separate recovery guards without deleting the original locks, accepts only this job's candidate or previous artifact, checks the exact store binding, validates/reloads Nginx and checks all served file hashes. Only then does it reconcile the database baseline and clear ownership locks. It never writes the draft workspace. A queued request that never acquired a database claim is instead cancelled with a failed status and must be reviewed again.

If publication permission was revoked, the project was archived or the destination was disabled before the candidate committed, it cannot be approved through recovery. Restore the recorded previous artifact explicitly:

```sh
pnpm exec tsx scripts/builder-client-worker.ts --recover JOB_UUID --restore-previous
```

The previous artifact must pass integrity and served-output checks. A damaged candidate is retained for inspection and does not prevent restoring the intact previous site. An externally edited active include is never overwritten. If the candidate already committed before an acknowledgement was lost, reconcile that committed release first; any subsequent rollback uses the ordinary reviewed publication workflow and its current permissions.

For the supplied systemd installation, an operator can run recovery with the same private environment without exposing its values in a shell command:

```sh
sudo systemd-run --unit=kaizen-client-recovery --wait --collect --pipe --property=User=kaizen-builder --property=Group=kaizen-builder --property=WorkingDirectory=/opt/kaizen-builder --property=EnvironmentFile=/etc/kaizen/client-worker.env /usr/bin/node /opt/kaizen-builder/node_modules/tsx/dist/cli.mjs /opt/kaizen-builder/scripts/builder-client-worker.ts --recover JOB_UUID
```

Append `--restore-previous` when appropriate. Resume the timer after successful reconciliation. Failed checks preserve ownership for another attempt. If the recovery process itself stopped, rerun the same recovery command: it can protect and retry retained recovery guards whose recorded processes are proven stopped on this host, preserving the original worker/database token and all existing verification gates. Concurrent recovery, live/foreign processes, missing or invalid ownership metadata, unrelated server selection, changed worker assignment, or more than eight nested interrupted guards require operator inspection. Never remove a lock just because it is old. The lower-level `client-publication.mjs reconcile` checks Nginx only and must not substitute for this hosted metadata recovery.

Release history is available in pages of 50 with Latest, Newer and Older controls. Active baselines and pending or recovery-required jobs remain visible on every page. Cursors are resolved within the selected project and caller permissions; new releases do not shift older page boundaries. The local companion uses the same paging contract. Local tests cover the actual SQL recovery protocol, ownership/permission refusal, lost acknowledgements and real worker termination after Nginx reload. The crash fixture routes its declared HTTPS identity to loopback HTTP; it tests real responses and hashes, not TLS or public DNS. A live service must still be verified with unrelated accounts, actual Storage downloads and the installed supervisor on the selected host before claiming production readiness.
