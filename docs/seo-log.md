# SEO change log: kaizenweb.co.uk

Every change that can affect search, newest first: date, URL, what changed and why. One change at a time where possible, then wait a few weeks before judging it (`seo-strategy`, "Measure, test and audit"). Positions quoted here are stale the day they are written; pull Search Console for current numbers.

## 2 Oct 2026: show the speed check and a real report together (P-06)

- `/performance-scanner/` puts its address field and email explanation in the first phone screen. A dated, real Kaizen homepage result shows what the report contains, with separate desktop and phone images. The closing message explains the next step without claiming the test finds everything.
- Shared scanner presentation also changes on `/review/`. The PDF uses plain language, actual test dates, newer Google findings and pages that expand to fit the results. The existing below-90 email gate, optional consent and browser download remain. Report details stay tied to the page tested even if the input changes.
- All 54 built documents retain their metadata and structured data. URL, canonical, title, description, initial-HTML FAQs and existing link destinations remain; review stays noindex. No CMS or sitemap change. Local checks pass; production release and live verification pending. Proof: `docs/audits/2026-10-02-p06-proof.md`. No search or enquiry improvement is claimed.

## 2 Oct 2026: bring the guides into the main site design (B-01)

- `/blog/` and all nine article routes adopt the existing site navigation, fonts, colours and footer, with a light reading layout and main landmark. The index replaces its stretched featured grid with nine naturally sized cards and gains a descriptive author/review-policy link.
- All 53 original documents retain their metadata and structured data. Article prose, sources, images, original publication dates, explicit checked dates, URLs and canonicals are preserved. No CMS write or sitemap change. A fresh crawl retains all service/contact links and finds no orphan or missing internal destination across 23 indexable pages.
- Local types, full build, copy, 100 screenshot tiles and Windows test comparison pass. Eighty-eight local browser views and four navigation journeys also pass. Released in `1823626`, deployment `36971480599`; eleven live content/search checks, 22 live browser views, four live menu checks, four live journeys and twelve redirect checks pass. B-01 is complete; proof: `docs/audits/2026-10-02-b01-proof.md`. No ranking or enquiry improvement is claimed.

## 2 Oct 2026: named author, real review dates and sourced guides (B-02)

- All nine public blog posts now name Sean McDonnell, link to `/authors/sean-mcdonnell/` and display a checked date tied to a completed content/source review. Article author metadata matches. The new indexable profile links approved work and the company officer record, explains the review policy and provides a correction route. It is included in the sitemap and page-owner map.
- Reviewed and corrected `/blog/free-website-speed-scan/`, `/blog/choose-web-design-agency-liverpool/` and `/blog/more-than-a-refresh-why-we-rebuilt-the-kaizen-website/` before assigning review dates. Removed unsupported performance/provider/analytics claims, added primary sources and aligned their titles, descriptions and excerpts. The rebuild guide gains a real homepage screenshot. The other six articles retain their verified B-03/B-04 bodies and sources.
- Original article URLs, canonicals and publication timestamps are preserved. Index cards now link directly to the canonical trailing-slash URLs, avoiding a redirect and fixing navigation in the strict local preview. UK date display is independent of the build host; the scanner's 3 February timestamp displays consistently on its article and index card. Checked dates do not follow build time or generic CMS edits. The retired B-04 document and original brand author are unchanged.
- Verification passes: copy ages 8.0 to 9.8, full build, types, test comparison, all 75 screenshot tiles plus seven final index tiles, and a fresh 23-page indexable crawl. Released in `03d4afc`, deployment `36968276276`; eleven live content/search checks, 88 live browser views, four navigation journeys and twelve redirect regression requests pass. B-02 is complete. Proof: `docs/audits/2026-10-02-b02-proof.md`. No ranking or enquiry uplift is claimed.

## 2 Oct 2026: combine the overlapping software-project guides (B-04)

