---
name: seo-strategy
description: "Read before deciding WHAT SEO content to write or change, for Kaizen's own site or any client site: the page-type taxonomy, keyword to page ownership, the cannibalisation and new-content decision rules, keyword research, the quality bar (helpful content, EEAT, YMYL), earning authority and links, local SEO (Business Profile, reviews and UK review law, location pages, LocalBusiness markup), audits and measurement. Grounded in The Art of SEO (4th ed.) and Google's Search Quality Rater Guidelines and Search Central docs. Pairs with marketing-messaging and marketing-page-design. Needs the project's site profile."
metadata:
  author: Kaizen Web (method first written for Consigns, 24 Sep 2026; generalised 1 Oct 2026)
---

> Built from a full read of *The Art of SEO* (4th ed., Enge, Spencer and Stricchiola, O'Reilly 2023), then checked against Google's own documents: the Search Quality Rater Guidelines (11 Sep 2025 edition, "SQRG") and five Search Central pages (Search Essentials, spam policies, helpful content, SEO Starter Guide, AI features; read as updated to Aug 2026). Where Google and the book differ, Google wins. What the authors say vs what we concluded is in `references/sources.md`. Reusable tables (keyword sheet, page-owner map, content audit, link targets, audit and migration checks) are in `references/working-tools.md`.

## Orientation

This is the **content strategy and decision layer** for SEO: which pages exist, what each owns, how to add or change content without cannibalising, and how a site earns the authority to rank. **What a page says** is `marketing-messaging`; **how it looks and is structured** is `marketing-page-design`. The **implementation** (the site's head/SEO component, sitemaps, robots, structured data) lives in each site's code.

**Per site, read the site profile first** (`docs/marketing/site-profile.md`; template in `../marketing-messaging/references/site-profile-template.md`). It holds the page-owner map, the terms not to target, the topic boundary, and where the live data and logs are.

**Where the live truth lives (this skill is deliberately durable, not a ranking snapshot):**
- **The SEO change log** (default `docs/seo-log.md`): the running strategy, baseline and every SEO-relevant change with its date.
- **The issue tracker**: the live content backlog, each item with angle, terms, internal links and priority.
- **Google Search Console**: query x page positions; the only timely data source. **Treat any position number as stale the moment it's written down.** GSC keeps 16 months only: export it (AoS ch8).
- **Volume tools** (Ahrefs, Ubersuggest or similar): use the right country.

## The usual situation, and the strategy

Most sites we build are young, small, compounding domains. The common diagnosis is **"rank problem, not relevance"**: shown for the right terms but sitting on page 3+ where clicks are about 0. Two intents need two homes: **commercial/buyer terms -> product, service and hub pages**; **informational terms -> guides that funnel up**. The ceiling is usually **authority** (few links). The Art of SEO is clear on how to lift it: authority is earned by being worth citing (original data, genuinely useful tools, expert commentary, relationships in the trade), not by acquiring links as a task, and "nobody wants to link to you just to help you make money" (AoS ch11), so links go to useful content, which then passes authority up through internal links. A weak site also gets less benefit of the doubt on quality (AoS ch9), so **the quality bar is higher, not lower**: fewer, better pages. Stay **tightly on the site's topic** so Google keeps the right association (off-theme content weakens a site, AoS ch7 "Content Themes").

## Page-type taxonomy (how to structure a site)

- **Commercial hubs / cornerstones**: own the money terms; everything links UP to them.
- **Product or service landing pages.**
- **Segment landing pages** (one per audience or industry). **Each must carry genuinely different content** (the segment's work, documents, objections). Pages that differ only by the segment or place noun are the "too-similar pages" the book calls thin (AoS ch9, ch10) and fit Google's "doorway abuse" examples ("substantially similar pages that are closer to search results than a clearly defined, browseable hierarchy"); merge them rather than ship them. Location pages follow the same rule.
- **Comparison and "alternative" pages**: honest, from public information, usually not in the main nav.
- **Informational guides / spokes** (the compounding engine): each must add something a reader cannot get from the official or obvious source in one click, or it is thin.
- **Tools/utilities** (checkers, calculators, generators). A tool must do exactly what it says: Google's spam policies name "misleading functionality", and the SQRG's example of a top-rated tool page is a calculator that is "functional and easy to use". Large sets of near-identical generated pages (a page per code, per postcode) are usually better noindexed.

## The rules (the decision layer)

- **Hub-and-spoke.** Every informational spoke links **UP** to at least one hub and **ACROSS** to the money pages the site profile names (product, pricing, contact).
- **New content decision tree.** Before creating a page: (1) pull GSC: does an existing page already get impressions for the term? If yes, **strengthen/extend it, don't make a competitor**. (2) Is it a genuinely distinct intent that needs its own page, or a variant the owner page should answer in a section? Long-tail variants are won by enriching the owner page, not by a page per phrase (AoS ch7 "Long-Tail Keyword Targeting"). (3) Can you write a unique title that no sibling page could carry? If not, the page probably should not exist (AoS ch7, ch10). (4) Would an expert in the field reading it learn something or save time? If not, don't publish.
- **Cannibalisation discipline.** Keep a **page-owner map** (term -> one URL) in the site profile. A sibling page's head term never goes in another page's title. When a page's phrase contains a broader page's term, link back to the broader page with that term as the anchor (AoS ch7 "Keyword Cannibalization"). When the site's own pages split a term, flag it but defer the internal-link surgery until the cluster settles (~2 weeks) so you measure one change at a time.
- **Official-service queries are not ours.** Someone searching to log in to, register for or apply through an official service wants the official site. Help them get there with a plain link; never target the query or let a page look like the official service. Google's spam policies treat impersonating an official service as scam and fraud, and the SQRG rates pages that deceive about who is behind them as Lowest.
- **Garden paths: high volume, WRONG audience, do NOT target.** List them in the site profile. The book's version: relevance beats popularity, and a visitor who lands on the wrong promise is a cost (AoS ch6 "Evaluating Relevance").
- **Exact buyer terms are often tiny**: own them, but they're bottom-funnel capture, not a traffic source; the volume usually lives in informational terms.
- **House copy and facts**: the site's house voice; every regulated fact verified against the primary source before it ships.
- **When you ship a page**, do the full plumbing in the same change (sitemap, internal links, nav or footer where it belongs, and a test where practical).

## Keyword research (AoS ch6, adapted)

- **Order of value** (the authors' hierarchy): **priority to the business > relevance > popularity > difficulty**. A 20/mo term a buyer types when ready to buy beats a 2,000/mo term from the wrong audience.
- **Sources, best first:** GSC queries (the most valuable Google data you have); site search and chat openers; how the owner and prospects actually say it (the book names salespeople as the best source of exact customer language); noncustomers and newcomers to the trade; trade bodies, regulator vocabulary and trade press; competitors' vocabulary; autocomplete, People Also Ask, AlsoAsked, then tool volumes. Feed memorable phrases into the site's voice-of-customer log as well.
- **Map the question journey**, not single keywords: for each topic, work back to the earliest question a buyer asks ("do I need...", "what happens if...") and forward to the buying question. Aim for the whole journey across hub and spokes; one short article rarely satisfies a broad query (AoS ch15 "Meeting Searcher Intent").
- **Keep local wording**: UK vs US variants are different queries (the book's own example is prawn vs shrimp). Check spelling pairs and trade terms. Never insert misspellings.
- **Tiny volumes are normal in niches.** Filter, don't delete: small numbers can be tool noise, but a low-volume term with clear buyer intent stays. Break hard terms into specific long-tail variants.
- **Striking distance first**: pages ranking roughly 11 to 20 respond fastest to title, heading and content work; don't pour effort into a term at #90 (AoS ch6 "Rank threshold values").
- **Review monthly** and on events (a regulation change, a deadline, a competitor launch). Keep dated copies.
- The opportunity score in the book (relevance x priority x volume / difficulty x rank) is a sorting aid, not a formula to obey.

## Writing and page rules that affect ranking (AoS ch7, ch10, ch11)

- **Title tag**: the target term first, brand last, under ~60 characters. It must say what the reader can do here. Google rewrites titles that are inaccurate, off-query or overly self-promotional (AoS ch10): check the SERP and learn from its rewrite before fighting it.
- **Meta description**: honest, a soft sell, what the reader gets. Not a ranking factor; it earns the click.
- **H1** carries the term plainly; it can be more conversational than the title. The hero message can live in the H1 when it reads naturally, or in the subhead; never bury the term to fit a slogan.
- **Never brief writers with keyword lists, densities or word counts.** SEO-centric instructions like these are a warning sign of search-first content (AoS ch9, ch10 "Content That Is Not Helpful to Users"). Give the writer the question journey and the reader; let the expert write; then check the title, H1 and that the expected subtopics are covered.
- **Use the term naturally**: in the title and H1, then as a person would say it, with synonyms. Read it aloud; if it seems spammy to you, it will seem spammy to Google too (AoS ch11 "Don't Spam, and Don't Hire Spammers").
- **Commercial pages need content that helps a buying decision**, woven into the page, never a text block dumped at the bottom for search engines (AoS ch10 "Commercial content audits").
- **Link out to primary sources** (official guidance, legislation, regulators, standards bodies). Citing sources is part of trust (AoS ch7 EEAT).
- **Descriptive anchor text** on internal links, never "click here" or "learn more".

## The quality bar: helpful content and EEAT (AoS ch3, ch7, ch9, ch10)

- **Weak pages can drag the whole site.** Google's helpful-content signal was sitewide and recovery took months after a fix (AoS ch9; since folded into core ranking, check current Google docs). Low-value pages are not free: improve them, merge and 301 them, noindex them as a stopgap, or remove them.
- **Search-first content is the risk**, not AI as such. Google's own warning signs include: producing lots of content on many topics hoping some ranks; mainly summarising others; writing because a topic is trending; leaving readers needing to search again; "writing to a particular word count" ("No, we don't" have a preferred one); entering a niche "without any real expertise" for the traffic. Full self-check in `references/working-tools.md`. AI output is fine for outlines, clustering and question lists; it never ships as a page without an expert rewriting and fact-checking it (AoS ch2, ch11; Google's spam policies call mass AI pages without added value "scaled content abuse").
- **Decide whether the site is YMYL.** The SQRG's test: "Would a careful person seek out experts or highly trusted sources to prevent harm?" Health, money, legal, safety and compliance topics usually are. The SQRG puts "instructions on how to fill out tax forms" in the must-come-from-experts column; any "how to fill in an official form" guide is the same kind of page. YMYL pages are held to "very high Page Quality rating standards", and a lack of expertise alone is enough for a Low rating (SQRG 2.3, 3.4.1, 5.1).
- **What a YMYL page needs** (SQRG 2.5, 3.4, 5.5; Google's "Who, How, and Why"):
  - **Who**: a byline where a reader would expect one, leading to a real author page (background, experience, how to verify it), and an About page saying who runs the business, with company details and contact. Never a made-up or inflated profile: fake or AI-generated author profiles are Lowest; overstated "I'm an expert" claims are Low.
  - **How**: say how the page was checked (against which official pages) and link them. If automation ever substantially writes a page, say so.
  - **Why**: made for the site's buyers who would find it useful if they came straight to the site, not to catch searches.
  - **Accuracy consistent with the official source.** Mild inaccuracies make a page Low; harmful ones Lowest (SQRG 5.2, 4.5).
  - **A reviewed date that means something.** Google lists "changing the date of pages to make them seem fresh when the content has not substantially changed" as a warning sign. Bump the date only after a real review, and review promptly when rules or dates change. For queries about current rules, a stale answer is useless to the searcher (SQRG 18.0).
- **Plain English on top of official guidance is a legitimate model.** The SQRG says paraphrasing "may be valuable, for example when an expert paraphrases the contents of a government policy in easy-to-understand language". But a page that only restates the official source with "commonly known information" is Low. Add what the official source doesn't give: worked examples, the real mistakes people make, how it works on a real job, the joins between rules, and tools.
- **"Average" is Medium; ranking needs High.** Typical pages on a topic are Medium. High needs a high level of effort, originality, skill, or E-E-A-T. A small site will never out-authority the official source, so it must beat it on clarity, completeness, experience and usefulness.
- **Put the answer first; no filler.** The SQRG marks pages Low when "filler" sits prominently ahead of the helpful content. On guides, the first screen answers the question; background comes after.
- **Experience beats summary.** Real screenshots, real work, real customer stories, what actually trips people up: things a generic article cannot copy.
- **Trust is the centre of E-E-A-T** (Google and SQRG 3.4). E-E-A-T itself is not a ranking factor, but Google's systems look for signals that line up with it and give them "even more weight" on YMYL topics. Reputation is judged by what independent sources say, not what the business says about itself (SQRG 3.3).
- **Entity clarity** (AoS ch7 "Entities"): every key page should let Google and a reader answer: who is this for, what do they want that we provide, and why are we one of the best to provide it. If you cannot answer distinctly, neither can Google. This is the messaging skill's one idea, seen from search.

## Technical guardrails that shape content and design (AoS ch7, ch10, ch12)

- **Indexable text is in the server HTML.** Static or server-rendered pages (Astro and similar) are the right model. Content inside accordions, tabs and dialogs is fine if it is in the initial HTML; content fetched only after a click is not indexed. No client-only component may hold text that should rank.
- **Mobile-first indexing**: what is missing on mobile is missing from Google. Progressive disclosure on phones collapses content, it never drops it.
- **Nothing covers the content on landing.** Google counts intrusive interstitials against a page (AoS ch7 "Use of Interstitials and Dialogs"). Cookie banners, notice bars and chat widgets must not obscure the main content when someone arrives from search.
- **Meaningful images use `<img>`** with width/height and descriptive alt text, never CSS backgrounds (not indexed). Decorative images get `alt=""`. Good design and good image SEO agree: real, relevant visuals near the text they illustrate (AoS ch12 "Image Optimization Tips").
- **Answer engines need nothing special.** Google says there are "no additional requirements" and no special optimisation for AI Overviews and AI Mode, and "You don't need to create new machine readable files, AI text files, or markup". A page must be indexed and snippet-eligible; they may "fan out" into related subtopic searches, so covering the question journey across hub and spokes is what helps. An `llms.txt` does no harm and may help other assistants, but it is not a Google lever. AI Overview and AI Mode clicks are counted in GSC under "Web".
- **Speed matters, but it is a small ranking factor** (AoS ch7 and ch15: the authors' own study found Core Web Vitals had a small effect; relevance and quality dominate). Rich visuals are welcome **when they are built well**: sized images, modern formats, no layout shift, lazy loading below the fold, few trackers. Never cut visual quality in the name of SEO; fix how it is delivered.
- **No `nofollow` on internal links. 301 for anything permanent. Don't change a URL just to add a keyword** (Google says the gain is minimal). Sitemap URLs return 200, are self-canonical and not noindex.
- **After every deploy**, check that nothing from staging leaked: no `noindex`, no staging robots rules, canonicals pointing at the live domain (AoS ch10 "Hidden Content": staging noindex copied live is a classic outage, and a new site has no traffic drop to warn you). On multi-site or multi-host setups, make sure only the canonical host is indexable.

## Earning authority and links (AoS ch11)

- **The test for any tactic: would we do it if Google did not exist?** If yes, it is marketing and the links it earns are the ones that count.
- **Map who the trade trusts**: regulators and official pages, trade bodies, trade press, event organisers, suppliers and partners, customers. That list is both the outreach list and the list of sources Google trusts.
- **What usually fits small businesses**: original data only they can gather (a short survey of their buyers, with the data allowed to tell the story); tools that are genuinely new; the owner's expert commentary to journalists (the book's case study: a human, opinionated reply to a reporter beat a press-release draft and won coverage); co-created content with partners, hosted on the site; speaking, podcasts and trade events; reclaiming unlinked mentions.
- **Outreach rules**: know what is in it for *their* readers before writing; contact the right person; be brief and personal; don't ask for a link in a first pitch; never ask for specific anchor text; follow up at most twice. PR and outreach are written by the owner, in their voice.
- **Never** (Google's link-spam list plus the book): paid followed links; free products or services in exchange for a write-up with a link; link swaps or partner pages that exist to cross-link; making a link a condition of a contract or terms without letting the other side mark it `nofollow`; guest posts or press releases with keyword anchors; low-quality directories; keyword links in widgets or templates spread across other sites; private blog networks; expired-domain tricks; paid or undisclosed reviews (UK advertising and consumer rules apply; check CMA/ASA guidance before any incentive). Don't gate research behind an email form if the point is to be cited.
- **Agency credit links**: a "website by Kaizen" link on a client site is a template link spread across other sites. Make it plain brand text, `nofollow`, or leave it out; never a keyword anchor.
- **Google's own advice is the same idea**: "Tell people about your site. Be active in communities where you can tell like-minded people about your services" (Search Essentials). Word of mouth is the lasting kind (SEO Starter Guide).
- **Keep going**: sites that stop earning links lose ground to the competitors they had passed. Authority work is a steady habit, not a campaign.

## Measure, test and audit (AoS ch8, ch10, ch14)

- **Baseline before changing anything**, and **log every change** (URL, what changed, date) in the SEO change log, so a movement can be traced to a cause or reverted (AoS ch5 "Document Previous SEO Work").
- **One change at a time, then wait.** SEO testing is serial: crawl and index lag means days to weeks per step; Google says to wait "a few weeks" before judging a change. Don't read a single rank check as truth (personalisation and location shift it). With several similar pages, change some and keep others as a control.
- **What to watch**: organic clicks and impressions per page (GSC), queries per page, share of URLs getting any search traffic, branded vs unbranded queries, indexed vs submitted pages, and the conversions the site profile names. Traffic without conversions is not the goal.
- **Audit on a rhythm** (quarterly, light) **and on events**: a redesign or rebuild (watch GSC coverage, 404s and rankings for 60 to 90 days), nav changes, a Google core update, a sudden drop. Checklist in `references/working-tools.md`.
- **Diagnosing a drop**: confirm it is Google organic -> check GSC for manual actions -> date it against known Google updates -> look for your own tech changes (noindex, canonicals, robots, JS), lost internal links, lost external links, content changes, content that has aged.
- **Use Bing Webmaster Tools too** (it can import GSC verification); a second engine's view is cheap.
- **Never scrape Google** for rank checks from your own scripts: Google's spam policies ban "machine-generated traffic". Use GSC and paid third-party tools.

## Local SEO (for businesses found by place)

Use this when a business serves customers in person or in an area (trades, clinics, shops, local agencies such as Kaizen in Liverpool). Skip it for businesses that only sell online with no place-based customers. Sources: Google's Business Profile help pages, its contributed-content policy, the Search Central LocalBusiness structured data page (all read 1 Oct 2026), and the Digital Markets, Competition and Consumers Act 2024, Schedule 20 paragraph 13. *The Art of SEO*'s local chapter (ch12) was not available to re-read, so nothing here is taken from it. Where a point is common industry practice rather than something Google says, it is marked **[practice]**. Checklist: `references/working-tools.md` section 14.

**How Google ranks local results.** In Google's words, local results are mainly based on **relevance** ("how well a Business Profile matches what someone is searching for"), **distance** ("how far each business is from the customer who's searching") and **prominence** ("how well-known a business is"). Google also says: "There's no way to request or pay for a better local ranking on Google." So the work is: be eligible, be accurate and complete, be the most relevant match, and become better known. Distance can't be changed, which is why fake addresses are tempting and why Google polices them.

**1. The Business Profile comes first, and it must be honest.**
- **Eligibility.** A profile is for a business with "a physical location that customers can visit, or travels to customers where they are". A business that only works remotely, with no in-person contact, may not be eligible. Check this before promising a client a profile.
- **Storefront or service area.** A storefront needs "permanent fixed signage of their business name at the address". A business that visits customers but doesn't serve them at its address is a service-area business and must remove the address: "If you don't serve customers at your business address, remove your address from your Business Profile." Up to 20 service areas, named as towns or postcodes (not a radius), no further than about 2 hours' drive.
- **No fake locations.** No virtual offices, and no co-working desks "unless that office maintains clear signage, receives customers at the location during business hours, and is staffed". One profile per location: "Do not create more than one page for each location."
- **The name is the real name.** It must match the name used "consistently on your storefront, website, stationery". No keywords, taglines, place names or phone numbers added to the name ("Regal Pizzeria", not "Regal Pizzeria Open 24 hours"). Stuffing the name is the most common local spam and gets profiles suspended.
- **Categories.** Use "as few categories as possible"; each completes "This business IS a", not "HAS a"; never categories used as keywords.
- **Contact details.** A phone number that reaches that location, local rather than a call centre where possible. The website link must not redirect to a landing page.
- **Complete and current.** Verify the profile; add hours, attributes, services, photos and video. Google: businesses with "complete and accurate info are more likely to show up in local search results". Update hours for holidays and closures the same day they change.
- **Ownership.** **[Our rule]** The client owns their profile in their own Google account; Kaizen has manager access, never ownership. If we part ways, they keep it.

**2. Reviews are prominence, and the rules are strict (and now UK law).**
- **Ask every real customer, fairly.** Google permits businesses to "encourage the posting of content that does represent a genuine experience, without offering incentives". Make it easy (a direct review link in the follow-up email or on the invoice). **[practice]** Ask everyone, not a hand-picked few.
- **Never:** pay or reward for reviews, "directly or in kind" (no discounts, prize draws or freebies); post reviews from staff, family, partners or anyone with a conflict of interest; write reviews for a client; pressure people to review on the spot; tell people what to write; offer anything to get a bad review removed.
- **UK law since April 2025.** The DMCC Act 2024 (Schedule 20 para 13) makes it an unfair commercial practice to submit or commission a fake review or one that hides an incentive; to publish reviews "in a misleading way", which includes hiding negative reviews while showing positive ones or giving positive ones disproportionate prominence; and **to offer a service to businesses that does any of this** (para 13(4)). For an agency that last point matters: never offer, sell or quietly do review writing, review buying or review gating for a client. A business publishing reviews on its own site must take "reasonable and proportionate steps" to stop fake or concealed-incentive reviews. Before any review scheme, read the CMA's fake reviews guidance (CMA208, Apr 2025).
- **Reply to reviews**, good and bad, calmly and specifically. Google: replying "shows that you value their feedback". Never reveal a customer's private details in a reply.
- **Testimonials on the site** follow the same law: real, permissioned, not cherry-picked to mislead, and any incentive disclosed.

**3. The website does the relevance work.**
- **One page per real service**, saying what it is, who it is for and where it is offered, written from the evidence (`marketing-messaging`). This is what makes the profile and the site "match what someone is searching for".
- **Location pages only where there is something real to say.** A page per town with the town name swapped is doorway abuse ("substantially similar pages that are closer to search results than a clearly defined, browseable hierarchy"; see the taxonomy above). A location page earns its place with real local content: work done there, the team or office there, local rules, real directions, reviews from customers there. If you can't write that, don't make the page; list the areas served on the service page instead.
- **Name, address and phone (NAP)** in the footer or contact page, as text, matching the profile exactly. **[practice]** Keep them identical across the site, the profile and the main directories; inconsistent details confuse people and are widely believed to weaken local trust.
- **LocalBusiness structured data** on the contact or home page (Google requires `name` and `address`; recommends `telephone`, `openingHoursSpecification`, `geo`, `url`, `priceRange`). Use the most specific subtype. It must match what is visible on the page and the profile. A service-area business that has hidden its address should not publish that address in markup either. Never mark up the business's own reviews about itself to get stars: `review` and `aggregateRating` are for sites that collect third-party reviews. Validate with the Rich Results Test.
- **Embed or link the map and the profile** on the contact page so people can get directions and read reviews.

**4. Prominence beyond reviews.**
- **Local links and mentions** come from being part of the area: local business groups and chambers, sponsoring local clubs or events, local press stories, suppliers and partners. Same test as all links: would you do it if Google didn't exist?
- **[practice] Citations**: a consistent listing on the main UK directories (for example Bing Places, Apple Business Connect, Yell, the trade's own directories). A handful of accurate ones beats hundreds of junk directories, which the link-spam rules above already rule out.
- **Bing Places and Apple Business Connect** matter in their own right: Apple Maps and Bing serve real local searches.

**5. Measure locally.**
- Business Profile performance: searches, views, calls, direction requests, website clicks.
- GSC filtered to local terms ("[service] [town]", "[service] near me").
- Calls and enquiries by source. **[practice]** Tag the profile's website link with UTM parameters so its visits show separately in analytics.
- Rankings vary street by street. Don't judge from one search on your own phone. A grid rank tracker from a paid tool gives a fair picture; never scrape Google yourself.

**Never (local).** Fake addresses, virtual offices or PO boxes; extra profiles for the same location; keywords in the business name; fake, paid, incentivised, staff or gated reviews; reviews written for clients; duplicate town pages; marking up your own reviews for stars; buying "local citations" in bulk.

## News posts

- **News pegs are spikes, not a schedule**: publish a news article only when a real event lands (a law coming into force, a deadline, an official announcement).
- Expect most of the value from sharing it (social, email, replies to leads) and from answer engines, not from Google ranking it: a young site rarely beats official sources and the trade press on the day.
- A news post links UP to the hub that owns the topic and never re-targets the hub's head term.

## How this works with the marketing skills

- **SEO decides which page owns which query, and what the searcher already knows** when they land (their awareness stage). **Messaging decides what the page says** from evidence. **Design decides how it carries it** at the premium bar. Hand the page brief the target query, the searcher's intent and the question journey.
- They agree more than they differ: all three books say to use the customer's own words, to learn from sales and support, to be specific, and that trust matters. The Art of SEO adds that "beautiful, simple, easy-to-use, consumable layouts instill trust and garner far more readership and links" (AoS ch7 "Visual layout"): **looking excellent is also an SEO asset.**
- Where they pull apart, the rule is: **the term must be plain in the title and H1; the message and the design do the persuading.** Never trade clarity or looks for keyword placement, and never trade the term away for a clever headline.

## Gotchas

- **Don't quote a position as current.** Every ranking in a log is timestamped and rots fast; pull GSC.
- **"Why isn't good content ranking?"** Usually authority. But check the page first: is it the best answer for that query, does it match the intent, is it thin or too similar to a sibling? Authority is the ceiling; quality is the floor.
- **The book is from 2023.** Google's current documents (read 24 Sep 2026) confirm AI Overviews and AI Mode, the helpful-content questions now sitting under core ranking, and the scaled-content, site-reputation and expired-domain spam policies. They also correct the book in places: keywords in URLs have "hardly any effect"; duplicate URLs are "not a violation" and cause no manual action (copying others' content is the problem); heading order doesn't matter to Search (keep it for screen readers). INP and FAQ rich results were not in the documents read; check before relying on them (`references/sources.md`).
- **CMS overrides.** Many CMSs let an SEO field override the title and meta description. When retitling a page, check and update the override in the same edit, or the change does nothing to search results.

## Principles

- **Value to the searcher first; search engines follow** (AoS ch15: SEO "is not a game of figuring out how to manipulate Google"; Google: SEO "can be a helpful activity when it is applied to people-first content").
- **Trust first.** YMYL pages are accurate, named, sourced, current.
- **Compounding through structure, not tricks**: a tight topic, hub-and-spoke internal linking, honest comparison pages, clean technical plumbing.
- **One page, one job.** A term has ONE owner; extend the owner rather than spawn a rival.
- **Fewer, better pages.** On a new, low-authority domain every weak page costs more than it earns.
- **Earn links by being worth citing.**
- **Measure one change at a time.** Ship, log, wait, read GSC, act.
- **Honesty over numbers.** Trust signals are facts with a link to the proof, never fabricated.
