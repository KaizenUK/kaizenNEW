# Kaizen builder — from private beta to public product

Ordered task map, written 12 September 2026 after the existing-site editing work landed. Codex implements it; Claude reviews each stage for usability, wording and safety; Sean accepts. Read [the Codex brief](handover/codex-launch-brief.md) first, then this map.

This map deliberately contains no time estimates. It gives scope, order and acceptance only.

## Where we are

Sean will use the builder on the Kaizen site alone first, as a private beta with one user. When he is happy, the same product opens to Kaizen's clients and then to the public. Everything below is ordered so that the private beta is usable first and nothing done for it has to be thrown away later.

The editor itself is in good shape: builder pages with about twenty-five block types, drafts, undo and redo, autosave and recovery, releases with staging and production destinations, redirects, private previews, backups, assets, contact forms delivered through the `builder-contact` function, project members with owner and editor roles, and on-page editing of existing Astro and React pages. The automated suite is broad (214 unit tests, 42 browser scenarios, Nginx release verification in CI).

What is missing is the wrapper around the editor: a way to edit existing pages without running a helper on your own computer, invitations, a client-friendly mode that hides Git, first-run guidance and templates, public-launch hardening, and finally self-serve sign-up, billing and domains.

## Ground rules (carry these into every task)

- Plain English in the interface. Use the vocabulary already in the product: helper, website folder, edit text and links, review my changes, apply changes to the folder, preview the website, publish. Do not rename common web design terms.
- Original source stays authoritative. Only safely located literal fields and complete section ranges are patched. Nothing is pushed or published without an explicit action by the user.
- Never commit private credentials, `KAIZEN-PRIVATE-MIGRATION*` files, deploy keys or `.env` values. Server-only secrets never get a `VITE_` prefix.
- Never test against Sean's personal `.kaizen-builder` or overwrite his checkout. Fixtures create their own temporary repositories, as `tests/builder/site-fixture.ts` does.
- Every task ships with tests at the level that proves it (unit, database, browser) and a short note in the matching guide under `docs/`. Append an implementation log to the end of this file per stage, as was done in `existing-site-visual-editing-plan.md`.
- New server endpoints only where the logic must live on the server: secrets, Git, builds, database operations. Everything else stays in the client.
- Keep the local helper path working. Developers keep using it; it is also the fallback if the hosted path is down.

## What already exists (build on it, do not rebuild it)

- **Repository actions** run inside the local helper: `scripts/builder-repository.ts` (inspect, plan, apply), `scripts/builder-source-editing.ts` (fields and groups), `scripts/builder-runner.ts` (reviewed builds and the loopback snapshot server), `scripts/builder-source-preview.ts` and `builder-source-frame.ts` (framed preview with the overlay), `scripts/builder-repository-git.ts` (status and commit of applied files only). The client calls them through `storage.repository({ action })` in `client/visual-builder/storage.ts` and pairs with the helper through `companionConnection.ts`, `HostedRepository.tsx` and the standalone consent window from `scripts/builder-companion-ui.ts`.
- **Hosted publishing** already runs on the server. `supabase/functions/builder-publish` freezes a release request and dispatches GitHub; the VPS worker `scripts/builder-release-worker.mjs` claims it, builds with `corepack pnpm run build`, stages and activates through `scripts/kaizen-releases.mjs` and verifies the live site. Client projects use `builder_client_jobs` and client destinations. See `docs/website-releases.md`.
- **Accounts** use Supabase password sign-in with reset, and `BuilderAuth.tsx` already handles invite and recovery links. `ProjectMembers.tsx` adds members by raw user ID and says so.
- **Access rules** live in `supabase/migrations/202609110001_builder_projects.sql` onwards and are covered by `client/visual-builder/project-access-database.spec.ts`.
- **Kaizen-only shortcuts** exist in about ten places (`activeProjectId === "kaizen"` in `BuilderApp.tsx`, `shell.tsx`, `SitePanel.tsx`, `storage.ts`; project `"kaizen"` fixed in `builder-publish`; allowed origins in `builder-companion.ts`, `_shared/editorAuth.ts` and `builder-contact`). They are fine for the beta and must become settings before clients arrive.
- **CI** (`.github/workflows/builder-checks.yml`) runs the Deno checks, `pnpm typecheck`, `pnpm test`, the client worker compiler check, independent client repository builds, Nginx release verification and `pnpm test:builder:browser`.

