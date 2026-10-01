# SEO working tools

Adapted in our own words from *The Art of SEO* (4th ed.): the keyword plan spreadsheet (ch6), the cannibalisation plot (ch7), the audit checklist (ch10), the content audit (ch10), the link-target qualification sheet (ch11) and the redesign checklist (ch7). Use the parts a job needs. Keep working copies in a sheet or an issue comment, not in the repo; record decisions and changes in the site's SEO change log (default `docs/seo-log.md`).

## 1. Keyword sheet (after AoS ch6 "Preparing Your Keyword Plan Spreadsheet")

| Keyword | UK volume | Priority (1-3) | Relevance (1-3) | Difficulty | Current rank (101 = none) | Topic | Segment / persona | Owner URL | Branded? | Source | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|

- **Priority** = how much it matters to the business now (buyer intent from the site's main segments scores high).
- **Relevance** = our own 1 to 3 judgement, not a tool score: does the intent match what the page gives, would they convert, would they leave disappointed?
- **Source**: GSC, site search, chat, the owner, trade body, competitor, autocomplete/PAA, tool. Frequency across sources is a signal.
- Sort to find opportunities; the book's opportunity score ((relevance x priority) x volume / (difficulty x rank)) is a sorting aid only.
- Separate tab for seasonal or deadline-driven terms; demand rises months before a deadline.

## 2. Page-owner map (cannibalisation check, after AoS ch7)

| Term | Owner URL | Title contains it? | H1 contains it? | Other pages getting impressions for it (GSC) | Action |
|---|---|---|---|---|---|

Rules: one owner per term. No page puts a sibling's head term in its title. A page whose phrase contains a broader term links back to the broader page with that term as anchor text. Before a new page: check this table and GSC.

## 3. Question journey (after AoS ch6 "Researching Natural Language Questions")

For each topic, list questions from earliest to buying:

| Stage | Question in the searcher's words | Who asks (which segment) | Where we answer it (URL + section) | Gap? |
|---|---|---|---|---|

Stages: noticing the problem ("do I need...", "what happens if...") -> understanding it -> comparing ways to solve it -> choosing a product -> using it.

## 4. Content audit (after AoS ch10 "SEO Content Auditing")

Split pages into informational and commercial, then:

| URL | Type | Written or reviewed by an expert? | Facts checked against primary sources, date | Reviewed date shown | Matches its title's promise? | On theme? | Unique vs sibling pages and the official source? | Organic clicks (90 days) | Decision |
|---|---|---|---|---|---|---|---|---|---|

Decisions: keep, improve, merge and 301, noindex (stopgap), remove. No traffic is a clue, not proof: a useful low-volume page can stay. For informational content also compare breadth and depth against the two strongest competitors on the topic; if we cannot beat them everywhere, pick the subtopics we can own.

## 5. Quarterly light audit (after AoS ch10 "Sample SEO Audit Checklist")

**Crawl** (Screaming Frog free is enough at our size):
- [ ] Broken internal links and missing images
- [ ] Non-301 redirects, chains, loops
- [ ] Missing or duplicate titles and H1s (if a page can't have a unique title, question the page)
- [ ] Missing or generic meta descriptions on key pages
- [ ] Missing alt text on meaningful images; decorative images `alt=""`
- [ ] Canonicals point at the live domain and at the page itself
- [ ] No `nofollow` on internal links
- [ ] Robots.txt blocks nothing we want crawled (including CSS and JS)
- [ ] Orphan pages (in the sitemap but not linked) and pages more than 4 clicks from home
- [ ] Anchor text: no "click here", "learn more", "read more"

**Search Console** (plus Bing Webmaster Tools):
- [ ] Pages not indexed and why ("Crawled - currently not indexed" deserves a look)
- [ ] Sitemap status: every URL 200, self-canonical, not noindex
- [ ] Manual actions and security issues: none
- [ ] Core Web Vitals report
- [ ] Top queries and pages: movements since last audit; striking-distance terms (11 to 20)
- [ ] Export performance data (GSC keeps 16 months)

**Human review**:
- [ ] Navigation and internal links still send authority to the hubs
- [ ] Thin, off-theme or too-similar pages
- [ ] Content written for search engines rather than readers
- [ ] Out-of-date facts or dates (check the source the site profile names)
- [ ] Author, sources and reviewed date visible on guides

**SERP review**, for our ten most important terms:
- [ ] What Google shows (AI answer, features, who ranks) and whether our page matches that intent
- [ ] Whether Google rewrote our title or description, and why

## 6. After a redesign, migration or big deploy (after AoS ch7 "Domain Changes, Content Moves, and Redesigns" and ch10 "Hidden Content")

- [ ] Every old URL returns 200 or a 301 to its closest equivalent (never a blanket redirect to home)
- [ ] No `noindex`, stage robots rules or stage canonicals on production
- [ ] Titles, H1s, meta descriptions and JSON-LD survived the rebuild
- [ ] Text that used to be in the HTML still is (not moved into click-loaded or `client:only` components)
- [ ] Old H2s that ranked kept or reworded, not removed (brief section 6)
- [ ] Sitemap regenerated; submit in GSC
- [ ] Watch GSC coverage, 404s and rankings weekly for 60 to 90 days; note the date in `docs/seo-log.md`

## 7. Change log entry (after AoS ch5 "Document Previous SEO Work")

`YYYY-MM-DD | URL(s) | what changed (title / H1 / content / links / technical) | why | expected effect | check date`

One change per page per check period where possible, so an effect can be traced.

## 8. Link target sheet (after AoS ch11 "Qualifying Potential Link Targets")

| URL / site | Type (regulator, trade body, trade press, event, partner, supplier, customer, podcast) | Topic fit (0-5, weighted highest) | Trust | Authority (tool score) | Their readers would value... | Our asset to offer | Contact | History | Status |
|---|---|---|---|---|---|---|---|---|---|

Before any pitch, fill "Their readers would value": if you can't, you are not ready to pitch. Topic fit counts more than authority.

## 9. Pitch checklist (after AoS ch11 "The pitch email")

- [ ] Right person, by name, as they write it
- [ ] Shows we know their site and readers
- [ ] Offers something new and useful to their readers (data, a tool, an expert view, a correction)
- [ ] Short; subject line accurate, no hype; a question works well
- [ ] No link request in a first pitch (exceptions: fixing a broken link to us, an unlinked mention, a resource list), never a requested anchor text
- [ ] Written by the owner, in their voice
- [ ] At most two follow-ups (about 3 working days, then 2 to 4 weeks), then park it

## 10. People-first self-check (Google's helpful content questions, condensed)

Run on any new or reworked guide. A "no" in the first list or a "yes" in the second is a reason to rethink.

Should be yes:
- [ ] Original information, reporting, research or analysis, not just a rewrite of the official source
- [ ] A substantial, complete description of the topic; the reader won't need to search again
- [ ] Insight beyond the obvious
- [ ] The title and H1 describe the page and don't exaggerate
- [ ] Something a buyer would bookmark or send to a colleague
- [ ] Written or reviewed by someone who demonstrably knows the trade
- [ ] No easily checked factual errors; no spelling or style slips
- [ ] Our existing audience would find it useful if they came to us directly
- [ ] It fits the site's main purpose

Warning signs (should be no):
- [ ] Made mainly to attract search visits
- [ ] One of many pages on many topics, hoping some rank
- [ ] Mainly summarising others without adding much
- [ ] Written because the topic is trending, not because our audience needs it
- [ ] Written to a word count
- [ ] Claims an answer that doesn't exist yet (for example an unconfirmed date)
- [ ] Date changed without a substantial update

Also worth doing: ask someone trusted who isn't part of the business (a consultant or customer in the trade) for an honest read.

## 11. YMYL guide check (after the SQRG and Google's "Who, How, and Why")

- [ ] **Who**: named author with a byline, linking to a real bio (trade experience, how to verify it); an About page says who runs the business, with company details and contact
- [ ] **How**: states what it was checked against, with links to the official pages and legislation
- [ ] **Accuracy**: matches the official source today; nothing implied that the regulator hasn't said
- [ ] **Current**: dates and deadlines from the verified source the site profile names; reviewed date changed only after a real review
- [ ] **Answer first**: the first screen answers the question; no filler above it
- [ ] **Value added**: worked examples, real mistakes, how it works on a job, links between the rules, or a tool
- [ ] **Nothing in the way**: cookie banner, notice bar and chat don't cover the content on arrival
- [ ] **Not official**: nothing makes the page look like an official service; official actions link to the official site

## 12. Query type (after SQRG 12.7)

| Type | Example for us | What the page must do |
|---|---|---|
| Know simple (one short, agreed answer) | e.g. "when does [rule] start for [segment]" | Answer in the first sentence; expect AI Overviews to quote it; be the trusted source they cite |
| Know (broad) | e.g. the topic's head term | Cover the journey: what, who, when, how, what it costs you; link to spokes |
| Do | e.g. a template, checker or calculator | Let them do it immediately; the tool works on the first try |
| Website (official) | e.g. an official service login or register | Not ours to target; link to the official site if the topic arises |
| Website (us) | the brand name, brand + login | Home page and app login are obvious and fast |

## 13. Assets worth earning links with (ideas, not a plan)

Checked against "would we do this if Google did not exist?":
- Original data: a short survey of the site's buyers on a live issue; analysis of public data with the owner's commentary.
- Genuinely new tools: anything nobody else offers the site's buyers.
- Expert commentary: the owner answering journalists and trade press on their topic.
- Partner content: case material with customers or partners, hosted on the site.
- Talks, podcasts, trade events; helping newcomers in trade forums.
- Unlinked mentions of the brand, reclaimed with a polite note.

## 14. Local SEO checklist (after Google's Business Profile guidelines, its review policy and DMCC Act 2024 Sch. 20 para 13)

Run for any business found by place. See "Local SEO" in `SKILL.md` for the reasons and sources.

**Eligibility and setup**
- [ ] Eligible: customers visit the business, or the business travels to them (not online-only)
- [ ] Storefront (permanent signage at the address) or service-area business (address removed, up to 20 named areas, about 2 hours' drive at most)
- [ ] No virtual office, PO box or unstaffed co-working desk; one profile per location
- [ ] Client owns the profile in their own Google account; we have manager access only
- [ ] Verified

**Profile content**
- [ ] Name exactly as on signage, website and stationery; no keywords, places or taglines
- [ ] As few categories as possible; each passes "This business IS a ..."
- [ ] Local phone number for the location; website link goes straight to the real page, no redirect
- [ ] Hours, holiday hours, attributes, services, products where eligible
- [ ] Real photos and video of the place, the work and the people (with permission)

**Reviews**
- [ ] A simple way to ask every customer (direct review link in follow-up email or invoice)
- [ ] No incentives of any kind, no staff, family or partner reviews, no reviews written for clients, no on-the-spot pressure, no telling people what to write
- [ ] No hiding bad reviews or over-featuring good ones on the website
- [ ] Every review answered, calmly, without private details
- [ ] CMA fake reviews guidance (CMA208) checked before any review scheme

**Website**
- [ ] One real page per service, saying where it is offered
- [ ] Location pages only with genuine local content; otherwise areas listed on the service page
- [ ] Name, address and phone as text on the site, matching the profile exactly
- [ ] LocalBusiness structured data (most specific subtype), matching visible content and the profile; no address in markup for a hidden-address service-area business; no self-serving review markup; Rich Results Test passed
- [ ] Map and profile linked from the contact page
- [ ] Profile website link tagged with UTM parameters

**Prominence**
- [ ] Bing Places and Apple Business Connect listings, matching the profile
- [ ] A handful of accurate UK and trade directory listings; no bulk citation buying
- [ ] Local relationships: business groups, chambers, sponsorships, local press, partners

**Measure**
- [ ] Business Profile performance (calls, directions, website clicks) recorded monthly
- [ ] GSC local queries ("[service] [town]", "near me") tracked
- [ ] Rankings judged with a grid tracker or several locations, never one phone search