- Kept `/blog/fix-failing-software-project-financial-guide/`, the stronger URL in the saved page-impression export (277 versus 173). Merged the useful warning signs and planning guidance from `/blog/software-project-rescue/`; removed unsupported generalisations about why projects fail or how many can be recovered.
- Title/H1 is "Fix or Rebuild a Failing Software Project?". The practical guide now asks readers to check what works, agree a useful result and compare the work and risks ahead. Two primary GOV.UK links support the advice. URL, canonical, original publication date, author, category and images are preserved.
- Retired URL and its `/blogdetail/` and `/insights/` aliases get direct server 301s, with/without trailing slashes and with query strings preserved. The old document remains in the CMS for recovery/preview, but public reads exclude it. Removed its generated HTML, index card and sitemap entry. The contract product owner page links directly to the retained guide.
- Copy reads at age 9.8. A crawl finds nine public articles and 22 indexable pages, with no orphan or missing internal destination; all articles retain service and contact/scanner links. Commit `17c2fdd`, deployment `36965743380`, live content/search checks, 12 redirect requests and 24 live browser views pass. B-04 is complete; proof: `docs/audits/2026-10-02-b04-proof.md`. No search or enquiry uplift is claimed.

## 2 Oct 2026: practical website checks and fresh build reads (B-03, fifth of five)

- `/blog/website-mistakes-liverpool/` now gives five checks for a site's message, images, next step, phone form and current details. Removed unsupported abandonment, tool/performance and rebuild claims. W3C headings/labels and Google image-loading sources support the practical guidance.
- Title/H1 is "5 Website Mistakes You Can Check on Your Own Site"; description and excerpt match. Real Kaizen homepage and phone-form screenshots replace the generated illustration. The form image is labelled as its first step with example placeholders; no real enquiry was sent.
- Preserved the URL, canonical, indexability, publication date, author and category. Descriptive body links reach the web-design hub, case studies, scanner, local-search checklist and contact. The old local-SEO service link and tracking parameters are removed. Other page metadata and all structured data are unchanged.
- Astro server/static reads now use the fresh CMS API after two builds picked up old article content. Published-only reads and browser/non-Astro cache settings remain unchanged. Rejected builds were not shipped; the final build contains the verified article. Full Windows test comparison has no new failures.
- Built copy reads at age 8.8 with zero wording/long-sentence hits. Proof: `docs/audits/2026-10-02-b03-mistakes-proof.md`. All five rewrites are now verified live; final commit `4561c87`, deployment `36964372283`, live content/search checks and 16 live browser views pass. B-03 is complete. No search or enquiry uplift is claimed.

## 2 Oct 2026: sourced website-price examples (B-03, fourth of five)

- `/blog/how-much-does-a-website-cost-in-liverpool-in-2025/` now explains the work inside a quote, with two attributed UK package examples. Prices include their VAT status and ongoing charges; removed unsupported market-wide ranges and price/quality claims. These are different advertised offers, not Kaizen rates or industry averages. Sources and figures are recorded in the site profile.
- Title/H1 is "How Much Does a Website Cost? A Guide to Quotes"; description and excerpt match. The real Midland homepage replaces the generated cover/social image. An actual Ask MOG screenshot illustrates the feature and licence scope to include in a quote, without revealing Midland's project price.
- Preserved the legacy URL, canonical, indexability, publication date, author and category. Body links reach WordPress work, the scanner, hidden-cost guide, Midland and contact. Removed the old local-SEO service link and tracking parameters. All other page metadata and all structured data are unchanged.
- Built copy reads at age 9.1 with zero wording/long-sentence hits. The first build fetched old CMS content and was rejected; the later public read, repeated full build and final page checks pass. Proof: `docs/audits/2026-10-02-b03-cost-proof.md`. One B-03 rewrite remains; no measured search or enquiry improvement is claimed.

## 2 Oct 2026: evidence-led local-search checklist (B-03, third of five)

