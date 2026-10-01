# Site audit: copy, design and SEO against the new marketing rules

**Date:** 1 October 2026
**Scope:** every page in the live sitemap at https://kaizenweb.co.uk (25 URLs) plus 7 pages outside it (`/get-started/`, `/review/`, `/thank-you/`, the three policy pages and `/insights/`). 32 pages in all.
**Rules checked against:** `.claude/skills/marketing-messaging`, `.claude/skills/marketing-page-design`, `.claude/skills/seo-strategy`, `docs/marketing/site-profile.md`, and Sean's standing rules: British English, reading age about 9, no em dashes ever, nothing that reads as AI-written.
**Method:** downloaded the live HTML of each page, pulled out the visible text, title, meta description, headings, canonical, robots and structured data, then ran automated checks (dashes, spelling, hype words, staffing words, AI-style phrasing, readability) and read the main pages by hand. Shared header and footer text was checked once, not per page.

---

## The short version

The site is close on spelling and has no exclamation marks on the live pages. The big gaps are:

1. **Em dashes are everywhere.** About 200 on 17 pages. The worst are the WordPress page (45), the local SEO page (29), the Midland Oil case study (28) and the home page (20).
2. **Reading age is too high.** Only `/contact/` and `/pledge/` are near 9. Service pages sit at 11 to 13. Every blog post is 14 to 17.
3. **Numbers that cannot be checked, and one that is wrong.** The home page says a 1-second delay costs "£2.6M lost revenue per year ... for a site doing £100k/month". That site only takes £1.2M a year, so the sum is impossible. Most other statistics have no source.
4. **Self-serving review stars in the home page structured data.** The skill says never do this. It should come out.
5. **Copy that sounds machine-written.** Stacked "No X. No Y. No Z." lines, "That's not X. It's Y." turns, "actually" 59 times, "has you covered", "the truth is", "peace of mind".
6. **The blog posts have 6 to 13 H1s each**, two pages compete for "free website speed test", and the sitemap lists two pages that are set to noindex.
7. **The site profile is mostly "unknown".** Segment, one-line pitch, proof permissions, Search Console and the page-owner map are all missing. Several checks could not run without them (see the checklist at the end).

**Already fixed today (Sean asked):** the phone number is gone from the site. Details are under "Changes made in this session".

---

## 1. House voice

### 1a. Em and en dashes (rule: none, ever)

| Page | Em dashes | En dashes | Notes |
|---|---|---|---|
| `/services/wordpress-web-design/` | 45 | 2 | |
| `/services/local-seo/` | 29 | 3 | |
| `/case-studies/midland-oil-group/` | 28 | 0 | plus a spaced hyphen used as a dash in the meta description |
| `/` (home) | 20 | 0 | |
| `/performance-scanner/` | 12 | 1 | one is in an H2 |
| `/get-started/` | 11 | 0 | ad landing page |
| `/about/` | 8 | 0 | |
| `/products/consign-comply/` | 8 | 1 | |
| `/review/` | 8 | 0 | ad landing page |
| `/pledge/` | 6 | 0 | |
| `/blog/website-mistakes-liverpool/` | 3 | 0 | |
| `/case-studies/` | 2 | 0 | |
| `/blog/local-seo-liverpool-checklist/` | 2 | 0 | |
| `/blog/`, `/blog/choose-web-design-agency-liverpool/`, `/case-studies/helen-moore-hairdressing/` | 1 each | 0 | Helen Moore's is in the meta description |
| `/terms-and-conditions/` | 1 | 3 | plus 17 spaced hyphens; legal text, lower priority |

Fix: rewrite each sentence rather than swapping the dash for a comma. Most of these dashes join two thoughts that should be two short sentences, which also helps reading age.
Example from the home page: "Fast, clean, and built around one goal — turning visitors into customers." becomes "It loads fast. It has one job: to turn visitors into customers."

The curly quotes and apostrophes in blog posts (`choose-web-design-agency` 3, `local-seo-liverpool-checklist` 6, `software-project-rescue` 2, `website-mistakes-liverpool` 3) also break the plain-punctuation rule. They come from Sanity content.

### 1b. Reading age (target about 9)

Worked out with Flesch-Kincaid (reading age = grade + 5) on body text only. It is a rough guide: it rewards short sentences and short words. A reading age of 9 means sentences of about 8 to 12 words and few words over three syllables.

