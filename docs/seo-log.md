# SEO change log: kaizenweb.co.uk

Every change that can affect search, newest first: date, URL, what changed and why. One change at a time where possible, then wait a few weeks before judging it (`seo-strategy`, "Measure, test and audit"). Positions quoted here are stale the day they are written; pull Search Console for current numbers.

## 2 Oct 2026: shared action labels and links (F-02)

- Marketing pages and navigation now use three consistent action labels for contact, the speed check and a case study. Former contact modal buttons are normal links to `/contact/`, present in server HTML. Ad landing pages retain their own form anchors. Existing article and service links keep their descriptive labels.
- `/case-studies/` now gives each card a clear case-study link in the shared button style. The destinations are unchanged. Page titles, descriptions, canonicals and structured data are unchanged throughout this task.
- Removed the temporary noindex `/ui-test/` route; it remains absent from the sitemap. Removed the unsupported "30 seconds" promise beside the homepage speed check. The free score still appears before the email step.
- Fixed the existing mobile-menu crash when a promotion has no image, so visitors can reach the navigation links. Proof: `docs/audits/2026-10-02-f02-proof.md`.

## 1 Oct 2026: isolated design foundation (F-01)

- Added the temporary `/ui-test/` design check with `noindex, nofollow` and confirmed it is excluded from the sitemap. F-02 removes it. No public navigation links to it.
- Added scoped design tokens and components for later page work. Existing marketing copy, page metadata, canonical URLs and link destinations are unchanged. Asset growth is 2.08%; the homepage HTML size is unchanged. Verification is recorded in `docs/audits/2026-10-01-f01-proof.md`.

## 1 Oct 2026: blog titles, guide links and plain copy (Q-12 to Q-14)

- Sanity blog search titles now read: /blog/choose-web-design-agency-liverpool/ "How to Choose a Web Design Agency in Liverpool"; /blog/fix-failing-software-project-financial-guide/ "Fixing a Failing Software Project vs Rebuilding"; /blog/free-website-speed-scan/ "How to Read Your Website Speed Report | Kaizen Web". The scanner guide H1 and excerpt now describe reading a report, leaving the actual tool query with /performance-scanner/. Descriptions on these three posts and /blog/wordpress-vs-react-business-roi/ now describe the article without ranking claims.
- Replaced 58 raw URL link labels across nine posts with descriptive anchors, including the seven closing contact links. Fixed the dash paragraphs in the agency guide, local search checklist and website mistakes post; corrected the scanner article's email/download explanation and removed a dash from the local search excerpt. Revision checks and full read-back verified the exact CMS changes. No slug, destination, publication date, image or WordPress vs React topic changed.
- /about/ now links to the Kaizen rebuild guide; /contract-product-owner/ to the software rescue guide; /contact/ to the pledge. The scanner-to-guide link was already shipped in Q-01. All are page-body links present in server HTML.
- /about/, /contract-product-owner/, /case-studies/ and both case studies now use plain copy within the reading-age target. Removed implementation names and unsupported security promises; retained approved client results. About now names Merseyside and West Yorkshire as service areas. The product-owner page uses the site's voice with Sean's experience as proof. Its former local SEO link now leads to the Midland case study, which links up to the WordPress service. Metadata and URLs for these marketing pages are unchanged; their visual rebuilds remain in Phase P.

## 1 Oct 2026: image sizes and link icons (Q-09, Q-10)

- `/case-studies/midland-oil-group/` and every blog post: added explicit image dimensions so browsers can reserve the right space during loading. The 16 Midland images use their real file dimensions; blog covers match the existing 1200 by 690 crop. A fresh crawl finds zero images without size across these pages.
- Replaced text arrows with decorative SVG icons on the case studies index, Helen Moore, contract product owner and thank-you pages, and the retained city-page component. Copy, metadata, URLs and link destinations are unchanged.

## 1 Oct 2026: shared footer and phone layout (Q-05 to Q-08, Q-11)

- All public pages using `SiteFooter`: removed the duplicate Blog link and the repeated footer sales block. Every unique navigation destination and legal line remains. Page endings now rely on their existing main action; F-06 will refresh the navigation design later.
- `/`, `/services/local-seo/` and `/contact/`: corrected decorative overlap, the empty benefits cell, wrapping step numbers and small phone form fields. No title, description, canonical, URL or structured data changed. Copy issues on home/local SEO remain for their scheduled page tasks.

## 1 Oct 2026: WordPress proof and copy (Q-02, P-02 copy preparation)

- `/services/wordpress-web-design/`: replaced the incorrect Midland load times with more than 8 seconds before and 1.2 seconds after; replaced the unsupported rankings sentence with three times the enquiries in the first month, as approved by Sean.
- Simplified the three options and FAQ answers to pass the full-page copy checks. Removed guaranteed rankings, unsupported load-time and delivery-time promises, and blanket security claims. The long quoted-search-phrase table is now plain buying guidance in native details elements, with all text in the server HTML. FAQPage data matches the visible answers.
- Title, description, URL and canonical are unchanged. The Midland case-study link now names the work. P-02 still owns the visual rebuild after the foundations; watch Search Console over the coming weeks before judging the copy change.

## 1 Oct 2026: scanner accuracy (Q-01)

