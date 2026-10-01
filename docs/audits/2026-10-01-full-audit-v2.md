# Full site audit, second pass: copy, design and SEO

**Date:** 1 October 2026 (afternoon). **Replaces** the gaps list in `2026-10-01-site-copy-design-seo-audit.md`; that file stays as the record of the first pass and the fixes already shipped.
**Task board:** `docs/audits/2026-10-01-task-plan.md` turns every finding below into a task any agent can pick up.
**Rules audited against:** `.claude/skills/marketing-messaging`, `marketing-page-design`, `seo-strategy`, `docs/marketing/site-profile.md`, and Sean's standing rules (British English, reading age about 9, no em dashes, nothing that reads as AI-written, premium look).

## What this pass covered (and the first pass did not)

| Area | First pass | This pass |
|---|---|---|
| Copy | Mechanical house-style checks on 32 pages | Same checks re-run on 30 live pages with a reusable tool (`scripts/audit/house-style.mjs`), plus claim checks on every page reviewed |
| Design | Headings and button labels from the HTML only | Full-page screenshots of 15 key pages at 1440px desktop and 375px phone (`scripts/audit/page-shots.mjs`), reviewed section by section; layout metrics (overflow, small text, tap targets) |
| SEO | Titles, meta, headings, structured data, sitemap, redirects, Search Console | Re-checked after the fixes went live, plus internal links, link text, outbound sources, images, authorship, orphan pages |
| Untitled UI | Not available | Catalogue reviewed; mapped to the gaps (section 5) |