| Page | Reading age | Average sentence (words) | Sentences over 20 words |
|---|---|---|---|
| `/contact/` | 9.0 | 9.7 | 0 |
| `/pledge/` | 9.3 | 10.8 | 4 |
| `/get-started/` | 9.8 | 11.5 | 4 |
| `/thank-you/` | 10.0 | 9.5 | 0 |
| `/review/` | 10.4 | 11.8 | 5 |
| `/about/` | 10.5 | 10.1 | 5 |
| `/performance-scanner/` | 10.9 | 11.0 | 4 |
| `/` (home) | 11.1 | 11.0 | 9 |
| `/services/local-seo/` | 11.4 | 11.2 | 20 |
| `/services/wordpress-web-design/` | 13.1 | 14.8 | 12 |
| `/case-studies/midland-oil-group/` | 13.3 | 13.4 | 13 |
| `/contract-product-owner/` | 13.9 | 15.7 | 15 |
| `/products/consign-comply/` | 14.1 | 10.4 | 8 |
| `/blog/` (index) | 14.3 | 17.8 | 6 |
| Blog posts (10) | 14.1 to 17.0 | 13.8 to 19.6 | 4 to 16 each |
| `/terms-and-conditions/` | 20.2 | 23.0 | 98 |

The blog posts are the biggest gap. They read like general business articles: long sentences, abstract nouns ("prioritisation", "architecture", "infrastructure", "momentum") and little concrete detail. Worst: `fix-failing-software-project-financial-guide` (17.0), `local-seo-liverpool-checklist` (16.7), `wordpress-vs-react-business-roi` (16.5).

Legal pages can stay more formal, but the terms page at reading age 20 with 98 long sentences could have a plain-English summary at the top.

### 1c. Sounds like AI

Patterns the skills and Sean's rules flag, counted across the live site (legal pages left out):

| Pattern | Count | Where it clusters |
|---|---|---|
| "actually" | 59 | local SEO (12), home (6), WordPress (5), cost guide (5) |
| "That's not X. It's Y." / "isn't X, it's Y" | 17 | local SEO (4), home, about, get-started |
| "not just" | 12 | home, about, contract product owner |
| Stacked "No X. No Y. No Z." (a triad, the rule-of-three tell) | 4 full triads, many pairs | home, about, Midland Oil, footer ("No fluff. No runaround. Just results.") |
| Question then one-word answer ("Got questions? Good.") | 4 | home, scanner, local SEO, WordPress |
| Stock phrases | "Kaizen has you covered" (home meta), "the truth is" (speed scan post), "My Experience, Your Peace of Mind" (contract PO H2), "Built different. On purpose." | |

Hype or filler words from the banned list: "outstanding" and "perform with awe" (home meta description), "tailored" (WordPress page, cost guide), "solutions" (3 blog posts, contract PO), "ensure" (contract PO 3 times), "vital", "navigate", "journey". Most are in meta descriptions and blog posts.

The home and about pages also repeat the same block almost word for word ("you deal with the same person from first conversation to final delivery. No handoffs. ... No 'I'll pass that on.' ... not whatever's left after the bigger clients"). Repeated paragraphs across pages read as templated.

### 1d. British English

Almost clean. Only one US spelling found on live pages: "behavior" on `/cookie-policy/`. No "-ize" spellings, "color", "center" or "program" found.

Also: most pages declare `<html lang="en">`. The blog uses `en-GB`. `StaticPageLayout.astro`, `LandingPageLayout.astro` and `BuilderLegalLayout.astro` should say `en-GB` too.

### 1e. Exclamation marks

None on the live pages. One in code that only shows after the form is sent: "Message sent!" in `client/components/ContactFormBox.tsx`.

### 1f. Staffing structure (profile: never mention teams, developers or staffing, never imply a team or a solo setup)

- **`/contract-product-owner/` breaks this most.** It is written in the first person ("How I Fix It", "My Experience", "I join your team", "I ruthlessly prioritise") which implies a solo setup, and its meta description says "Our Contract Product Owners", which implies a team. It also names past employers ("SMD Credit Solutions"). Rewrite in the "you deal with the same person" voice.
- **`/blog/choose-web-design-agency-liverpool/`** has a "Freelancer vs Agency" section ("freelancers work alone, availability can sometimes become an issue", "smaller expert-led teams"). That invites the reader to place Kaizen on that scale. Reframe around what the customer gets.
- **Home and about:** "We're not a big agency with layers of account managers" talks about structure. The customer-side version is already there: "One person. Start to finish."
- Mentions of the *customer's* team or developers ("your ops team", "your developers") are fine and were not counted as breaches.