- `/blog/local-seo-liverpool-checklist/` now covers accurate business details, visiting/service areas, clear services, phone/contact checks, genuine reviews and separate search/enquiry counts. Removed unsupported claims about website speed or structure controlling rankings. Four primary Google sources sit beside the relevant advice.
- Title/H1 is "Local Search Checklist for Your Business Website"; description and excerpt match. Real screenshots of Kaizen's homepage and service-area footer replace the generated map illustration in the cover, body and social preview. The example describes the website only; Sean's Google listing action remains S-02.
- Preserved URL, canonical, indexability, publication date, author and category. Body links lead to the main web-design hub, WordPress service, scanner and contact; removed the old local-SEO service link and tracking parameters. P-03 still owns site-wide service retirement. All other page metadata and all structured data are unchanged.
- Built copy reads at age 9.6 with no wording or long-sentence hits. Proof: `docs/audits/2026-10-02-b03-local-proof.md`. Two B-03 rewrites remain. No new ranking or enquiry result is claimed.

## 2 Oct 2026: checking the costs inside a quote (B-03, second of five)

- `/blog/hidden-costs-cheap-websites/` is now a practical checklist for recurring bills, edits, upkeep, moving old pages and testing the customer journey. Removed unsupported claims about cheap hosting, security, plugin counts and price predicting quality. No prices or failure rates are invented.
- Title/H1 is "Hidden Costs of Cheap Websites: What to Check". Description and excerpt match. Added Nominet, WordPress and Google primary sources beside supported explanations. A real Midland product-selection comparison replaces the generated illustration in the cover, article and social preview; the index card updates from those fields.
- Kept the URL, canonical, indexability, publication date, author and category. Descriptive body links lead to the WordPress service, scanner, Midland example, general cost guide and contact. New links omit the replaced article's tracking parameters. All other page metadata and structured data are unchanged.
- Built copy reads at age 8.4, with no wording or long-sentence hits. Full proof: `docs/audits/2026-10-02-b03-hidden-proof.md`. Three B-03 rewrites remain; no search or enquiry improvement is claimed.

## 2 Oct 2026: practical website-build comparison (B-03, first of five)

- `/blog/wordpress-vs-react-business-roi/` now explains how to compare the editor, phone experience, quoted work and upkeep. The title/H1 is "WordPress vs React: How to Choose for Your Business"; the description and excerpt match the new buying guidance. The existing comparison topic and URL remain; Kaizen's implementation is not disclosed.
- Added four primary-source links beside supported claims and a real Midland before-and-after example using the approved loading-time and enquiry figures. Replaced the generated cover/social image with the actual rebuilt homepage. The blog index picks up the updated card title, excerpt and image.
- Descriptive links lead to the WordPress service, scanner, Midland case study, cost guides and contact. The rewritten article's new links omit the old tracking parameters. Publication date, author, category, canonical and indexability are unchanged; no redirect or URL change.
- Blog body images now reserve space using their source/crop proportions. The cover sizing is unchanged. Verification and release evidence: `docs/audits/2026-10-02-b03-comparison-proof.md`. B-03 remains open for four more rewrites; B-01/B-02 retain the shared blog design and author/date work. No ranking or enquiry improvement is claimed.

## 2 Oct 2026: contact expectations and visible email (P-05)

- `/contact/` now names the website conversation, shows the exact agreed reply time and says the first chat is free. The existing expectations band explains agreement on work/price and the non-refundable deposit, with a descriptive pledge link.
- Added the established `hello@kaizenweb.co.uk` email near the form. A scoped Cloudflare email-obfuscation opt-out keeps this contact route usable without JavaScript. Initial autofocus is disabled on this page so phone visitors see the introduction; a named form section completes the heading order. No form fields or submission logic changed.
- Title, description, canonical, structured data and URL are unchanged, as are the other 54 generated page bodies. Copy reads at age 8.8 with no wording or sentence-length hits. Proof: `docs/audits/2026-10-02-p05-proof.md`. No enquiry or ranking improvement is claimed.

## 2 Oct 2026: clear ad pages and contact flow (P-11)

- `/get-started/` and `/review/` retain `noindex, nofollow` and stay out of the sitemap. Both now explain website work for business owners, a free first chat and the agreed reply time. Unsupported rankings, ad-cost, universal loading-time and no-monthly-fee claims are removed; the real Midland screenshot and approved result provide the proof.
- Existing shared buttons and fonts remain. Added a main landmark, stronger contrast, descriptive home/pledge links and focusable contact sections with fixed-header clearance. The actual contact/scanner components and submission logic are unchanged. The review title now describes general help instead of implying a personal review; both pages gain accurate descriptions. No URL, redirect, canonical, structured-data or indexable-page metadata change.
- Removed the slow-site page's unconfigured Bing UET placeholder and attempt-based conversion listener. This does not establish working measurement; S-04 remains open for account and conversion evidence. Reading ages are 7.5 and 7.7. Proof: `docs/audits/2026-10-02-p11-proof.md`. No search or enquiry uplift is claimed.