- `/performance-scanner/`: explained the actual email gate and browser PDF download; removed unmeasured timing and unsupported ranking promises. Rewrote the answers and their FAQPage data in plain English. The tool runs a simulated phone test, not a complete assessment of real visitor experience.
- Linked the page body to `/blog/free-website-speed-scan/` and `/services/wordpress-web-design/`, with descriptive anchors. Replaced the closing local SEO link in line with DEC-03.
- Added primary sources: [Google's speed test guidance](https://developers.google.com/speed/docs/insights/v5/about) and [page experience guidance](https://developers.google.com/search/docs/appearance/page-experience). Title, description and canonical URL are unchanged. No Sanity write was needed.

## Baseline (Search Console export, Jun 2025 to Sep 2026, read 1 Oct 2026)

- 196 clicks, 36,642 impressions, average position about 36.
- About 51 of the clicks come from 11 near-identical "seo agency in liverpool" searches with a 100% click rate at positions 50 to 140. Treat them as bots. India gives 84 clicks at a 12.8% click rate; the UK gives 67 at 0.29%.
- Real clicks are mostly brand searches. "kaizen web" sits at position 12.5.
- Best non-brand term: "local seo wirral", 1,370 impressions, position 15.
- Impressions peaked at about 5,000 a month in Feb and Mar 2026, then fell to about 1,500 a month while average position improved to about 16.
- West Yorkshire terms: one impression in 16 months.
- Full read: `docs/audits/2026-10-01-site-copy-design-seo-audit.md`, section 11.

## 1 Oct 2026 (late)

- **No visitable address published.** Sean chose "registered office only": 103 Old Hall Street, Liverpool removed from the footer, the structured data and `llms.txt`. The home page structured data is now an `Organization` (legal name Kaizen Web Ltd) with `areaServed` covering Merseyside and West Yorkshire (Leeds, Bradford, Cleckheaton, Gomersal added); opening hours, price range and map position removed, as they belong with a visitable address. The registered office in Mildenhall stays on the site as a legal detail. Business Profile change (service area, address hidden) is Sean's next step on Google; watch for a short dip in local visibility while Google catches up.
- **Midland case study:** "40+ years" (was "150+") and "licence".

## 1 Oct 2026 (evening)

- **Consigns page removed** at Sean's request (separate business). `/products/consign-comply` 301s to `/` (added to `shared/publicRoutePolicy.js`). It was noindex and had no search traffic, so nothing to lose.
- **Audit tooling added:** `scripts/audit/house-style.mjs` (copy rules) and `scripts/audit/page-shots.mjs` (desktop and phone screenshots). Second audit and task board in `docs/audits/2026-10-01-full-audit-v2.md` and `docs/audits/2026-10-01-task-plan.md`.

## 1 Oct 2026 (second commit)

- **Staging is noindex.** Every page built from the `stage` branch now carries `noindex, nofollow` (`isStagingBuild()` in `src/lib/site.ts`). Production builds from `main` are unchanged. Applies once `stage` deploys.
- **Midland Oil figures** made consistent on `/get-started/` and `/review/` (more than 8 seconds to 1.2, three times the enquiries).
- **Blog body text** renders curly quotes and the ellipsis character as plain punctuation.

**Deploy status:** the first two production deploys that day failed at "Activate production public release" because the server's 10-second storage check timed out on a cold disk. Later deploys went through and everything above is live (checked on the live site the same day).

## 1 Oct 2026

Pushed together, because they fix errors rather than test ideas:

- **Retired pages now return a real 301.** `/web-design-wirral`, `/web-design-warrington`, `/web-design-chester`, `/web-design-liverpool`, `/web-design-liverpool-city-centre`, `/services/web-design-liverpool`, `/services`, `/services/ecommerce`, `/services/contract-product-owner`, `/services/digital-transformation`, `/digital-transformation`, `/agile-coaching`, `/project-rescue`, `/product-owner`, and four old case studies. Before this they returned 200 with a "Redirecting to" HTML page. Rules come from `shared/publicRoutePolicy.js` and are written to the Nginx file by `shared/builderRedirects.js`.
- **New 301s:** `/elementor-test-landing/` (a test page that was live and indexable) to `/`; `/blog/new-kaizen-website-relaunch/` (old slug, was 404) to `/blog/more-than-a-refresh-why-we-rebuilt-the-kaizen-website/`.
- **Sitemap:** no longer lists `/builder/companion/` or `/products/consign-comply/`, both noindex.
- **Structured data (home):** removed the self-served `aggregateRating` and `review` markup and the `telephone` field. The phone number is off the whole site at Sean's request.
- **Blog posts:** body headings saved as H1 in Sanity now render as H2, so each post has one H1.
- **`lang="en-GB"`** on every public layout (was `en`).
- **Titles and meta descriptions** rewritten for the home, about, pledge, contact, case study, service, contract product owner, scanner, blog and terms pages, in code and in the Sanity seed files. **Not live until the Sanity sync runs** (`pnpm sync:seo:sanity`), because Sanity's values take precedence.
- **Copy:** unsourced statistics removed (53%, 7%, 8%, 14%, 76%, 88%, 70%, 1.4 seconds, the impossible £2.6M); the homepage speed demo now tells the true Midland Oil story; "#1" ranking claims say "Checked October 2026".

What to watch: Search Console coverage for the redirected URLs over the next 60 to 90 days (they should drop out of the index), and whether "kaizen web" moves up once the Business Profile and titles settle.
