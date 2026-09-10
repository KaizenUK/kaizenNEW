# Historical builder verification notes

These are earlier incremental notes, including limitations that have since been resolved. See [the current builder guide](visual-builder.md) for current behaviour and [your acceptance checklist](builder-acceptance-checklist.md) for remaining manual checks.

# Kaizen visual builder

The editor lives at `/builder/`. It has `noindex, nofollow`, is excluded from `sitemap.xml`, and does not load the public site's tracking, navigation or editor-session cookie. Published pages are generated separately from explicit published snapshots.

Source and design assets now have saved conversion briefs, source/reference attachments, status history and a downloadable developer handoff. Filter the library by conversion status. Matching reviewed React implementations appear as usable blocks; a status change never compiles uploaded source. The bundled ExampleCard demonstrates the workflow; the sample .fig placeholder remains a reference. See [component integration](builder-component-integration.md) for review, registration, deployment and compatibility limits.

## Local workspace

Run `pnpm dev`, then visit `http://localhost:4321/builder/` (use the port printed by Astro). The local API only accepts loopback hosts/connections and same-origin requests. It is a development-only Vite plugin, never an Astro production endpoint. Drafts, revisions, reusable content and uploaded files persist in `.kaizen-builder/`, which is gitignored. Back up that directory if the local work matters.

1. Use the starter template or create a blank page.
2. Open Assets, name a pack, then upload files, a folder or ZIP. “Try the sample asset pack” exercises PNG, SVG, a real Inter TTF, licences, TSX and a labelled Figma placeholder.
3. Search by name/path/pack/tag, filter by type or pack, and favourite assets. Drag media thumbnails into the canvas, or use **Use** to insert at the selected component. A selected container receives nested content; selecting a leaf inserts after it. Use a font to apply it to the page.
4. Select a component to edit its text and appearance. Text supports direct inline editing and semantic heading roles. Set Desktop styles as the base; Tablet and Mobile fields are explicit overrides. Empty values inherit. The preview sizes are 1280, 768 and 390 pixels; CSS breakpoints are 1023 and 639 pixels.
5. Save/autosave, return to Pages and reopen. Publish creates a separate snapshot. Open Page → Open published page. Local publishing does not change kaizenweb.co.uk.
6. Revisions → Restore as draft recovers one of the last 50 saves without replacing the published snapshot. Publish explicitly to promote the restored version.

For a static local publishing check, set `BUILDER_LOCAL_BUILD=1` for `pnpm build:site`. This includes local published snapshots and only their referenced local media in `dist/`. Never set this flag in a production build. Without the flag or the shared-workspace configuration, local drafts and published demo pages are excluded from normal builds.

## Export for Claude, Codex or a developer

**Export ZIP** includes all page drafts (with the currently open page first), a standalone React/TypeScript project, responsive CSS, locally bundled media/fonts, SEO/page data, a static HTML build script, and `HANDOFF.md` with a ready-to-use implementation prompt. It also includes licence, code and design references from the library, outside the executable source directory. Source references are never imported or executed. The export has no Puck, Sanity, Supabase, authentication tokens or server credentials.

The recipient runs `npm install`, `npm run dev`, and `npm run build`. The build produces an HTML file at every page URL, with the first page also at `/`. Media URLs become `/assets/...`. Links to existing site routes outside the export need review. External media that cannot be downloaded are listed in the handoff; missing uploaded/local media aborts the export rather than creating a silently broken archive. Exported source is a developer handoff, not a bidirectional source-code synchronisation system.

## Shared production workspace

The project already uses Supabase for browser data writes and Supabase Functions for deployment. The builder uses those services, with actual Supabase Auth JWT verification and an explicit editor allowlist. It deliberately does not treat the Studio's browser-set `kaizen_studio_auth=1` flag as permission to write or publish.

1. Apply the builder migrations in filename order, from `supabase/migrations/202609100001_visual_builder.sql` through `supabase/migrations/202609100010_builder_routes.sql`, to the existing Supabase project. Follow the later sections and docs/website-releases.md for the matching function and worker setup; migration 010 requires no pending release. It creates editor membership, protected drafts/assets/reusable data, public published snapshots, and media/source storage buckets. Use `pnpm exec supabase db push` with an authenticated, linked CLI, or apply the reviewed migration through the Supabase SQL editor.
2. Create/invite the intended editor in Supabase Auth, then add their existing Auth UUID to `public.builder_editors`. The app does not allow self-registration or self-granting editor access. For example, an administrator can run `insert into public.builder_editors(user_id) values ('EDITOR_AUTH_UUID');`.
3. Allow `https://kaizenweb.co.uk/builder/` as a Supabase Auth redirect URL. Enable the email sign-in provider and configure delivery.
4. Set `VITE_BUILDER_CLOUD=1`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in the site build environment. These are public configuration; never place a service-role key or GitHub token in a `VITE_` variable.
5. Deploy `builder-publish` with the Supabase CLI. Its handler independently calls `auth.getUser(jwt)` and checks `builder_editors`. Set `ALLOWED_STUDIO_ORIGINS` to include the public site and authorised local/staging origins. Supply the existing `GITHUB_DEPLOY_TOKEN`, `GITHUB_DEPLOY_REPO`, `GITHUB_DEPLOY_EVENT_TYPE=sanity-update`, and `GITHUB_DEPLOY_TARGET=main` function secrets. The GitHub token needs permission to send a repository dispatch.
6. Deploy the site using the existing GitHub/VPS workflow. Both the VPS build environment and any CI build that must include builder publications need the public builder configuration. A build fails if the enabled publication store cannot be read, so a transient backend failure cannot silently remove the pages.
7. Sign in at `/builder/`, run the sample workflow and verify a deployed page anonymously. Also verify that an unauthenticated user and an authenticated non-editor cannot read drafts, upload files, or invoke publishing. Production auth, RLS, storage and deployment require a real configured environment to verify.

Hosted publishing freezes a candidate and queues a coordinated release. Public snapshots change only after the retained artifact passes the live checks. Builder → Releases shows progress and actionable failures; failed publication preserves or restores the previous verified release. See docs/website-releases.md for the required worker, database and VPS setup. Manage old URLs through Builder → URL redirects.

## Asset support and boundaries

| Type | Behaviour |
| --- | --- |
| PNG, JPEG, WebP, GIF, AVIF | Validated using the browser's image decoder; usable as image/background |
| SVG | Sanitised, rendered as image resources; scripts, embedded HTML, external image/use references, event handlers and animation are removed |
| WOFF, WOFF2, TTF, OTF | Validated with the browser font loader; usable as a global page font |
| TXT/MD/PDF licence, README, EULA | Retained with pack and downloadable |
| JSX/TSX/JS/TS/CSS/HTML etc. | Stored as source references; developer review required |
| Figma/Sketch/XD/PSD/AI/EPS | Stored as design references; conversion required |
| Other files | Downloadable references; no automatic execution or editable-layout claim |