## 2 Oct 2026: plain pledge and direct contact path (P-10)

- `/pledge/` keeps its existing structure and four commitments, with shorter wording about the work, price, faults and project fit. Removed all six dashes and sales rhetoric. The existing 30-day fault-reporting policy is stated with its scope; the agreed non-refundable deposit and free first conversation are clear.
- Added the agreed contact action and response line in the first screen and at the close. One closing ask replaces the competing contact/scanner pair; the shared header still offers the scanner. No title, description, canonical, URL, CMS or structured-data change.
- Reading age 7.3; all five desktop/phone screenshot tiles and eight browser views pass. Other page bodies and all 55 generated documents' metadata are unchanged. Proof: `docs/audits/2026-10-02-p10-proof.md`. No enquiry or search uplift is claimed.

## 2 Oct 2026: measurement audit and export reminder (S-04, incomplete)

- No recognised browser analytics tracker found in the live homepage, contact, scanner or blog script graphs. Reporting account and last-30-day conversions remain unverified. Existing database saves and alert integrations need authenticated read-back before totals can be reported.
- Set an active monthly Search Console export reminder for the first day of each month at 09:00 Europe/London, starting 1 November. No public page, URL, tracker or conversion event was changed by this audit. Evidence and remaining work: `docs/audits/2026-10-02-s04-measurement.md`.

## 2 Oct 2026: article and service links (S-03)

- `/blog/fix-failing-software-project-financial-guide/` now links to contract product owner help and contact; `/blog/more-than-a-refresh-why-we-rebuilt-the-kaizen-website/` links to homepage web design and contact. `/blog/free-website-speed-scan/` links to WordPress web design, and `/blog/website-mistakes-liverpool/` links to homepage web design. Existing article text and search fields are preserved by revision-guarded writes and exact read-back.
- `/`, `/services/wordpress-web-design/`, `/services/local-seo/` and `/contract-product-owner/` now link to their relevant buying, comparison, checklist or fix-versus-rebuild guide. Eight short paragraphs add ten descriptive links using existing layouts. No URL, title, description, canonical, publication date or structured-data change.
- All ten articles now have service and contact/scanner body links. All four current service/home routes link to guides. The 55-document crawl has no missing internal destination or generic label; all 23 indexable pages are reachable within two clicks. Recheck after the planned P-03/B-04 retirements. Proof: `docs/audits/2026-10-02-s03-proof.md`. Search or enquiry gains are not yet measured.

## 2 Oct 2026: search page ownership (S-01)

- `docs/marketing/site-profile.md` now assigns the main topics and every one of the 54 exported queries with at least 100 impressions. The map uses Sean's 1 October Search Console export, covering 4 June 2025 to 28 September 2026. Relevant queries have one owner; excluded offers and client-navigation searches are identified explicitly.
- The homepage owns general web design and the brand. WordPress work, the speed-test tool and the website-cost guide keep their existing URLs and distinct jobs. Local SEO remains excluded under DEC-03. All 23 current indexable titles were reviewed; the scanner guide's earlier title fix already resolves that conflict, so this task changes no title or CMS field.
- Separate query/page exports do not prove query-level cannibalisation. No current rank or uplift is claimed. P-03 still owns the local-search redirect; B-04 retains the fix-versus-rebuild guide when merging the rescue article, based on its higher exported page impressions. Source, coverage and validation: `docs/audits/2026-10-02-s01-proof.md`.

## 2 Oct 2026: homepage copy and design rebuild (P-01)

