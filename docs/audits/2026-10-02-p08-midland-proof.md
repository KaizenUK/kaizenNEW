# P-08: Midland Oil Group case study

2 October 2026. Released in `2181878`; production deployment [36985576824](https://github.com/KaizenUK/kaizenNEW/actions/runs/36985576824) and live verification pass. The two-page P-08 task remains open until Helen's rebuild and live checks are complete.

## What changed

The page now opens with the trade buyer's problem, a real screenshot and the agreed contact action/reply. Approved results appear immediately afterwards. One old-site screenshot explains the starting point. The industry view and oil finder demonstrate how buyers choose a product. Five native disclosures retain the menu, services, brands, data-sheet search and company-document examples in initial HTML.

Nine distinct screenshots replace sixteen image placements. Repeated comparisons, duplicated homepage crops and repeated sales bands are removed. The images remain the original project files, with correct dimensions and descriptive alternatives. The shared F buttons, results, spacing and type are used independently of homepage-specific patterns. No new client result or quote is introduced. The oil finder's "on licence" wording remains.

The gallery uses full-image links without JavaScript and a native modal dialog when enhanced. It retains zoom and previous/next controls, adds keyboard entry, a labelled dialog, focus containment/return and visible controls. Reduced motion needs no animation. The previous body scroll setting is restored. Checks exposed disabled-end-button keyboard navigation and a delayed close-event race; both were repaired before release.

A descriptive service link and pledge link sit with the free first conversation and deposit explanation. The client site's link, case-study index and Helen's story remain reachable. The URL, title, canonical, indexability and structured data stay unchanged. Midland's description now describes the oil finder in plain language; source props, fallback, seed and the exact CMS document agree. A revision guard and full-document read-back confirm that only `seo.metaDescription` changed in `seed-page-case-studies-midland-oil-group`.

## Evidence and checks

- Brief: `docs/audits/2026-10-02-p08-brief.md`. Claims and permissions are from the site profile and founder interview. Existing original project images were inspected. The old-site image is explicitly archival.
- Types pass. Astro check: 495 files, zero errors, zero warnings, 189 inherited hints. Full main production build passes.
- All 53 baseline HTML documents checked. Only Midland's body and intended description tags change; every other metadata field and all structured data are preserved. Nine images, five disclosures, approved results and required service/index/pledge/contact links exist in initial HTML.
- House style: age 8.9, average sentence 9.3 words, zero hard-rule hits. No actual paragraph sentence exceeds 20 words. Two long checker strings combine the button label with its separate agreed reply sentence.
- All 16 Midland baseline tiles and five Helen baseline tiles inspected. Midland's nine final closed-page tiles and eleven expanded-page tiles inspected. Closed height: 5,564 desktop and 7,387 phone, down from 11,420/14,022. With every disclosure open: 7,930/9,121. No overflow, overlapping content or unfinished bands.
- Final full Vitest comparison: 1,561 tests, 1,078 pass, 439 existing Windows/Linux-environment failures and 44 pending. Every previously passing test still passes; no new failure or missing passing test. The comparison is by file and full test name.
- Eight browser views cover 375/768/1024/1440 pixels with JavaScript off/on. All nine image dimensions and five native disclosures are checked in each. The first contact action ends at 555 pixels and reply at 615 pixels on the phone. Eight keyboard journeys reach the contact page without submitting a form.
- Thirty-two gallery checks cover every image at 375/1440, the first image at intermediate widths, plus twelve rapid close/reopen checks on the phone. Zoom reaches both bounds and resets between images. Buttons and arrow keys reach both gallery ends. Escape/close restore the chosen link's focus; an existing body overflow setting is restored. Tab focus stays within the native modal context. No-JavaScript image links open the original asset in all four widths.
- Normal, expanded and modal accessibility checks have zero axe violations. Browser page errors and horizontal overflow are zero. Wide and portrait gallery images were inspected at both widths; the dialog bounds fit the viewport.

Private evidence is under `.local/marketing-20261001/p08-*`. Nothing in that directory is committed. Stage remains held until the whole goal ends.

## Production verification

The release marker identifies commit `2181878cde1d4f9880240430f26b69fa73cdee44`. Midland returns 200 and exactly matches the verified local body, headings, links, metadata and structured data. All 5 internal page destinations return 200. All nine public screenshots match the original asset SHA-256 hashes. The case-study URL remains in the sitemap, and the retired local-search service remains absent.

The same eight live browser views, eight keyboard contact journeys and 32 gallery checks pass. JavaScript-off image links, native disclosures, image dimensions, zoom and gallery navigation, rapid reopening, scroll restoration and focus return are verified. Normal, expanded and modal accessibility checks have zero axe violations. No browser errors, overflow or form submissions. Private proof: `p08-midland-live.json` and `p08-midland-browser-live.json`.

## Definition of done for this page

- [x] First phone screen names the work, buyer and next step.
- [x] Headings explain the buying problem, changes and approved result.
- [x] Agreed contact action and exact response line appear at the start and closing ask.
- [x] Real work and approved numbers are adjacent; no invented quote or result.
- [x] Plain British copy meets the reading/sentence rules.
- [x] Desktop and phone page tiles inspected, including all expanded examples.
- [x] Intended search-description change is consistent and guarded; initial-HTML content and existing URLs remain.
- [x] Descriptive links connect the service owner, case-study index, pledge and other case study.
- [x] Final repaired gallery/browser and required local checks pass.
- [x] Production deployment and live verification pass.

No ranking or enquiry uplift is claimed from this layout. S-04 still needs verified conversion reporting.
