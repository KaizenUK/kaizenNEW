# Kaizen visual builder

The builder lives at `/builder/`. It creates builder pages and edits safely matched content in existing Astro/React pages through the [existing-site canvas](#existing-site-canvas). Original source and CMS ownership are preserved. See [client projects and handoff](builder-client-projects.md) for repository integration, and [the current handover](../HANDOVER.md#linux-continuation--12-september-2026) for deployment and acceptance status.

This guide describes current behaviour. Earlier incremental results are retained in [verification history](builder-verification-history.md); historical statements there are not the current feature status. Deployment setup and recovery are documented in [website releases](website-releases.md).

## Private beta and problem reports

The sidebar footer identifies this release as **Private beta**. Open **Settings → Report a problem** to copy a technical report, then share it with Kaizen along with what you were trying to do. **Download report** saves the same JSON when clipboard access is unavailable, and **View report** shows exactly what will be shared. Settings remains available if the project cannot load. The original workspace's website connections continue to be managed by the owner.

Reports contain the project ID, screen, builder page ID or a one-way SHA-256 reference for a source route, browser family/major version/platform, helper mode/state, and the latest error category and time. Raw errors and stacks, page content and titles, source paths, full browser strings, helper connection details and sign-in credentials are excluded. Error summaries come from fixed categories; a report does not copy arbitrary exception text. Caught storage/helper failures and browser errors update the in-memory record without suppressing errors or changing the original response. The failing page reference is retained when you leave the editor to open Settings. Local helper health is marked `not-checked`; the report does not infer that a server is still running. This record clears when the account changes and is not persisted to browser storage. Copying or downloading a report does not send a message to anyone.

## Local workspace

Run `pnpm dev` and open the local builder at the printed IPv4 address, normally `http://127.0.0.1:4321/builder/?local=1`. Keep the terminal running. The `local=1` query selects the local workspace even when hosted settings are configured.

1. Create a blank page or use the starter template.
2. Open Assets, name a pack and import files, a folder or a ZIP. The sample pack contains images, SVGs, an Inter font, licences, source references and a labelled design placeholder.
3. Search the library, then drag a supported asset into the canvas or select Use. Containers receive nested content; selecting a leaf inserts after it. Fonts can be applied to a page or shared site design.
4. Select content to edit text, layout and appearance. Desktop values form the base; tablet and mobile values can override them. Inherited values are labelled and individual overrides can be reset.
5. Save or wait for autosave, return to Pages and reopen. Preview uses the published renderer without publishing anything. Publish explicitly creates a separate local publication.
6. Restore a saved revision as a draft, then publish separately if that version should become live.

Local files live in the gitignored `.kaizen-builder/` directory. Back it up when the work matters. The local API restricts writes to loopback connections and same-origin builder requests. Vite's filesystem deny list protects the private workspace; approved media is served through its media handler. Test runs use a separate `test-results/` workspace and never replace personal pages or assets.

For a static local publication check, set `BUILDER_LOCAL_BUILD=1` for a build. Never set it for a production deployment. Normal builds exclude local pages and local files. Local publishing does not change kaizenweb.co.uk.

## Workspace layout

The builder chrome follows the Unity Dashboard Kit (Poppins headings, Inter body, purple `#6C5DD3` primary, 24px cards). The tokens live at the top of `client/visual-builder/builder.css`; the shell components are in `client/visual-builder/shell.tsx`.

- A permanent left sidebar reaches Pages, Site design, Assets, Releases (shared workspace only, with a badge counting pages that have unpublished changes), URL redirects, Private previews, Project backups and Existing site pages. The footer toggles dark mode (remembered per browser) and links back to the live site.
- **Pages** lists every page with a live thumbnail, a status pill (Draft, Published, or Changes to publish, judged from edit times after the last publication), filter tabs, search and sorting. The purple banner creates a blank page or the starter template.
- **Assets** opens the same library that the editor shows in its Assets panel, so packs can be managed without opening a page.
- The editor keeps undo/redo, device preview, the page URL, save status, Save, Preview, Export ZIP and Publish in one top bar. The left panel offers Blocks (searchable, ready-made sections first), Assets and Layers; the right panel offers Design, Page, Styles and Revisions. Selected blocks can be copied, pasted, duplicated or deleted from the inspector header.
- **Publish** opens a check first: a search-result preview and a short list covering title, URL, shared header/footer, search description and indexing. Publishing proceeds from that dialog; nothing goes live from the top bar directly.

## Editing and whole-site design

The editor supports nested placement/reordering, a layer tree, parent selection, inline text and rich-text links, undo/redo, duplication and copy/paste. Layout controls include spacing on individual sides, columns and proportions, grid gaps/spans, alignment, sizing, backgrounds/overlays, borders/shadows, typography, image fit/focal points, hover/focus states and responsive visibility/order. Preview widths are 1280, 768 and 390 pixels; CSS breakpoints are 1023 and 639 pixels.

**Site design** manages shared colours, typography and spacing tokens, linked components, headers and footers. Assign shared content to pages explicitly. Instance overrides remain intact when the shared definition changes, and an instance can be detached. Shared changes remain drafts; publication review lists affected page drafts, including any other pending edits on those pages.

Saved sections and page templates are reusable copies. Linked components in Site design remain connected. The desktop workspace is the supported editing interface; mobile preview is for checking the resulting site.

**Blocks → Browse section designs** adds eight editable variations: studio navigation, editorial hero, services overview, project gallery, customer stories, simple pricing, contact banner and studio footer. Preview each in wide or mobile view before insertion. They use ordinary builder blocks, so nesting, undo/redo, responsive controls, backups and React export keep working. Replace sample copy, quotes, prices, images and links before publication.

**Existing site pages** opens a searchable list of the original layouts, CMS routes and site redirects. It is compiled from the project's page files, fixed redirects and available published Sanity routes. It contains public path metadata, not source code. With a local checkout or connected helper, supported source routes open in the existing-site canvas. Use the CMS for article and managed content; arbitrary layout changes to unregistered components still require a developer. Individual blog articles are managed in the CMS rather than enumerated in this list. The list updates with the builder's next build and clearly reports an unavailable CMS inventory. Its optional CMS lookup is bounded to five seconds.

Existing routes are reserved against builder pages. To recreate an existing design, build it at a new URL and review any later route-ownership change separately. Opening an existing source page exposes its safely matched content; it does not convert the page into builder blocks.

## Asset support and boundaries

| Asset | Current behaviour |
| --- | --- |
| PNG, JPEG, WebP, GIF, AVIF | Validated with the browser image decoder; usable as images/backgrounds |
| SVG | Sanitised image/icon resources; scripts, embedded HTML, external references, event handlers and animation removed |
| WOFF, WOFF2, TTF, OTF | Validated with the browser font loader; usable typography |
| TXT, MD, PDF licences/readmes | Preserved with their packs and downloadable |
| React, JavaScript, TypeScript, CSS, HTML source | Downloadable references; reviewed integration required |
| Figma, Sketch, XD, PSD, AI, EPS | Design references; conversion required |
| Other files | Downloadable references; never executed automatically |

Names, original folder paths, packs, licences, tags and favourites remain searchable. Library browsing uses 48-item pages, deferred search, filters and sorting. Bulk metadata changes support up to 2,000 selected assets. Usage views identify references in pages and reusable content. Replacing an asset changes selected draft references while keeping old published/history files available.

Import limits are 50 MB per file, 250 MB compressed ZIP, 500 MB expanded batch and 2,000 files. Encrypted or nested archives are not recursively unpacked. Duplicate detection uses content hashes with pack/path identity. Corrected bytes can be retained as separate assets. These are enforced limits, not performance claims at the maximum sizes.

Optimisation retains originals and can generate smaller WebP variants for responsive image/background use. It avoids upscaling. SVG stays vector; GIF, animated PNG/WebP, AVIF and images above 40 megapixels retain their originals. Optimisation depends on browser decoding and WebP encoding.

The bundled `.fig` is an explicit placeholder, not a valid editable design. The sample Inter font includes its SIL Open Font License; source/design references remain outside executable code.

### Representative UI8 packs tested locally

- **Hero Gradients v2 / Cubic Glass Gradient:** the complete 35.5 MB ZIP imported 20 JPGs, preserving names and folder paths while ignoring Mac archive metadata. Reimport skipped all 20 duplicates. The extracted folder also imported 20 images with no metadata-file errors. Search, insertion, save/reopen, image optimisation and local publication at 390 px were checked.
- **20 Logistics Animated Icons:** the complete 40.7 MB ZIP imported 361 files: 40 GIF images, 40 SVG icons, 200 source references and 81 download-only video files. Search and pagination were checked. Uploaded source is served as an attachment, never executed. Lottie JSON, HTML animation bundles, MP4 and MOV do not become editable blocks automatically.
- The real SVGs exposed lost colours/outlines caused by removing Illustrator styles. The importer now copies safe static presentation declarations from simple class, ID and element rules and inline styles into SVG attributes before sanitisation. It retains safe local paint references, and removes external references and executable styles. Complex CSS selectors, conditional styles and SVG animation are not supported. Previously imported icons need reimporting and draft replacement to receive this fix; existing published assets are preserved.
- Other available packs exceed the current limits: the larger gradient archives need extracting and importing in smaller batches; individual files above 50 MB need smaller exports. The approximately 62.6 MB LOGIX Figma file and 900.8 MB ultimate gradient Figma file were identified as oversized, not claimed as successfully imported or converted.

Licensed pack files stay outside the repository. To repeat the opt-in Chromium compatibility check, set `BUILDER_UI8_DOWNLOADS` to the folder holding these two ZIPs and the extracted gradient folder, and run `pnpm exec playwright test --config playwright.builder.config.ts tests/builder/real-packs.spec.ts`. The test uses the isolated test workspace and restores its previous metadata afterwards. It makes no hosted uploads.

## Recoverable and resumable imports

The importer stores a pending batch and file blobs in IndexedDB, scoped to the workspace/account. Reloading can resume the pending job. A browser lock prevents two tabs owning the same import; only one pending job per workspace is supported. Completed blobs are removed, and a successful import clears its recovery records.

Files of 6 MiB or more use TUS uploads in 6 MiB chunks. Resume checks the server's committed offset, refreshes credentials and replaces missing/expired upload sessions. Smaller files retry as whole files; registration also recovers a lost acknowledgement without duplicating the stored asset. Server files are immutable.

Browser storage limits and eviction still apply. Clearing site data removes recovery copies; oversized packs may need splitting or reselection. Hosted uploads use Supabase's resumable storage endpoint and editor storage policies. Hosted connection-loss, expiry and permission checks remain unverified.

## Developer conversion requests and reviewed React blocks

Code and design assets can carry a saved conversion brief: source/reference assets and hashes, requirements, status history and downloadable developer handoff. Filter the library by conversion status. A usable block requires a matching reviewed React implementation in the component registry; changing a status never compiles uploaded source.

The bundled ExampleCard demonstrates this contract. See [component integration](builder-component-integration.md) for review and registration. Editable backups and exports retain conversion references; arbitrary developer-modified React source is not automatically reimportable.

## Contact forms

The Contact form block provides editable copy, privacy wording/link, optional fields and responsive styling. First name, email, message and privacy acknowledgement are required; marketing is opt-in. Preview never submits an enquiry. Local publication writes to the local workspace's `contact-submissions.json` without sending email. Failed requests retain entered details; unchanged retries use the same request ID.

For hosted delivery, migration `202609100003_builder_contact.sql` expects the existing `contact_form_submissions` table. Deploy `builder-contact` with the checked-in public visitor configuration and configure `BUILDER_CONTACT_ORIGINS`. Keep the existing `contact-alert` delivery workflow connected. The default public endpoint derives from `VITE_SUPABASE_URL`; `VITE_BUILDER_FORM_ENDPOINT` can select another compatible receiver.

The receiver validates input, origin, consent, a honeypot and body size, then uses a private retry/rate ledger and database transaction. Browser success means storage accepted the enquiry; downstream email/CRM delivery is separate. Hosted storage and real delivery have not been verified. Exports deliberately require their own configured receiver; see the exported `CONTACT-FORMS.md`.

## Sanity content in the visual builder

Post listings support categories, ordering, 1–24 posts, Cards/Minimal/Editorial variants and image, summary, author and date controls. Text, Image and Button blocks can connect to supported published post fields; disconnecting restores the prior manual content. Bindings work in shared definitions and survive save/reopen and undo.

The adapter targets existing post/category/author schemas and a fixed published-only projection. Configure the existing Sanity project/dataset and private token on the server; deploy `builder-content` for the hosted editor. That function checks the authenticated user and editor membership. No private token, arbitrary query or CMS draft is sent to the browser.

Published layouts resolve current CMS data during the site build and emit static markup. A failed connection or missing linked record fails that publication; exact rollback uses the retained artifact rather than refetching CMS data. Listings add no visitor-side CMS fetch. The catalogue is limited to 1,000 posts/categories; larger collections require pagination work. Arbitrary document types and article-body layout editing are outside this integration.

React exports capture current resolved content and bundle referenced images. Linked article-detail routes still belong to the original site and are not generated automatically in the export.

## Editable project backups

**Backups** downloads a versioned ZIP with editable pages, assets, saved content, shared definitions/styles, redirect data and bounded history. Restore previews its changes, validates paths/checksums, remaps uploaded asset references and commits drafts/metadata atomically with optimistic version checks.

Restore retains current live publications and unrelated pages. Imported published snapshots become revision data, not live pages. A pre-restore draft remains in history. Redirect restore changes the draft only. Existing external media, CMS data and receiving services remain external dependencies. Credentials, enquiries, preview records and deployed artifacts are not part of the backup.

Limits: 500 pages, 20,000 assets, 2,000 saved sections/templates, 100 shared components, 50 MB per file, 500 MB archive/expanded files and 50 million characters of workspace JSON. Page history retains 50 revisions; shared design and redirect history retain 30 each. Completed file uploads can remain after a rejected final transaction and are reused on retry. Unsupported versions, missing or altered files and unsafe paths are rejected.

## Export for Claude, Codex or a developer

**Export ZIP** includes all page drafts, resolved shared content/CMS data, React/TypeScript components, responsive CSS, bundled media/fonts, SEO/page data, a static build and developer instructions. Source/design/licence references remain outside executable source. There is no Puck, Supabase/Sanity connection or credential requirement in the generated project.

Use Node 22 or later, then `npm install`, `npm run typecheck`, `npm run dev` and `npm run build`. Each page receives static HTML at its URL; the first page also appears at `/`. Interactive blocks use a small runtime while non-interactive pages do not load it. Review external routes and unavailable remote media reported in `HANDOFF.md`. Missing registered/local media aborts the export.

Configure the form receiver in `src/formConfig.ts` before using exported forms. `redirects.json`, `hosting/nginx-redirects.conf` and `REDIRECTS.md` describe host-level redirects; Vite preview does not activate HTTP redirect rules. An export is a developer handoff, separate from an editable project backup.

## Saved private preview links

From Preview, save a link for 1 hour, 24 hours or 7 days. Shared definitions, image metadata and loaded CMS content are resolved into an immutable preview snapshot, separate from later drafts and publications.

Hosted links under `/builder/?preview=<id>` require an existing authorised editor account on every read. The ID is not an anonymous access token. Other workspace editors may view/revoke it; external reviewers without editor access cannot. The viewer rechecks access every ten seconds and on focus, and clears expired/revoked previews. Previously viewed copies cannot be recalled. Public image/font URLs retain their existing storage policies.

There are at most 50 active previews per workspace with a two-million-character document limit. Revocation clears the document and reserves its ID; preview creation cleans expired documents. Local previews remain available only while the local server/workspace is accessible. Forms are inert in previews. Builder/preview noindex and referrer protection remain enabled, with no sitemap entries.

Migration `202609100009_builder_previews.sql` enables hosted previews. Supabase's approved sign-in return URLs and email templates must preserve the preview query. Actual hosted sign-in return and access verification remain outstanding.

## Editing redirects

**Redirects** provides a saved draft, review of added/changed/removed rules, explicit publication and history restoration. Directory URLs cover both slash forms and builder redirect responses preserve query parameters. Temporary 302 is the default; browsers can retain a permanent 301 after it changes.

Rules use internal paths with letters, digits, slashes, dots, hyphens and underscores, up to 200 characters and 200 rules. External URLs, query-specific matches and regular expressions are unsupported. Current pages, existing site sections and editor/service paths cannot be claimed as sources. Publish a destination first. Update/remove affected redirects before changing their destination page's live URL; local page and shared-site publication now validate the entire candidate before writing it.

Cloud publication freezes the rules in the release. The production build checks source ownership, cycles across builder/Sanity/site redirects and destinations against emitted files. A failed check retains the prior live release. Nginx verification checks actual status, Location and query preservation; rollback restores retained rules while preserving newer drafts. See [website releases](website-releases.md#builder-url-redirects).

## Shared production workspace

Complete [the deployment setup](website-releases.md) before using the changed production workflow:

1. Apply builder migrations in filename order from `202609100001_visual_builder.sql` through `202609100010_builder_routes.sql`. Follow their prerequisites; migration 003 uses the existing contact table and migration 010 requires no pending release. Do not reapply older backup definitions over migration 010's wrappers.
2. Use existing Supabase Auth editor accounts and add their UUIDs to `builder_editors`. The browser cannot self-register or grant editor membership. Authorise the intended builder sign-in return URLs and configure email delivery.
3. Set `VITE_BUILDER_CLOUD=1`, `VITE_SUPABASE_URL` and the public anon key in the site build. Keep service keys, GitHub tokens and Sanity private tokens out of `VITE_` values.
4. Deploy `builder-publish`, `builder-contact` and `builder-content` with their documented origins/credentials. Deploy the accompanying `contact-alert` change where that existing workflow is used.
5. Initialise separate retained release stores and Nginx includes for staging/production. Configure the VPS release worker and its private service credential, then enable `BUILDER_RELEASE_COORDINATOR=1` in the publish function. Use separate Supabase builder workspaces for independently deployed sites.
6. Verify editor sign-in, anonymous/non-editor denial, cloud save/reopen/upload, private previews, a hosted test form submission, live publication, failure preservation and rollback.

GitHub dispatch acceptance does not mean a page is live. **Releases** shows queued/building/activating/verifying/live or actionable failure. The worker promotes public database snapshots only after artifact and live-response checks. Ambiguous commit acknowledgement retains the verified artifact and pending ownership for operator reconciliation; it never blindly rolls back a possibly committed database. Recovery instructions are in the deployment guide.

## Verification and remaining work

Run `pnpm test`, `pnpm typecheck`, `pnpm test:builder:browser` and `pnpm build`. The browser suite uses an isolated workspace and covers imports, nested editing, history, responsiveness, shared content, CMS/forms, backups, previews, redirects, source editing and commit isolation.

The final existing-site implementation at `d7d9359` passed 214 unit tests across 44 files, Astro/TypeScript checks with zero errors and zero warnings (172 existing hints), and 42 browser scenarios. One optional licensed-archive scenario was skipped because its external archives are unavailable. The Nginx recovery test ran and passed. Desktop and phone canvas screenshots were regenerated and visually checked. The complete site/Studio build also succeeded through the real hosted helper connection.

The public frontend is release `gh-34712289074-1` from `9aca128`; `d7d9359` adds local helper server-stop detection. The checkout and deployment are recorded in [the acceptance log](existing-site-visual-editing-plan.md#helper-window-stability-follow-up--12-september-2026). Older incremental results belong to [verification history](builder-verification-history.md), not the current acceptance status.

**Hosted preview confirmed:** Sean connected his real checkout from the live builder, opened the page, ran Build and saw the project appear. Firefox/Safari checks were waived, and any future Retry failure is deferred to a bug fix at his request. The earlier Codex in-app failure does not describe his successful preview. This user confirmation covers the build and displayed canvas; individual editing actions and Git boundaries have the automated evidence above, plus the recorded actual local text apply/rebuild/restore. See [the acceptance update](existing-site-visual-editing-plan.md#user-confirmed-hosted-preview--12-september-2026). Existing ResizeObserver notifications and large editor/Studio chunk warnings remain recorded limitations.

## Existing-site canvas

1. Open the project in the hosted builder, choose **Connect helper**, and approve its website folder with **Allow this folder** in the local window.
2. Return to **Pages → Pages from the website's code → Edit**. Check the command and choose **Build** when first asked. Later builds reuse approval only within the same connection and for unchanged scripts.
3. Double-click matched words to type, select a link to edit its text/address, use **Replace image** for project Assets, and move supported sections with their handles or drag. Outline and Selected show the same draft. Grey content explains why it is managed elsewhere.
4. Choose **Review my changes**, then **Apply changes to the folder**. Only reviewed source changes and selected image files are written; the preview rebuilds afterward.
5. Optionally choose **Commit these changes** and enter a message. Only files in the last applied proposal are committed. Existing staged files, changed applied files, missing Git identity or an in-progress Git operation prevent the commit. Nothing is pushed or published automatically; use GitHub Desktop and the site's existing deployment process.

A disconnected or restarted helper shows **Reconnect** while retaining edits. **Keep connected** requests approval again before the two-hour session expires. If framing fails, use **Open the preview in a window** or **Open in the local builder**. Chromium may require Local Network Access permission in addition to folder approval. Firefox/Safari checks were waived by Sean; they are not claimed as verified.

Existing native pages now have a separate page editor inside the same builder chrome. It embeds a cookie-free, token-prefixed snapshot served by the helper. The bridge exchanges inspected field IDs and draft values with the parent using both origin and nonce checks; it has no helper capability. Snapshots retain `connect-src 'none'` and `form-action 'none'`, and permit framing only by the connected editor origin and themselves. Ordinary window previews keep their original cookie flow.

The canvas and Outline share one draft, undo/redo history and source-review process. Desktop/tablet/mobile widths are 1280/768/390. Large outlines render a bounded window of rows. Project Assets can replace source images, and verified groups can move on the page. The original Astro/React files, imports, scripts and hydration remain the source of truth; apply patches their original byte ranges.

Registered builder blocks emit their registration and block IDs. Their existing literal numeric and colour design values appear with the supported registered content fields; computed styles remain with code. Builder-owned pages retain the established visual design controls. Unregistered native components retain content-only editing. See [the client editing journey and exact Git behaviour](builder-client-projects.md#on-page-editing-september-2026-implementation) and [the milestone acceptance log](existing-site-visual-editing-plan.md).