**Still not possible from here, and why:** buyer research (no enquiries or customer interviews yet; see DEC-01); user testing with real people; competitor and search-results review (worth doing once the page-owner map exists); the Google Business Profile itself (Sean's account).

## Scorecard

| Area | Verdict | One line |
|---|---|---|
| SEO technical | Good | The first pass fixed the big items. What is left is content quality, link text and the local decisions. |
| Copy: house rules | Poor | About 190 dashes remain, reading ages 9 to 17, AI-sounding patterns on most pages. Only contact and pledge are near target. |
| Copy: claims and proof | Mixed | Three pages still state different Midland Oil figures; the scanner claims "No sign-up" but asks for an email. |
| Copy: message | Weak | Pages say what Kaizen does, but not who it is for. The home H1 is a slogan. No page names the three buyer types. |
| Design: premium bar | Below bar on most pages | Strong craft in places (Midland case study, phone journey on local SEO), but most heroes are text only with an empty half, and bands look sparse or unfinished. |
| Design: consistency | Poor | Four button styles, three heading treatments, two sites' worth of design (the blog is a different brand), FAQ styled two ways. |
| Mobile | Fair | No horizontal scroll anywhere. Big empty gaps carry over; one overlap bug; very long pages (local SEO is 21,700px on a phone). |

## 1. Copy findings

**COPY-1. Dashes, reading age and AI patterns (house rules).** Live baseline from `node scripts/audit/house-style.mjs` (1 Oct, after the first fixes):

| Page | Reading age | Avg sentence | Sentences >20 words | Dashes | AI patterns |
|---|---|---|---|---|---|
| `/services/wordpress-web-design/` | 13.1 | 15.1 | 11 | 46 | 6 |
| `/services/local-seo/` | 11.3 | 11.2 | 19 | 29 | 13 |
| `/case-studies/midland-oil-group/` | 13.3 | 13.3 | 13 | 28 | 4 |
| `/` | 10.5 | 10.5 | 8 | 11 | 11 |
| `/performance-scanner/` | 10.8 | 10.8 | 4 | 11 | 3 |
| `/about/` | 10.5 | 10.0 | 5 | 8 | 4 |
| `/get-started/` | 9.8 | 11.5 | 4 | 8 | 4 |
| `/pledge/` | 9.2 | 10.6 | 4 | 6 | 2 |
| `/review/` | 9.9 | 11.3 | 3 | 5 | 2 |
| `/contract-product-owner/` | 13.9 | 15.7 | 15 | 0 | 4 |
| `/case-studies/` | 14.9 | 16.7 | 1 | 2 | 0 |
| `/contact/` | 9.8 | 10.8 | 0 | 0 | 0 |
| Blog posts (10) | 14.4 to 16.9 | 13.4 to 19.1 | 3 to 15 each | 0 to 3 | 0 to 6 |

Targets: 0 dashes, reading age 10 or under on marketing pages (about 9 is the aim), average sentence 12 words or fewer, no sentence over 20 words. Blog guides may sit a little higher (11) where a technical term cannot be avoided, but the sentences still stay short.

**COPY-2. Claims that are wrong or unproven.**
- `/services/wordpress-web-design/` "Real result" card: "8.4s → 0.4s", "Load time: 0.4 seconds. Rankings improved within weeks." Sean confirmed the figures are more than 8 seconds before and 1.2 seconds after. "Rankings improved within weeks" has no evidence on file.
- `/performance-scanner/`: "No sign-up. No install." The scanner asks for an email before showing results (`client/components/SpeedScanner.tsx`). "Get answers in 30 seconds" is not measured.
- `/case-studies/midland-oil-group/`: "150+ years combined experience". Midland's own site (in our screenshot) says "40+ years". Needs the client's answer.
- `/case-studies/midland-oil-group/`: "Technology provided on license" should be "licence" (noun).
- `/services/local-seo/` "The maths": "£500 to £2,000 a month" retainer range and "£0 after" are market claims with no source; "#1 for local search terms" is dated, which is right.
- `/services/wordpress-web-design/` "This section loaded faster than your homepage" and "Sub-second loads, perfect Core Web Vitals": unverifiable as written.
- Consigns page: removed from the site on 1 Oct 2026 at Sean's request (it is a separate business); its address redirects to the home page.

**COPY-3. Message: who is it for?** The home H1 "Always Be Better." is a slogan. The subhead says what Kaizen does but not for whom. None of the three buyer types (trade and industrial, local service businesses, slow WordPress sites) is named on the home page, so a visitor cannot "see themselves" (messaging skill, step 2). The case studies index heading ("Proof, trimmed to the work that matters most") and the blog's old framing were written from Kaizen's side, not the buyer's.

**COPY-4. Staffing rule.** `/contract-product-owner/` still says "I'm Sean McDonnell, founder of Kaizen. While we are a full-service agency, this is my specialist service", "manage your team", "the team is confused". The profile says never imply a team or a solo setup. Home and about still say "We're not a big agency with layers of account managers".

**COPY-5. Repetition and templated feel.** The same "same person from first conversation to final delivery. No handoffs. No surprises. No 'I'll pass that on.'" block appears on home and about. Two-tone headings ("Keep everything / you've already earned.", "Three paths forward. / One of them is yours.") are used on nearly every section, which makes the site read as a formula.

**COPY-6. SEO-first copy.** The WordPress page's "Which one is right for me?" table is built from quoted search phrases ("WordPress not ranking on Google", "Should I rebuild my WordPress site?"). It reads as written for search engines (seo-strategy, "Use the term naturally").

## 2. Design findings (from the screenshots)

**DES-1. Heroes do not carry proof or a picture.** Home, WordPress, local SEO, about, scanner, pledge, review and contract product owner heroes are text in the left half with the right half empty. Home adds floating diamonds that say nothing about the business. The one real asset that sells (the Midland Oil before/after screenshots) sits far down the page. Premium check fails.

**DES-2. Four button styles.** Blue gradient pill (header, service pages), black square (home), white square (footer), teal-to-green gradient (case studies, contract product owner), plus text links with literal "->" characters (case studies, Helen Moore). About 20 different labels for the same few actions ("Start Your Project", "Talk to Us", "Start a project", "Get in touch", "Get a quote like this", "Free Site Audit", "Run a free audit", "Free site scan", "Get a technical audit"...).

**DES-3. Typography.** Manifa V2 headings are loaded as a TTF without font metric overrides, so every multi-line heading has double-height gaps between lines ("We're not an / SEO agency." spans 300px). Body text switches between DM Sans, Inter (blog) and a monospace font (case study labels). Eyebrow labels at 12px light grey are hard to read.

**DES-4. Empty and unfinished bands.**
- Home "What we actually do": three rows with about 200px of empty space around each and tiny right-aligned links.
- Home "Why Kaizen" bento grid: an empty grey cell bottom right.
- Home "Sound familiar?" scroll-reveal: lines stay light grey until scrolled past, low contrast.
- Local SEO "Do no harm" list: step numbers wrap ("0" above "1"), a layout bug.
- Service page FAQs are unstyled native `<details>` with 12px questions and default black triangles, while the home FAQ is styled.

**DES-5. Repeated closing blocks.** Every page ends with a dark "final CTA" band and then a dark footer that repeats the same two buttons and a second big heading ("Websites built properly."). The footer lists "Blog" twice.

**DES-6. Case studies index has no images.** Two text rows with service tags; no screenshots, no numbers. The proof page looks the least like proof.

**DES-7. The blog is a different site.** Dark "Linear" theme, Inter font, its own header ("Insights / Articles / Case Studies / Start Project"), monospace dates, a huge empty featured card, AI-generated stock-style images, and "KA Kaizen" as the author. It does not match the main site and does not look like Sean.

**DES-8. Contract product owner page is off-system.** The H1 breaks one word per line, the page uses a different left margin, a gradient button and long text blocks. It looks like an older template.

**DES-9. Mobile.** No horizontal overflow on any page (good). The home hero diamond overlaps the "Free Site Audit" button. Large empty gaps carry over. Local SEO is 21,700px tall on a phone and the WordPress page 15,100px; both need progressive disclosure (accordions, tabs) for the detail. Contact form puts first name and surname side by side at 375px; check the input text is 16px or more so iPhones do not zoom.

**DES-10. Strong pieces to keep and build on.** Midland Oil case study (real before/after screenshots), the local SEO phone journey mock-ups, the home before/after speed demo, the reviews carousel, the dark/light band rhythm when it is used with intent.

## 3. SEO findings

**SEO-1. Blog posts still show the old titles** (Sanity post fields, not seeded): "How to Choose a Web Design Agency: Clear and Concisely", "Free Website Speed Test: Check Your Score Now" (competes with `/performance-scanner/`), "Fixing Failing Software Project vs Rebuilding".
**SEO-2. Raw URLs as link text.** Seven blog posts end with a link whose text is "https://kaizenweb.co.uk/contact/". Anchor text should say what happens ("Talk to us about your website").
**SEO-3. Orphan posts.** `/blog/free-website-speed-scan/`, `/blog/more-than-a-refresh-why-we-rebuilt-the-kaizen-website/` and `/blog/software-project-rescue/` have no links from any page body (only the blog index). `/pledge/` has none from page bodies either.
**SEO-4. No sources, no author, no checked date.** No blog post links to a primary source; none names a real author; none says when it was checked. The cost guide and the local SEO checklist give money and ranking advice, which the quality bar treats strictly (seo-strategy, "Who, How, Why").
**SEO-5. Thin and overlapping posts.** "When a Software Project Starts to Go Wrong" and "Fixing a Failing Software Project vs Rebuilding" cover the same ground; several posts are generic agency advice with no Kaizen example.
**SEO-6. Page-owner map is still empty.** Search Console data is in hand (see the first audit, section 11). Open question: own "local SEO" as a service, or step back from it (the local SEO page H1 is "We're not an SEO agency").
**SEO-7. Images.** Sixteen images on the Midland case study and the main image on every blog post have no width and height, so the page jumps while loading.
**SEO-8. Local.** Business Profile address shown customers cannot visit (on hold with Sean); `areaServed` lists Merseyside only; West Yorkshire appears nowhere on the site. On hold until Sean decides.

## 4. Decisions only Sean can make

Listed with recommendations in the task board, section "Decisions". In short: main buyer order and the one-line pitch (blocks the home rewrite); the primary action and what happens after it (blocks the button clean-up and contact page); the local SEO stance; photos of Sean and real work; client logo and quote permissions; Midland's "150+ years"; the contract product owner page voice; the Business Profile address.

## 5. Untitled UI (Pro): where it fits

Untitled UI React is Tailwind CSS v4 plus React Aria, the same Tailwind version as this site, so its components sit inside the existing Astro and React islands. It installs with `npx untitledui@latest add <component>`; Pro components need `npx untitledui@latest login` on Sean's account first. Its `theme.css` brand colour defaults to purple, so the theme must be mapped to Kaizen's tokens (Manifa V2 for display, DM Sans for body, Kaizen dark, cyan and the blue CTA gradient) before anything ships. The existing UI kit in `client/components/ui/` is shadcn on Radix and is used by the builder app; leave it there and use Untitled UI for marketing pages only.

| Gap | Untitled UI category |
|---|---|
| DES-1 text-only heroes | Hero header sections (44): split hero with screenshot or device mock-up |
| DES-2 button chaos | Buttons (base): one primary, one secondary, one link style |
| DES-4 FAQ two ways | FAQ sections (16) |
| DES-5 closing blocks | CTA sections (20), Footers (40) |
| DES-6 case studies without images | Blog sections or Features sections with image cards; Metrics sections (16) for the numbers |
| DES-7 blog off-brand | Blog sections (24), Blog post pages (10), Content and rich text sections (22) |
| Proof near the action | Testimonial sections (26), Social proof sections (12, needs logo permission) |
| About page with no person | Team sections (14), About pages (10) |
| Contact page | Contact sections (36), Inputs (16px text, labels, errors) |
| Service page detail on phones | Tabs (application UI), accordions within FAQ sections |

## 6. Full checklist pass

| Item | Result |
|---|---|
| Messaging steps 1 to 5 | Step 1 could not run (no customer evidence; DEC-01). Steps 2 to 5 assessed against the profile: COPY-3 to COPY-6. |
| Clarity rules and house voice | Run on all 30 live pages (COPY-1). |
| Proof rules | COPY-2. |
| Design diagnosis table | Main problems: "don't see why it matters to them" (no buyer named), "don't trust us" (proof low and inconsistent), "can't understand the words" (reading age). |
| Headings as spoilers | Mostly spoilers already; categorisers remain ("What we actually do", "Local SEO FAQ", "Featured Case Studies", "What to Expect"). |
| Calls to action | DES-2. |
| Mobile | DES-9. Mobile share is about 30% of search impressions (profile). |
| Premium check | Fails on most heroes and on the case studies index, blog and contract product owner page (DES-1, 6, 7, 8). |
| Polish pass | DES-3, DES-4, DES-9. |
| Page types, page-owner map | SEO-6. |
| Title, meta, H1 rules | Pages fixed and live; blog posts outstanding (SEO-1). |
| Quality bar (Who, How, Why) | SEO-4, SEO-5. |
| Technical guardrails | Good: redirects, sitemap, noindex staging, structured data. SEO-7 outstanding. |
| Local SEO checklist 14 | Website side partly done; profile side waits on Sean (SEO-8). |
| Change log | `docs/seo-log.md` is in use. |