---

## 2. Proof and claims (messaging skill: "never invent ... numbers"; profile: claims must be checkable)

| Claim | Page | Problem |
|---|---|---|
| "£2.6M lost revenue per year for every 1-second delay — for a site doing £100k/month" | home | **Wrong.** £100k a month is £1.2M a year. Remove or correct with a source. |
| "8 seconds. That's all you get. That's how long a visitor waits" | home | Contradicts the same page's "3 seconds" and "53% leave after 3 seconds". Pick one, with a source. |
| "53% of visitors leave...", "7% of conversions", "0.1s ... increases conversions by 8%", "14% of your leads" | home, scanner, get-started | No source shown. These come from Google and Deloitte studies of mobile and retail sites. Name the source and link it, or drop them. |
| "76% of local searches happen on a phone", "88% of people who have a bad mobile experience won't return" | local SEO | No source. |
| "3x more enquiries in the first month", "1.2s load time", "0 plugins" | home (Midland Oil) | Fine if true and Midland Oil agreed to it. Record the evidence in the site profile. |
| "100% Performance Score", "Zero Booking Friction", "#1 Local Ranking ... Dominant visibility" | Helen Moore case study | A Lighthouse score changes with every test, "Zero friction" is not measurable, and a ranking claim needs a date and the search terms. Give the terms, the date and a screenshot, or drop it. |
| "#1 for local search terms" | local SEO | Same. Which terms, when? |
| "Core Web Vitals ... are a direct ranking factor" | local SEO FAQ | Overstated. The SEO skill (and Google) say speed is a small ranking factor. Soften it. |
| "Trusted by Wirral trades, small shops, e-commerce brands, and SaaS teams" | home hero | Needs to match real clients. Also a triad. |
| Reviews shown as "1 week ago", "2 weeks ago", "4 weeks ago" | home | These are frozen in the HTML. The structured data dates B Loughran's review 5 March 2026, so "1 week ago" is now seven months out of date. Show real dates or pull them live. |
| The 4 reviews | home | Permission is "unknown" in the profile. Confirm they are Google reviews shown in full and not cherry-picked (DMCC Act rules in the SEO skill). |

---

## 3. Messaging and page design

### 3a. The site has no evidence base yet
`docs/marketing/voice-of-customer.md` has no entries, and the site profile leaves the segment, the one-line pitch, who it is not for, what happens after the call to action, and pricing as "unknown". Until these are filled, every rewrite is a guess. **First action:** Sean answers the founder question bank in `.claude/skills/marketing-messaging/references/working-tools.md`, and the answers go into the voice-of-customer file.

### 3b. Five-second test: what does Kaizen do, and for whom?
- **Home H1 is "Always Be Better."** That is a slogan, the "branding waffle" the messaging skill warns about. It says nothing about websites or who they are for. The subhead does the work ("Websites that rank higher, load faster and turn visitors into customers"). The SEO skill says the term must be plain in the H1. Something like "Websites for Liverpool businesses that load fast and bring in enquiries" carries the term and the promise.
- The home page offers three different things in its first band (web design, performance, product owner for hire). A visitor has to work out which is for them. The segment is never named.
- **Blog index H1 is "Engineering Notes".** That is an insider label. The posts are for business owners, not engineers.
- **Case studies H1 "Proof, trimmed to the work that matters most."** and meta description "the kind of rebuild ... Kaizen wants more of". These are written for Kaizen, not the buyer.

### 3c. Headings: spoilers, not categorisers
The design skill wants headings that carry the argument. Categorisers found: "What we actually do", "Reviews", "Featured Case Studies", "Local SEO FAQ", "WordPress web design FAQ", "Professional Accreditations", "Recommended Reads". Good spoilers already exist and should be the model: "One person. The whole way.", "Advice before invoices.", "It's not your hosting. It's how the site was built."

The footer puts "Websites built properly." in an H2 on every page. That adds the same heading to every page outline. Make it a styled paragraph.

### 3d. Calls to action
Labels vary for the same action: "Talk to Us", "Start Your Project", "Start a project", "Start a conversation", "Get a Quote Like This", "Free Audit", "Free Site Audit", "Run a free audit". The skill asks for one main action per view, and a line under it that removes the fear. What happens after someone clicks is "unknown" in the profile, so that reassurance line cannot be written yet.

