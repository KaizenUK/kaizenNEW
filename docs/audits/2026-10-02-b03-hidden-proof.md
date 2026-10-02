# B-03, second guide: the costs inside a website quote

Reviewed 2 October 2026 against `2026-10-02-b03-brief.md`. This is the second of five rewrites. B-03 remains in progress; B-01 and B-02 retain the blog's shared design and author/date work.

## Content and evidence

The guide now helps an owner check recurring bills, edits, care/recovery, moving old pages and the actual customer journey. Unsupported assumptions about low prices, shared hosting, security, plugin counts and inevitable rebuild costs are removed. There are no invented prices or guarantees. The buying checklist is advice, not a claim that every supplier charges for each item.

Three primary sources appear beside their relevant explanations: Nominet for .uk address renewals, WordPress for backups before updates and Google Search Central for handling changed page addresses. The precise source links and review notes are in the brief and the public article source, `docs/marketing/articles/hidden-website-costs.md`.

The real Midland screenshot shows the new size selector on the left and the old product page on the right, as its caption states. It illustrates work to include in the agreed scope; it does not claim a standard price or attribute a measured result to one feature. The same real screenshot replaces the generated cover/social image.

## CMS scope

- Published document `wp-post-93`, unchanged slug `hidden-costs-cheap-websites` and publication timestamp `2025-11-26T03:41:18.000Z`.
- Only title, excerpt, SEO title/description, body, main image and cover image change. Author, category and all other fields are preserved.
- The fresh document matched the saved snapshot exactly. Revision guard `fZDLTQid2WH0Zo7nsDqiSm` to `i35eDX7ypztuZchHdcdH8F`; exact read-back passed. Full previous documents are retained in ignored evidence for rollback.
- The asset matches the existing public WebP by SHA-1 `1a68d8a3132f2fc52751f9fc67df782c99f95373` and dimensions 2524 by 1234.
- Descriptive body links go to the WordPress service, scanner, Midland case study, general cost guide and contact. New links omit the old article's tracking parameters.

## Verification

- [x] House style on the built article: reading age 8.4, average sentence 10.0 words, zero long-sentence or wording hits. Its 552-word body, H1, excerpt and all 30 content blocks render in the initial HTML.
- [x] TypeScript and Astro check pass: 489 files, zero errors/warnings and 192 existing hints. Full main production build passes, including unchanged Studio steps. No runtime source or shared component changed, so the board does not require a repeated full Vitest run for this rewrite.
- [x] Compared all 55 public HTML documents: only this article and the index card body text change. All structured data, the other 54 documents' metadata and the other 53 page bodies are unchanged. Article metadata changes only its title, description and social image; canonical and indexability are preserved.
- [x] Both article images load and their actual CDN pixels match the reserved HTML dimensions: 1200 by 690 cover and 1200 by 587 body. All internal article links reach existing pages; the three source links are descriptive.
- [x] Sixteen before and sixteen after browser views at 320, 375, 768 and 1440px, JavaScript off/on: all images load, zero page errors or overflow. The contact link has visible keyboard focus. Axe finds no new issues; the same existing missing-main/region findings remain B-01 work.
- [x] All 15 official screenshot tiles inspected, including all eight blog-index tiles. Article height is 4,407px desktop and 5,553px phone; index height 3,661px and 7,538px. No new overlap, clipping or overflow. The index's existing oversized cards are still assigned to B-01.

Ignored evidence: `.local/marketing-20261001/b03-hidden-*` snapshots, CMS plan/read-back, checks, browser reports, image verification and screenshot sheets. Full CMS snapshots stay uncommitted.

## Release

Shipped directly to main as `4fc4ca8e691f624f6c66b4199a8b647fc390c5ca`. Production deployment `36961182843` succeeded; live release `gh-36961182843-1`, created at `2026-10-02T03:42:24.418Z`, identifies that exact commit.

The article and index return 200. Live article text, links, metadata and structured data match the verified build; its index card also matches. All 16 live browser views pass for image loading, page errors, overflow and contact-link keyboard focus, with no new axe findings against the recorded baseline.

Live evidence: `b03-hidden-live-server.json` and `b03-hidden-browser-live.json` under the ignored evidence directory. Remote main matches the release. Stage remains `4dbda85bab98fa16ba32157347ebb87bcc90a7d5`, verified after deployment, until the whole goal ends.
