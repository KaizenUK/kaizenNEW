# Full site audit, second pass: copy, design and SEO

**Date:** 1 October 2026 (afternoon). **Replaces** the gaps list in `2026-10-01-site-copy-design-seo-audit.md`; that file stays as the record of the first pass and the fixes already shipped.
**Task board:** `docs/audits/2026-10-01-task-plan.md` turns every finding below into a task any agent can pick up.
**Rules audited against:** `.claude/skills/marketing-messaging`, `marketing-page-design`, `seo-strategy`, `docs/marketing/site-profile.md`, and Sean's standing rules (British English, reading age about 9, no em dashes, nothing that reads as AI-written, premium look).

## Progress: 2 October 2026, measurement complete

Final consent follow-up also verifies withdrawal followed by reload and re-acceptance, plus consent changing while the SDK loads. Eight analytics regression tests pass. The final full comparison has 1,569 tests: 1,086 pass, 439 inherited Windows failures and 44 pending, with no regressions. The two environments are brought to the corrected final commit before the goal closes.

All 40 tasks within the goal are complete. Sean explicitly deferred S-02, his Business Profile and directory changes, until afterwards; those external listings are not claimed complete. S-04 now runs in PostHog EU project 203621, deployed in `57324be` (`37009100208`). Live test events for saved contacts and scanner leads were received, excluded from the saved report and independently counted. The report reads zero measured real conversions at verification. Tracking begins 2 Oct; earlier dates are unmeasured. The monthly Search Console reminder is active. See `docs/audits/2026-10-02-s04-measurement.md` for report link, filters, dates and limitations.

The final measurement addition preserves all 53 documents' search metadata and the 22-page sitemap. Thirty-four local browser checks, twelve reviewed consent views, real-SDK withdrawal checks, eight live page comparisons and both live form probes pass. The isolated full test comparison has 1,082 passes, the same 439 inherited Windows failures, 44 pending tests and no regressions.

## Progress: 2 October 2026, after Phase P and final site audit

All eleven Phase P tasks are verified and live, alongside all Phase Q, F and B tasks. P-09 is the last page release, in 6f13109 with deployment 36990006987. The individual proofs and task board retain the release evidence. S-05 now audits the final 28-route inventory; the corrections are verified and live in 3667dac, deployment 36995212547. S-05 is complete. See docs/audits/2026-10-02-s05-proof.md for the exact scope and exceptions.

The final build preserves metadata/schema in all 53 HTML documents. The fresh sitemap has 22 self-canonical indexable pages, nine guides and three service owners. No orphan, missing destination, generic anchor or retired internal link remains; every indexable page is within two clicks of home. Local SEO is retired with a direct redirect, and overlapping software-project posts are merged.

The current copy run has zero dashes, exclamation marks, US spellings, banned words or AI-pattern hits. Marketing, guide and response pages read at ages 7.3 to 9.9. Actual paragraph sentences meet the 20-word limit; merged label fragments remain documented separately. Existing legal prose is retained, with reading ages 12.4 to 20.3 and one legitimate “Client staff” definition. This is not a claim that legal terms meet the marketing reading-age target.

The visual audit reviews all 220 final tiles across 56 desktop/phone views. All 112 local page views pass image, overflow, page-error and applicable axe checks. Final corrections address the desktop menu landmark, legal-page contrast, thank-you guide wording and contact-form labels/error recovery. The full Windows comparison retains 1,078 passing tests, 439 inherited failures and 44 pending tests, with no regression or new failure. Production verification passes: all 28 exact page comparisons, 41 internal destinations, 100 redirects, 112 live page views, 16 menu views and 22 journeys. Twelve live form captures also pass visual inspection.

### Current scorecard after Phase P and the final production audit

| Area | Verdict | Evidence and remaining work |
|---|---|---|
| SEO technical | Ownership and links verified | Current sitemap/canonicals, service-guide coverage and depth pass. All live S-05 regression checks pass. |
| Copy: house rules | Public marketing copy meets the target | Ages 7.3 to 9.9 and zero mechanical hard-rule breaches. Specialist legal prose is explicitly separate. |
| Copy: claims and proof | Reviewed and attributed | Approved client results, real work and dated primary sources; no new result or uplift claim. |
| Copy: message | Page rebuilds complete | Buyer, offer, proof and agreed action/reply are present. Sean's homepage design review remains separate. |
| Design: premium bar | Full page and screenshot review complete | All planned page rebuilds are live. All twelve final live form captures and the audit release pass. |
| Design: consistency | Shared foundations used throughout | Blog, marketing, response pages and menus use the current system; final corrections verified locally and live. |
| Mobile and accessibility | Browser checks pass locally and live | 112 page views and 16 menu views pass. All 22 final journeys and equivalent production checks pass. |
| Measurement and listings | Measurement verified; listings deferred | S-04 is complete with the explicit 2 Oct collection start and historical-data limitation. Sean deferred S-02 until after the goal. |

