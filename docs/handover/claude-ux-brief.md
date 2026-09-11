# Claude brief — Kaizen builder visual and UX pass

Read `HANDOVER.md` and `docs/handover/original-request.txt` first. Sean requested this pass because he finds much of the current product confusing or ugly. Functional tests are not a substitute for his usability expectations. Inspect the working interface, not just screenshots or CSS.

## Product and users

An agency website builder for multiple clients. The primary workflow is:

Create/open client → import assets → build or edit the actual pages visually → preview/test → export or save into a local repository → configure services → publish to the correct destination → maintain without losing editability.

Two types of page need an understandable presentation: builder-owned visual pages, and existing Astro/React pages from a local checkout. The latter currently opens source-content fields plus a separate selector; **full WYSIWYG editing is missing**. Coordinate the design with implementation of that feature. Do not dress up the existing text-field form and call the underlying problem solved.

## What to inspect and improve

- Information architecture: clear project context, page navigation and one obvious next action. Explain where the user is and where their data is saved.
- Existing-site entry: connecting the companion, selecting a checkout, opening a page and entering the visual editor should feel like one coherent workflow. Avoid making a nontechnical user navigate repository diagnostics, source fields and build cards just to see the page.
- Canvas: the page itself should dominate. Plan in-place selection/editing, useful element/layout controls, responsive previews, undo/redo and visible saved/unsaved state. Explain unsupported/dynamic/shared elements exactly where the user encounters them.
- Distinguish without overwhelming: hosted builder page data vs local source draft; preview vs live; save vs apply files vs commit vs publish. Keep implementation detail out of the main flow unless it changes a user's decision.
- Sidebar, toolbar, panels and dialogs: consistent widths, spacing, typography, labels, action hierarchy and progressive disclosure. Reduce dense prose cards and repeated headings.
- Projects, page list, asset import/library, shared styles/content, templates, settings, export, editable backup and releases all need visual consistency and discoverability.
- Review/error/recovery states should say what happened, what is safe and the next action; preserve drafts and show long paths/URLs without overflow.
- The editor's theme must stay distinct from the website's theme. Retain the existing font direction and inspect current loaded fonts before substituting anything.
- Desktop, tablet and narrow-screen use; keyboard navigation, focus management, labels, contrast and usable drag alternatives.

## Deliverables

1. Inspect the current UI and provide an ordered, concrete list of the main usability problems tied to real screens.
2. Establish the navigation and screen layout for both new-site and existing-site editing; show the complete journey, not only an attractive canvas mockup.
3. Implement the agreed visual/UX improvements in the repo, preserving working behavior. Use existing accessible components and shared design tokens where practical.
4. Capture before/after desktop and mobile screens and verify the key flows with actual interaction.
5. Document any remaining functional dependencies separately from design work. Do not claim working WYSIWYG functionality merely because controls or mockups have been drawn.

## Constraints and boundaries

- Astro 7 static app, React 19 islands, Tailwind 4, Puck/Unity builder; follow `AGENTS.md` and preserve the existing Puck patch.
- No unsolicited commerce, booking system, backend rewrite or replacement framework.
- Auth, project/data isolation, explicit publication destinations, backups, version/conflict checks and recovery must survive the redesign.
- Do not run acceptance tests against Sean's personal `.kaizen-builder` or overwrite his checkout. Use isolated test data.
- Main deployment is authorised, but backing up this handover did not deploy commit `1486788`; read current deployment state before publishing.
- Do not display private access files or keys in screenshots, fixtures, generated sites or Git.

Acceptance is a comprehensible, attractive, working product for Sean, including the existing-site editing journey. A prettier collection of technical forms is insufficient.