## Architecture decisions

### 1. The helper moves to the server for hosted projects

Today, editing an existing page needs the repo, Node and pnpm on the editor's own computer plus a running helper. Clients will never do that. The hosted path runs the same repository actions on the VPS, against a working copy the server owns.

- One **hosted helper service** on the VPS (`scripts/builder-hosted-helper.ts`, run as a systemd service next to the release worker) imports the existing runner, repository, source and Git modules unchanged. It keeps one working copy per project under a dedicated directory, cloned with a per-project deploy key that never leaves the server. Every request is authenticated with the caller's Supabase session and checked against `builder_project_members`. All file work goes through the existing path-safety helpers.
- **Interactive actions** (inspect, source inspect, plan, apply, Git status) go over HTTPS through the existing `/editor-api/` proxy so the editor feels immediate. **Builds** become jobs with status and log polling, exactly as the local helper's `repository-build` and `repository-build-status` already behave, and one build runs at a time per project.
- **Preview snapshots** are served over HTTPS from a loopback preview server behind a new `/editor-preview/<project>/<build>/` route, protected by the editor cookie on `.kaizenweb.co.uk`, with `frame-ancestors` set to the builder origin and the existing `connect-src 'none'` and `form-action 'none'` kept. The hosted editor frames that URL the same way it frames the helper's snapshot today.
- The client keeps one interface. `storage.repository` picks the transport from the project: hosted by default, local helper when a developer connects one. `SitePageEditor.tsx` and `SitePages.tsx` do not need to know which one they are talking to.
- **Save to website** is the new end of the journey for editors: apply the reviewed plan, commit the applied files, push to the project's configured branch. For Kaizen that branch is `stage`, which the existing deploy workflow publishes to staging; production stays behind the existing promote step and the Releases screen. Developers still see and can edit the commit message; editors see "Save to website".
- Builds on the server execute the project's own build script. For the Kaizen-only beta that is Sean's own code. Before clients or the public arrive, builds must run isolated (a container or a separate build host, decided in L5-T4).

### 2. Two modes of the same product

Owners see developer details (file paths, branches, commits, build logs). Editors see the client view (pages, words, images, save, publish). It is the same screens with the technical lines hidden, not two products. A per-user "Show developer details" switch lets an owner see what an editor sees.

### 3. Self-serve is a separate stage, not a redesign

Sign-up, billing and custom domains sit on top of projects and members as they exist. Nothing in the earlier stages should assume a single tenant except the explicit Kaizen shortcuts, which L0 turns into settings.

## Stages and tasks

Each task lists what it delivers, the files most likely involved and how it is proven. "Proven by" is the minimum; add more when it is cheap.

### L0 — Beta switches and a clean baseline

- **L0-T1 Turn Kaizen shortcuts into project settings.** Replace each `activeProjectId === "kaizen"` with a project capability (`hasInventory`, `legacyWorkspace`, `publishPath: "github" | "worker"`), stored on `builder_projects` and exposed by `builder-projects`. `builder-publish` reads the project from the request rather than assuming `"kaizen"`. Proven by unit tests on the project model, the existing publish and projects function checks, and the browser suite unchanged.
- **L0-T2 Origins from configuration.** Allowed origins in `builder-companion.ts`, `_shared/editorAuth.ts` and `builder-contact` come from one documented environment variable each, with the current values as defaults. Proven by unit tests for the parsers and a note in `docs/website-releases.md`.
- **L0-T3 Beta notice and problem reports.** A small "Private beta" pill in the sidebar footer and a "Report a problem" action in Settings that copies diagnostics (project, page, browser, last error, helper state, no secrets) to the clipboard and offers a download. Proven by a unit test that the diagnostics never include tokens or keys, and a browser check of the action.
- **L0-T4 Error visibility for the operator.** Client errors and hosted helper failures are recorded with project and user IDs in a `builder_client_errors` table through the existing projects function, retained for a bounded period. If Sean prefers a hosted error service, swap the sink; keep the shape. Proven by a database test for retention and access rules.