Earlier progress sections and scorecards below are historical checkpoints. This section and the task board give the current state.

## Progress: 2 October 2026, after Phase B

All four Phase B tasks are verified and live. B-01 ships in `1823626`, deployment `36971480599`, with eleven live content/search checks, 22 live browser views, four menu checks, four journeys and twelve redirect checks passing. Its 88 local browser views have no normal-state axe findings, page errors, missing images or overflow. The individual proof files and board retain the earlier releases. The homepage, contact, pledge and both ad pages have also shipped since the Phase F checkpoint. Seven Phase P tasks remain open; their earlier copy fixes do not constitute visual completion.

The fresh whole-site copy run covers 29 public pages, excluding builder and legacy redirect HTML. Nine articles replace the original ten after B-04, and the author profile is new. There are **22 remaining dashes**: 18 on the local SEO page awaiting P-03 retirement and four in the unchanged legal terms. No exclamation marks, US spelling or banned-word hits occur. The local SEO page retains ten AI-pattern flags; legal terms contain one staffing-word hit. These are remaining findings, not passes. Raw evidence: ignored `.local/marketing-20261001/phase-b-house-style.log`.

| Guide | Reading age | Average sentence | Actual sentences over 20 |
|---|---:|---:|---:|
| Website speed report | 9.0 | 10.4 | 0 |
| Fix or rebuild a software project | 9.8 | 11.2 | 0 |
| WordPress versus React | 8.0 | 9.6 | 0 |
| Hidden website costs | 8.4 | 10.0 | 0 |
| Website mistakes | 8.8 | 9.9 | 0 |
| Local search checklist | 9.6 | 10.3 | 0 |
| Choosing a web designer | 9.0 | 10.5 | 0 |
| Website costs | 9.1 | 9.8 | 0 |
| Why we rebuilt our site | 9.2 | 10.9 | 0 |

All nine guides have primary sources, real examples, service/contact links, Sean's linked byline and an explicit checked date. Original publication dates remain separate. Their hard-rule, staffing and AI-pattern counts are zero. The index reads at age 9.9; its checker merges card headings/author labels with prose, producing six artificial long sentences. Its actual ten prose paragraphs average 10.6 words per sentence, longest 17. The author page reads at 9.0; its button/reply concatenation is documented in B-02. Heading and paragraph boundaries were checked separately without weakening the checker.

The B-01 visual review covers all 100 new desktop/phone tiles: index and all nine posts, with home/contact/author controls. All images load and no tile has overflow, clipping or empty card bands. Main navigation, fonts, colours and footer now match the marketing site. The 375px index is 6,188px, down from 7,192px. Four menu states and private quote/code/table/action/video captures were also inspected. The blog's missing main landmark is fixed. Open desktop menus retain one inherited axe best-practice `region` finding for the React Aria portal/hidden Dismiss control, reproduced on the unchanged homepage at both desktop widths. Resolve or explicitly reassess that shared-menu finding during final S-05; B-01 does not change its source.

### Current scorecard after Phase B

| Area | Verdict | Evidence and remaining work |
|---|---|---|
| SEO technical | Ownership and links verified | S-01/S-03 complete; all 23 indexable pages remain linked. Article source/author review and the B-04 direct 301 are verified. Recheck after P-03. |
| Copy: house rules | Blog rewritten, remaining page findings identified | All nine guides meet their gate. Local SEO retirement and unchanged legal-copy flags remain. |
| Copy: claims and proof | Reviewed sources and real examples available | Published source reviews, explicit checked dates and approved client results replace unsupported claims. No ranking or enquiry uplift is inferred. |
| Copy: message | Main homepage released | P-01 is live; Sean's review is pending before its bespoke patterns are reused. Other P briefs/rebuilds remain. |
| Design: premium bar | Blog released; remaining P pages open | All B-01 tiles reviewed. Seven page tasks still need their final design/retirement/report-preview work. |
| Design: consistency | Blog now uses the main foundations | Shared fonts/navigation/footer and light reading styles pass local and live checks. Final shared-menu follow-up remains. |
| Mobile | Blog cards corrected | No overflow in all 100 captures; no stretched card rows. Final whole-site review follows the remaining P tasks. |
| Measurement | Not yet verified | Monthly export reminder is set. Analytics account and 30-day conversion evidence remain S-04; Business Profile changes remain Sean's S-02 action. |