The included `.fig` is explicitly a classification placeholder, not a valid design. Real UI8 packs have not been supplied. Compatibility with a particular UI8 pack, complex SVG artwork and all font/image variants requires testing with those files. Import limits: 50 MB per file, 250 MB compressed ZIP, 500 MB expanded batch, 2,000 files. Encrypted/nested archives are not recursively unpacked. Duplicate detection compares content hashes within the same pack/path; corrected files with different bytes can be retained as separate assets. Supplied folder paths and filenames remain in metadata even though storage uses safe UUID filenames. Interrupted batches can be retried; completed duplicates are skipped. The Assets importer now retains pending files and resumes large transfers; see Recoverable and resumable imports below for limits and hosted verification status.

The Inter sample is from the [Google Fonts Inter directory](https://github.com/google/fonts/tree/main/ofl/inter), distributed with its SIL Open Font License. The SVG samples are original demonstration graphics. The PNG is the existing site logo. `node scripts/create-builder-sample.mjs` rebuilds the sample ZIP from checked-in source assets.

## Architecture and verification

- `shared/visualBuilder.ts`: versioned data contract and validation; optimistic save versions; draft/publication separation.
- `client/visual-builder/config.tsx`: Puck component registry and fields. Temporary asset drawer aliases are canonicalised to Image/Icon before storage/export.
- `client/visual-builder/Renderer.tsx` and `page.css`: React rendering shared by editing, preview, static Astro output and developer exports. Published routes have no Puck import or React hydration directive.
- `scripts/builder-local.ts`: loopback-only local persistence and dev media delivery; atomic file replacement and serialised writes.
- `src/lib/builderPublished.ts` and `src/pages/[...slug].astro`: build-time public snapshots. Existing Astro/public URLs are reserved; conflicting Sanity routes fail the build.
- `supabase/migrations/...` and `supabase/functions/builder-publish`: shared persistence, access control and deployment dispatch.

Run `pnpm test`, `pnpm typecheck`, and `pnpm build:site`. The tests cover URL reservations, lost-update rejection, live/draft URL collisions, revision isolation, nested IDs, asset classifications, ZIP paths, static HTML escaping, and project export contents. Set `BUILDER_EXPORT_FIXTURE=1` while running tests to write the generated standalone project to `test-results/export-project/`; install its dependencies and run its build/typecheck separately. Browser checks remain necessary for dragging, inline editing, preview scaling, actual font/image decoding, and published output.

Remaining product boundaries: the editor is designed for a desktop workspace; phone-sized screens preview the published page rather than offering a full phone editing UI. Saved sections/templates are reusable copies; Site design provides linked shared components. The Releases screen polls coordinated publication progress; actual hosted operation still requires verification. Uploaded component/design conversion is developer assisted. No automatic deployment of newly uploaded source code occurs.

### Verified locally on 10 September 2026

- Imported the eight-file sample ZIP, repeated it to verify duplicate detection, and imported a real font/licence folder through the folder picker. Filenames and subfolders survived.
- Searched for and inserted media, applied the uploaded Inter font, edited the headline inline, and set a 40px mobile override. Saved, reloaded and reopened the page successfully.
- Dragged assets directly into nested canvas content and moved an icon between the hero and a feature card. Also verified layer-tree nesting, undo/redo, nested copy/paste, duplication and saving a page template.
- Restored an older revision as a draft while the published page remained unchanged, then republished the edited draft. The local route refreshed without restarting the server.
- Checked desktop published output and the 390px preview in the browser. Preview and published images loaded; the mobile layout had no horizontal overflow.
- All 20 Vitest tests and the project typecheck passed. The static local-publication build passed; its published page contained zero scripts, all referenced media existed, and `/builder/` was absent from the sitemap with `noindex, nofollow` in its HTML.
- A second, normal production build passed and excluded the local demo page and its uploaded media.
- Generated a standalone export fixture, installed its dependencies, passed its build and TypeScript check, and loaded it in the browser with bundled media. The browser's **Export ZIP** action also completed successfully.
- After the drag patch, verified rapid desktop and mobile nested drops, same-container reordering, moving between containers, empty-slot insertion, layer-tree dragging, cancellation outside the canvas, and undo/redo. Frozen-lockfile installation, all 20 tests, typechecking and the production build passed again.
- Exported both saved pages through the browser. The expanded two-page export fixture built successfully, including a nested URL with escaped SEO title and `noindex`; shared media was bundled only once.

Production Supabase access policies, email sign-in, cloud uploads and the GitHub/VPS publishing chain have not been exercised without the deployment configuration. Real UI8 packs and their format variations remain to be tested.

### Puck drag-target patch

Puck is pinned to 0.23.0 with a pnpm patch in `patches/@puckeditor__core@0.23.0.patch`. Its original nested-area handler throttles pointer inspection by 50ms, debounces area changes by 100ms, and delays collision refresh by another 50ms. A quick release inside a nested slot could therefore commit to its previous ancestor. The patch inspects each pointer move, activates the destination synchronously with React `flushSync`, and refreshes collision detection immediately when the destination changes. At release it resolves the final pointer location using Puck's existing nesting/allowed-component checks and gap-index calculation, so an asynchronous preview cannot commit an older destination. Releases outside the canvas cancel the canvas operation. The outline uses its separate drag provider. Both ESM and CommonJS distributions are covered. Published pages and exported projects do not depend on this patch or Puck.

Use pnpm and the committed lockfile to retain the patch. Before upgrading Puck, repeat the browser checks for fast library-to-nested-slot drops, movement between nested containers, empty slots, scaled mobile previews, undo/redo and layer dragging; remove the patch only after upstream behavior passes those checks. The synchronous update runs when the target changes, not on every move within the same target. Very large pages still need performance testing with representative content.

## Elementor-style expansion: editing controls

The first increment of the expanded goal adds grouped visual controls for independent padding and margins, column proportions, column spans, separate row/column gaps, ordering, sizing, typography, image ratios and focal points, background overlays, and hover/focus colours. Measurements use pixels unless labelled otherwise. Column proportions such as `2 1` create a wider first column. Setting a column count at a smaller breakpoint resets inherited proportions.

The settings panel follows the canvas's Desktop/Tablet/Mobile selection. Every control shows whether its value is a base setting, override, inherited value or default, with individual reset buttons. A smaller-screen shorthand replaces larger-screen side values before applying that screen's individual side overrides. Explicit zero and visible overrides are preserved. Background images can be removed at one breakpoint without breaking the developer export.

The selected component's full ancestor path appears above its fields; click an ancestor to edit a containing layout. Ctrl/Cmd+S saves, Ctrl/Cmd+C/V copies/pastes components, and Ctrl/Cmd+D duplicates. Copy/paste/duplicate shortcuts leave normal text inputs and inline text editing alone. Puck continues to handle undo/redo shortcuts.

The Puck patch also fixes pending history recording. Visual control transactions are committed in a microtask after the state reducer finishes, avoiding Puck's 250ms grouping of separate field/reset actions. Pending text history is flushed before undo/redo and cancelled when replacing the history timeline. This is included in both CommonJS bundles and the ESM history chunk; the drag patch remains intact.

### Browser regression suite

Install Chromium once with `pnpm exec playwright install chromium`, then run `pnpm test:builder:browser`. Tests launch a dedicated loopback service on port 4322 with a separate workspace and separate Astro/Vite caches under `test-results/`. They do not use production credentials or the personal `.kaizen-builder/` directory. The dedicated port must be free. The normal builder can remain open on port 4321.

Six browser tests verify responsive inheritance and reset, fast undo/redo and keyboard shortcuts, save/reopen, preview, local publishing, revision restoration with live snapshot isolation, image crop/focal settings, hover styles, sample ZIP duplicate handling, dragging assets into nested content, copying/pasting, duplication and same-container drag reordering, rich text formatting and partial-text links, and interactive navigation/tabs/FAQs in preview and local publication. Keyboard coverage includes tab arrow keys/Home/End and closing mobile navigation with Escape. A JavaScript-disabled browser checks the tab-content fallback. The suite runs on relevant pull requests through `.github/workflows/builder-checks.yml` and can be started manually in Actions. It has passed locally; the new GitHub workflow has not yet run remotely.

The expanded goal remains in progress. Library organisation/replacement and editable project backups now have local implementation and browser coverage. Image optimisation and resumable imports now have local implementation and browser coverage. The developer conversion workflow now has saved briefs, status tracking and reviewed React registration (see the later increment below). Deployment tracking/private previews/rollback still need implementation and verification. Sanity post listings and field bindings have isolated browser coverage; the deployed connection remains to be verified. Contact forms have local end-to-end coverage; hosted persistence and notification delivery still require deployment and verification. Uploads have been confirmed working by the user; exact compatibility with real UI8 pack variations and the deployed authentication/publishing chain still require representative evidence. Existing saved section/template copies and one-way React exports retain their earlier behaviour.

### Rich text and interactive blocks

Rich text supports inline typing and formatting. To add or edit a link, select the words in the right-hand Rich text field, then use its link button. Relative page URLs, anchors, web URLs, mailto and tel links are supported; unsafe schemes are rejected. The published renderer parses an allowlist into React elements, retaining safe formatting without executing supplied HTML.

The Interactive library now includes Menu, Accordion, Tabs and Video. Menu has editable brand/link lists and a mobile disclosure; Accordion has editable questions and answers; Tabs has editable titled text panels and arrow-key/Home/End navigation. Test interactions using Preview: the canvas keeps Puck selection overlays in front of interactive controls. Video uses native controls with an MP4/WebM URL, an optional library poster, WebVTT captions and visible transcript/caption text. Uploaded video classification/optimisation and third-party player embeds remain outside current tested support.

Menus and FAQs use native HTML disclosure controls. Published pages load the small standalone runtime only when menus or tabs occur, including in nested sections. Tabs remain readable as sections if JavaScript is unavailable. React exports include the same components and runtime: production HTML does not hydrate React and loads the runtime only where needed; the development preview still uses React. Contact forms are described below. CMS data bindings and the remaining expanded milestones are still in progress.

The original 22 KB WebM sample (`public/builder-samples/story.webm`) is a generated geometric animation with a WebVTT description; it is not third-party pack content. Browser checks exercise actual playback and caption loading in local publishing and the independently built export. After generating and building the export fixture, run `node tests/builder/verify-export.mjs` to check the exported media, mobile layout, keyboard controls and selective scripts in Chromium.

### Expanded milestone verification — 10 September 2026

- 25 unit tests and five browser regressions passed. After adding the sample video, the interaction regression also passed with actual playback and caption loading.
- The application typecheck and 23-page production build passed. An isolated static publishing build generated 32 routes from test data without reading personal workspace pages.
- Both static publications and the independently built React export passed browser checks under `script-src 'self'`, including menu/tab keyboard operation, FAQs, mobile width, media, video and captions. Run `node tests/builder/verify-export.mjs --static` after the isolated static build to repeat the publication check.
- Published menu/tab scripts are emitted as hashed files rather than data URLs. Marketing-only pages contain no scripts. The builder remains excluded from the sitemap and has `noindex, nofollow`.
- Frozen-lockfile installation passed; the pre-existing missing Supabase CLI executable warning remains an environment setup issue for CLI deployment commands. No production publication, database migration, GitHub push or live cloud verification was performed in this increment.

## Shared site design

Open **Pages → Site design** to edit shared colours, typography and spacing tokens, or create a shared header, footer or section. Start from a built-in block or an existing saved section. Shared definitions open in the same visual editor and autosave to the site draft. Site-wide settings use **Save site draft**; unsaved changes are marked and protected with a browser navigation warning. You can download a recovery draft or explicitly discard changes and reload the latest saved design.

On a page, open **Page** settings to assign its header/footer and enable **Use site styles**. Existing page sections are retained; remove any old navigation/footer that you are replacing. Named token selectors appear beside supported appearance controls when site styles are enabled. Base token bindings inherit through breakpoints; a smaller-screen numeric override takes precedence. Shared definitions can also reference tokens.

Drag linked sections from **Shared components** in the block library. Select an instance to override its text, formatted text, media URLs or links without changing the definition. Reset removes an override. **Detach shared component** makes an independent editable container; undo/redo restores/removes the link. Component structure changes require editing the shared definition or detaching the instance.

**Review site publication** lists every page that uses shared definitions or site styles. The final action explicitly publishes the current drafts of all listed pages together with the site design. This also promotes other draft edits on those pages: review the list before publishing. Shared changes do not alter previous published snapshots while you edit. Individual-page publishing refuses to mix in unreviewed shared changes; publish the site design first. Publication uses optimistic versions for both the design and every page in the reviewed workspace, with one atomic database/local write.

Site design keeps 30 saved revisions; restoring one opens it as an unsaved site draft. Page revisions remain separate. Published pages and React exports contain resolved components and token values, so they do not query the private site-design store. Exported snapshots are independent; their shared definitions are not automatically re-linked to the builder. Editable whole-project backup/import is available through Project backups, described below.

### Shared-site verification

The browser regression creates a three-page site through the UI, assigns a shared navigation/footer, drags a linked section into each page, applies a token, preserves a per-instance override and checks shared publication. It edits a shared definition, verifies draft/live isolation, then detaches an instance and verifies undo/redo plus independence from later shared edits.

The PostgreSQL tests run the actual migrations in PGlite with fixture Supabase roles/auth schemas. They verify editor-only drafts, non-editor exclusion, service-only publication, three-page atomic publication, stale/null version rejection, and transaction rollback when one snapshot is invalid. These tests do not claim to verify the hosted Supabase Auth, storage or HTTP permissions. The updated edge function also passes Deno typechecking.

Deploy the second migration and the updated `builder-publish` function before enabling shared-site publishing in production. Older installations retain the original builder workflow; shared-design saves require the new migration. The shared-site React export fixture now contains three pages and is built and browser-checked independently.

## Contact forms

Drag **Contact form** from Interactive onto the page. Edit its heading, introduction, button, success message, privacy notice/link and optional last-name, phone, website and marketing fields in the settings panel. First name, email, message and privacy acknowledgement are required; marketing is always opt-in. Appearance uses the normal responsive controls. Form fields stack on mobile, retain native labels/validation, and report submission status through an accessible live region.

Preview validates the form but never sends it. On a local published page, the receiver writes only to the development workspace's contact-submissions.json; it sends no email. Browser regressions use the separate test-results workspace. A successful response hides the completed form. Failed or timed-out requests keep the visitor's details. Unchanged retries retain the same request UUID to avoid duplicate enquiries after a lost acknowledgement.

### Connect production delivery

1. Apply supabase/migrations/202609100003_builder_contact.sql to the existing Supabase project. It expects the existing contact_form_submissions table used by ContactFormBox and adds a private retry/rate ledger plus a service-only transaction. It does not change access policies for older contact forms.
2. Deploy builder-contact using the checked-in config (verify_jwt=false: this is a public visitor form). Its server-side validation, origin checks, honeypot, rate limiting and database transaction run without exposing a service key to the browser. Keep the existing contact-alert notification workflow connected to contact_form_submissions. The accompanying alert change escapes user text when constructing HTML emails.
3. The renderer derives the public receiver from VITE_SUPABASE_URL. VITE_BUILDER_FORM_ENDPOINT can explicitly select another compatible receiver. Configure BUILDER_CONTACT_ORIGINS on the function for approved production/staging origins; defaults are the two kaizenweb.co.uk origins. No wildcard origins are enabled. Rebuild after changing public configuration.
4. Verify an authorised test enquiry in the hosted table and the existing delivery workflow after deployment. Local receiver/database tests do not prove hosted mail or CRM delivery. No real enquiry has been sent by these tests.

The receiver accepts at most 16 KiB JSON, validates the required fields and consent, and stores the same fields as the existing form. The private ledger uses keyed hashes, retains retry entries for seven days, and enforces five enquiries per email in ten minutes plus a global ceiling of 100 per minute. These are basic abuse controls for this receiver; they do not retrofit the older direct-insert contact workflow. Missing configuration or failed storage never claims successful delivery. Browser success means the enquiry was accepted into storage; downstream email/CRM delivery is separate.

### Exported forms

Exports include the contact React component and the same lightweight runtime, but leave src/formConfig.ts disconnected. CONTACT-FORMS.md documents how to set a public receiver URL and its JSON/response contract. Neither Kaizen's local receiver nor credentials are copied into the archive. The independent export fixture is explicitly connected to a test receiver before its build, then submitted in the browser; it does not send real enquiries.

### Contact milestone verification — 10 September 2026

- 38 unit/database tests passed, including request validation, origin/body limits, private ledger permissions, rate limiting, retry deduplication and transaction rollback when enquiry storage fails.
- All seven browser regressions passed. The contact regression creates the form through drag-and-drop, changes its copy, saves/reopens, checks inert preview, publishes locally, validates required fields and privacy acknowledgement, then simulates a lost acknowledgement and proves only one enquiry was stored after retry.
- The independent three-page export passed build/typecheck and browser submission against an isolated test receiver. An isolated 70-route Astro static build also passed the contact submission, shared navigation, mobile, video/caption and keyboard interaction checks under script-src 'self'.
- The project typecheck passed for 209 files with zero errors/warnings. The normal 23-route production build passed; builder noindex/sitemap exclusion and exclusion of local test routes were checked in its output.
- builder-contact, builder-publish and contact-alert passed Deno typechecking. The new migration and functions have not been deployed; real hosted enquiry storage, email/CRM delivery, sign-in and publication remain unverified. No real enquiry was sent.
- Astro's developer toolbar is disabled only for the isolated test environment because its overlay intercepted the mobile submit button. It is absent from production output regardless.

## Sanity content in the visual builder

Drag **Sanity content → Post listing** onto a page. Choose a category, post order, 1–24 posts and Cards, Minimal or Editorial list styling. Toggle images, summaries, dates and author names. The standard responsive controls set columns, proportions, gaps, spacing and visibility. Empty categories have an editable empty message. Sanity images request a maximum 1,200px width and automatic format conversion.

Select a Text, Image or Button block and choose **Connect to Sanity**. Find a published post, then choose a supported field: title, summary, author or date for text; post image for images; article URL for buttons. Bound values come from Sanity and their manual input is hidden. **Use manual content** restores that block's previous manual value. Connecting, changing fields and disconnecting are discrete undo steps. Bindings persist when saving/reopening and also work inside shared definitions.

**Refresh Sanity content** refreshes the editor's view. Builder drafts retain query settings and field references. On every site deployment, published builder documents resolve the latest published CMS metadata into static React markup. A CMS change can therefore update published cards without publishing a draft layout. Listings do not fetch Sanity in the visitor's browser and add no script. A missing linked post/category or failed CMS connection fails the build, rather than silently substituting stale content or dropping the listing. The existing deployment pipeline must retain the prior release on build failure; live failure/rollback verification is still outstanding. Restoring a page draft revision restores the binding, not a historic CMS revision; an exact live rollback needs the corresponding built release artifact.

### Connection and scope

The server adapter uses the existing PUBLIC_SANITY_PROJECT_ID/SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET/SANITY_DATASET and optional private SANITY_API_TOKEN. Local development reads these on the server. For the hosted editor, deploy the new builder-content Supabase function and configure its existing Sanity credentials. It verifies the Supabase user's JWT and builder_editors membership before returning a fixed published-only post/category projection. No private token, arbitrary GROQ query or Sanity draft is sent to the editor. Server builds use the same projection and the published perspective.

This integration targets the existing post, category and author schema. Article links retain the existing /blog/{slug}/ routes, whose content/layout remain owned by Sanity and Astro. Arbitrary Sanity document types and full article-body layout editing are not implied. The current catalogue is limited to 1,000 posts/categories; reaching that limit stops publication explicitly and needs catalogue pagination work before publishing a larger collection.

The standalone React export materialises current published CMS content, bundles referenced card images, and retains no active CMS bindings or CMS fetch implementation. Existing article-detail routes are not generated by the export; review its handoff notes before deploying elsewhere. Whole-project editable backup/import is available separately through Project backups, described below.

Browser tests use authored metadata matching the existing Sanity projection via BUILDER_CONTENT_FIXTURE and the isolated local adapter. Tests reset only this fixture file; they never read or change production CMS content. Static test builds must set BUILDER_LOCAL_BUILD=1 and the fixture path. A normal production build refuses to use a configured CMS fixture if CMS resolution is requested. Hosted Sanity connectivity, private-dataset permissions and real article-link destinations have not been verified by these fixture tests.

### CMS milestone verification — 10 September 2026

- 43 unit/database tests and all eight browser regressions passed. CMS checks include category/order/limit controls, responsive card variants, text/image/link bindings, disconnect/undo, save/reopen, and updating published CMS content without publishing draft layout changes.
- The four-page React export passed its independent build, typecheck and browser checks. The exported CMS listing contains bundled images and makes no CMS request. CMS-only pages contain zero scripts.
- The project typecheck passed for 215 files with zero errors/warnings. The normal 23-route build passed with builder noindex/sitemap exclusion and isolated test-route exclusion verified. The isolated 82-route static build also passed desktop/mobile listing, media, form, shared content and keyboard checks under script-src 'self'.
- builder-content and builder-publish passed Deno typechecking. The new hosted content function and real Sanity connection have not been deployed/verified in this increment. The tests used authored projection fixtures, not the live CMS.

## Library organisation and replacement

In **Assets**, search by filename, folder path, pack, original pack or tag. Filter by type, pack or favourites; sort by newest, name or file size. **Import assets** expands the upload controls, which collapse after a successful import. The library renders 48 cards per page, with pagination above the cards. Select cards or the current page, then add/remove tags, move to a pack or change favourites together. **Select all matches** supports batches up to 2,000 assets. Metadata updates are atomic and reject stale edits; **Refresh library** reloads current asset metadata after saving the current draft.

Moving assets between packs preserves their `originalPack`, filename, folder path, hash and stored file. Asset details link the licence documents from that original pack even when either the asset or licence has been reorganised. Licence files are retained; moving a file does not imply new usage rights.

Asset details show draft and published-snapshot references, shared definitions, saved sections/templates, shared style references and page revision usage. Draft usage resolves linked components, so a shared header image lists the pages that use it. Usage covers structured media, font, background and button-link URL fields. It does not scan arbitrary prose, embedded rich-text HTML links, external code or external CMS records. The “Published snapshot” label describes the stored publication; deployment confirmation is separate.

For images, SVG icons and fonts, **Replace in drafts** can select an existing compatible asset or upload a new file through the normal validation path. **Review replacement** saves the current editor draft and lists affected content. Applying the reviewed change updates direct page draft references, shared site draft references and saved reusable content atomically, then returns to Pages. Reopen the drafts to review them and publish explicitly. Original files, published snapshots and previous revisions remain available. Shared replacements require the usual site-publication review. A changed page, site design, source/replacement asset or saved section invalidates the review and requires a fresh review; it never overwrites an intervening edit.

Deploy `202609100004_builder_library.sql` before using bulk metadata or replacement with the hosted builder. Both RPCs require builder-editor membership. The replacement transaction shares the page/site publication lock and also locks legacy asset/saved writes; no object-storage file is overwritten. This migration has been tested locally against PostgreSQL via PGlite, but has not been applied to hosted Supabase in this increment.

The added tests exercise atomic metadata updates, stale-review rejection, shared usage, revision preservation and draft-only replacement in the TypeScript and actual SQL implementations. Browser coverage imports the sample ZIP, bulk-tags/moves/favourites its assets, retains licence links, uploads a replacement, reviews two affected pages, reopens the changed drafts and checks that the public page changes only after explicit publication. A separate 1,000-item metadata fixture checks paginated browsing, search and a bulk update; it is not a 1,000-file upload benchmark or evidence of real UI8 compatibility.

Real representative UI8 packs, the expanded developer conversion workflow and deployed publishing/rollback verification remain unfinished. Resumable imports were added in the later increment below. Editable project backup/import and generated thumbnails/responsive image variants were completed in the subsequent increments below. The user has confirmed that uploads work; these remaining compatibility and scale checks do not negate that confirmation.

### Library milestone verification — 10 September 2026

- All 51 unit/database tests passed. The full browser run passed nine tests and exposed an older drag test's assumption of unique filenames across packs. After adding its explicit pack filter and compacting the upload controls, all seven editor/library browser regressions passed; the contact, CMS and shared-site regressions had passed in the full run.
- The final project typecheck passed for 220 files with zero errors/warnings, and the normal 23-route production build passed. Builder noindex/sitemap exclusion and separation of local test publications were checked again.
- Browser screenshots show the 1,000-item library and the reviewed two-page replacement. The regression confirms original asset URLs remain downloadable after replacement and publication. Original personal workspace files were not modified by these tests.
- Changes remain local; the library migration and UI have not been deployed. Previous independent export/static-render checks still cover the unchanged rendering path; this increment changes library management and draft references.

## Editable project backups

Open **Pages → Project backups → Download editable backup**. The versioned ZIP contains `project.json`, the full saved workspace and every registered library file, including fonts, licences, source/design references, draft page history, shared-design history and saved sections/templates. Files have SHA-256 checksums; export fails if a stored file no longer matches its recorded checksum. Hosted export reads a single database snapshot, then downloads immutable asset files.

Choose **Choose backup to restore** and review the page list. Matching page IDs replace those drafts; missing IDs add draft pages. Other pages stay in the workspace. Imported shared definitions with matching IDs and shared default styles take precedence, while other definitions/tokens are retained. The review exposes other current pages connected to shared design. URL conflicts with another page's draft or published snapshot must be resolved before restore; restoring does not take another page's live URL.

**Restore drafts** verifies archive paths, counts, sizes, checksums and supported component schemas, then revalidates every image, SVG and font through the existing upload validation. Existing matching immutable files are reused. New files receive new storage IDs; page, theme, shared/saved content and history references are remapped, including registered-asset links in rich text. Asset tags, favourites and original licence-pack association are restored. Source and design files remain references and are never executed or registered as components.

The final draft/metadata transaction rejects changed page/site versions, changed saved content and stale asset metadata. It does not alter current publications or delete pages/files. Previously published content in the archive is retained as page revision data, not activated. In an empty workspace, restored pages and shared design have no publication. In an existing workspace, a **Before project restore** page revision preserves the previous draft; the previous shared draft is also retained in site history. Normal history limits still apply: 50 page revisions and 30 site revisions. Backups contain the archived history even if merging histories reaches those limits.

Completed file uploads can remain in the library if the final transaction fails; choose the backup again and review current state to retry. Matching uploads are reused. This is recoverable file-level retry, not resumable byte transfer. No draft transaction is committed partially.

Deploy `202609100005_builder_backup.sql` after the preceding builder migrations to enable hosted backup snapshot/restore RPCs. Both require editor membership. The database migration has been tested with the actual SQL in PGlite, including late-failure rollback and publication preservation; it has not been deployed to hosted Supabase in this increment.

### Scope and limits

Backups support up to 500 pages, 20,000 library assets, 2,000 saved sections/templates, 50 MB per file and 500 MB per ZIP/expanded archive; workspace JSON is limited to 50 million characters. These are enforced limits, not a benchmark at the maximum sizes. Shared design retains the existing 100-component limit. ZIP paths are fixed asset IDs; original names, folder paths and packs are retained in the manifest and restored library. Unexpected paths, missing files, unsupported versions and altered bytes are rejected.

External media URLs, Sanity content and form receivers remain external dependencies. Backups do not bundle the CMS database, credentials, enquiries or deployed release artifacts. A page with an external media URL can still depend on the original host after restoration. Use registered library assets for self-contained media portability. React source exports remain a separate developer handoff and cannot be automatically reimported as editable projects.

The browser regression downloads a three-page project with an imported sample ZIP, shared navigation/footer/styles, a form, saved content and responsive image settings. It restores into an empty isolated workspace, verifies new file IDs and remapped references, confirms no publication is activated, edits a restored page visually, checks its 80% mobile image width, saves and reopens it. The test restores only its test workspace afterwards; personal workspace data is never modified.

### Backup milestone verification — 10 September 2026

- All 59 unit/database tests and all 11 browser regressions passed. Backup-specific tests additionally reject tampered files, unexpected ZIP paths, unsupported versions/components, malformed metadata and an oversized declared expanded entry before allocating it.
- The actual PostgreSQL migration restores an empty workspace, restores matching drafts/metadata, preserves publications and pre-restore history, rejects stale versions, enforces editor membership and rolls back staged data after a late save failure.
- The project typecheck passed for 224 files with zero errors/warnings. The normal 23-route production build passed. Backup/library code remains in the editor bundle; the public rendering path and standalone React export are unchanged by this increment.
- The three-page sample archive and browser screenshots are under `test-results/`. The archive uses the supplied sample pack, not a representative real UI8 download. No hosted migration, deployment, GitHub push, real enquiry or live rollback was performed.

## Optimised library images

New static JPEG, PNG and WebP uploads retain their original bytes and produce smaller WebP copies in the browser. The candidate widths are 320, 640, 1280, 1920 and 2560 pixels, without upscaling; narrower originals use their own width for the thumbnail. Encoding uses quality 0.84, and only copies smaller than 95% of the original are kept. The library uses the smallest retained copy and hides generated files from asset browsing and bulk selection. The generated files remain registered in storage for publication and backups.

Select an image's **Details → Optimise image** to process an existing upload, or **Regenerate optimised images** to retry. Processing errors retain the original and show an explanation with the retry action. Temporary Windows file locks during local catalogue saves receive a bounded retry; the previous complete catalogue stays in place until the atomic rename succeeds.

Image blocks keep the original URL as their fallback and render a responsive `srcset`, intrinsic dimensions and lazy loading. `sizes="auto, 100vw"` lets supporting browsers use the rendered width, with a viewport fallback. See [MDN's sizes documentation](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/sizes). Backgrounds choose retained copies targeting 2560 pixels on desktop, 1280 on tablet and 640 on mobile; an explicit disabled background remains disabled. This does not dynamically recrop the original: the existing focal-point, fit and aspect-ratio controls still apply.

SVG icons stay vectors. GIF, animated PNG/WebP and all AVIF uploads retain their originals to avoid flattening animation or changing unsupported fidelity. Images above 40 megapixels also retain their original. Optimisation needs browser image decoding and WebP encoding; it is not a server image-processing queue. Existing GIF/AVIF previews can therefore still load their original file. Real UI8 packs and maximum-size batch performance remain unverified.

The editor resolves current asset metadata, while each publication captures the variant URLs it uses. Regenerating library versions does not alter an existing published snapshot or overwrite the original. Publish affected drafts explicitly to use newly generated versions. React exports bundle referenced originals and variants; editable project backups include every registered generated file and remap image metadata and parent references on restore. Backup restoration does not regenerate files while uploading the archive.

Apply `202609100006_builder_images.sql` for hosted image metadata updates. The updated backup migration `202609100005_builder_backup.sql` additionally permits restored image metadata and parent references; deploy its current function definition if an earlier version was already applied. The image RPC requires editor membership, checks the current original asset, validates registered variant files and rejects stale writes. Neither migration has been deployed by this local increment.


### Image milestone verification — 10 September 2026

- All 63 unit/database tests passed, including the real image metadata SQL, missing/mismatched variants, stale writes, editor permissions, immutable publication metadata and animation-preservation detection.
- All 12 browser regressions passed. Subsequent visual inspection found an automatic-sizing proportion issue; the natural-ratio fallback and renderer validation were corrected. The dedicated image test then passed its new rendered-proportion assertion; the six editor/backup regressions also passed during this correction.
- The actual browser test uploaded a generated 3200×1800 PNG, checked five smaller WebP files and original SHA-256 bytes, placed the image, saved/reopened, selected mobile preview, published locally, regenerated variants without changing the published snapshot and downloaded a React export. It also rejected an attempt to overwrite the original asset ID. The test image was 5,803,341 bytes; its 640px copy was 10,428 bytes. This synthetic result is not a real-pack compression benchmark.
- The downloaded one-page image export passed an independent build, typecheck and desktop/mobile browser checks, including natural mobile proportions, responsive backgrounds, original bytes, bundled files and no visitor scripts. The four-page export fixture also passed its independent build/typecheck and existing form, CMS, shared-content and interactive-component browser checks earlier in this increment.
- The isolated 117-route Astro build passed both image and existing public-render browser checks. The normal 23-route website build passed; `/builder/` noindex, sitemap exclusion and exclusion of the isolated image fixture were verified. The project typecheck reported 228 files, zero errors/warnings; the publishing function passed Deno typechecking.
- The sample editable backup contains a generated image variant. Restoration checks its new URL, parent reference and downloadable bytes in addition to the existing three-page edit/reopen workflow. Personal workspace data was not changed by the tests.
- Changes remain local and uncommitted. Hosted auth, object-storage permissions, migrations, live deployment/failure/rollback and real UI8-pack compatibility remain unverified. Resumable transfer was added in the following increment; the expanded developer conversion workflow remains future work under the active goal.
- The combined build initially reached Studio with its dependencies absent. Installing its existing frozen lockfile resolved that environment issue; the Studio build and staging into dist/studio then passed. No Studio source or dependency versions were changed.

## Recoverable and resumable imports

The Assets importer now stages a pack in this browser before transferring it. **Pause import** stops the current transfer and retains pending files. After reopening the page or returning to Assets, **Resume import** reloads the saved queue; it does not require selecting the ZIP/folder again. **Discard pending import** removes that queue and its pending browser copies, while completed library assets remain available. Damaged files stay listed with their errors; discard the pending import and choose a corrected pack to replace those inputs. Files already imported with the same pack, path and checksum are skipped.

The queue uses IndexedDB, with file blobs stored separately from progress records. Completed/duplicate blobs are removed as each file finishes, and a successful job removes its remaining queue records. Browser storage limits and eviction still apply: clearing website data removes recovery copies, and a pack that exceeds available browser storage needs to be split or selected again. The existing 50 MB per file, 250 MB per ZIP, 500 MB/2,000 expanded files per batch limits remain. These are enforced limits rather than maximum-size performance claims. One pending job per workspace is supported; finish or discard it before importing another pack.

A browser Web Lock gives one tab ownership of a workspace's queue. Another tab can inspect the pending job, but attempting to run/discard it while the first tab owns it shows an actionable message. Queue keys include the local workspace identity or Supabase project/user identity. Resumable requests validate the saved URL against the active endpoint before adding credentials, refresh the current session credential for each request, and reject a changed signed-in scope. Access is still enforced by the existing server and Supabase policies; client scope checks are not an authorisation substitute.

Files of 6 MiB or more use TUS with 6 MiB chunks. The queue saves the server upload URL before sending the first chunk. Resume checks the server's committed offset and transfers the remaining bytes, with bounded retries for temporary network/server failures. Smaller files use the existing upload route, can be paused and retried as whole files, and recover a lost acknowledgement without registering a duplicate. The cloud path can also verify and register an already-uploaded object whose asset-row acknowledgement was lost. Published files are never overwritten; resumed transfers retain their original asset ID.

For hosted Supabase, the client uses its built-in resumable storage endpoint and existing editor storage policies, without a new deployed builder API or migration. The direct storage hostname is used for standard Supabase project URLs. See [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads): upload URLs can expire after 24 hours, at which point the TUS client starts a fresh session for that unfinished file. Hosted permissions, expiry and connection-loss behaviour still require live verification; local checks do not establish hosted support as tested.

Local development uses `@tus/server` and `@tus/file-store` behind the existing loopback/same-origin builder checks and required builder header. Partial bytes and protocol metadata live under the selected local workspace's `uploads/` directory. Registration verifies length/SHA-256 before copying into immutable asset storage. Completed protocol files are released after catalogue persistence. Abandoned local partial uploads become eligible for cleanup after 24 hours, with cleanup triggered on a later upload creation; discarding the browser queue does not immediately delete them. The server is a development-only Vite integration and is absent from the published site.

Image optimisation remains a separate recoverable stage after the original upload. If paused after the original has registered, that original is usable; **Details → Optimise image** can generate/retry its smaller versions. Generated copies and backup restoration also use the shared upload transport for large files, but only the Assets import queue retains original pending-file blobs across a browser reload. The project-backup restore keeps its existing reselect-and-retry workflow.


### Upload recovery verification — 10 September 2026

- All 65 unit/database tests passed. The upload protocol test uses the actual TUS server/file store, recreates the handler while retaining partial bytes, checks the saved offset, rejects stale offsets and mismatched checksums, and confirms that releasing protocol state leaves the registered asset intact. The client also successfully replaces a missing upload session and persists its new URL.
- The full browser run passed 13 cases and exposed a test selector that expected the newly collapsed import controls to stay visible. After correcting the selector, both upload cases passed again. They cover a 14 MiB reference file inside a ZIP, an interrupted connection after 6 MiB, competing-tab exclusion, pause/reload/resume, exactly the remaining 6 MiB and 2 MiB chunks, licence preservation, byte checksums and removal of completed browser blobs. The other case checks recovery-service retry, a lost small-file acknowledgement, duplicate avoidance, a damaged image error and discarding pending files without removing the completed licence.
- The full production command passed the website, Studio and staging steps. The 231-file typecheck reported zero errors/warnings after rerunning with a separate cache to avoid a Windows Vite cache lock. The recovery queue appears only in the BuilderApp bundle; no production upload API was emitted. Builder noindex and sitemap exclusion were verified.
- The original local dev process remained alive but no longer listened after its dependency path changed. A current dev process was started and checked at `http://127.0.0.1:4321/builder/`; the superseded non-listening process was stopped after checking its exact command/path. The existing unrelated process bound to 0.0.0.0 was left alone. The current builder and its local workspace endpoint both returned HTTP 200.
- Changes remain local, uncommitted and undeployed. Hosted Supabase auth/storage/TUS recovery, real UI8-pack compatibility, the expanded developer conversion workflow, and live publishing/failure/rollback verification remain outstanding under the active goal. No real enquiry or public publication was made.


## Developer conversion requests and reviewed React blocks

Source/design asset details now save a conversion brief: intended behaviour, editable fields, mobile layout, interactions, attached source/reference/licence files and developer notes. Requests have a version and the last 30 status changes. Filter the library by status and export an exact brief for implementation. A stale save or missing/changed reference fails with a useful message.

Ready for review is a tracking state. Reviewed block available is derived from an exact deployed registry contract; changing the requirements or source files removes that match. The bundled ExampleCard has a manually reviewed static React adaptation with editable text and the normal responsive controls. It can be inserted from asset details or the Reviewed React blocks drawer. Existing inserted versions remain stable when the originating brief changes. Missing component registrations fail page validation. Uploaded code and the sample Figma placeholder are never compiled or executed.

See [the developer integration guide](builder-component-integration.md) for immutable registrations, review evidence, new component integration, migrations and export/backup requirements. This increment does not claim conversion of a real UI8 design.

Verified locally: 69 unit/database tests; browser save/reopen of a brief, matching registration, text/mobile editing and local publication; editable backup restoration with remapped source IDs; standalone React export typecheck/build/browser checks; and publication-function Deno typechecking. Hosted migrations, authentication, storage and live deployment/rollback remain unverified. Changes remain local and uncommitted.

Final verification for this increment: all 15 browser scenarios were verified (14 in the full run; the duplicate-fixture selector was isolated by pack and passed on rerun, alongside the conversion save-in-progress case). The production site/Studio build passed. Astro/TypeScript reported 236 files, zero errors/warnings and 155 hints. An isolated 140-page static build passed browser checks for the reviewed block with mobile spacing and no visitor scripts, plus existing media, forms, CMS and image variants. The standalone four-page React export also built and passed browser checks independently. Local /builder returned HTTP 200 with noindex. No hosted release or rollback was performed.


## Retained deployment artifacts and rollback foundation

Public VPS deployment now stages a complete retained artifact and switches a managed Nginx include, with file checksums, a public release marker, HTTP body verification and automatic restoration after failed configuration/reload/health checks. Rollback selects the original rendered HTML, CMS content and redirects without rebuilding. The existing deployment workflow pins its source commit and resolves production/staging exactly once. The separate optional Studio host copies the retained Studio build.

**The updated workflow requires one-time VPS release-store and Nginx setup before it can deploy.** See [website releases](website-releases.md) for concrete setup, activation, rollback and recovery commands. No live server settings or secrets have been changed. The root/shared assets remain private except for explicitly served site files and immutable build assets.

Verified locally: 77 unit/database/HTTP tests passed; a real isolated Nginx instance passed activation, generated redirects, old asset availability, invalid-config recovery, wrong-route/content recovery and exact rollback. Builder CI now includes the real Nginx smoke test on Ubuntu; that remote CI run is not yet verified.

Final verification: the full website/Studio production build passed, and the 238-file typecheck reported zero errors/warnings (155 hints). An isolated 140-route build was served through real Nginx with 310 retained files and 120 marker/page responses verified. Chromium checked the reviewed card's mobile styling and the compiled builder entry through the retained asset alias; the latter showed the expected Supabase configuration gate, so it does not establish hosted sign-in. The final eight focused deployment/redirect tests, Bash syntax check and whitespace check passed. The local development builder returned HTTP 200 with noindex. Test Nginx processes were stopped after verification.

This retained-artifact foundation was followed by the coordinator increment below. Hosted sign-in/storage, actual VPS activation and live rollback remain unverified. The active goal is not complete. Changes remain local, uncommitted and undeployed.

## Frozen publication queue and Releases controls

Hosted Publish now queues a private, immutable candidate instead of updating public snapshots before dispatch. The VPS worker builds that candidate and commits publication records only after the retained artifact passes public HTTP checks. Code/CMS deployments use the same queue, so a failed editor request cannot leak into an unrelated later build. Newer page/site drafts and their autosave concurrency tokens survive promotion. One worker owns a pending release, with no automatic takeover based on age.

The shared workspace dashboard now has **Releases**, with observed progress, current live status, errors and dispatch retry. Explicit review steps queue whole-site rollback or individual-page unpublishing. Rollback uses the original artifact and restores its database publication snapshots; unpublish retains the draft/history. The local development workspace keeps its existing local publication workflow and does not pretend to have hosted release status.

This rollout requires migration `202609100008_builder_releases.sql`, the updated publishing function, the new VPS worker and server-only release credentials together. See [the coordinated setup and recovery guide](website-releases.md#coordinated-builder-publication). Hosted Publish refuses to promote data until its coordinator setup flag is enabled. No live migration, function deployment, secret change, GitHub push or public release has been performed here.

Verified locally: all 91 unit/database/HTTP tests passed; the 241-file typecheck had zero errors/warnings (155 hints); the full production website/Studio build and publishing function Deno check passed. Database tests cover frozen three-page publication, newer drafts, single ownership, permissions, stale input, rollback reconciliation, unpublish, URL reservation and code/CMS queue isolation. Worker tests exercise real files/HTTP with a controlled Nginx adapter, including a definitive database rejection, lost committed acknowledgement and an unavailable outcome check. A Chromium test exercises the shipped Releases panel with a controlled service boundary; it does not establish hosted authentication as tested.

A separate 26-route Astro build used exactly three frozen builder snapshots while excluding 114 unrelated published fixture pages. Real Nginx verified that artifact's 196 files and six marker/page responses; Chromium checked all three selected pages at mobile width and the compiled builder entry. The original real-Nginx activation/failure/rollback scenarios also passed again. The following increment adds private previews; editable redirects, pre-worker GitHub job diagnostics, actual hosted publication/rollback and representative real UI8 compatibility remain goal work.

## Saved private preview links

Open a page's **Preview** window, choose **1 hour**, **24 hours** (default), or **7 days**, then select **Save private preview link**. Copy or open the returned link. It stores the current rendered page configuration independently of its editable draft and public publication. Shared definitions, images and the currently loaded Sanity content are resolved before saving, so later draft/site/CMS changes do not change that preview. A saved preview does not publish a page.

Links open under `/builder/?preview=<id>`. The hosted viewer requires an existing authorised builder editor account on every read. A link is an identifier, not an anonymous access token. Other authorised editors in the same workspace can view and revoke it; external reviewers without editor access cannot. Anonymous and non-editor users cannot read the private table or use its create/read/list/revoke RPCs. The preview viewer loads the snapshot without downloading the rest of the editing workspace.

Use **Private previews** in the dashboard to list active links, open a saved copy or revoke it. The open viewer rechecks access every ten seconds and when its window regains focus, and clears the frame on an error, revocation or expiry. A timer also removes it at the returned expiry time. Previously viewed copies cannot be recalled. Existing media assets retain their storage policy: these controls protect page composition and preview access, and do not make already-public image/font URLs private.

The same reviewed React renderer and visitor interactions power inline and saved previews. Forms are marked as preview-only and do not submit enquiries. Desktop, tablet and mobile widths are available. Both the builder shell and preview document retain noindex; links do not create sitemap entries. Referrer metadata prevents the preview URL being sent to external resources through ordinary browser referrers.

Apply `202609100009_builder_previews.sql` after the builder migration to enable hosted previews; no new edge function or server credential is required. The Supabase Auth redirect allowlist and email templates must preserve the builder preview query when signing in from a link. Restrict approved returns to the intended builder origin/path; see [Supabase's redirect URL and email-template guidance](https://supabase.com/docs/guides/auth/redirect-urls). The return from an actual hosted magic-link email remains unverified here.

There can be at most 50 active previews per workspace, each subject to the page document's two-million-character JSON limit and a seven-day lifetime. Revocation clears the stored document and retains an ID tombstone so an old creation retry cannot revive the link. Expired documents are cleared when another preview is created; expired IDs stay reserved. Preview records are operational data, outside editable project backups, React exports and public release artifacts.

Local previews use the existing loopback-only builder API and separate `previews/` records in its chosen workspace. They survive reload/restart on that computer, while the local server is available, and do not provide remote editor authentication. Local reads require the builder request header and origin checks. The dev-server filesystem deny list now also protects the entire configured private workspace, including direct and `/@fs/` requests; approved media is served through the existing media handler. This closes a reproduced direct-file access gap without publishing preview storage.

Verified locally: 97 unit/database/HTTP tests passed, including the actual preview migration's anonymous/non-editor denials, access by a second authorised editor, immutable retries, expiration, revocation/tombstones and limits. The complete 17-scenario browser suite passed. The new browser scenario saves and reopens a preview, preserves it after a later draft edit, checks mobile spacing, verifies that its form sends no enquiry, revokes from the dashboard and inline controls, and checks removal from an already open viewer. Direct and `/@fs/` preview/workspace file requests were denied; the normal local workspace file returned 403 to a separate direct HEAD probe as well.

The full production site/Studio build passed. The 245-file typecheck reported zero errors/warnings and 155 hints. A scan of 155 emitted text files found no saved-preview fixture content or preview-storage directories, and verified builder noindex, sitemap exclusion and referrer metadata. Changes remain local, uncommitted and undeployed. Hosted migration/authentication, magic-link return, deployment/rollback and real UI8-pack compatibility remain unverified; the full goal is still active.

## Editing URL redirects

Open **Builder → URL redirects**. Add an old URL, select or enter its destination and choose temporary (302) or permanent (301). Save the redirect draft, then use **Review redirect publication** to inspect additions, changes and removals before publishing. Published rules and saved history are available below the editor. Restoring history places rules into the editor; save and publish explicitly to activate them. Destination suggestions include published builder pages and existing public pages.

Local publication applies to the running local site only. Cloud publication uses the verified release queue; **View releases** shows progress. Drafts and newer saves remain separate from the frozen release. Both trailing-slash forms preserve incoming query parameters. Publish a destination or moved page before publishing its redirect; current pages, existing site sections and editor/service URLs cannot be claimed as redirect sources. The production build rejects loops, conflicting rules or destinations missing from the generated site.

Editable project backups retain redirect drafts, published reference rules and bounded history. Restore replaces the redirect draft while retaining the destination workspace's published rules. React exports include `redirects.json`, `hosting/nginx-redirects.conf` and `REDIRECTS.md`; install equivalent rules on the destination host to produce HTTP 301/302 responses. Vite preview does not automatically activate host redirects. Destinations outside the exported pages appear in the export warnings.

Hosted setup requires migration `202609100010_builder_routes.sql`, the updated publish function and release worker, after earlier migrations and with no release pending. See [website releases](website-releases.md#builder-url-redirects). All implementation changes are currently local; this does not establish that production has been upgraded.

### Redirect verification on 10 September 2026

- 103 unit/database/HTTP tests passed across 20 files. The added database suite applies the actual redirect migration and verifies editor permissions, public/draft isolation, frozen publication, rollback, source reservations, failed requests and atomic draft-only backup restoration. A backup ZIP also round-trips redirect rules/history.
- All 18 browser scenarios passed, including the redirect editor: save/reopen, explicit publication, both slash forms, tracking query preservation, later draft isolation, history restoration and removal. The test reproduced an Astro trailing-slash 404 ahead of the local handler; a separate public-redirect middleware now runs before that guard while editor APIs retain their existing checks.
- The full production site and Studio build passed using a frozen three-page fixture. The build reproduced a generated CSS filename containing `@`; available-path checks now ignore filenames outside the permitted redirect syntax without broadening the rule syntax.
- The complete 265-file artifact passed eight marker/page/redirect HTTP checks through a real isolated Nginx process. Browser checks covered all three mobile pages and the compiled builder entry. Recovery checks detected lost-query redirects and restored the exact prior release. Generated redirect metadata/config remain outside the retained public root.
- The exported four-page React project passed independent typecheck/build and browser checks. Its form was configured only for the smoke test's local receiver, following the export setup instructions. Export build/browser verification is now included in builder CI; Linux CI has not been run here.
- Main typecheck: 249 files, zero errors/warnings, 155 existing hints; a final TypeScript check also passed. Deno checked the updated publish function. Builder noindex and sitemap exclusion were verified in generated output.

Changes remain local, uncommitted and undeployed. Actual hosted sign-in, cloud storage, migration rollout, VPS publication/rollback and representative UI8 pack compatibility remain unverified. The full builder goal is active. Screenshots and detailed command logs are in the ignored `test-results/` directory; no personal workspace was changed by these checks.
