# B-03, first guide: choosing a website build

Reviewed 2 October 2026 against `2026-10-02-b03-brief.md`. This is the first of five rewrites. B-03 remains in progress; the shared blog design and author/checked-date work remain B-01 and B-02.

## Content and evidence

The article now helps an owner compare the editing experience, phone usability, included work and upkeep. It removes broad technology, price and quality promises. Four primary sources sit beside the specific editing, performance, update and role explanations they support. The source text is saved in `docs/marketing/articles/website-build-comparison.md`.

Q-14 explicitly retains this article's WordPress-versus-React topic. The comparison names those tools only to explain the buying question. It does not name Kaizen's implementation or claim that a tool alone makes sites fast or editable.

The approved Midland example uses the actual old and rebuilt homepage screenshots, with captions identifying their dates relative to the rebuild. The old image is historical evidence, not current Midland marketing copy. Its former lifespan wording is not repeated as a current claim. The article states the approved more-than-8-second to 1.2-second change and threefold first-month enquiries as one client's result, not a general promise. The cover and social preview use the real rebuilt homepage instead of the generated illustration.

## CMS scope

- Published document: `wp-post-97`; slug remains `wordpress-vs-react-business-roi`.
- The patch changes only title, excerpt, SEO title/description, body, main image and cover image. The publication timestamp remains `2025-11-26T15:54:10.000Z`; author, category and all other fields are preserved.
- Revision guard: `fZDLTQid2WH0Zo7nsDqiSm` to `i35eDX7ypztuZchHdccxzF`. Fresh exact read-back passed. Complete previous documents are retained in ignored local evidence for rollback.
- Both screenshot assets match the existing public WebP files by SHA-1 and dimensions: old 2544 by 1313, new 2550 by 1312. No new client image was generated.
- Internal links lead to the WordPress service, scanner, Midland case study, related cost guides and contact. The new links use descriptive labels. Tracking parameters from the replaced old article links are absent from these new links.

## Verification

- [x] Fresh CMS read-back is exact; the article's existing URL and publication date are preserved. One H1, matching title/description and all 37 content blocks render in the initial HTML.
- [x] House style on the built article: reading age 8.0, average sentence 9.6 words, zero long sentences or dash, exclamation, US spelling, banned, staffing or AI-pattern hits. The public Markdown draft also passes independently.
- [x] TypeScript and Astro check pass: 489 files, zero errors/warnings and 192 existing hints. Full production build with `KAIZEN_DEPLOY_BRANCH=main` passes, including the unchanged Studio steps.
- [x] The two new body images revealed that their renderer had no dimension attributes. It now reserves their rendered size using the image URL's original size or saved crop, capped at the requested 1200px width. All 22 images across the ten built blog posts have dimensions. The three article images' actual CDN pixels exactly match their HTML dimensions: 1200 by 690, 1200 by 619 and 1200 by 617.
- [x] Because the renderer is shared, ran the full Windows Vitest suite before and after: 1,553 tests, 1,070 passed, 439 failed and 44 pending in both. Test-name comparison finds zero regressions. Existing Linux-dependent failures remain.
- [x] All 15 official screenshot tiles inspected: seven article tiles and eight index tiles at 1440px and 375px. Article heights are 5,040px and 6,195px; index heights 3,661px and 7,538px. New copy and screenshots have no overlap, clipping or overflow. The index's existing oversized cards/featured gap remain B-01 work; this is not acceptance of the whole blog design.
- [x] Sixteen before and sixteen after browser views at 320, 375, 768 and 1440px, JavaScript off/on. Images load, no page errors or horizontal overflow, and the article contact link has visible keyboard focus. Axe retains only the pre-existing missing-main/region findings, with no new failures. The cover figure's selector becomes a class selector when additional body figures exist; it is the same existing landmark issue.
- [x] Compared all 55 public HTML documents: only the comparison article and blog index body text change. All structured data is unchanged. Metadata changes are confined to the comparison's title, description and social preview; canonical/indexability and the other 54 documents' metadata are unchanged. The other 53 page bodies match exactly. All article internal destinations exist.

Ignored evidence is under `.local/marketing-20261001/`: `b03-comparison-*` snapshots, CMS plans/results, browser reports, screenshot sheets, image-pixel verification, checks and test comparison. Full CMS documents are not committed.

## Release

Shipped directly to main as `91f50887e5d1a5759d611df20975fb0e34030022`. Production deployment `36960324633` succeeded. The live marker identifies that exact commit as `gh-36960324633-1`, created at `2026-10-02T03:30:58.607Z`.

The article and blog index return 200. Live article text, links, metadata and structured data match the verified build; the index card also matches. Sixteen live browser views pass for image loading, keyboard focus, page errors and overflow, with the same existing landmark findings and no new accessibility failures. The unrelated scanner card's known host-timezone date difference remains assigned to B-02.

Live evidence: `b03-comparison-live-server.json` and `b03-comparison-browser-live.json` in the ignored evidence directory. Remote main matches the release; stage is still `4dbda85bab98fa16ba32157347ebb87bcc90a7d5`, verified after deployment, until the entire goal ends.