## Progress: 2 October 2026, after Phase F

All seven foundations are implemented, verified and live on production at `8b263e6`. The site now has isolated Untitled UI tokens, three agreed action labels, corrected heading proportions and smaller WOFF2 loading, two section-spacing sizes, a shared server-rendered FAQ, accessible marketing navigation, one static footer and reusable client proof. Each foundation's commit and release evidence is linked from the board. P-01 remains the first full page rebuild; these changes do not mark any Phase P task complete.

The fresh final-build house-style run covers the same 29 public pages as Phase Q. It finds **51 dashes on six pages**, down from 63 after Q and about 190 in the original audit. There are no exclamation marks, US spelling or banned-word hits. Remaining dashes: home 10, local SEO 18, pledge 6, get-started 8, review 5 and terms 4. These unchanged sections remain for the later page tasks and final audit. Source: ignored `.local/marketing-20261001/phase-f-house-style.log`.

| Current marketing page | Reading age | Average sentence | Sentences over 20 | Dashes | AI patterns |
|---|---:|---:|---:|---:|---:|
| Home | 8.8 | 9.3 | 4 | 10 | 8 |
| WordPress | 7.2 | 9.3 | 0 | 0 | 0 |
| Local SEO, awaiting retirement | 10.1 | 10.4 | 11 | 18 | 10 |
| About | 7.1 | 8.1 | 0 | 0 | 0 |
| Contact | 6.6 | 9.4 | 0 | 0 | 0 |
| Scanner | 7.4 | 8.7 | 0 | 0 | 0 |
| Product owner | 8.0 | 8.7 | 0 | 0 | 0 |
| Case studies index | 8.8 | 10.5 | 1 | 0 | 0 |
| Midland Oil | 8.7 | 9.7 | 1 | 0 | 0 |
| Helen Moore | 9.2 | 10.8 | 0 | 0 | 0 |

The case-index and Midland long-sentence flags join independent badges or link labels; they are not newly lengthened prose. Their visual rebuilds still remain P-07/P-08. The newly adopted homepage proof bands were checked separately from the unchanged narrative: review excerpts age 9.7, Midland age 9.3, no long sentences or hard-rule/staffing/AI hits. The four shared FAQs also meet the copy gate. Whole-home age alone does not make its remaining copy acceptable.

The ten blog bodies still measure ages 13.8 to 16.9, and the index is 13.4. B-01 to B-03 still own their presentation, sources, author and readability. The checker omits article-header excerpts; this table is not a replacement for those checks. No search-ranking or conversion improvement is inferred.

Visual re-audit uses the official page-shot runs made and reviewed through the foundation changes. F-04 covers all 18 marketing/ad/legal routes at both widths; F-05 covers all four changed FAQs; F-06 adds the blog index, cost guide, every navigation state and corrected footer; F-07's final normal-state run covers home, WordPress and contact, with all 30 tiles inspected. The final F-07 native-focus correction changes no normal layout and has four further inspected captures. Earlier captures are identified by task, not described as new final-build captures. All reported views have zero horizontal overflow. Proof notes record the full review and browser coverage. Current phone heights are 14,300px for home, 9,586px for WordPress and 2,557px for contact; WordPress is below the P-02 length target, but its new hero/cards are still required.

### Current scorecard after Phase F

| Area | Verdict | Current evidence and remaining work |
|---|---|---|
| SEO technical | Core fixes retained | Existing metadata/schema/URLs preserved through the foundations; FAQs are in initial HTML. Complete ownership and internal-link work remains S-01/S-03. |
| Copy: house rules | Much improved, unfinished | 51 dashes remain on six pages. Rewritten service/about/contact/proof copy meets targets; home, retirement, pledge, ads and blog work remain. |
| Copy: claims and proof | Core claims corrected | Scanner flow and Midland results match the evidence; readable Google excerpts and a real case-study screenshot are reusable. Later page/blog claims still need review. |
| Copy: message | Homepage rebuild required | Its H1 is still a slogan. Buyer routes, the main purchase doubt and proof in the first screen remain P-01. |
| Design: premium bar | Foundation ready, pages unfinished | Reusable controls, type, spacing and proof are verified. Heroes, case-study index, product-owner page and blog still need their full rebuilds. |
| Design: consistency | Shared marketing system in place | Three action styles, shared FAQ, header/footer and proof are available. Blog body/header design remains B-01. |
| Mobile | Layout faults fixed, page work remains | Zero overflow in reviewed captures; contact is shorter and WordPress is below 10,000px. Home and retiring local SEO remain long; P tasks own the new page structure. |