### 3e. Topic boundary
The profile says the topic is web design, build and performance. Three areas sit outside it:
- `/products/consign-comply/` (hazardous waste notes). It is noindexed, which is right, but it is in the sitemap and the footer. Decide whether it belongs on this site.
- `/contract-product-owner/`, `/blog/software-project-rescue/` and `/blog/fix-failing-software-project-financial-guide/` (software delivery). Off-theme content weakens the site's main topic (SEO skill). Either make product ownership a clearly separate offer or move it.

### 3f. Design checks that could not run from HTML alone
The premium check, phone check at 375px, polish pass and eye-path review need the pages open in a browser. They were not done in this pass (see the checklist). The `/get-started/` and `/review/` pages could not be judged on their own, because they depend on the ad they sit behind.

---

## 4. SEO

### 4a. Must fix
1. **Remove `aggregateRating` and `review` from the home page structured data** (`client/lib/seo.ts`, `buildLocalBusinessSchema`). The SEO skill: "Never mark up the business's own reviews about itself to get stars." Google can ignore the whole block or take manual action.
2. **The sitemap lists noindex pages.** `/products/consign-comply/` (noindex, nofollow) and `/builder/companion/` (noindex) are both in `sitemap.xml`. The rule is: every sitemap URL is 200, self-canonical and not noindex. `src/pages/sitemap.xml.ts` excludes `/builder/` but not paths under it, and does not check the Consign Comply page's robots setting.
3. **Blog posts have many H1s.** Every subheading in the Sanity posts is styled as H1: 6 to 13 per post. Change them to H2 in Sanity. Also make `PortableTextRenderer.tsx` render an H1 block as H2, so it cannot happen again.
4. **Two pages compete for "free website speed test".** `/performance-scanner/` ("Free Website Speed Test | Check Your Google PageSpeed Score") and `/blog/free-website-speed-scan/` ("Free Website Speed Test: Check Your Score Now"). The scanner should own the term. Retitle the post or merge it in and 301 it.
5. **Year mismatch.** The URL is `/blog/how-much-does-a-website-cost-in-liverpool-in-2025/`, but the H1 and meta say 2026 and the title has no year. Don't change the URL just for this (the skill says the gain is small). Make the title, H1 and meta agree, and take the year out of the copy unless the prices were reviewed this year.

### 4b. Titles and meta descriptions to rewrite

| Page | Problem |
|---|---|
| `/` | Meta: "look outstanding ... perform with awe ... Kaizen has you covered". Hype, and no full stop. |
| `/blog/choose-web-design-agency-liverpool/` | Title: "Clear and Concisely". Ungrammatical, and "Liverpool" is in the URL but not the title. |
| `/blog/fix-failing-software-project-financial-guide/` | Meta: "Learn how to explain how to evaluate the difference." Garbled. Title: "Fixing Failing Software Project" is missing "a". |
| `/blog/wordpress-vs-react-business-roi/` | Meta: "how you can choose ... for their website". Mixed person. |
| `/case-studies/midland-oil-group/` | Meta: "to high-end tech platform that transformed the business". Missing word, hype, spaced hyphen. |
| `/performance-scanner/` | Meta: "find out what is holding you back and fixes". Garbled, and 160 characters. |
| `/services/wordpress-web-design/` | Title is 63 characters (over 60). Meta: "a decent, custom coded website" undersells. |
| `/services/local-seo/` | Meta opens with what Kaizen is not ("We are not an SEO agency"). |
| `/pledge/` | Title and meta use "No-BS". It might put off some buyers, and it is not in the profile's voice. |
| `/products/consign-comply/` | Meta is 184 characters. |
| `/about/` | Meta: "Meet Sean, our founder". "Our founder" hints at a staff structure. |
| `/terms-and-conditions/` | Meta describes the company, not the terms. |

### 4c. Local SEO (the profile says this matters)
- **Location story doesn't match.** The copy says "Based on the Wirral. Working across the UK." The structured data, footer and `llms.txt` give 103 Old Hall Street, Liverpool L3 9BP. Blog slugs target "Liverpool". The SEO skill is strict: a Business Profile address must be a place customers can visit, with signage and staff. A virtual office or registered-office address is not allowed. **Sean to confirm** what that address is and whether Kaizen is a storefront or a service-area business. Then make the copy, structured data, footer and Business Profile say the same thing.
- **Phone removed (today).** The address and email stay consistent. If the Google Business Profile still shows the old number, update it to match.
- **`areaServed`** in the structured data lists Chester, Warrington, St Helens, Southport and North Wales. Make sure the site really serves those places. There are no pages for them, which is right unless there is real local work to show (doorway rule).
- **`foundingDate` 2026** in the structured data. Check it matches Companies House.
- Checklist 14 items that need the Business Profile itself (verification, categories, review requests, Bing Places, Apple Business Connect) could not be checked from the repo.