### L1 — Hosted helper: edit existing pages without a local helper

- **L1-T1 Repository transport in the client.** `storage.repository` gains a hosted transport selected per project, with the same action names and error shapes as the local helper. Connection state, expiry and "not connected" notices map onto session validity. Proven by unit tests with a fake server and the existing `site-*.spec.ts` scenarios run against the hosted transport with a fixture API, the way `companion.spec.ts` fakes the helper today.
- **L1-T2 Hosted helper service.** `scripts/builder-hosted-helper.ts` serving the interactive actions over HTTP on a loopback port, using the existing modules, one working copy per project, per-project locks, deploy-key cloning and fetch, and membership checks on every call. Proven by integration tests on a temporary bare repository and working copy, and by security tests for auth, membership, path safety and concurrent locks.
- **L1-T3 Build jobs and logs.** Builds queue per project, run one at a time, stream a bounded log and expose status. Reuse the job conventions from `builder_client_jobs`. Proven by integration tests including a failing build and a cancelled build.
- **L1-T4 Preview over HTTPS.** Loopback preview server for snapshots, the `/editor-preview/` proxy route documented for Apache/DirectAdmin alongside `/editor-api/`, editor cookie check, correct CSP. Proven by a Playwright scenario that frames a served snapshot from an HTTPS parent (extend the M0 test in `site-canvas.spec.ts`).
- **L1-T5 Save to website.** After apply: commit the applied files with the editor's name and email from their account, push to the configured branch, and show where it went (staging link, release status). Refuse and explain when the branch moved, when there are unrelated staged files or when the push is rejected. Proven by integration tests against a temporary remote and the existing commit isolation scenario extended with push.
- **L1-T6 Kaizen first, then per-project settings.** Wire the Kaizen project's working copy and `stage` branch so Sean's beta works end to end. Then add project settings for repository URL, branch and the deploy key's public half (shown once, copyable, never the private half). Proven by the hosted journey on a fixture project in the browser suite and a manual check by Sean on Kaizen.
- **L1-T7 Operations.** systemd unit, health endpoint, log rotation, restart behaviour, disk limits for working copies and snapshots, and a runbook section in `docs/website-releases.md`. Proven by the health check in CI where possible and a documented manual check on the VPS.

### L2 — People and access

- **L2-T1 Invite by email.** New `builder-invite` function using Supabase's admin invite, creating the membership in the same step; members screen lists people by email and name, with resend and remove. `BuilderAuth.tsx` already accepts the invite link, so finish the landing copy and the set-password step. Proven by a function test with a fake auth admin, a database test for membership rules, and a browser scenario for the invited person's first sign-in.
- **L2-T2 Roles that mean something.** Owner and editor stay; `can_publish` stays separate. Editors get the client view by default; owners get developer details with a switch to see the client view. Proven by unit tests for the view mode and browser checks of both modes on the site editor and Pages.
- **L2-T3 Account page.** Name, email, password change, sign out of other sessions, and a "delete my account" request that an owner confirms. Proven by unit tests and a browser check.
- **L2-T4 Sign-in states.** Expired link, used link, wrong password, reset sent, invited but not yet set up. Each says what happened and what to do next. Proven by the existing `auth.spec.tsx` extended per state.

### L3 — Client mode and wording

