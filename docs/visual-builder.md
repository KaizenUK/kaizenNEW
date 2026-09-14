# Kaizen visual builder

The builder lives at `/builder/`. It creates builder pages and edits safely matched content in existing Astro/React pages through the [existing-site canvas](#existing-site-canvas). Original source and CMS ownership are preserved. See [client projects and handoff](builder-client-projects.md) for repository integration, and [the current handover](../HANDOVER.md#linux-continuation--12-september-2026) for deployment and acceptance status.

This guide describes current behaviour. Earlier incremental results are retained in [verification history](builder-verification-history.md); historical statements there are not the current feature status. Deployment setup and recovery are documented in [website releases](website-releases.md).


## In-app help

The builder’s Learn more links render the marked sections below. These short sections describe user actions; the detailed reference continues afterwards.

<a id="help-pages"></a>
<!-- builder-help:pages -->
## Pages

Open a page from the list to edit it. Choose **Blank page** or **Browse templates**, preview a layout, then **Use template**. In an empty builder project, **Start with a website** creates six pages with shared navigation and a footer. Replace the samples before publishing.

### Start here

The new-project checklist links to each step:

1. Name your site: rename it in Projects.
2. Choose a site design: save your design.
3. Add a page: create and edit a page.
4. Preview it: open the rendered preview. Changed content needs another preview.
5. Publish: review through Releases. Only a verified live release completes this step; unpublishing clears it.

Dismiss the card or reopen it with Show start here. This browser remembers each account and project's checklist. Blocked storage limits it to this visit. Existing websites keep their usual Pages screen.

### Page status

- **Draft** means edits have not been saved.
- **Saved** means edits are kept; they may still need publication.
- **On staging** means this version has been checked on staging.
- **Live** means this version has been checked on the live website.

The Saved filter includes new pages and newer saved changes. Previous versions can remain live. See [editing website pages](#help-source) or [publishing changes](#help-releases).
<!-- /builder-help -->

<a id="help-projects"></a>
<!-- builder-help:projects -->
## Projects

Each project holds one website's pages, assets, styles, history and access. Open a project before editing its website.

Use a project's menu to rename, duplicate or archive it. A duplicate copies editable content and history but starts without service connections, a publishing destination or private preview links. Archiving removes a project from the normal list; **Show archived projects** lets an owner find it again.

The original Kaizen workspace keeps its existing files. Project access is managed separately: see [People and access](#help-people).
<!-- /builder-help -->

<a id="help-site"></a>
<!-- builder-help:site -->
## Site design

Site design holds shared colours, fonts, headers, footers, reusable components and named design values. Upload a font in Assets before choosing it here. A page uses the shared theme when **Use site styles** is selected in its Page settings.

Editing a shared component affects every linked instance. A saved section copy is independent. Review which pages use a shared component before changing it.

Save changes first, then review publication. Publishing shared design can also publish the current drafts of pages that use it, including their other pending edits. Restoring history puts the earlier design into the form; it does not publish it.
<!-- /builder-help -->

<a id="help-assets"></a>
<!-- builder-help:assets -->
## Assets

Import images, icons, fonts or a ZIP pack here, then place them from the editor's Assets panel. The library is shared by pages in this project.

Choose an asset to inspect its preview, source and licence, references and replacement options. **Import starter illustrations** adds two original SVGs and their licence through the normal pack importer. Keep the licence or source record with imported material. Code and design files can be saved as references; they need a reviewed implementation before they become usable blocks.

An interrupted import can be resumed while this browser still holds its recovery data. Clearing browser storage removes that recovery copy. Review reported errors before reimporting a pack; an existing file may already be available.
<!-- /builder-help -->

<a id="help-releases"></a>
<!-- builder-help:releases -->
## Releases

Saving a draft, exporting a website and publishing are separate actions. Review the saved content and destination before starting a release.

1. For an existing website, **Save to website** sends the applied changes to staging.
2. Open staging and check the result. In Releases, choose **Review staged website**, then **Publish reviewed changes** when the review is right.
3. For builder projects, choose the destination and **Review saved project for publication**, then publish the reviewed project.

**Queued**, **Building** and **Checking website** describe progress. **On staging** and **Live** identify confirmed destination versions. A failed or unavailable check does not prove the new version is live.

**Earlier release** has been replaced; review restoring it if needed. Taking a website or page offline is also a separate reviewed action. Drafts and history are kept. A website owner or server administrator connects missing destinations through the project's setup.
<!-- /builder-help -->

<a id="help-redirects"></a>
<!-- builder-help:redirects -->
## Redirects

A redirect sends visitors from an old address to a replacement page. Enter internal paths such as `/old-offer/` and `/new-offer/`, and publish the destination page first.

Save the rules, review added, changed and removed redirects, then publish when ready. Restoring history changes the draft only. Update affected redirects before changing a destination page's live address.

Temporary redirects use 302. Browsers can remember a permanent 301 after it changes. Rules preserve tracking query parameters; external destinations and regular expressions are not supported. Existing website and editor routes are protected.
<!-- /builder-help -->

<a id="help-previews"></a>
<!-- builder-help:previews -->
## Private previews

Create a saved link from a page's **Preview** screen. It captures that version of the page so later edits do not alter what the reviewer sees. Choose when the link expires.

Hosted preview links require an authorised editor account for the project; possessing the link does not grant access. Local preview links need the local helper and workspace to remain available. Forms do not send enquiries in a preview.

Revoking a link stops future visits. A copy someone already opened cannot be recalled. Use [Releases](#help-releases) when the website should become public.
<!-- /builder-help -->

<a id="help-backups"></a>
<!-- builder-help:backups -->
## Backups

A project backup keeps content editable in the builder: pages, shared design, revisions, saved sections, settings and the asset library. A website export is a separate [developer handoff](#help-repository).

Review a backup before restoring it. Restore adds or updates drafts and preserves current publications and unrelated pages. Old published snapshots become history, not live pages.

External media, CMS content and form services stay external. Account credentials, enquiries, private preview records and deployed releases are not included. For an original website folder, use its separate [folder-backup controls](#help-folder); restore into a new empty folder.
<!-- /builder-help -->

<a id="help-repository"></a>
<!-- builder-help:repository -->
## Export & handoff

**Download website ZIP** contains the finished website, source and developer instructions, plus an editable project backup. The developer can build and host the exported website independently. Review its handoff notes for external content, forms and redirects.

The website folder controls open existing source and review changes before applying them. Applying to a folder, saving to staging and publishing are separate actions. Existing source stays authoritative; unreviewed or conflicting files are not silently replaced.

Hosted projects use the configured server folder. A developer can choose [a helper on this computer](#help-helper) in a separate tab. Use [Backups](#help-backups) for an editable project copy, or [Website folder backups](#help-folder) for original source.
<!-- /builder-help -->

<a id="help-settings"></a>
<!-- builder-help:settings -->
## Settings

Set the public website address, favicon and optional form or CMS connections here. Saving settings does not publish them; export, integrate or publish again when the reviewed website is ready.

The website address is its public HTTPS origin, without a subfolder. An empty address omits the sitemap from the export. The form receiver must follow the exported website's form contract; leaving it empty disables delivery. A stored enquiry does not confirm email delivery. Public Sanity connections read published documents using the Kaizen post, category and author schema; exports contain a snapshot. Private content needs a server integration.

Owners can configure the hosted website folder and use **Show developer details** to switch between client and developer views. This changes presentation, not permissions. Your view choice is remembered for this account and website in this browser. Use **Report a problem** to copy or download diagnostics for the owner. The signed-in hosted builder also sends safe error summaries to Kaizen automatically; older reports are cleared.
<!-- /builder-help -->

<a id="help-account"></a>
<!-- builder-help:account -->
## Account

Your name and verified email identify the website changes you save. Enter your own name here if Save to website asks for account details.

Email and password changes may require confirmation or a code sent to your existing address. Follow the result shown after submitting; a requested change is not always immediately active.

You can sign out other sessions without ending this one. Account deletion removes login and project access while retaining website content and history. An owner must review another editor's deletion request. Keep the on-screen confirmation and ownership requirements in view before confirming.
<!-- /builder-help -->

<a id="help-existing"></a>
<!-- builder-help:existing -->
## Existing site pages

This inventory lists routes from the original website, its CMS and redirects. It updates when the website is built.

Open a supported source page to edit its matched text, links, images and sections in the [website page editor](#help-source). CMS-managed content remains with its CMS; a route can explain when it needs a developer.

Existing routes are reserved. Build a new builder page at a different address, and review any later ownership change before replacing an existing route.
<!-- /builder-help -->

<a id="help-editor"></a>
<!-- builder-help:editor -->
## Page editor

Use Blocks to add content, Layers to select nested items, and Design to change appearance. Page settings control the title, address, shared styles and search description. Undo and Redo follow your edits.

Edits autosave. **Draft** remains visible until saving is acknowledged; keep this window open if saving fails. Preview checks the resulting page without publishing it. Device controls show desktop, tablet and phone layouts.

Revisions restore an earlier version as a draft. Shared design can affect other pages, so review it in [Site design](#help-site). When ready, [review publication](#help-releases).
<!-- /builder-help -->

<a id="help-source"></a>
<!-- builder-help:source -->
## Website page editor

Build the website preview when asked, then double-click matched words to type. Select links or images to change them, and move supported sections using their handles. Outline and the canvas share the same edits and undo history.

1. Wait for **Saved** after editing; these are private changes for review.
2. Choose **Review my changes** and check the Before and After values.
3. **Apply changes to the folder** writes only the reviewed changes and rebuilds the preview.
4. **Save to website** sends the applied changes to staging. Check staging before [publishing through Releases](#help-releases).

The **Edit text and links** fallback offers matched fields when direct canvas editing is unavailable. Grey or computed content explains where it is managed. Supported registered components expose their existing design values; arbitrary source layouts are not converted into builder blocks. A failed build leaves edits available. Reconnect an interrupted helper and check the saved state before retrying a write with an unknown outcome.
<!-- /builder-help -->

<a id="help-people"></a>
<!-- builder-help:people -->
## People and access

An owner invites people by email and manages their access to this project. An editor can change content; **Can publish** is a separate permission. Owners can also manage project setup and membership.

An invited person follows their email link to set a password and sign in. Use Resend when a fresh invitation is needed. Check the result after sending; a request accepted by the email service does not prove the recipient has read it.

Removing a member ends their project access. Client and developer views only change the information shown; they never grant extra access.
<!-- /builder-help -->

<a id="help-helper"></a>
<!-- builder-help:helper -->
## Website helper

The hosted helper opens the website folder configured for this project. Your sign-in controls access; nothing needs to run on your computer. Refresh the connection if it stops responding.

For the developer's local path:

1. Open a terminal in the Kaizen folder and run `pnpm dev`; leave it running.
2. Paste its address into Helper address and choose **Connect helper**.
3. In the approval window, check the project and folder, then choose **Allow this folder**. Keep that window open while editing.

Reconnect to the same folder to continue. Choose another folder in a separate tab, and restore a folder backup into a new empty folder. Switching helper paths opens a separate tab so open edits stay with their original folder. Saving to the folder and publishing remain separate steps.
Preview builds run the folder's own scripts. Check unfamiliar code before confirming the build review. Install dependencies first when using a local helper. Preview forms and network calls are disabled; a failed build restores the previous output.
<!-- /builder-help -->


<a id="help-folder"></a>
<!-- builder-help:folder -->
## Website folder backups

A folder backup keeps original source, images, settings files and this project's unapplied edits. It restores a website folder; it is different from an editable builder-project backup.

Close page editors before preparing the backup, then review its file list. Installed packages, build output, Git history and private settings are excluded. Limits are 35 MB for a ZIP, 200 MB of unpacked files and 32 MB per file.

Restore into a new folder whose parent already exists. Existing folders are never replaced. With the local helper, restore into the new empty folder you approved; use another builder tab to approve a different folder. Nothing is installed, built or committed by restoring. Reconnect the folder afterwards and review any remaining setup.
<!-- /builder-help -->


## Private beta and problem reports

The sidebar footer identifies this release as **Private beta**. Open **Settings → Report a problem** to copy a technical report, then share it with Kaizen along with what you were trying to do. **Download report** saves the same JSON when clipboard access is unavailable, and **View report** shows exactly what will be shared. Settings remains available if the project cannot load. The original workspace's website connections continue to be managed by the owner.

Reports contain the project ID, screen, builder page ID or a one-way SHA-256 reference for a source route, browser family/major version/platform, helper mode/state, and the latest error category and time. Raw errors and stacks, page content and titles, source paths, full browser strings, helper connection details and sign-in credentials are excluded. Error summaries come from fixed categories; a report does not copy arbitrary exception text. Caught storage/helper failures and browser errors update the in-memory record without suppressing errors or changing the original response. The failing page reference is retained when you leave the editor to open Settings. Local helper health is marked `not-checked`; the report does not infer that a server is still running. This record clears when the account changes and is not persisted to browser storage. Copying or downloading a report does not send a message to anyone.

In the signed-in hosted builder, safe error summaries are also sent automatically through the existing projects service. The server attaches the verified account and selected project IDs and its own receipt time; it stores only the diagnostic fields above, not the copied report, raw exception text or client clock. Database operators can inspect them using the [error visibility runbook](website-releases.md#builder-error-visibility). Ordinary project owners and editors cannot read the operator table. Reports older than 14 days are deleted by an hourly database job. The local builder and signed-out screens do not send reports.

Repeated failures are limited, and reports are discarded if the account changes while preparing them. Failed delivery is not retried or saved to a browser queue and never blocks editing. A disconnected browser cannot report its own outage until a later distinct failure can reach the service, so the absence of reports is not proof of a healthy service. Helper request failures and failed preview build results use the same safe reporting path; the server-hosted helper itself is part of L1.

## Browser support

Core account, editing, Save, template and import-recovery journeys are checked in Chromium, Firefox and WebKit. Hosted website editing uses the protected HTTPS helper. Rebuilding opens a fresh canvas, including the original page's supported React interactions. Interrupted imports retain portable recovery bytes in this browser; recovery packs saved by earlier versions remain readable.

For the local developer path, Safari/WebKit blocks a hosted HTTPS editor from embedding the helper's HTTP loopback preview. Open **the local builder** at the address below to edit that preview, or use the hosted helper. The connection message explains these choices. Chromium and Firefox also retain their tested local-helper path and its consent requirements.

The automated WebKit checks run on Linux. They do not constitute manual Safari testing on macOS or iOS. The [launch task map](builder-launch-plan.md#l5-t1--core-journeys-in-three-browser-engines-14-september-2026) records the current evidence and remaining manual acceptance. `pnpm test:builder:browser` runs all three engines against isolated fixtures; milestone CI runs the extra engines in separate jobs.

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
- **Pages** lists every page with a live thumbnail, a status pill using the shared saved/publication language, filter tabs, search and sorting. **Saved** includes both new pages and newer saved changes; **Live** includes pages at their current production baseline. The purple banner creates a blank page or the starter template.
- **Assets** opens the same library that the editor shows in its Assets panel, so packs can be managed without opening a page.
- The editor keeps undo/redo, device preview, the page URL, save status, Save, Preview, Export ZIP and Publish in one top bar. The left panel offers Blocks (searchable, ready-made sections first), Assets and Layers; the right panel offers Design, Page, Styles and Revisions. Selected blocks can be copied, pasted, duplicated or deleted from the inspector header.
- **Publish** opens a check first: a search-result preview and a short list covering title, URL, shared header/footer, search description and indexing. Publishing proceeds from that dialog; nothing goes live from the top bar directly.

## Saved and published states

Pages, the editor header/footer and Releases use these labels:

| Label | Meaning |
| --- | --- |
| **Draft** | Current edits have not yet been saved. Keep the editor open while saving, or when saving needs attention. |
| **Saved** | Edits are kept. They may still need review, apply or deployment. Saving does not publish them. |
| **On staging** | The observed version is on staging. Check it before publishing. |
| **Live** | The observed version is on the production website. |

A new edit returns to Draft, then Saved after acknowledgement. A saved private source draft stays Saved even when an older version of that page is live. Builder-page badges compare saved edits against the verified production snapshot; when a staging baseline is unavailable they conservatively stay Saved. Local preview publication alone does not establish a public release.

For hosted source pages, destination labels require a clean website folder, a successful deployment workflow for its exact version, and a matching destination release marker. Unrelated folder edits keep this whole-folder observation at Saved; a Save receipt can separately confirm that its particular changes reached staging. Unavailable tracking stays Saved. The marker identifies a version; it does not replace checking the rendered page.

Releases also show progress and exceptions: Queued, Building, Updating website, Checking website, Update failed, Previous release restored and Recovery needs attention. **Earlier release** means a verified release has been replaced. **Offline** means an active unpublish operation took that destination offline. Staging releases never use the Live badge.

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

**Download website ZIP** includes all page drafts, resolved shared content/CMS data, React/TypeScript components, responsive CSS, bundled media/fonts, SEO/page data, a static build and developer instructions. Source/design/licence references remain outside executable source. There is no Puck, Supabase/Sanity connection or credential requirement in the generated project.

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

Hosted projects connect to their configured website folder automatically after sign-in. **Export & handoff → Hosted helper** shows the connection and offers **Refresh connection**. The hosted service provides source editing, saved drafts, queued builds, protected previews, Save to website and explicit publication through Releases. Developers can still choose the approved local helper. See the launch task map for the distinction between currently deployed milestones and newer launch-branch work.

Hosted builds show their queue position, progress and bounded build log. **Cancel build** removes a waiting job or stops a running one and restores its previous output before reporting cancellation. You can keep saving editing drafts while a build runs; applying changes to the website folder waits until it finishes. Reopening the page resumes an active job and preserves a failed or cancelled result. Choose **Try building again** or **Build again** when ready to retry. Jobs and logs expire when the helper restarts. A finished build only offers a preview when the protected preview service has supplied one.

To use the developer fallback, choose **Use a helper on this computer**. This opens a separate tab for the same project with `helper=local`, then asks for the familiar folder approval. The helper choice stays fixed for that tab, including after disconnection: a failed hosted call never moves to a local folder, and an ended local connection never falls through to the server. Returning to the hosted helper also opens a separate tab so open drafts and reviewed plans keep their original folder. Direct local builder sessions continue to use the local workspace.

1. Open the project and wait for its hosted helper to connect. For the developer fallback, choose **Connect helper** in the separate local-helper tab and approve its website folder with **Allow this folder** in the local window.
2. Return to **Pages → Pages from the website's code → Edit**. Check the command and choose **Build** when first asked. Later builds reuse approval only within the same connection and for unchanged scripts.
3. Double-click matched words to type, select a link to edit its text/address, use **Replace image** for project Assets, and move supported sections with their handles or drag. Outline and Selected show the same draft. Grey content explains why it is managed elsewhere.
4. Choose **Review my changes**. Read the **Before** and **After** values for text, link addresses, image choices, supported design values and section order. Changes to shared content explain their effect on other pages. Choose **Apply changes to the folder** when the review is right; only reviewed changes are written and the preview rebuilds afterward. If your edits change during review, review again before applying.
5. On a hosted website, choose **Save to website** to send the applied changes to staging. If Account details are required, open **Account details** and enter your own name and email. An interrupted or unconfirmed save explains whether to check its state, retry, or ask the website owner for help. Open staging to check the result; publishing remains a separate action in Releases. On the developer's local-helper path, **Commit these changes** keeps the existing explicit commit and GitHub Desktop workflow.

In **client view**, the footer shows the page, editing state and Save action. Source paths, branches, commits, change-summary input and deployment diagnostics are hidden. The review shows readable values, with image names instead of generated source paths. In **developer view**, the same review also offers each changed source file and **Show the whole file**; the footer retains Git state, editable change summary and Save details. Owners choose their view in **Settings → Show developer details**. This changes presentation only: source checks, account identity, membership, commit isolation and separate publication still apply.

A disconnected or restarted helper shows **Reconnect** while retaining edits. Hosted connections follow the verified sign-in and server lease: expired or revoked access stops requests and keeps recovery available. **Keep connected** refreshes hosted sign-in; on the local-helper path it requests approval again before that helper session expires. Account changes cancel pending requests and keep source recovery separate by account, project, transport and folder. Operations with an unknown outcome are not retried automatically: review the folder before retrying a write. If framing fails, use **Open the preview in a window**; **Open in the local builder** remains available for a paired local helper. Chromium may require Local Network Access permission for that local path. Firefox/Safari checks were waived by Sean; they are not claimed as verified.

Existing native pages have a separate page editor inside the same builder chrome. A paired local helper provides a cookie-free, token-prefixed canvas snapshot. Hosted previews must use this project's first-party `/editor-preview/<project>/…` path and run in an opaque sandbox, including window previews; project scripts cannot read the editor's storage or parent document. Messages still require the expected frame window and nonce. Opaque frames use origin `null`; only messages sent to that already validated frame use a wildcard target origin. The bridge has no helper capability or sign-in token. Snapshots retain `connect-src 'none'` and `form-action 'none'`, and permit framing only by the connected editor origin and themselves. Actual authenticated hosted preview/asset serving and its verification remain L1-T4; the transport browser fixtures are not evidence of production cookie enforcement.

The canvas and Outline share one draft, undo/redo history and source-review process. Desktop/tablet/mobile widths are 1280/768/390. Large outlines render a bounded window of rows. Project Assets can replace source images, and verified groups can move on the page. The original Astro/React files, imports, scripts and hydration remain the source of truth; apply patches their original byte ranges.

Registered builder blocks emit their registration and block IDs. Their existing literal numeric and colour design values appear with the supported registered content fields; computed styles remain with code. Builder-owned pages retain the established visual design controls. Unregistered native components retain content-only editing. See [the client editing journey and exact Git behaviour](builder-client-projects.md#on-page-editing-september-2026-implementation) and [the milestone acceptance log](existing-site-visual-editing-plan.md).