### 4d. Quality bar
- **Who / How / Why on guides:** the blog posts show no author byline, no reviewed date and no links to primary sources. The cost guide and local SEO checklist give advice about money and ranking, so they should name who wrote them and when they were checked.
- **Thin or generic posts.** Several posts ("Hidden Costs of Cheap Websites", "5 Common Website Mistakes", "Software project rescue") cover what many agency blogs say, with no Kaizen-specific examples, screenshots or numbers. Google's helpful-content questions ask "would an expert learn something?" Add real work (the Midland Oil before and after is the strongest asset on the site) or merge them.
- **Hub-and-spoke:** posts end with "Next Step" sections, but the anchors were not checked against the page-owner map, because there is no map yet.

---

## 5. Priority order

| # | Fix | Effort | Where |
|---|---|---|---|
| 1 | Correct the £2.6M figure; settle 3s vs 8s; source or remove every statistic | small | home, scanner, local SEO, get-started components |
| 2 | Remove review stars from structured data | small | `client/lib/seo.ts` |
| 3 | Sitemap: drop noindex pages | small | `src/pages/sitemap.xml.ts` |
| 4 | Blog H1s to H2 (Sanity) and renderer guard | small | Sanity + `PortableTextRenderer.tsx` |
| 5 | Rewrite the broken meta descriptions and titles (table 4b) | small | page files and Sanity SEO fields (check overrides) |
| 6 | `lang="en-GB"` on all layouts; "behavior" to "behaviour" | small | layouts, cookie policy |
| 7 | Sean fills the site profile gaps and the founder interview | Sean, 1 hour | `docs/marketing/` |
| 8 | Rewrite home, about, WordPress and local SEO pages: no dashes, reading age 9, no AI patterns, spoiler headings, a plain H1 | large | page files |
| 9 | Rewrite contract product owner page out of "I/our POs"; decide its place on the site | medium | page file |
| 10 | Rewrite or merge blog posts to reading age 9, with author, date, sources and real examples | large | Sanity |
| 11 | Settle the address and local story; match the Business Profile | Sean | profile, `client/lib/seo.ts` |
| 12 | Browser design pass (premium, 375px, polish) on the rewritten pages | medium | |

Rewrite one page at a time and log each change in `docs/seo-log.md` (the SEO skill: one change at a time, then wait).

---

## 6. Changes made in this session

Sean asked for the phone number to be removed. Removed from:
- `client/lib/seo.ts`: the `BUSINESS_PHONE` constants and `telephone` in the LocalBusiness structured data
- `client/components/layout/SiteFooter.tsx`: the "Call us on" line and the "Call" contact block
- `client/components/ContactFormBox.tsx`, `client/components/homepage/HeroRemotionSequence.tsx`, `src/components/homepage/FinalCTA.astro`, `src/components/static/WebDesignCityPage.astro`, `src/pages/contact.astro`: the "Call us on" lines
- `src/pages/services/wordpress-web-design.astro`: the call button, replaced with the site's "Talk to us about your site" contact button
- `src/pages/services/local-seo.astro`: the call button next to the contact button, and the placeholder "Call Now — 0151 XXX XXXX" in the mock-up (now "Call now")
- `public/llms.txt`: both phone lines

Later the same day, after Sean's go-ahead, the technical fixes and quick wins below were made and checked with a local build, the redirect tests and `tsc`. Each one is also logged in `docs/seo-log.md`.