- `/` now leads with web design for business owners, real Midland before/after screenshots and the approved first-month enquiry result. Early pledge points address paying again and editing the site. Three buyer routes link to the relevant case studies or WordPress service. A clearly labelled loading replay uses actual screenshots and the confirmed more-than-eight-second/1.2-second figures.
- Removed repeated homepage arguments, retained the ten server-rendered FAQ answers and four existing review excerpts, and left one closing contact ask. The title, description, canonical, URL and FAQPage data are unchanged. The Organization description now states the current website offer and Merseyside/West Yorkshire service areas in plain English.
- No redirect or competing page introduced. The homepage keeps web-design ownership; WordPress service intent stays on its existing route. P-03 still owns retirement of the local-search page. Copy, responsive, accessibility and server evidence: `docs/audits/2026-10-02-p01-proof.md`. Search and enquiry effects need time and later measurement; no uplift is claimed.

## 2 Oct 2026: readable reviews and real case-study proof (F-07)

- `/`: the four existing Google reviews now appear once as static cards, with complete selected excerpts, names, posting months and links to the existing listing. Each excerpt is labelled. No new review or aggregate-rating data is emitted; existing Organization data is unchanged.
- The Midland band now shows the real site screenshot, a plain oil-finder explanation and approved results: several genuine enquiries a day, 1.2-second loading and three times the enquiries in the first month. Removed the old plugin count and AI wording. The existing case-study destination remains beside the evidence.
- Both bands are present in server HTML without hydration. All page metadata, URLs and structured data are unchanged, as is homepage text outside these bands. Proof: `docs/audits/2026-10-02-f07-proof.md`. The full homepage rebuild remains P-01.

## 2 Oct 2026: buyer-led navigation and static footer (F-06)

- Shared marketing navigation now uses Services, Work, About, Guides and Contact. The desktop Helen Moore case-study entry is a working link. Guide labels describe their topics without technology names; existing destinations are preserved.
- The shared footer keeps all 28 audited destinations in server HTML, including the six guide links, company/public profiles and legal pages. Contact details remain visible, the registered office is labelled once, and page endings receive no extra sales ask.
- Compared 31 footer-bearing routes: page-body copy, metadata and structured data are unchanged. No URL, redirect or keyword-owner change. Local-search navigation stays until P-03. Keyboard, accessibility, visual and link evidence: `docs/audits/2026-10-02-f06-proof.md`.

## 2 Oct 2026: server-rendered shared FAQs (F-05)

- `/`, `/services/wordpress-web-design/`, `/services/local-seo/` and `/performance-scanner/` now use the same native FAQ. All 38 answers are in initial HTML, including the homepage answers previously loaded by the client. Each page has one FAQPage script generated from its visible questions and answers.
- Home/local-search answers now describe agreed website work, editing and next steps in plain English. Removed unsupported timing/ranking promises and monthly local-SEO offers. The homepage explains the real score-first scanner flow, agreed reply time, free first chat and non-refundable deposit. WordPress/scanner answers are unchanged.
- Existing scanner guide links, Service data, metadata and URLs remain. The local-search redirect remains P-03. Proof: `docs/audits/2026-10-02-f05-proof.md`.

## 2 Oct 2026: consistent marketing section spacing (F-04)

- Active marketing, ad, case-study and legal pages use two consistent section sizes. Removed oversized gaps around headings and rows, plus empty viewport-height tails on short introductions. Header clearance and image proportions are preserved.
- Parsed before/after HTML for all 18 changed routes confirms identical wording, links, heading levels, metadata and structured data. This is a presentation change; URLs and page ownership are unchanged. Proof: `docs/audits/2026-10-02-f04-proof.md`.

## 2 Oct 2026: font loading and readable labels (F-03)

- Public marketing and ad landing pages preload the 25,356-byte WOFF2 heading font, replacing the 75,080-byte TTF download for supported browsers. The original TTF remains as a fallback.
- Marketing headings use corrected font proportions and a 1.1 line height. Small section and navigation labels use at least 12px DM Sans with stronger contrast. Case-study labels no longer use a monospace font.
- This is a presentation change. Copy, heading levels, page URLs, titles, descriptions, canonicals and structured data are unchanged. Verification and the measured homepage layout shift are recorded in `docs/audits/2026-10-02-f03-proof.md`.

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
