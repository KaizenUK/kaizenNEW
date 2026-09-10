# Kaizen visual builder

The editor lives at `/builder/`. It has `noindex, nofollow`, is excluded from `sitemap.xml`, and does not load the public site's tracking, navigation or editor-session cookie. Published pages are generated separately from explicit published snapshots.

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

1. Apply `supabase/migrations/202609100001_visual_builder.sql` to the existing Supabase project. It creates editor membership, protected drafts/assets/reusable data, public published snapshots, and media/source storage buckets. Use `pnpm exec supabase db push` with an authenticated, linked CLI, or apply the reviewed migration through the Supabase SQL editor.
2. Create/invite the intended editor in Supabase Auth, then add their existing Auth UUID to `public.builder_editors`. The app does not allow self-registration or self-granting editor access. For example, an administrator can run `insert into public.builder_editors(user_id) values ('EDITOR_AUTH_UUID');`.
3. Allow `https://kaizenweb.co.uk/builder/` as a Supabase Auth redirect URL. Enable the email sign-in provider and configure delivery.
4. Set `VITE_BUILDER_CLOUD=1`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in the site build environment. These are public configuration; never place a service-role key or GitHub token in a `VITE_` variable.
5. Deploy `builder-publish` with the Supabase CLI. Its handler independently calls `auth.getUser(jwt)` and checks `builder_editors`. Set `ALLOWED_STUDIO_ORIGINS` to include the public site and authorised local/staging origins. Supply the existing `GITHUB_DEPLOY_TOKEN`, `GITHUB_DEPLOY_REPO`, `GITHUB_DEPLOY_EVENT_TYPE=sanity-update`, and `GITHUB_DEPLOY_TARGET=main` function secrets. The GitHub token needs permission to send a repository dispatch.
6. Deploy the site using the existing GitHub/VPS workflow. Both the VPS build environment and any CI build that must include builder publications need the public builder configuration. A build fails if the enabled publication store cannot be read, so a transient backend failure cannot silently remove the pages.
7. Sign in at `/builder/`, run the sample workflow and verify a deployed page anonymously. Also verify that an unauthenticated user and an authenticated non-editor cannot read drafts, upload files, or invoke publishing. Production auth, RLS, storage and deployment require a real configured environment to verify.

Publishing saves the snapshot and queues the existing static-site deployment. The UI says “deployment queued”; it does not claim the public site changed immediately. If repository dispatch fails, the committed snapshot/version is returned and the user is told to retry. A failed build leaves the currently deployed site in place. URL changes remove the old generated page on the next `rsync --delete` deploy; redirects for old URLs must be managed separately.

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

The included `.fig` is explicitly a classification placeholder, not a valid design. Real UI8 packs have not been supplied. Compatibility with a particular UI8 pack, complex SVG artwork and all font/image variants requires testing with those files. Import limits: 50 MB per file, 250 MB compressed ZIP, 500 MB expanded batch, 2,000 files. Encrypted/nested archives are not recursively unpacked. Duplicate detection compares content hashes within the same pack/path; corrected files with different bytes can be retained as separate assets. Supplied folder paths and filenames remain in metadata even though storage uses safe UUID filenames. Interrupted batches can be retried; completed duplicates are skipped. Uploads are not resumable across network disconnects.

The Inter sample is from the [Google Fonts Inter directory](https://github.com/google/fonts/tree/main/ofl/inter), distributed with its SIL Open Font License. The SVG samples are original demonstration graphics. The PNG is the existing site logo. `node scripts/create-builder-sample.mjs` rebuilds the sample ZIP from checked-in source assets.

## Architecture and verification

- `shared/visualBuilder.ts`: versioned data contract and validation; optimistic save versions; draft/publication separation.
- `client/visual-builder/config.tsx`: Puck component registry and fields. Temporary asset drawer aliases are canonicalised to Image/Icon before storage/export.
- `client/visual-builder/Renderer.tsx` and `page.css`: React rendering shared by editing, preview, static Astro output and developer exports. Published routes have no Puck import or React hydration directive.
- `scripts/builder-local.ts`: loopback-only local persistence and dev media delivery; atomic file replacement and serialised writes.
- `src/lib/builderPublished.ts` and `src/pages/[...slug].astro`: build-time public snapshots. Existing Astro/public URLs are reserved; conflicting Sanity routes fail the build.
- `supabase/migrations/...` and `supabase/functions/builder-publish`: shared persistence, access control and deployment dispatch.

Run `pnpm test`, `pnpm typecheck`, and `pnpm build:site`. The tests cover URL reservations, lost-update rejection, live/draft URL collisions, revision isolation, nested IDs, asset classifications, ZIP paths, static HTML escaping, and project export contents. Set `BUILDER_EXPORT_FIXTURE=1` while running tests to write the generated standalone project to `test-results/export-project/`; install its dependencies and run its build/typecheck separately. Browser checks remain necessary for dragging, inline editing, preview scaling, actual font/image decoding, and published output.

Remaining product boundaries: the editor is designed for a desktop workspace; phone-sized screens preview the published page rather than offering a full phone editing UI. Saved sections/templates are reusable copies, not linked instances. Site deployment completion is not live-polled. Uploaded component/design conversion is developer assisted. No automatic deployment of newly uploaded source code occurs.

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