- **Retired pages return a real 301** (20 paths, with and without the trailing slash). Before, Astro wrote a "Redirecting to" page for each, served with a 200. `shared/builderRedirects.js` now writes them into the Nginx rules, and `astro.config.mjs` no longer generates the stub pages; the release check fetches every built file and refuses redirects, so the stubs had to go too.
- **New redirects:** `/elementor-test-landing/` to `/`, and the old blog slug `/blog/new-kaizen-website-relaunch/` to the post's current address.
- **Sitemap:** skips everything under `/builder/` and `/studio/`, and any static page whose source sets noindex.
- **Home structured data:** review stars and reviews removed. Review cards show the month posted instead of a frozen "1 week ago".
- **Blog posts:** an H1 saved in Sanity renders as H2. Blog index heading is now "Website guides for business owners".
- **British English:** `lang="en-GB"` on all public layouts; "behaviour" on the cookie page; "Message sent." without the exclamation mark; "optimisations" in the scanner report.
- **Statistics:** removed from the home, scanner, get-started, review, local SEO and WordPress pages and the scanner's PDF report. The homepage speed demo now tells the Midland Oil story (more than 8 seconds before, 1.2 after) instead of quoting industry figures.
- **Ranking claims:** "Checked October 2026" added next to each "#1".
- **Titles and descriptions:** rewritten in the page files, the default table in `client/lib/seo.ts` and the Sanity seed files. Sanity's values win on the live site, so they only go live after `pnpm sync:seo:sanity` runs with a Sanity token.
- **Staging** is still indexable. Sean said to leave staging for now. The fix is one line on the staging server or in Cloudflare: send `X-Robots-Tag: noindex` for `stage.kaizenweb.co.uk`.

---

## 7. Full checklist pass

Result key: **done**, **gap** (checked and failing), **could not run** (with reason).

### Messaging
| Item | Result |
|---|---|
| Step 1, gather evidence | **could not run.** `voice-of-customer.md` is empty and there is no Search Console access from here. The audit used only the live site. |
| Step 2, segment and awareness | **gap.** No segment in the profile. The pages don't name who they are for. |
| Step 3, message inventory | **could not run.** Needs step 1. |
| Step 4, ranked hierarchy | **could not run.** Needs step 3. |
| Step 5, clarity rules and house voice line by line | **done** by script on all 32 pages and by hand on home and about. Results in section 1. |
| Output (a) to (e) | Not applicable to an audit. Due on each rewrite. |
| Tool 1, page brief | **gap.** No briefs exist for any page. |
| Tool 2, feature and benefit inventory | **could not run.** Needs Sean. |
| Tool 3, objection table | **could not run.** No evidence of real objections yet. |
| Tool 4, proof inventory | **done** as section 2. Permissions are unknown. |
| Tool 6, competitor audit | **could not run.** Out of scope for this pass. Suggested later: about 10 Liverpool and Wirral web design sites. |
| Tool 7, visitor intention gap | **could not run.** Needs analytics and Search Console. |
| Tool 8, funnel steps | **gap.** What happens after the call to action is unknown. |
| SUCCESS check | **gap.** Concrete and Credible fail on unsourced and wrong numbers. Stories are strong on Midland Oil, weak elsewhere. |

### Design
| Item | Result |
|---|---|
| Diagnosis table | **partly done.** The clear problems are "can't understand the words" (reading age), "don't see why it matters to them" (H1, segment) and "don't trust us" (unsourced numbers). Behaviour data (replays, scroll maps) is not available. |
| Structure | **gap** on home (three offers in one band) and blog index. Not checked visually. |
| Headings, spoilers not categorisers | **gap.** See 3c. |
| Calls to action | **gap.** Too many labels, and no reassurance line. See 3d. |
| Mobile researched separately | **could not run.** Mobile share is unknown. |
| Visual hierarchy, five-second test | **gap** on the home H1. The rest could not run without a browser pass. |
| Headings-only read | **done.** The argument survives on about, Midland Oil and get-started. It fails on home and the blog posts. |
| Plain-text read | **done.** The words carry the argument on most service pages. Blog posts are generic. |
| Premium check, 375px phone, polish pass | **could not run.** Needs a browser pass on each page. Planned as step 12. |
| Objection map check | **could not run.** No objection map yet. |
| Confusable ideas | Not applicable. None found. |

### SEO
| Item | Result |
|---|---|
| Page type and query type | **done** at site level. Hubs: home and the two service pages. Tool: scanner. Spokes: blog. Off-topic: Consign Comply and contract PO. |
| Page-owner map | **gap.** It is empty in the profile. One conflict found already (speed test). |
| Title, meta, H1 rules | **gap.** See 4a and 4b. |
| Entity clarity | **gap.** The home page doesn't say who it is for. |
| Who / How / Why, YMYL | **gap** on blog posts. The site is not YMYL in the strict sense, but the cost guide touches on money. |
| Technical guardrails | **done** from the HTML. Canonicals are fine. Multiple H1s on blog posts. Noindex pages in the sitemap. No images without alt text. Interstitials not checked in a browser. |
| People-first check | **gap** on most blog posts. See 4d. |
| Local SEO checklist 14 | **partly done.** Website items checked. Profile, reviews and citation items need Sean. |
| Redesign checklist | Not applicable. Nothing shipped to production in this pass. |
| Change-log entry | **gap.** `docs/seo-log.md` does not exist. Create it with the first SEO change (the phone removal changes structured data, so it should be the first entry once deployed). |