The original scorecard and numbered findings below remain a dated baseline. The task board and dated progress sections are the current state.

## Progress: 1 October 2026, after Phase Q

Phase Q corrects the scanner flow and Midland figures, phone layout faults, duplicate footer asks, literal arrow text, missing image dimensions, blog titles/raw links, orphan body links and exposed implementation names. Proof notes are linked from the task board. Copy preparation for later page rebuilds was included where required by the house-style gate; those rebuilds remain open.

The fresh production-build audit covers 29 current public pages, including six noindex/legal routes outside the sitemap. The retired Consigns page is excluded. The checker finds 63 dashes across six unchanged pages, down from about 190 in the original pass. It finds no exclamation marks, US spellings or banned hype words. Article-header excerpts are omitted by the current checker, so screenshots and CMS data were also inspected; the local-search excerpt's remaining dash was corrected.

| Page changed in Phase Q | Reading age | Average sentence | Sentences over 20 | Dashes | AI patterns |
|---|---:|---:|---:|---:|---:|
| WordPress | 7.2 | 9.3 | 0 | 0 | 0 |
| Scanner | 7.4 | 8.7 | 0 | 0 | 0 |
| About | 7.1 | 8.1 | 0 | 0 | 0 |
| Contact | 6.6 | 9.4 | 0 | 0 | 0 |
| Product owner | 8.0 | 8.7 | 0 | 0 | 0 |
| Case studies index | 8.4 | 9.1 | 0 | 0 | 0 |
| Midland Oil | 8.7 | 9.6 | 0 | 0 | 0 |
| Helen Moore | 9.0 | 10.4 | 0 | 0 | 0 |

| Area | Updated result | Still open |
|---|---|---|
| Claims | Scanner explains email and PDF download; Midland figures match the profile; blanket security/ranking promises removed from rewritten pages | Check claims in the remaining P/B tasks |
| Copy | Eight edited marketing pages meet age, sentence and hard-rule targets | Home, local SEO, pledge, landing pages and blog rewrites; terms has four dashes |
| Links | All 58 raw URL labels in nine posts replaced; four orphan destinations now have body links | Full S-03 crawl and remaining service links |
| Images | Zero missing dimensions on all 16 Midland images and every blog cover | Proof placement, new case-study cards and blog imagery |
| Phone layout | Hero overlap, empty benefits cell, wrapping step numbers and small form fields corrected; reviewed pages have no horizontal overflow | Long pages, typography and design foundations |
| Visual consistency | Duplicate footer ask and literal arrows removed | Untitled UI adoption, shared type/buttons/FAQ and full page rebuilds |

The ten blog posts still measure ages 13.8 to 16.9; targeted metadata and link fixes do not complete B-03. No search-ranking or conversion improvement is inferred from this release. The original findings below remain as the baseline, not the current completion state.

## What this pass covered (and the first pass did not)

| Area | First pass | This pass |
|---|---|---|
| Copy | Mechanical house-style checks on 32 pages | Same checks re-run on 30 live pages with a reusable tool (`scripts/audit/house-style.mjs`), plus claim checks on every page reviewed |
| Design | Headings and button labels from the HTML only | Full-page screenshots of 15 key pages at 1440px desktop and 375px phone (`scripts/audit/page-shots.mjs`), reviewed section by section; layout metrics (overflow, small text, tap targets) |
| SEO | Titles, meta, headings, structured data, sitemap, redirects, Search Console | Re-checked after the fixes went live, plus internal links, link text, outbound sources, images, authorship, orphan pages |
| Untitled UI | Not available | Catalogue reviewed; mapped to the gaps (section 5) |

**Still not possible from here, and why:** buyer research (no enquiries or customer interviews yet; see DEC-01); user testing with real people; competitor and search-results review (worth doing once the page-owner map exists); the Google Business Profile itself (Sean's account).

## Original scorecard, 1 October before Phase Q

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
