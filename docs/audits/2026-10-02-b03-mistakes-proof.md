# B-03, fifth guide: common website mistakes

Reviewed 2 October 2026 against `2026-10-02-b03-brief.md`. This is the last of five article rewrites; B-01/B-02 still own the shared blog design and author/date presentation.

## Content and evidence

The guide now gives five practical checks: first-screen meaning, image loading, the next action, phone forms and current details. It removes unsupported abandonment, tool/performance and structural-rebuild claims. Three primary W3C/Google sources sit beside the relevant advice. No client result or ranking promise is added.

The real example is the first step of Kaizen's contact form at 375px. The screenshot shows empty fields with existing placeholder names, visible labels, stacked name fields and the Next button. The caption identifies the placeholders and first step. No form was submitted. The homepage screenshot replaces the generated cover/social illustration.

The final form capture includes the whole card at 1125 by 1416 pixels. A first attempt was clipped by the viewport and was replaced before upload; the capture now checks its full height. The full final image was visually inspected.

## CMS scope

- Document `wp-post-50`; unchanged slug `website-mistakes-liverpool` and publication timestamp `2025-11-18T14:05:30.000Z`.
- Only title, excerpt, SEO title/description, body, main image and cover image change. Author, category and other fields are preserved.
- Fresh document matched the saved snapshot exactly. Revision guard `i35eDX7ypztuZchHdcaJRF` to `dv4Fp7fx0jPSkm1uF1OBht`, followed by exact read-back.
- New form asset matches the local image by SHA-1 `4b571f22eeeeb2c64ed1e157d99b2eaa8c039c52` and dimensions 1125 by 1416. Reused homepage asset `8ac1b8a9012ee17309ac57f7a329003e74e55296`, 1440 by 900.
- Article links reach the web-design hub, case studies, scanner, informational local-search checklist and contact. The old local-SEO service link and tracking parameters are removed.

## Freshness correction

Like the cost guide, the first build succeeded while still returning the previous article. Both the server-content assertion and browser H1 assertion rejected it before release. Even a successful public-CDN read in the verification process did not establish that the following build would use that same fresh cache response.

The site CMS client now bypasses the API CDN when Astro renders on the server, including static builds (`import.meta.env.SSR`). Browser and non-Astro client settings are preserved, as is the published perspective; this does not enable draft reads. This follows Sanity's [API CDN guidance](https://www.sanity.io/docs/help/js-client-cdn-configuration) and [Astro rendering guidance](https://www.sanity.io/docs/astro/static-and-server-rendering), read on 2 October. Asset URLs still use the image CDN.

The latest saved full Windows test baseline is `b03-comparison-tests-after.json`. Git comparison from `91f5088` to the pre-fix `6c2373a` confirms no changes to runtime source, scripts, tests, dependency files or build/test configuration, so that baseline still represents the code before this correction. A new full run is compared by test name, alongside repeated type and build checks.

## Verification

The original 55-page HTML snapshot and 16 before browser views are preserved. The first screenshot directory records the rejected stale build; accepted screenshots are in `b03-mistakes-shots-final`. Private evidence stays under `.local/marketing-20261001/b03-mistakes-*`.

- [x] Repeated TypeScript/Astro checks pass after the freshness fix: 489 files, zero errors/warnings, 192 existing hints. Full main production build passes, including unchanged Studio steps.
- [x] Full Windows Vitest comparison has no regressions by test name: before and after both have 1,553 tests, 1,070 passing, 439 existing failures and 44 pending. Evidence: `b03-mistakes-tests-after.json` and `b03-mistakes-test-comparison.json`.
- [x] Built copy reads at age 8.8, average sentence 9.9 words, zero wording/long-sentence hits. Its 570-word body and all 31 content blocks are in initial HTML.
- [x] All 55 public HTML documents compared: only the article and its index card body text change. All structured data, the other 54 documents' metadata and other 53 page bodies are unchanged. Canonical, indexability and publication date are preserved.
- [x] Actual CDN image pixels match HTML dimensions: 1200 by 690 cover and 1125 by 1416 body. Internal article links resolve; three source links are descriptive and beside their claims.
- [x] Sixteen before and sixteen final after browser views at 320, 375, 768 and 1440px, JavaScript off/on: images load, zero page errors or overflow, visible contact-link keyboard focus. No new axe findings against the existing missing-main/region baseline assigned to B-01.
- [x] All 14 accepted screenshot tiles inspected, seven for the article and seven for the index. Article height is 5,013px desktop and 5,979px phone; index is 3,521px and 7,538px. The shorter card title reduces the existing desktop grid's height. No new overlap, clipping or overflow; existing oversized index cards remain B-01 work.

## Release

Released directly to main in `4561c87e4696402bb7adc7789029c38f65daa7f5`. Production deployment `36964372283` passed; live marker `gh-36964372283-1` records activation at `2026-10-02T04:26:36.606Z`.

The live article and blog index return 200. Article content, links, metadata and structured data match the verified local build; the updated index card also matches. Sixteen live browser views at 320, 375, 768 and 1440px with JavaScript off/on pass: every image loads, no overflow or page errors, visible contact-link focus and no new accessibility findings. The existing missing-main/region findings remain assigned to B-01; the scanner card's existing timezone issue remains B-02.

All five B-03 rewrites are now verified on production. Evidence: `b03-mistakes-live-server.json` and `b03-mistakes-browser-live.json` under the private local evidence directory. Remote stage is still `4dbda85bab98fa16ba32157347ebb87bcc90a7d5`, unchanged until the entire goal ends.