---

## 8. Sean's answers (1 Oct 2026) and what they change

All six are recorded in `docs/marketing/site-profile.md`.

| Question | Answer | What changes |
|---|---|---|
| 103 Old Hall Street | Registered office only. Customers can't visit. Sean now lives in Cleckheaton, and West Yorkshire is the main region. | Kaizen is a **service-area business**. (a) Hide the address on the Business Profile and name West Yorkshire service areas. (b) Remove `address` and `geo` from the LocalBusiness markup in `client/lib/seo.ts`, and replace the Merseyside-heavy `areaServed` list. (c) Footer: label the address "Registered office", not a location. (d) Change "Based on the Wirral" on home and about, the hero line "Trusted by Wirral trades", "Base: Liverpool" in `llms.txt`, and `foundingLocation`. (e) Liverpool blog posts keep their URLs; their titles and copy are decided once the area list is set. |
| Statistics | Trust GSC (our own data) only | Remove every general industry figure (53%, 7%, 8%, 14%, 76%, 88%, £2.6M, "8 seconds") unless a primary source is linked. Use our own Search Console numbers where we have them. Removing the £2.6M line also fixes the wrong sum. |
| Case study claims | Both clients agreed. "#1" checked October 2026. Don't name the terms. | The claims stay. Add "checked October 2026" next to each "#1", with no terms named. The "100% performance score" should also say when it was measured. |
| Consign Comply | A spin-off business that started as a one-off build. Keep it as a showcase. | Reframe the page as "a product we built that became its own business", linking to the Consigns site. Keep it noindex, but take it out of the sitemap. Contract product owner was not answered; still open. |
| Main buyer | All three: trade, local service businesses, slow WordPress sites. No genuine enquiries yet. | Low enquiries is the problem to diagnose. The home page needs to let each of the three see themselves quickly. A first test: a "Which one are you?" band with three routes, each with its own proof (Midland Oil, Helen Moore, the WordPress page). |
| Search Console | Sean has access. | Export plan below. |

### Getting the Search Console data

Claude can't be added as a Search Console user, because that needs a Google account. Either of these works:

1. **Easiest: export from the Search Console website.** Open Performance, then Search results. Set Search type to Web and Date to "Last 16 months". Search Console only keeps 16 months, so that is everything there is. Click Export and save as CSV (or Google Sheets, which Claude can read through the Drive connector). The export comes as several tables (queries, pages, countries, devices, dates). Put the files in `docs/marketing/gsc/`, or just say where they are.
2. **For query-to-page pairs** (needed for the page-owner map and cannibalisation): the export above lists queries and pages separately. Either repeat the export with a Page filter for each key page (home, the two service pages, the scanner, the cost guide), or connect Search Console to Looker Studio and export a table with both Query and Landing page.

Thin data is still useful. It shows which terms Google already links to Kaizen, which pages get shown, and whether any Liverpool impressions are worth keeping now that the region is changing.

## 9. Still open for Sean

Answered 1 Oct 2026 and recorded in the site profile: the contract product owner page stays; areas are Merseyside plus Cleckheaton, Gomersal and the area around them including Leeds and Bradford, but **don't change the service areas yet**; Sean travels to clients; Sean owns the Business Profile.

Still open:
1. **Midland Oil numbers disagree.** The homepage says more than 8 seconds to 1.2 seconds and "3x more enquiries in the first month". `/get-started/` says 9 seconds to under 2, PageSpeed 23 to 98, and "enquiries doubled". Which is right? Both are left as they were until Sean says.
2. **Helen Moore's hero photo** is an Unsplash stock image with the alt text "Helen Moore Hairdressing salon interior". A stock photo presented as the client's salon misleads. Swap in a real photo of the salon, or label it as illustrative.
3. Run `pnpm sync:seo:sanity` (needs `SANITY_API_TOKEN` in `.env`) to put the new titles and descriptions live. It overwrites the SEO fields on those Sanity pages and deletes Sanity pages whose slugs are now retired, which includes the Elementor test page.
4. **Two addresses in the footer.** The footer shows 103 Old Hall Street, Liverpool with a map pin, and separately "Registered office: Suite A, 82 James Carter Road, Mildenhall, IP28 7DE". Sean described Old Hall Street as the registered address. Which one is on Companies House? The LocalBusiness markup uses Old Hall Street. Both stay as they are until Sean confirms, because the service-area change is on hold.
5. Fix the blog post titles and descriptions in Sanity Studio by hand (they are not in the seed files): "How to Choose a Web Design Agency: Clear and Concisely", the garbled description on the failing-software-project post, "for their website" on the WordPress vs React post.