- **L3-T1 Hide Git in client mode.** Site editor footer shows page, saved state and "Save to website"; no branch, file or commit text. Review dialog keeps the plain before-and-after list and hides "Show the whole file". Developer mode keeps everything. Proven by browser checks in both modes.
- **L3-T2 One status language everywhere.** Draft, Saved, On staging, Live, with the same words in Pages, the editor header, Releases and the footer. Proven by a unit test over the status mapping and a screenshot pass.
- **L3-T3 Explain once, where it matters.** Every view keeps its one-line description; replace remaining paragraphs with a "Learn more" link to a short in-app help drawer that renders the relevant section of `docs/visual-builder.md`. Proven by a browser check that every view has a description and no view has more than one paragraph of explanatory text above the fold.

### L4 — First run and templates

- **L4-T1 First-run checklist.** On a new project, Pages shows a "Start here" card: name your site, choose a site design, add a page, preview it, publish. Each step links to the right place and ticks itself off. Dismissible; stored per user and project. Proven by unit tests for the step logic and a browser scenario.
- **L4-T2 Page template gallery.** At least six page templates built only from existing blocks (Home, About, Services, Contact, Pricing, Landing page) with thumbnails, preview and "Use template". Extend the current single starter in `starters.ts` and `PagesView.tsx`. Proven by unit tests that each template validates against the block registry and a browser check of the flow.
- **L4-T3 Starter site.** One "Small business" starter that creates the six pages, navigation and footer together. Proven by a browser scenario that creates it and publishes to a staging destination in the fixture.
- **L4-T4 Sample images and text.** Licence-safe placeholders through the existing asset and licence rules; no third-party images without a recorded licence. Proven by the existing licence checks.

### L5 — Public-launch hardening

- **L5-T1 Browsers.** Add Firefox and WebKit projects to `playwright.builder.config.ts` for the core journeys and fix what fails. Sean waived these for the beta; they are required for the public gate.
- **L5-T2 Accessibility.** Keyboard paths through Pages, the editor and the dialogs; names on every control; contrast on pills and buttons; an axe check in the browser suite with zero serious violations.
- **L5-T3 Performance.** Lazy-load the page editor and the site editor; measure and record the builder's first useful paint on a mid-range laptop; fix the largest chunks flagged by the build.
- **L5-T4 Security.** Rate limits on the public functions, an RLS review of every `builder_*` table with tests, a secrets audit, dependency audit in CI, and the isolation decision for server builds of client code (container or separate build host). Document the decision and its limits in `docs/website-releases.md`.
- **L5-T5 Backups and monitoring.** Supabase point-in-time recovery enabled, release store and working copies backed up, uptime and error alerts to Sean, a written restore drill.
- **L5-T6 Legal and privacy.** Builder Terms of Service and Privacy Policy pages (Sean or a lawyer writes the words; Codex wires the pages, the version and the acceptance record at first sign-in), plus data export and deletion requests routed to the owner. Cookie notice only if analytics are added.

### L6 — Self-serve

- **L6-T1 Sign-up.** Email sign-up with confirmation, a first project created on first sign-in, and the acceptance record from L5-T6. Proven by function and browser tests.
- **L6-T2 Billing.** Stripe Checkout and customer portal, a webhook function writing `builder_subscriptions`, and plan limits (projects, pages, storage, publishing) enforced in the projects function with clear in-app messages. Proven by function tests with recorded webhook payloads and database tests for limits.
- **L6-T3 Custom domains.** Per-project domain with verification by DNS record and automatic TLS. Apache/DirectAdmin owns ports 80 and 443 today, so decide between Cloudflare for SaaS in front of the release store, a dedicated edge host, or DirectAdmin's own domain automation. Record the decision, then implement domain add, verify, remove and the release worker's mapping to it. Proven by integration tests against a fake DNS and a documented manual check on one real domain.
- **L6-T4 Quotas and abuse.** Upload and storage limits per plan, publish rate limits, a report-and-takedown path, and suspension that keeps data but stops publishing. Proven by database and function tests.

