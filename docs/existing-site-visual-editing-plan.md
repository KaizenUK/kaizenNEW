# Existing-site visual editing — end-to-end task map

Prepared 12 September 2026 for Codex, after the UX/copy pass. Read `HANDOVER.md` and `docs/handover/claude-ux-brief.md` first; this document turns their open requirement (“edit existing websites visually, not just source-content fields”) into ordered, testable tasks.

## The journey we are building

1. Sean signs in at the hosted builder and opens a client project.
2. He clicks **Connect helper**, approves the website folder in the helper window (already works).
3. **Pages** now lists the website's own pages (from its code) next to the builder pages.
4. He opens one. The editor shows the real page in the canvas. Editable words, links and images light up on hover; anything driven by code or the CMS is outlined grey with a plain reason.
5. He clicks a heading and types. He swaps an image from Assets. He drags a section up. Every change is saved on his computer as he goes; the outline in the sidebar shows the same changes.
6. **Review my changes** shows exactly which files change. **Apply** writes them into the folder. **Commit** records them in Git with a message. Pushing and publishing happen the way the site already does (GitHub Desktop, then the site's own deploy).

Everything happens in one place: the hosted editor at `kaizenweb.co.uk/builder/`, with the helper on the user's computer doing the file work. No popups except the helper approval window.

## Ground rules (carried over from the handover)

- Never rewrite or “convert” the site. Edits patch the original files through `scripts/builder-source-editing.ts`; imports, styles, scripts and hydration stay untouched.
- Say what cannot be edited and why. Computed values, CMS content and layout of unregistered components stay outside the editor's reach and must be shown as such where the user meets them.
- Builds run only after the user has seen the command once per session; no install, push or destructive Git command ever runs automatically.
- Drafts survive reloads, disconnects and file changes (`useSourceEditingDraft`, `scripts/builder-source-drafts.ts`). Recovery must never lose typed text.
- Tests use isolated fixtures (`tests/builder`, ports from `tests/builder/ports.ts`), never Sean's `.kaizen-builder` or a real client repository.
- Do not mark a milestone done because a test passes against a fixture; walk the journey in the browser at desktop and phone width.

## What already exists (build on it, do not rebuild it)

| Capability | Where |
| --- | --- |
| Pairing, capabilities, 2-hour session, approved-root checks | `scripts/builder-companion.ts`, `client/visual-builder/companionConnection.ts`, `CompanionWindow.tsx` |
| Route discovery and ownership (builder page, managed in code, needs a developer) | `scripts/builder-repository.ts` (`inspectRepository`) |
| Editable text/link/image fields with exact byte ranges, section groups, boundary reasons | `scripts/builder-source-editing.ts` (`inspectSource`, `editSource`), `shared/builderSourceEditing.ts` |
| Local drafts per project/repository/route, stale detection, recovery download | `client/visual-builder/useSourceEditingDraft.ts`, `scripts/builder-source-drafts.ts` |
| Reviewed build with consent, retained previous output, private snapshot server on 127.0.0.1 for one hour | `scripts/builder-runner.ts`, `client/visual-builder/RepositoryBuild.tsx` |
| Click-on-the-built-page → source field ids (currently in a popup) | `scripts/builder-source-preview.ts` (`sourceSelectionScript`), `client/visual-builder/useSourceSelection.ts` |
| Review → apply with per-file previews and conflict detection | `repository-source-prepare`, `repository-prepare`, `repository-apply` in `scripts/builder-repository.ts`; UI in `RepositoryPanel.tsx` |
| Content outline UI (rows, click to edit, edited markers) | `client/visual-builder/SourcePageEditor.tsx` |
| Registered component contract (fields + one slot) for builder blocks | `shared/builderRegistry.ts`, `docs/builder-component-integration.md` |

The gaps are: the built page is not inside the editor, site pages are not listed as pages, images cannot be replaced from the library, and there is no commit step.

## Architecture decision: hosted editor frames the helper's preview

The editor page (`https://kaizenweb.co.uk/builder/`) embeds the helper's snapshot server (`http://127.0.0.1:<port>`) in an iframe and talks to it with `postMessage`. Loopback origins are treated as potentially trustworthy by Chromium and Firefox, so the HTTP frame is not blocked as mixed content; M0 verifies this before anything is built on it.

Three changes make the snapshot embeddable:

1. `Content-Security-Policy: frame-ancestors` lists the connected builder origin (from the companion session identity) plus `'self'`, instead of `'none'`. Keep `connect-src 'none'` and `form-action 'none'`.
2. The snapshot must not depend on a cookie when framed. Third-party cookies are blocked in an iframe from another site. Serve the framed snapshot under its token path and rewrite root-relative URLs in the built HTML and CSS (`src`, `href`, `srcset`, `poster`, `content`, `url(/…)`, `@import`) to that path prefix. The existing cookie flow stays for the popup and direct preview.
3. The overlay script is injected only into the framed HTML, bound to a per-session nonce, and can only `postMessage` to the parent origin. It can never call the helper.

Fallback if M0 fails in a browser Sean needs: run the same editor in the local builder (`Open in the local builder` already exists, same origin as the helper, no framing restrictions). Design every later task so the canvas code does not care which of the two it runs in.

## Milestones and tasks

Task IDs are stable; reference them in commits (`M2-T3: …`). Each task lists acceptance criteria; a task is not done until its test exists and passes on the isolated fixture.

### M0 — Feasibility spike

- **M0-T1 Prove the frame.** Playwright test: an HTTPS page (use `page.route` on a fake `https://builder.example`) embeds `http://127.0.0.1:<port>/__kaizen-preview/<token>/` from a real runner snapshot with the CSP change from the decision above and path-prefixed assets. Assert the page renders, module scripts run, and a `postMessage` handshake with a nonce completes both ways. Files: `docs/handover/experiments/` (replace the old failed script), later folded into `tests/builder/site-canvas.spec.ts`.
- **M0-T2 Manual browser check.** Repeat in Firefox and Safari (Sean's Mac) with the real hosted site once deployed. Record results in this file under a “Browser support” heading. If Safari blocks the frame, the local-builder fallback becomes the default there.
- **M0-T3 Fix the diagnosis gap.** The old `*.localhost` experiment failed without a cause; do not reuse the random-hostname idea unless M0-T1 fails. Path-prefixing is deterministic and needs no DNS behaviour.

### M1 — Site pages inside Pages, and an editor that opens them

- **M1-T1 Site pages list.** In `PagesView.tsx`, when the helper is connected (hosted) or in the local workspace, show a second section “Pages from the website's code” listing `inspectRepository` routes: title (page `<title>` or first heading from the last inspection, falling back to the route), path, ownership pill, and an **Edit** button. Cache the inspection per root; refresh on reconnect. Acceptance: connected fixture repo shows its routes under Pages; builder pages unaffected.
- **M1-T2 Editor mode for site pages.** New `SitePageEditor.tsx` sharing the editor chrome from `BuilderApp.tsx` (`EditorShell` header: back, project chip, page title, save-status pill, device widths; theme toggle). Left panel tabs: **Outline** (move `SourcePageEditor`'s row list here), **Assets** (existing `AssetLibrary` in compact mode), **Sections** (the reorder list). Right panel: **Selected** (see M2-T4) and **Page** (route, files involved, shared components used). Canvas: the build/preview surface (M1-T3). Acceptance: opening a site page from M1-T1 shows the chrome, the outline and an empty canvas state; “Back to pages” returns to the list.
- **M1-T3 Build orchestration.** `useSiteBuild(root)`: reads `repository-build-status`; if there is no fresh snapshot (files hash from the inspection differs from the build's), the canvas shows one card: “Build a preview to edit on the page” with the command and a **Build** button (this is the consent; keep `repository-build-review` semantics, but once accepted, further builds in the same helper session run without re-asking). Progress state with elapsed time and the log behind a disclosure; failure state shows the error and keeps the outline usable. Acceptance: first open asks once; second open in the same session builds automatically; a failed build leaves the outline editable and offers the log.
- **M1-T4 Connection lifecycle in the editor.** Banner when the helper disconnects (“Not connected. Your edits are safe on this computer.”) with a **Reconnect** button that reuses the last address; a warning ten minutes before the 2-hour session ends with **Keep connected** (re-opens the approval window). Acceptance: killing the helper mid-edit shows the banner; reconnecting restores editing without losing typed text.
- **M1-T5 Kaizen's own site.** The local workspace's `ExistingPages` inventory becomes the same list as M1-T1 (the inventory is the source when no helper is connected). Keep `Edit existing /about/` aria labels so `tests/builder/existing-pages.spec.ts` keeps passing.

### M2 — Click-to-edit words on the real page

- **M2-T1 Embeddable snapshot.** In `scripts/builder-runner.ts`: per-session `frame-ancestors` from the companion identity origin; path-prefixed rewriting of built HTML/CSS for the framed route; new `repository-source-frame` action returning `{ url, nonce, files }` like `repository-source-preview` but for the embedded page. Unit tests in `client/visual-builder/runner.spec.ts` for the rewriter (root-relative attributes, srcset lists, CSS `url()`, already-prefixed URLs, external URLs untouched, `data:` untouched).
- **M2-T2 Overlay v2.** Extend `sourceSelectionScript` into `sourceEditingScript` in `scripts/builder-source-preview.ts`: hover outline (green = editable, grey = managed elsewhere); click → `select {ids}`; Enter or double-click on an editable text element → `contenteditable` on that element only when its text equals exactly one field's value; `input` → `edit {id, value}` (debounced 150 ms); Esc → revert to the last applied value; `apply {id, value}` from the parent updates the DOM; `focus {id}` scrolls the element into view and outlines it. Repeated text: map the n-th DOM occurrence to the n-th field with that value in source order; when it is still ambiguous, send all ids and let the editor ask. Hide the old bottom toolbar when framed. Acceptance: fixture page with a heading, paragraph, repeated “Learn more” links and a CMS-driven quote: heading edits arrive as messages, repeated links map to distinct fields, the quote is grey with a reason.
- **M2-T3 Canvas hook.** Replace `useSourceSelection` with `useSourceCanvas(inspection, frameRef)`: handshake by nonce and origin, receives `select`/`edit`, writes into `values` (same draft hook), pushes outline edits back with `apply`. Undo/redo: a small history over `values`/`orders` wired to the header's Undo/Redo buttons and Ctrl+Z/Ctrl+Shift+Z when focus is not inside the frame. Acceptance: typing in the frame updates the outline row and the saved-on-this-computer pill; typing in the outline updates the frame; undo restores both.
- **M2-T4 Selected panel.** Right panel for the selected field: kind, current text (editable textarea), original text, **Undo this change**, and “Where it comes from”: file and line, “Shared with other pages” when the file is not the route, and the boundary reason when the click hit managed content. Keep the aria labels tests rely on (`Existing page content editor`, `Source editing draft`, `Find page content`).
- **M2-T5 Review and apply inside the editor.** **Review my changes** opens the existing changes card as a modal over the canvas (reuse the `builder-modal` pattern from `PublishDialog.tsx`), **Apply changes to the folder** applies, then M1-T3 rebuilds automatically and the frame reloads to the same scroll position. Acceptance: end-to-end on the fixture: edit → review → apply → rebuilt frame shows the new text → file on disk contains it and nothing else changed (compare hashes of untouched files).
- **M2-T6 Device widths.** The header's desktop/tablet/mobile switch resizes the frame (same widths as builder pages: 1280/768/390). The overlay keeps working at each width.

### M3 — Links, images and sections on the page

- **M3-T1 Links.** Clicking an `<a>` selects both its text field and its `href` field; the Selected panel shows “Text” and “Address”, with the address validated like redirects (`/path/` or `https://`). Acceptance: changing the address updates the frame and the draft; apply writes the attribute with the existing `attribute` encoding.
- **M3-T2 Images.** Clicking an `<img>` (or an element with a `src`/`poster` field) shows **Replace image** in the Selected panel: choose from the project's Assets or upload. Extend `SourceEdits` with `assets: { fieldId, assetId, path }`, and `repository-source-prepare` to add the file into the repository under the folder the current `src` already uses (default `public/images/`), rewriting `src` and, when present, `srcset`. Preview immediately with a blob URL. Alt text edits use the existing `alt` field. Acceptance: fixture image replaced from the library; the proposal lists one added file and one updated page; apply copies the bytes; a second apply does not duplicate the file.
- **M3-T3 Sections.** For each `SourceGroup`, map items to DOM elements by order within the group's container; when the counts match, show up/down handles on hover and accept drag within the group; when they do not match, show the group in the Sections tab only. Acceptance: reordering in the canvas updates `orders`, the Sections tab and the draft; apply reorders the source blocks exactly once each.
- **M3-T4 Managed content explanations.** Hovering grey content shows “Managed elsewhere: …” using `inspection.boundaries` and, for Kaizen's own site, the CMS kind from the page inventory. Add **Open in CMS** when the content is Sanity-managed and a studio URL is known.

### M4 — Commit and hand-off

- **M4-T1 Read-only Git status.** Helper action `repository-git-status` (in `scripts/builder-repository.ts`, allowed by `rooted` in `scripts/builder-companion.ts`): is a Git repository, current branch, changed files, last commit summary, merge/rebase in progress. Editor footer shows “Branch main · 2 files changed since the last commit”. Acceptance: fixture with and without `.git`; helper refuses paths outside the approved root.
- **M4-T2 Commit only what was applied.** Helper action `repository-commit { planId, message }`: stages exactly the files recorded by the last applied plan for that root (record them in the apply result), runs `git commit` with the message, refuses when a merge or rebase is in progress, when other files are already staged, or when the repository has no user identity configured (return a message telling the user to set it in GitHub Desktop). Never `git add -A`, never push, never amend. Acceptance: commit contains only the plan's files; an unrelated dirty file stays uncommitted; second commit with nothing applied is refused with a clear message.
- **M4-T3 Editor flow.** After a successful apply: **Commit these changes** with a message field prefilled (“Update text on /about/”), then a “Next: push in GitHub Desktop, and the site deploys as it normally does” note. For projects with a Kaizen publishing destination, the existing Releases flow stays the way to go live.
- **M4-T4 Docs.** Update `docs/builder-client-projects.md` and `docs/visual-builder.md`: the journey, what is and is not editable, browser support from M0-T2, and the exact Git behaviour.

### M5 — Design controls for registered components

- **M5-T1** Emit `data-kaizen-block="<registration id>"` from the registered block renderer so the overlay can recognise builder blocks inside a site, and show their registered fields in the Selected panel.
- **M5-T2** Layout and style controls appear only for those blocks and for builder pages added to the site through “Add builder pages to this folder”. Arbitrary components keep content-only editing; say so in the panel.

## Cross-cutting requirements

- **Security.** Nonce per canvas session, origin checks on every message, ids validated against the inspection before use, no helper calls from the frame, `connect-src 'none'` kept, apply still limited to the approved root, commit limited to applied files. Add these as explicit assertions in the specs.
- **Accessibility.** Outline rows are buttons; Enter opens an editor; Esc closes it and returns focus; the frame's contenteditable elements are reachable by Tab; live-region status for “saved”, “applied”, “built”.
- **Performance.** Sites like Kaizen's have 280+ fields across 18 files: virtualise the outline above 150 rows, debounce frame messages, keep the last build's snapshot until the new one is verified.
- **Failure states.** Frame fails to load → keep the outline editable and offer “Open the preview in a window” (existing popup) as the fallback; build fails → log plus outline; helper disconnects → banner (M1-T4); files changed on disk → the stale-draft recovery already exists, surface it in the canvas too.
- **Copy.** Reuse the vocabulary from the September pass: helper, website folder, edit text and links, review my changes, apply changes to the folder, preview the website, folder backup, commit. Short sentences; say what happens next, not how it works.
- **Tests.** One spec per milestone under `tests/builder/` (`site-pages.spec.ts`, `site-canvas.spec.ts`, `site-media.spec.ts`, `site-commit.spec.ts`) using the fixture-repository pattern from `companion.spec.ts` and `source-editing.spec.ts`. Run with `BUILDER_TEST_PORT`/`BUILDER_COMPANION_TEST_PORT` set when the default ports are busy, and with `npm_execpath` pointing at pnpm on machines without npm.

## Definition of done

- The journey at the top works end to end on the isolated fixture in Chromium, and manually on Kaizen's own site through the hosted builder with Sean's checkout.
- Words, links, images and section order can be changed on the page itself; managed content is explained where it is clicked.
- Apply changes only the intended files; commit contains only those files; nothing is pushed or published automatically.
- Typecheck, unit suite and the full builder browser suite pass; screenshots at 1440 and 390 are attached to the completion note.
- The handover's “critical correction” is answered explicitly in `HANDOVER.md`, with the remaining boundary (design editing of unregistered components) stated plainly.

## Browser support — implementation log, 12 September 2026

- **M0-T1, Chromium 153.0.8010.12 on Linux:** the replacement experiment uses a real `RepositoryRunner`, a routed `https://builder.example` parent, a token-prefixed IPv4 loopback frame and no cookies. Module imports execute, CSS imports and images load, and a nonce handshake completes in both directions. No browser security flags are disabled.
- **Permission diagnosis (M0-T3):** the same test without Local Network Access permission fails with `net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`. Granting the permission for the fixture origin makes it pass. This is an additional browser permission, not helper folder approval. See [Chrome's Local Network Access guidance](https://developer.chrome.com/blog/local-network-access). The old random-hostname experiment had no captured diagnostics; its original cause is not retrospectively proven.
- **Firefox 155.0 on Linux:** the same isolated HTTPS-parent experiment passes, including modules, images, CSS and the nonce handshake. **Actual hosted acceptance (M0-T2):** attempted in the signed-in Codex in-app browser; its HTTPS-to-loopback canvas remained blank. Hosted Firefox and Safari on Sean's Mac are not yet verified. Safari cannot be manually tested on this Linux workstation. The local editor and window preview remain necessary fallbacks. Do not describe these browsers as accepted until their actual hosted journeys are walked.

Reproduction: `pnpm exec tsx docs/handover/experiments/source-frame-host-check.mjs`. If the current shell has no Node/npm, put the installed Node runtime on PATH and set `npm_execpath` to the installed pnpm JavaScript entry point before invoking `tsx` directly. Do not substitute a different pnpm major or reinstall the project as part of the spike.

## Verification before hosted acceptance — 12 September 2026

- Astro check and TypeScript: zero errors and zero warnings (172 existing hints).
- Unit suite: 214 passed across 44 files, including real Nginx/PostgreSQL recovery and helper-private-draft fingerprint isolation.
- Full builder browser suite: 40 passed; the opt-in licensed UI8 archive test was skipped because its external archives are not on this workstation. Nginx publication, hosted-origin helper reconnect, ordinary builder editing, original-source editing, assets, backups and uploads passed.
- Following final canvas adjustments, the HTTPS framing, text/undo/apply/rebuild and independent Astro + React hydration checks passed again. The native fixture includes multiline JSX text and registered desktop padding controls. Untouched SSR content is preserved until an actual edit, and unhydrated Astro islands are not bound early.
- Desktop and phone screenshots: `test-results/site-canvas-1440.png` and `test-results/site-canvas-390.png`. Overlay bounds follow viewport changes and scrolling; the phone header retains readable page and save status.
- The suite still emits the previously recorded ResizeObserver notifications during some older builder flows. Security tests also deliberately exercise denied Vite paths. Do not describe the entire development console as clean.

The complete production site and Studio build passed after restoring Studio dependencies from its unchanged lockfile. Hosted acceptance, final release evidence and Safari acceptance are recorded separately below rather than inferred from these tests.


## Release and actual-checkout acceptance — 12 September 2026

- **Deployed:** `5984058f248a1e912c1ffb53a7296bcaaf56f561`, release `gh-34707447577-1`. [Deployment 34707447577](https://github.com/KaizenUK/kaizenNEW/actions/runs/34707447577) succeeded and the public release marker matched.
- **Signed-in hosted journey:** Sean signed in. Normal `pnpm dev` on IPv4 port 4321 connected through folder approval to his Linux checkout. Pages listed the native routes; `/about/` opened with 281 fields across 18 files. The reviewed complete site/Studio build succeeded. The in-app browser left the framed page at `about:blank`, and the editor displayed its connection error and fallback controls. This is **not a passed hosted canvas acceptance**. The browser exposed no frame request diagnostic; the isolated Chrome Local Network Access diagnosis above must not be presented as a proven cause for this in-app failure.
- **Actual local fallback:** the same editor on port 4321 rendered About with the original styling and hydrated navigation. Selected-panel text changes appeared immediately in the canvas; Undo and Redo restored both. Review listed only `src/pages/about.astro`. Apply wrote exactly the temporary heading replacement, with all other bytes unchanged. Reopening after Astro's development reload automatically rebuilt without another command approval; the new snapshot showed the applied text. A second reviewed apply restored the original file byte-for-byte (SHA-256 `1e951a4ed29849adc2cfb95e584f37b5fee258648da1a32cf8c0b0fd668d2ed7`). No acceptance wording was committed or published. Build and apply recovery copies are retained locally and ignored by this checkout's Git configuration.
- **Manual input limitation:** the in-app browser could inspect the local frame and operate parent controls, but its click/keyboard commands targeting the frame reported unavailable targets/focus roots. An earlier local tab also stopped responding to inspection. Direct typing into the actual site's frame therefore remains a manual acceptance item; editing through the Selected panel is not being substituted for that requirement.
- **Stability follow-up:** unchanged section orders now leave DOM nodes in place, avoiding unnecessary Astro island disconnection/reconnection. The independent native Astro/React fixture now contains a reorderable section around the hydrated island and asserts zero section moves during text/design edits. Native hydration and image/section tests passed again; TypeScript passed. This helper-only correction does not change the deployed static frontend.
- **Real-page copy check:** [source-frame-kaizen-copy.mjs](handover/experiments/source-frame-kaizen-copy.mjs) copies Kaizen source and the existing public build into an isolated temporary repository. With normal test-origin Local Network Access permission, Chromium passed direct heading editing at 1440 and 390 widths against its 281-field/18-file About inspection with no page errors. This adds scale coverage without touching personal drafts; it does not prove the signed-in hosted browser journey.

**Still open:** actual hosted on-page input after resolving the browser's frame access, actual hosted Firefox, and Safari on Sean's Mac. Keep M0-T2 and the corresponding manual part of the definition of done open. Arbitrary design editing of unregistered components remains outside the documented contract.

## Image and Undo follow-up — 12 September 2026

- **M3-T2 decoded-image correction:** the earlier media assertion checked that `src` became a blob URL; adding a decoded-width assertion exposed a blank replacement. A parent-created blob URL is scoped to the parent's storage partition. The editor now sends the selected Blob through the authenticated canvas message and creates/revokes its URL inside the receiving frame. Only the currently selected asset and inspected image/srcset fields receive it; draft data still contains repository paths and asset references. This follows [MDN's blob URL storage-partitioning rules](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob#storage_partitioning).
- The isolated media journey now checks the actual decoded replacement, original/replacement pixels after Undo/Redo, and the copied image after apply/rebuild. A separate real-runner HTTPS-parent test checks decoded images at 1440 and 390 widths, retained URLs for unchanged assets, srcset restoration, ignored wrong nonces and unknown image IDs, and the restrictive CSP.
- **M2-T3 Undo correction:** the full suite exposed a duplicate edit sent on blur after the debounce had already sent it. That late message could overwrite a parent Undo. Flushing now clears the pending-input flag, so blur cannot replay an already-sent value. The existing edit → Undo → Redo → apply → rebuild regression failed three consecutive times before the correction and passed three consecutive times afterward.
- The unrelated builder rich-text test failed once in the initial combined run, then passed all three focused repeats and the next full run. That full run passed 40 scenarios but its asset-library scenario was interrupted by an Astro document reload: a documentation edit at 17:57:02 UTC matched the trace's unexpected navigation. No rich-text or asset-library implementation/assertion was weakened. Keep the checkout unchanged throughout the final full-suite rerun, including documentation and build output.
- The unit suite passed again: 214 tests across 44 files. Astro/TypeScript checks and the complete site/Studio build passed for the image implementation; the subsequent generated-frame Undo correction passed three consecutive browser journeys. The final uninterrupted builder browser suite passed **41 scenarios**, with one optional licensed-archive skip (6.5 minutes). Desktop/phone screenshots were regenerated and visually checked. Deployed as `9d3337f585750a308e26fa2f0149ee73e41f1d30`, release `gh-34710410450-1`: [deployment 34710410450](https://github.com/KaizenUK/kaizenNEW/actions/runs/34710410450) succeeded and the public release marker matched. Actual hosted-browser acceptance remains open.
