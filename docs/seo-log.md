# SEO change log: kaizenweb.co.uk

Every change that can affect search, newest first: date, URL, what changed and why. One change at a time where possible, then wait a few weeks before judging it (`seo-strategy`, "Measure, test and audit"). Positions quoted here are stale the day they are written; pull Search Console for current numbers.

## Baseline (Search Console export, Jun 2025 to Sep 2026, read 1 Oct 2026)

- 196 clicks, 36,642 impressions, average position about 36.
- About 51 of the clicks come from 11 near-identical "seo agency in liverpool" searches with a 100% click rate at positions 50 to 140. Treat them as bots. India gives 84 clicks at a 12.8% click rate; the UK gives 67 at 0.29%.
- Real clicks are mostly brand searches. "kaizen web" sits at position 12.5.
- Best non-brand term: "local seo wirral", 1,370 impressions, position 15.
- Impressions peaked at about 5,000 a month in Feb and Mar 2026, then fell to about 1,500 a month while average position improved to about 16.
- West Yorkshire terms: one impression in 16 months.
- Full read: `docs/audits/2026-10-01-site-copy-design-seo-audit.md`, section 11.

## 1 Oct 2026 (second commit)

- **Staging is noindex.** Every page built from the `stage` branch now carries `noindex, nofollow` (`isStagingBuild()` in `src/lib/site.ts`). Production builds from `main` are unchanged. Applies once `stage` deploys.
- **Midland Oil figures** made consistent on `/get-started/` and `/review/` (more than 8 seconds to 1.2, three times the enquiries).
- **Blog body text** renders curly quotes and the ellipsis character as plain punctuation.

**Deploy status:** the production deploy for both of today's commits failed at "Activate production public release" (GitHub run 36863503435, and run 36858020270 for Sean's earlier `47d31f0`). The last successful deploy was 14 Sep. None of today's changes are live until that is fixed.

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