## Gates

**Private beta gate (Sean, Kaizen only).** L0 complete; L1 through T6 for the Kaizen project; L2-T1 and L2-T2; L3-T1 and L3-T2; L4-T1. Sean edits a real Kaizen page from the hosted builder with no helper running, saves to website, sees it on staging, and publishes through Releases.

**Client gate (Kaizen's clients).** Everything in L1 including T7; all of L2, L3 and L4; L5-T2, L5-T4 isolation decision implemented, L5-T5 and L5-T6. A client edits text and images on their site, saves and sees staging, and an owner publishes.

**Public gate.** All of L5 and L6. A stranger signs up, pays, builds a site from a starter, connects a domain and publishes, without anyone at Kaizen touching a server.

## Definition of done for every task

- The task's tests pass in CI, and the full existing suite still passes.
- The screens involved use the plain-English vocabulary and have been looked at in the browser at desktop and phone widths.
- The relevant guide under `docs/` describes the behaviour in one place, and this file's log records what shipped, what was proven and what was left out.
- No secrets, private files or personal workspaces were touched or committed.
- Claude has reviewed the stage for wording, layout and safety, and Sean has accepted it.


## Implementation log — L0

### L0-T1 — Project settings and publication boundaries (12 September 2026)

Implemented on `codex/builder-launch` in a separate worktree. Sean's original checkout and its pending visual edits remain untouched. The launch brief and task map are carried onto this branch, and AGENTS/HANDOVER link to both.

- Added validated `hasInventory`, `legacyWorkspace` and `publishPath` settings to the shared project model, hosted database and projects response. Local catalogue migration preserves all existing workspace bytes. New, copied, imported and helper-linked projects keep worker routing and no destination.
- Replaced project-ID switches in the interface, storage transport, preview form configuration and helper actions. The stable original ID remains only where needed for registration and physical storage addresses. Project configuration clears on account changes; missing settings stop hosted routing.
- Publication names its project explicitly. The function checks membership, publish permission, archive state and routing before reading the release workspace or dispatching. Database access follows the configured legacy project; only one preserved workspace can use GitHub publication. Owners cannot escalate these operator settings through the project API.
- Updated [the client-project guide](builder-client-projects.md#project-capabilities) with behaviour, limits and migration/deployment order. No additional GitHub publication destination or hosted repository service is implied by these settings.

**Local proof:** TypeScript/Astro checks: zero errors and zero warnings (172 existing hints). Deno checks pass for projects and publish functions. The final full unit/integration run passed all 237 tests across 45 files with Nginx enabled. New cases cover malformed settings, safe defaults and migration, original-ID-independent database access, denied capability updates, missing/unauthorised/archived publication requests, worker-route rejection and disconnected preview forms. The final full browser suite passed 42 scenarios with only the optional licensed-archive scenario skipped, including real Nginx publication. Tests used temporary repositories and fixture workspaces.

The first full browser run exposed an obsolete hosted-media mock and two transient editor failures. The mock now supplies project configuration rather than rewriting a production constant. Both editor cases passed a focused rerun without a code fix, and the final full run held the source steady and passed. Existing ResizeObserver notifications remain visible; no console-clean claim is made. Private-preview tests deliberately request blocked private files and verify denial.

Desktop and phone project screens were inspected: [desktop](handover/builder-launch/l0-projects-desktop.png), [phone](handover/builder-launch/l0-projects-phone.png). The existing current-project pill can make long project names wrap awkwardly on desktop; retain this for Claude's stage polish.

**Pending:** CI on the launch branch, production migration/function/frontend rollout, Claude's L0 review and Sean's gate acceptance. Nothing has been pushed or deployed by this task. Continue in order with L0-T2; this is implementation evidence, not private beta acceptance.


### L0-T2 — Configured browser origins (12 September 2026)

Added one explicit server-side allowlist per service: `BUILDER_COMPANION_ORIGINS`, `ALLOWED_STUDIO_ORIGINS` and `BUILDER_CONTACT_ORIGINS`. A shared parser preserves each documented default only when its setting is absent, replaces defaults when configured, normalises/deduplicates origins and rejects unsafe entries without reflecting their contents in errors. Explicitly empty lists permit no browser origins. The helper test override remains restricted to exact HTTP loopback origins; normal pairing still requires folder approval.

The editor API no longer derives extra allowed origins from site/Studio URL variables. [The release guide](website-releases.md#builder-browser-origins) gives defaults, syntax, environment locations and the rollout requirement to list all authorised origins explicitly. The example environment lists the new settings. CI now watches the parser and affected server modules and checks the contact function alongside projects and publish.

**Local proof:** all 255 unit/integration tests pass across 46 files with Nginx enabled; TypeScript/Astro reports zero errors/warnings and the same 172 hints; Deno checks pass for projects, publish and contact. Parser tests cover absent/empty/replaced configuration, canonicalisation, unsafe inputs, credential-safe errors, lookalike hosts and test-origin restrictions. A real temporary-repository helper test exercises a configured non-default HTTPS origin and retained folder checks. All three relevant browser journeys pass: companion reload, cross-origin pairing/editing/revocation and contact submission/idempotency. No screens changed; L0's desktop/phone evidence remains above, and the full browser suite will run again at the stage boundary.

**Pending:** hosted configuration/function rollout, branch CI and the stage/gate reviews. No credentials, live allowlists or personal workspaces were changed. Continue with L0-T3.


### L0-T3 — Private beta and problem reports (12 September 2026)

Added a **Private beta** pill in the sidebar footer and **Settings → Report a problem** for every project, including the original workspace and failed workspace loads. The action copies a report, offers the identical JSON as a download, and lets the user inspect it. Clipboard denial keeps the download available.

The report uses an explicit list of fields: project/page identifiers, a one-way reference for source routes, known browser family/version/platform, helper mode/state and a fixed last-error category/summary/time. Raw exception text, stacks, URL credentials, source paths, helper secrets, titles and arbitrary properties never enter the report. A local helper's health is explicitly unprobed. Error classification observes browser errors without suppressing them and wraps storage failures while preserving their original errors and results. The failing page survives navigation to Settings, and diagnostics clear when the account changes. No report is automatically sent in this task; operator recording is L0-T4.

**Local proof:** all 266 unit/integration tests pass across 47 files with Nginx enabled. TypeScript/Astro checks report zero errors/warnings and 172 existing hints. Privacy tests exercise credential-bearing inputs, object-coercion attempts, fixed summaries, route hashing, browser listener cleanup, error-page retention and unchanged storage outcomes. Both report browser scenarios pass, covering copy/download equality and a failed workspace with denied clipboard access. Existing client-settings and hosted-helper scenarios also passed during the task. Desktop/phone layouts were inspected, including horizontal-overflow checks: [desktop](handover/builder-launch/l0-settings-desktop.png), [phone](handover/builder-launch/l0-settings-phone.png). The current guide is [Private beta and problem reports](visual-builder.md#private-beta-and-problem-reports).

**Pending:** L0-T4, the full browser run at the L0 boundary, branch CI, deployment, Claude's stage review and Sean's private beta acceptance. No private migration files, credentials, personal workspaces or live systems were changed. Continue in order with L0-T4.

### L0-T4 — Operator error visibility (12 September 2026)

Added automatic, best-effort recording of signed-in hosted builder errors through the existing `builder-projects` function into `builder_client_errors`. The function uses the verified account ID and the requested project; the database rechecks current membership and archived state under the same project lock used by membership changes. Publish permission is not required to report a failure. Builder users, including project owners, cannot read or write the operator table or impersonate another actor through the recording RPC. Database operators have the inspection query in the [error visibility runbook](website-releases.md#builder-error-visibility).

The sink rebuilds a fixed set of safe fields: identifiers, server receipt time, error category/source, known screen, optional page ID/route hash, browser family/major version/platform and helper mode/state. Raw messages, stacks, paths, credentials, build logs and arbitrary JSON never enter the table. The browser reporter observes caught workspace/catalogue/helper errors and browser events, pins each outgoing request to its captured account, drops pending reports on account changes, bounds/deduplicates attempts, and never reports its own failures. Failed build results received successfully over HTTP are recorded too. Local and signed-out builders do not send reports; Settings explains automatic reporting in the hosted builder and keeps manual copy/download available during a reporting outage.

Recording is capped at 20 events per account/project per hour and 2,000 per project per day. Migration `202609120003_builder_error_retention.sql` requires an hourly `pg_cron` job which physically deletes records older than 14 days, including idle projects. With the scheduler running, records are deleted at the next hourly run. The runbook includes checks for the active job, recent executions and overdue rows, plus recovery steps. Live table retention is separate from database backup retention.

**Sink decision:** the database table is the task map's default and is implemented. A hosted error service would add provider search/alerting and another service to operate; use it only if Sean prefers that option later, retaining the same field shape, access controls and retention contract. No external error provider or messaging integration was added. The actual hosted helper service is still L1; its browser-visible failures can use this recording path, but this task does not claim a deployed hosted helper was exercised.

**Files:** `shared/builderDiagnostics.ts`; client `errorReporting.ts`, `BuilderApp.tsx`, `projectStorage.ts`, `useSiteBuild.ts`, `ProblemReport.tsx`; `supabase/functions/_shared/clientDiagnostics.ts`, `builder-projects/index.ts`; the two new error-table/retention migrations; `errorReporting.spec.ts`, `error-reporting-database.spec.ts`, `tests/builder/diagnostics.spec.ts` and `site-pages.spec.ts`; the builder guide, release runbook and CI path filter.

**Local proof:** all 282 unit/integration tests pass across 49 files with Nginx enabled. Database tests execute the actual migrations and cover service-only recording/reading, RLS defence, cross-project and revoked/archived access, bounded fields, account/project quotas, server-owned identity/time, physical expiry and account deletion. PGlite substitutes only the unavailable scheduler; it executes the migration's job definition and real cleanup function, not a live cron worker. Client/function tests cover credential-bearing inputs, untrusted extra fields, account-change races, stale initial sessions, deduplication, failed/slow sends, cleanup and safe server failure responses. TypeScript/Astro checks report zero errors/warnings and 172 existing hints; Deno checks pass for projects, publish and contact functions. Six relevant browser scenarios pass, including real app/storage reporting against a fixture sink, a reporting outage, sign-out, manual reports and failed builds. Desktop/phone screenshots were inspected with horizontal-overflow checks: [desktop](handover/builder-launch/l0-error-reporting-desktop.png), [phone](handover/builder-launch/l0-error-reporting-phone.png).

### L0 stage verification and handoff

All four L0 tasks are implemented locally on `codex/builder-launch` in the isolated `kaizen-launch` worktree. The final full browser run passes **45 scenarios**, including real Nginx publication/rollback and the local-helper source-editing journeys. The optional licensed UI8 archive scenario remains skipped because its private archives are not supplied. No application source was edited during that run. Existing ResizeObserver notifications still appear in the development log; deliberate error/denied-file fixtures also log expected failures. This is a passing automated suite, not a claim of a silent console or manual acceptance.

**Pending:** branch CI, migration/function/frontend deployment, verification of the actual retention job, Claude's running-product review and Sean's private beta gate. The launch branch has not been pushed or deployed. Sean's original checkout and its pre-existing edits remain untouched; no private migration files, credentials or personal workspaces were used. Continue in order with **L1-T1**, the per-project hosted repository transport. Stop at the private beta gate for Sean's hands-on acceptance as instructed in the brief.
