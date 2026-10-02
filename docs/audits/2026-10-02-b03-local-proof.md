# B-03, third guide: local-search checklist

Reviewed 2 October 2026 against `2026-10-02-b03-brief.md`. This is the third of five rewrites. The existing legacy URL remains informational, consistent with DEC-03 and the page-owner map.

## Content and evidence

The guide now covers correct Google business details, real visiting/service areas, clear website services, the phone/contact journey, honest reviews and separate counts for search visits and enquiries. Four primary Google sources appear beside the claims they support. Unsupported claims about website speed/structure controlling rankings are removed.

The title and H1 become "Local Search Checklist for Your Business Website". The old local-SEO service link is removed; the useful service path goes to the WordPress page and the main web-design hub. This does not advertise a local-SEO service or complete P-03's site-wide retirement.

The real Kaizen website supplies the example: its footer says Merseyside and West Yorkshire and that we come to clients. Live screenshots of the homepage and phone footer replace the old map illustration. The final footer capture includes actual side/top padding and both images were inspected. They show website content, not the Google listing; S-02 is still Sean's action. No ranking claim or new client result is added.

## CMS scope

- Document `wp-post-42`; unchanged slug `local-seo-liverpool-checklist` and publication timestamp `2025-11-17T12:57:51.000Z`.
- Only title, excerpt, SEO title/description, body, main image and cover image change. Author, category and all other fields are preserved.
- The fresh document matched its saved snapshot. Revision guard `fZDLTQid2WH0Zo7nsDw1MY` to `dv4Fp7fx0jPSkm1uF1Ms05`, followed by exact read-back.
- Real screenshot assets match the local files by SHA-1 and dimensions: homepage `8ac1b8a9012ee17309ac57f7a329003e74e55296`, 1440 by 900; footer `c95c2afdfe4567ad139eb7663e2e7d8d523887a6`, 1500 by 1800. The images are saved under `public/images/guides/`.
- Descriptive links reach the web-design hub, WordPress service, scanner and contact. New links omit the old article's tracking parameters. Google source links retain only their language parameter.

## Verification

- [x] House style on the built article: reading age 9.6, average sentence 10.3 words, zero long-sentence or wording hits. Its 596-word body and all 34 content blocks render in the initial HTML.
- [x] TypeScript and Astro check pass: 489 files, zero errors/warnings and 192 existing hints. Full main production build passes, including unchanged Studio steps. No runtime source or shared component changed, so no repeated full Vitest run is required for this rewrite.
- [x] Compared all 55 public HTML documents: only this article and the index card body text change. All structured data, the other 54 documents' metadata and the other 53 page bodies are unchanged. Canonical, indexability and publication date are preserved.
- [x] Both article images load and their actual CDN pixels match the reserved HTML dimensions: 1200 by 690 cover and 1200 by 1440 body. Internal article links reach existing pages; none links to the retiring local-SEO service. The shared footer retains its existing link pending P-03.
- [x] Sixteen before and sixteen after browser views at 320, 375, 768 and 1440px, JavaScript off/on: all images load, zero page errors or overflow, and visible keyboard focus on the contact link. Axe finds no new issues against the existing missing-main/region baseline assigned to B-01.
- [x] All 15 official screenshot tiles inspected, including all eight blog-index tiles. Article height is 5,185px desktop and 6,327px phone; index height 3,661px and 7,538px. The footer example is legible on the phone. No new overlap, clipping or overflow. Existing oversized index cards remain B-01 work.

Ignored evidence: `.local/marketing-20261001/b03-local-*` snapshots, CMS plan/read-back, image records, checks, browser reports and screenshot sheets. Full CMS snapshots remain uncommitted.

## Release

Shipped directly to main as `7494803cf4391e8ecb24c05a44f7da9fae09564c`. Production deployment `36962388549` succeeded; live release `gh-36962388549-1`, created at `2026-10-02T03:58:57.645Z`, identifies that exact commit.

The article and index return 200. Live article text, links, metadata and structured data match the verified build; its index card also matches. All 16 live browser views pass for image loading, page errors, overflow and contact-link keyboard focus, with no new axe findings against the recorded baseline.

Live evidence: `b03-local-live-server.json` and `b03-local-browser-live.json` under the ignored evidence directory. Remote main matches the release. Stage remains `4dbda85bab98fa16ba32157347ebb87bcc90a7d5`, verified after deployment, until the whole goal ends.
