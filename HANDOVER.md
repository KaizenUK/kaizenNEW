# Kaizen builder — Windows to Linux handover

Prepared 11 September 2026 at Sean's request; resumed on Linux on 12 September. **Read the Linux continuation below for current implementation and acceptance status.**

This file is the starting point for Codex, Claude and Sean. It supersedes older “remaining work” statements in the chronological progress log. Read [the original request](docs/handover/original-request.txt), [Linux restoration](docs/handover/linux-restore.md), and [Claude's visual/UX brief](docs/handover/claude-ux-brief.md).

## The critical correction

Sean successfully logged in and connected his local checkout. His hands-on feedback was: “all the editor does is allow me to change text blocks, am I not supposed to be able to edit this in the wysiwyg editor?” He also described much of the current interface as confusing or ugly and specifically requested a Claude visual/UX pass.

**He expects to edit existing websites visually, not just edit source-content fields.** Current native editing offers text/link/image fields, some Astro section reordering and a separate rendered selection window. It does not open an existing site in the full WYSIWYG canvas with layout/design editing. Do not call that requirement complete because source round-trip tests pass. This is the primary unfinished product work.

Do not narrow the goal to building new sites or content-only editing. Preserve original code and interactions; make unsupported/dynamic elements explicit rather than pretending arbitrary React/Astro can round-trip automatically. Design the actual end-user workflow with Claude before investing further in scattered controls.

## Linux continuation — 12 September 2026

**Builder launch:** Start with [the launch brief](docs/handover/codex-launch-brief.md), then follow [the ordered launch task map](docs/builder-launch-plan.md). Implementation is on `codex/builder-launch`; the task map records evidence and remaining acceptance. Sean has provisionally accepted the current hosted workflow and explicitly resumed the goal; continue the outstanding tasks in order.

**Sean's launch acceptance — 13 September:** Sean clicked **Save** and saw the account/email setup requirement. He said the behavior looked right, accepted it for now, and asked to raise a bug later if needed. This clears the current hands-on acceptance hold. It is evidence of the Save attempt and account-details notice, not a completed staging save or production publication. Keep account setup and wording in the upcoming L2 work, without inventing his account details. Finish L1-T7 and continue the ordered launch tasks; this acceptance does not mark unimplemented tasks complete.

**L2 continuation — 13 September:** all four People and access tasks are implemented and locally verified in `kaizen-launch`: invitations/member directory, role-based views, Account and clear sign-in/password-link states. Account lets users supply their own name, request email/password changes, sign out other sessions and request deletion with approval from another owner of each website. Save points to Account and shares its name/email rules. A failed or reused password link preserves an existing valid sign-in, with an explicit choice to continue or sign out. The full checkpoint passes **610 tests across 69 files**, **65 browser journeys with one optional archive skip**, all six function checks, and type checking with no errors or warnings. Screenshots and detailed evidence are in the task map. **L2 has not been deployed.** The first milestone CI run exposed an early Save-button loading gap; the fix passes five repeated recovery checks, eight affected browser journeys and full types. Complete CI on the corrected revision and the coordinated migrations/functions/frontend/**helper runtime** rollout; T3 adds a shared module imported by the helper. Preserve Sean's pending About edit during that upgrade. Continue with **L3-T1** afterwards; file/branch/commit hiding remains that explicit work.

**Sean's CI cadence — 13 September:** batch CI at the end of each milestone (L0–L6), then once more at the end of the goal. Keep task documentation and relevant local checks current; do not stop between individual tasks for CI. This supersedes earlier per-task CI holds in the chronological log.

**Hosted helper operations — 13 September:** L1-T7 is implemented and deployed. The final `6358086` revision passes [builder CI](https://github.com/KaizenUK/kaizenNEW/actions/runs/34776260772): 436 tests, 53 browser scenarios and 10 additional hosted-transport scenarios, with one optional archive skip. Production (`gh-34776913010-1`) and staging (`gh-34776913050-1`) each pass all 259 HTTPS origin checks. The database head matches production with no pending release; client-demo is unchanged. The permanent `kaizen-hosted-helper.service` is enabled and healthy. Its root-owned `3688a08` runtime contains the same helper source as the final revision; only documentation and a browser test differ. The managed staging checkout advanced to `6358086` by fast-forward, preserving Sean's modified About page, saved draft, source recovery and private build settings byte-for-byte. Private pre-upgrade and source-forward backups are retained on the VPS. Current L2 work is recorded above.

**Previous launch deployment — 13 September:** `e747452` established the live hosted Kaizen setup, including the four builder functions. Codex used the signed-in production builder to build Kaizen's real About page on the VPS and inspect its rendered desktop/phone previews, without a local helper or content changes. The T7 rollout above supersedes its helper and frontend; its functions remain current because T7 did not change them. Credential replacement is closed, with no further token action pending. Sean's later provisional acceptance is recorded above; neither deployment completes the launch goal.

**Latest acceptance:** Sean confirmed that, from the live builder connected to `/home/sean/Documents/GitHub/kaizenNEW`, he opened the page, clicked **Build**, waited, and the project appeared. This clears the reported hosted-preview blocker. He waived Firefox/Safari checks and asked that any future Retry failure be handled as a bug fix rather than delaying this task. Retry was not needed in his successful first-build journey. See [the acceptance update](docs/existing-site-visual-editing-plan.md#user-confirmed-hosted-preview--12-september-2026).

The existing-site canvas is deployed as `9aca128` / `gh-34712289074-1`. Local helper server-stop detection is in `d7d9359`. Website routes open from Pages into the real built page, with direct text editing, link addresses, image replacement, section ordering, shared outline/undo history, draft recovery, review/apply and an explicit commit step. The old field editor and separate selector are fallbacks. This answers the handover's **critical correction in code**, and Sean has confirmed the real hosted page now appears.

Original Astro/React source remains authoritative. Only safely located literal fields and complete section ranges are patched. Registered components expose supported content and existing literal design values; unregistered components do not gain arbitrary layout/style editing. Builder pages retain their full visual editor. A Git commit includes only the last applied plan's files; pre-existing staged files, an in-progress Git operation, changed applied bytes or missing identity prevent it. No push or publication is automatic.

The final code passed 214 unit tests across 44 files, 42 browser scenarios with one optional licensed-archive skip, and Astro/TypeScript checks with zero errors and zero warnings (172 existing hints). The complete site/Studio build passed. Desktop and phone screenshots were regenerated and visually checked. The browser suite covers direct typing, links, decoded replacement images, section order, draft recovery, review/apply/rebuild, registered design values, original React hydration and commit isolation.

Evidence remains distinguished: the actual local fallback completed a reviewed temporary text apply/rebuild/restore, with the About source restored byte-for-byte. An isolated copy of Kaizen's real About page passed direct desktop/phone input with 281 fields across 18 files. Sean's later live-site confirmation establishes the real build and rendered canvas; it does not claim that he manually repeated every editing or commit operation. Earlier Codex in-app blank-frame and input-control failures remain recorded in the chronological acceptance log, not an unresolved claim that Sean's preview fails.

The frame keeps its nonce/origin checks, approved-root boundaries, `connect-src 'none'` and `form-action 'none'`. Selected images create their blob URLs inside the preview frame, and text blur cannot replay an edit after Undo. The local consent page survives development reloads; builds preserve Astro preferences and ignore generated recovery/Studio output. A session probe detects a stopped or restarted helper server without extending its two-hour expiry. Keep the helper terminal and approval window open while editing.

The historical pause-state sections below describe 11 September, not current implementation or deployment status.

## State at the pause

| Area | Authoritative state |
| --- | --- |
| Repository | `https://github.com/KaizenUK/kaizenNEW`, branch `main`. This handover and all completed code are being pushed to GitHub. |
| Last deployed application code | `e05783d74e6bcba8cc083969c183eaba5ac4f48e` — fixes default local companion startup. |
| Live main release | `gh-34633894917-1`; [CI run 34633894917](https://github.com/KaizenUK/kaizenNEW/actions/runs/34633894917) passed, including served-output verification and database finalization. |
| Code newer than production | `1486788` adds publication delivery warnings and strengthened tests. **Committed and verified locally; not deployed to the website or Supabase function.** The handover push uses `[skip ci]` so backing up work does not publish it. |
| Hosted builder | <https://kaizenweb.co.uk/builder/>. Password protected. Open signup disabled. Sean has signed in successfully. |
| Sean's login | `sean@kaizenweb.co.uk`. Sean chose his password; none is recorded here. |
| Acceptance client | <https://client-demo.kaizenweb.co.uk>. Separate destination on the existing VPS, expressly authorised by Sean. |
| Current client artifact | `300d7710-69c9-46fe-82ed-5e940997d80d`; freshly verified against the public server with 11 checks. This supersedes older artifact IDs in the operations history. |
| Main unresolved functionality | Existing-site WYSIWYG editing and the visual/UX redesign. |
| Workstation | Windows checkout was `C:\Users\seanm\Documents\GitHub\kaizenNEW`. No Linux workstation acceptance has been performed. |

Sean authorises direct production/main deployment, not a staging deployment; staging capability remains part of the product. He authorises dependency upgrades, including majors. He selected his **local GitHub Desktop checkout**, not a managed VPS repository, for existing-site editing. No new permission question is needed for those choices. Never commit private credentials.

## What works now

### Projects, access and persistence

- Dashboard: create, open, rename, duplicate and archive projects. New/copied projects have no deployment destination by default.
- Pages, assets, site design, reusable content, templates, settings, history and destination configuration are scoped to projects. Duplication remaps project media and disconnects services/destination appropriately.
- The legacy Kaizen workspace has an in-place migration path preserving existing drafts, publications, assets and history.
- Hosted owner/editor membership and separate publish permission are enforced at API, PostgreSQL and Storage boundaries. Real unrelated-account access, revocation and editor/publisher separation were tested against production Supabase.
- Private uploaded assets use stable project references and expiring display/download URLs. Rendering renews access without rewriting saved data/undo history. Fresh access is checked after revocation; already-issued signed URLs can remain valid until expiry.
- Password invitation/recovery setup and subsequent sign-in were exercised. Temporary authentication test resources were removed. The disabled client publication test uploader identity remains to preserve Storage ownership; it has no project membership.

### Builder-owned visual pages

- Unity/Puck editor supports nested blocks, drag/drop, inline/rich text, layers, undo/redo, duplication, copy/paste, autosave, revisions, responsive overrides and inherited-setting indicators.
- Shared headers, footers, sections, site tokens and typography; per-instance overrides and detachment; reusable sections/templates; asset library import/search/reuse/deduplication/replacement.
- Asset ZIP import, resumable uploads, small-file retry, responsive image generation/crop/focal point, font/media handling and source/license reference preservation.
- Page management, URLs, SEO metadata, sitemap/robots generation, redirects, private previews, backup and release controls exist. The current arrangement needs a substantial UX pass; functional coverage is not design acceptance.
- Navigation and interactive exported blocks have desktop/mobile and keyboard checks.

### Export, backup and repository handoff

- Selected-project exports contain independently buildable React/TypeScript source, static page generation, bundled media/fonts/styles/runtime, redirect configuration and integration guides.
- Exported websites do not require Kaizen's editor, credentials, Supabase or private Sanity connection. CMS content is materialised as a snapshot.
- `.kaizen/project.zip` is the editable backup; `dist/` is the website to deploy. These are different deliverables. Backups retain structure, shared content, assets/settings and history; restoration is reviewed and does not activate old publications.
- Local Astro + React and builder-export repository inspection, proposed-file review, apply/recovery, ownership/version/conflict checks and reopening for a further visual edit are implemented.
- Git operations remain with the user/GitHub Desktop. Integration preserves unrelated files and uncommitted changes and rejects changed generated files rather than silently replacing them.
- A compiled component registration contract exposes supported fields and a nested-content slot. It is not an automatic importer for arbitrary components. See [component integration](docs/builder-component-integration.md).

### Existing source editing — useful but incomplete

- Inspect native Astro/React and imported JS/TS/MJS/JSON literals, including barrel exports and named content variables. Change literal text, links and images without replacing the original layout, scripts or hydration.
- Reorder supported complete Astro sibling sections. Computed/CMS values remain with their source integration.
- Per-project/repository/route drafts persist locally, survive reopen, detect another window's saves/source changes and offer recovery downloads. Reviewed application checks all imported file hashes and retains recovery copies.
- Reviewed builds execute the selected repository's actual package build command, recover prior output after failure, and expose a private static snapshot. Selection requires a build matching current source.
- Native source backup/restore includes source/assets/package files and saved source drafts, preserves modes where supported, refuses existing destinations and excludes secrets, Git, dependencies and build output.
- **No full native WYSIWYG canvas, direct visual layout editing, or general source-element styling has been implemented.**

### Hosted-to-local companion

- Hosted **Export & handoff** (labelled “Export & repositories” before the September 2026 UX pass) opens a local consent window and connects only after approval of one folder for the shown hosted origin/account/project.
- Capabilities are local, expire, restrict roots and issued review/job IDs, and are revoked on disconnect/account change. Draft identities are separate from the original local Kaizen project.
- `pnpm dev` now runs the foreground API launcher in `scripts/dev.mjs`, explicitly at `http://127.0.0.1:4321`, and rejects an occupied port. Keep the terminal and companion window open. A different port is supported with `pnpm dev --port 4325`.
- Sean reported a genuine Windows failure: the old CLI listened on IPv6 `::1` while the form used IPv4. Earlier port-4322 acceptance did not test normal startup. This was reproduced, fixed, tested on actual port 4321 from the signed-in production page, and confirmed working by Sean.
- Click **Connect helper** afresh after a restart. An old URL fragment is a pairing session, not a reusable bookmark.

### Publishing and services

- Main-site CI uses retained static releases and verifies served files before reporting success; failure restoration and the Supabase `pg_safeupdate` fix are deployed.
- Separate client publication registry, frozen snapshots, queued worker, history, explicit destination selection, failure recovery, rollback and unpublish are implemented. New projects cannot default to Kaizen's live destination.
- Client-demo production publication, later revision, failed-byte verification/restoration, rollback, unpublication, retained newer drafts and unrelated-account isolation were exercised against the real VPS/Supabase.
- Process-crash recovery has isolated real-Nginx evidence; no deliberate crash of the public VPS is required to repeat acceptance.
- Per-client form receiver and public Sanity project/dataset settings exist. An empty form receiver disables export submission. Stored submissions are distinguished from delivered notifications. **No real client notification recipient/delivery service or client CMS has been provisioned for this demo.** These remain explicit integration boundaries, not working inbox-delivery claims.

## Missing work and known issues

1. **Existing-site WYSIWYG**: design and implement the actual visual editing workflow. It must show the existing rendered page within the editing experience, support meaningful on-page selection/editing and visual design/layout controls, retain source review/recovery, and accurately identify unsupported elements. Validate against Sean's actual checkout and a representative independent Astro/React site, not just a simple text fixture.
2. **Claude visual/UX pass**: unify navigation, terminology, hierarchy and workflows; reduce the many technical cards/panels and excessive instructions. See the separate brief. Sean has explicitly rejected treating the present appearance/usability as finished.
3. **Unreleased delivery warnings** (`1486788`): deploy the frontend and the updated `builder-projects` Edge function together after checking current main. No migration is needed. Verify the real review response/UI. Other functions and the VPS client worker have not been changed by this commit.
4. **Live demo missing route**: its current footer has a “Get in touch” link to `/contact/`, which returned HTTP 404. The project currently has Home and About only. This was not silently changed or republished. Resolve it deliberately when resuming; check the current draft first. New warning code exposes missing routes/shared footer links and unconfigured receivers before publication.
5. **ResizeObserver notifications**: the development-server log can show “loop completed with undelivered notifications”. Instrumented repeated repository tests reproduced it after page close, with `visibility:hidden` and a closing marker. Active editing/resizing passed. Do not claim every warning in every workflow is proven harmless or that the editor console is universally clean. Observer unobserve/reobserve and visibility-pausing experiments failed to eliminate it and were reverted. Do not suppress errors merely to make tests green.
6. **Native visual-frame feasibility is not established**: see the experiment below. Current preview is deliberately popup-only and uses cookies/CSP that are unsuitable for simply embedding the same URL cross-site.
7. **Linux migration validation**: restore private state, re-establish credentials, resolve changed absolute paths, run the ordinary companion command and test the actual hosted connection. Windows acceptance does not prove the new Linux setup.
8. **Dependency exception**: dated audit has one moderate `adm-zip@0.6.0` transitive Sanity CLI finding with no available fix at the last check. Builder archives use fflate; installed Sanity CLI use was archive creation, not the vulnerable extraction operation. Root is not described as zero-vulnerability. See [dependency maintenance](docs/dependency-maintenance.md).
9. Exported CMS is a snapshot; arbitrary React/Astro conversion, arbitrary property types/slots and commercial design-pack conversion are not implemented general capabilities. Do not broaden those claims.

## Verification at the pause

| Evidence | Result and scope |
| --- | --- |
| Latest full unit/integration suite | 204 passed, 1 optional Nginx skip, 41 files, 69.87 seconds. Includes unreleased delivery-warning changes. |
| Latest full Unity browser suite | 31 passed, 2 optional skips, 4.2 minutes. Before delivery-warning changes; includes companion, source editing and native backup. Optional skips are real external asset packs and local Nginx publication. |
| Affected browser follow-up | Client history/publication warning review at mobile width and repository handoff: 2 passed in 26.3 seconds after warning changes. |
| Type check | 310 files, 0 errors, 0 warnings, 171 hints; TypeScript succeeded. |
| Edge check | Deno check of `supabase/functions/builder-projects/index.ts` passed after warning changes. |
| Production build | Last deployed `e05783d` CI passed full site/Studio build, served-output checks and finalization. No production build/deploy of `1486788` is claimed. |
| Independent exports | Astro 7.3.2 and standalone React/Vite 8.3.0 fixtures installed/built outside the repo; desktop/mobile navigation, keyboard menu, links, console/private-source checks and zero-audit snapshots were verified during dependency work. |
| Hosted security | Real production unrelated-account API/database/Storage denial, immutable media, owner/editor/publish distinction and revocation passed. |
| Actual companion | Signed-in production editor consent, local source inspection/save/reopen/apply/build/selection/disconnect passed on isolated source; normal port 4321 startup was then separately verified and confirmed by Sean. This proves the implemented content-editing flow, not the missing WYSIWYG flow. |
| Current client output | Artifact `300d7710-69c9-46fe-82ed-5e940997d80d` passed 11 checks; those byte checks do not prove every authored link has a destination. `/contact/` is a separately observed 404. |

Tests used isolated directories and sample assets. Personal `.kaizen-builder` was not used as a test workspace. Ignored `test-results/` and OS-temp fixture folders will not survive a wipe unless separately copied; durable results and reproduction commands are recorded here. Do not treat old test log prose as proof of future changes.

## Source map for the next developer

| Work | Files |
| --- | --- |
| Editor, shell and appearance | `client/visual-builder/BuilderApp.tsx`, `shell.tsx`, `builder.css`, `PagesView.tsx`, `ProjectsView.tsx` |
| Native content UI and drafts | `SourcePageEditor.tsx`, `useSourceEditingDraft.ts`, `useSourceSelection.ts`, `shared/builderSourceEditing.ts` |
| Source inspection/patching | `scripts/builder-source-editing.ts`, `builder-repository.ts`, `builder-source-drafts.ts`, `builder-native-backup.ts` |
| Local builds/preview transport | `scripts/builder-runner.ts`, `builder-source-preview.ts`, `client/visual-builder/RepositoryBuild.tsx` |
| Hosted/local pairing | `HostedRepository.tsx`, `CompanionWindow.tsx`, `companionConnection.ts`, `scripts/builder-companion.ts`, `builder-local.ts`, `shared/builderCompanion.ts` |
| Project state/auth/media | `storage.ts`, `projectStorage.ts`, `cloudProjects.ts`, `scripts/builder-projects.ts`, `supabase/functions/builder-projects/` |
| Export and registered components | `exportProject.ts`, `Renderer.tsx`, `RegisteredBlocks.tsx`, `shared/builderRegistry.ts` |
| Client publishing | `ClientPublications.tsx`, `scripts/builder-client-publisher.ts`, `builder-client-worker.ts`, `client-publication.mjs`, `supabase/functions/_shared/clientPublication.ts` |
| New shared delivery checks | `shared/builderDelivery.ts`, `client/visual-builder/delivery.spec.ts` |
| Browser coverage | `tests/builder/`; base config `playwright.builder.config.ts`, Windows/local variant `playwright.builder.local.config.ts` |

Unqualified frontend filenames in this table are under `client/visual-builder/`.

The present source selector matches text/attribute values against fields; repeated content is ambiguous. `SourceInspection` contains fields/groups/file hashes, not a complete editable element/layout graph. `sourceSelectionScript` communicates with `window.opener`; `useSourceSelection` owns a popup. Runner snapshots currently send `frame-ancestors 'none'` and use an HttpOnly `SameSite=Lax` cookie on IPv4 loopback. Embedding that unchanged into the hosted HTTPS page is not a solved design.

An isolated experiment attempted an HTTPS editor iframe using a random `*.localhost` origin and cookie-free root-relative module assets. It failed to find the rendered frame heading within five seconds. The exact browser failure cause was **not diagnosed** before the pause. The scratch script is preserved at [experiments/source-frame-host-check.mjs](docs/handover/experiments/source-frame-host-check.mjs). It is not connected to product code, not a passing test, and not an endorsed architecture. No native WYSIWYG implementation was committed.

## Production map — no secret values

- VPS SSH alias on Linux: `kaizen-vps` (`root@144.91.72.17`), confirmed by Sean and verified on 13 September. The previous Windows alias was `kaizen-server`; use `ssh kaizen-vps` here.
- Main production checkout `/srv/kaizen/production`; retained store `/var/lib/kaizen/production`; private environment `/etc/kaizen/production.env`.
- Launch staging checkout `/srv/kaizen/staging`, store `/var/lib/kaizen/staging`, Apache HTTPS → Nginx 8093. The verified existing-site baseline and remaining hosted setup are recorded in [the launch log](docs/builder-launch-plan.md).
- Supabase management-token file restored with restricted permissions at `/home/sean/.config/kaizen/supabase-access-token.txt`; never print or commit its contents. L0 migrations through `202609120003` are applied. Matching functions/frontend are deployed with `e747452`: `builder-projects` v8 and the other three builder functions v7, all active with their existing authentication configuration.
- Server Node `/opt/kaizen-runtime/node/bin/node` (22.23.2 at verification).
- Client worker `/opt/kaizen-builder` resolves to `/opt/kaizen-builder-releases/1179886`. Retained prior copy `/opt/kaizen-builder-before-1179886`. Service/timer `kaizen-client-worker.service` / `.timer`; timer active. Jobs `/var/lib/kaizen-client-worker/jobs`.
- Destination registry `/etc/kaizen/client-destinations.json`; worker secrets `/etc/kaizen/client-worker.env`, mode 0600. Browser settings must never receive these.
- Client project `fb86c9f8-b48a-404e-a3cd-6f43f9bdc07b`, destination `d2dc035d-1f2c-4fcf-8404-4194786f512f`, label “Client demo — VPS”. Sean is sole owner/publisher.
- Client retained store `/var/lib/kaizen-client-releases/client-demo`.
- Apache/DirectAdmin owns public ports 80/443; main proxy 8091, client demo proxy 8092. Nginx binary `/usr/local/sbin/nginx`, config `/etc/nginx/nginx.conf`, service `kaizen-nginx.service`.
- DirectAdmin demo public root `/home/kaizenweb/domains/client-demo.kaizenweb.co.uk/public_html`; custom vhost branch `/usr/local/directadmin/data/users/kaizenweb/domains/kaizenweb.co.uk.cust_httpd`.
- Cloudflare is authoritative DNS. Demo A record is DNS-only to `144.91.72.17`; no second DirectAdmin DNS zone is necessary. Cloudflare's robot rewriting previously caused byte verification failure and automatic restoration when proxied.
- TLS/ACME `/var/lib/kaizen-client-tls/client-demo`; daily `kaizen-client-demo-tls.timer` active; `/usr/local/sbin/kaizen-client-demo-tls-reload` validates/reloads Apache. Retain HTTP challenge routing. Setup backups `/root/kaizen-client-demo-setup`.
- Supabase project `kbqraygsegcclzhsmpvz`: 15 builder migrations and four builder functions deployed. The `builder-projects` function performs its own JWT checks and uses `verify_jwt=false` at the gateway; don't change that as an incidental deployment “fix”.
- Access details originally live in `C:\Users\seanm\.config\kaizen\access-handoff.json`; the private file named `staging.env` was used for the **production** Supabase project. Its name does not establish environment isolation.

Read [client-demo operations](docs/client-demo-operations.md), [hosted publication](docs/hosted-client-publication.md), [publication setup](docs/client-publication.md), [client workflow](docs/builder-client-projects.md) and [chronological progress](docs/builder-project-progress.md) for deeper implementation history. Older “not deployed”, artifact IDs and blocked-access statements in those historical documents are superseded by this handover.

## Resume order

1. Restore from the private bundle and fresh Git clone using the Linux guide. Verify actual repository/remote/deployment state; do not recreate hosted projects/users or rerun destructive acceptance helpers blindly.
2. Read Sean's correction above and Claude's brief, then follow [the existing-site visual editing task map](docs/existing-site-visual-editing-plan.md) (added 12 September 2026 after the UX pass); keep source preservation, project isolation and recovery as requirements.
3. Run focused tests while implementing, then demonstrate the actual hosted editor with Sean's Linux companion and a representative native site. Test normal startup, not only a special test server.
4. Integrate the UX pass. Preserve working builder-owned editing, backups, releases, auth and asset flows while changing their presentation.
5. Finish the unreleased delivery warnings and deliberately resolve the demo's broken link. Check the current project first so Sean's later edits are preserved.
6. Repeat a requirement-by-requirement completion audit against the original brief. Declare completion only after the WYSIWYG workflow and UX have actually been delivered and verified.

Do not create timers or background work to continue during the wipe. No goal-completion or blocked status was set: this is a user-requested pause.