## 10. Original questions for Sean

1. What is 103 Old Hall Street: an office customers can visit, or a registered or virtual office? Is Kaizen a storefront or a service-area business on Google?
2. Which home page statistics have a source you trust? Should the rest go?
3. Did Midland Oil and Helen Moore agree to the numbers and claims shown? What are the "#1" search terms, and when was that checked?
4. Should Consign Comply and the contract product owner work stay on this site?
5. Who is the main buyer (trade? local service businesses? businesses with a slow WordPress site?), and in their words, what do they come to you for?
6. Can you give the Search Console property access, so the page-owner map can be built from real queries?

## 11. Search Console findings (export read 1 Oct 2026)

Web search, last 16 months (Jun 2025 to Sep 2026). Files Sean exported: chart, queries, pages, countries, devices.

**Almost no real search traffic.** 196 clicks and 36,642 impressions in 16 months. About 51 of the clicks listed by query come from 11 near-identical searches ("all seo agency in liverpool", "seo company in liverpool" and so on) with a 100% click rate while the site sat at positions 50 to 140. People do not scroll to page 7 and click every time, so these look like bots or ranking tools. India gives 84 clicks at a 12.8% click rate; the UK gives 67 at 0.29%, which fits. Take them out and what is left is mostly people searching for Kaizen by name. That, more than the copy, explains why the site has brought in no genuine enquiries.

**Shape over time.** Impressions peaked at about 5,000 a month in Feb and Mar 2026 at positions 30 to 40, then fell to about 1,500 a month while average position improved to about 16. Google stopped testing the site for many broad Liverpool, Wirral and ecommerce searches (mostly from the old pages) and kept it for fewer, narrower ones.

| Group | Queries | Impressions | Clicks | Read |
|---|---|---|---|---|
| Suspected bots ("seo agency in liverpool" variants) | 11 | 112 | 51 | Ignore |
| Brand ("kaizen web", "kaizen", misspellings) | 95 | 2,800 | 17 | "kaizen web" at position 12.5: own name not on top |
| Clients' names (Midland Oil, Helen Moore) | 13 | 3,068 | 3 | People looking for the client, not for Kaizen |
| Liverpool and Merseyside | 164 | 8,544 | 4 | "local seo liverpool" 3,076 impressions at position 35 |
| Wirral | 60 | 6,986 | 0 | "local seo wirral" 1,370 at position 15: the only non-brand term near page one |
| Warrington and Chester | 44 | 1,835 | 0 | From the retired location pages |
| Ecommerce, Shopify, Magento | 65 | 2,606 | 0 | From the retired ecommerce page; not a current service |
| Speed test seekers ("google speed test") | 322 | 2,252 | 0 | Want Google's own tool; do not target |
| West Yorkshire | 1 | 1 | 0 | Starting from zero |

**What Google thinks Kaizen is:** a Liverpool and Wirral local SEO agency. The local SEO page's H1 says "We're not an SEO agency". Decide whether to own "local SEO" as a service (the "fix the site" angle) or step back from it.

**Brand confusion.** About a dozen "kaizen seo ..." searches ("contact number", "is kaizen seo legit", "complaints", "client list") get around 100 impressions each. They look like people hunting for a different company called Kaizen. A verified Business Profile, the exact same name everywhere, and a few links that say "Kaizen Web" are the fix.

**Technical problems the data exposed** (fixed 1 Oct unless stated): retired pages answering 200 instead of 301; `/elementor-test-landing/` live and indexable; old blog slug returning 404; staging (`stage.kaizenweb.co.uk`) indexable, with a few staging URLs in Google (left for now at Sean's request).

**Devices.** About 30% of impressions are on phones. The real share is probably higher, because the suspected bot clicks are desktop.

**What it means.** The copy rewrite still matters, but it will not fix enquiries on its own, and with about one genuine non-brand click a month Search Console cannot measure a rewrite. Faster levers: the Business Profile as a service-area business, the redirects and clean-up done today, and the "local SEO" decision. Business Profile figures (calls, website clicks, direction requests) and real enquiries will show progress sooner than rankings.
