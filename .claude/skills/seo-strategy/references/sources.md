# Sources: what The Art of SEO says, and what we take from it

Assessment written 24 Sep 2026 (for Consigns) from a full read of the main text; generalised for any site 1 Oct 2026. "AoS" = *The Art of SEO*, 4th edition, Eric Enge, Stephan Spencer and Jessie Stricchiola, O'Reilly, 2023. The copy we read is a plain-text export with no page numbers, so references give the chapter and section heading (for example "AoS ch6 'Keyword Valuation'"). Short quotes only; the book is copyright.

Labels: **[Author]** = what the book explicitly recommends. **[Ours]** = our conclusion for the sites we build. Where a point is from our own knowledge of events after the book, it says so and should be checked against current Google documentation.

## What was read, and gaps

- Read in full: the preface and chapters 1 to 15. The index was not read.
- Figures did not survive the export (only captions remain): screenshots of SERPs, Search Console reports, the local ranking factor charts, the IAB and Bloomberg privacy tables. The text carries the argument; a few numeric charts could not be checked.
- Chapter 12 (local, image, news and video search) and chapter 13 (privacy law, mainly US) were read closely only where they touched Consigns. **Local SEO is covered from Google's own documents and UK law instead (read 1 Oct 2026, below), not from AoS ch12**, which was not available to re-read. If the book becomes available, compare its ch12 with the "Local SEO" section and note any differences here.
- Google's own documents were read the same day from files Sean supplied (see the next section). Copies are not kept in the repo: Google revises them without notice, and the Rater Guidelines are Google's copyright. Re-download from the links below when checking a point.

## Google's own documents (read 24 Sep 2026)

| Document | Version read | Link |
|---|---|---|
| Search Quality Rater Guidelines ("SQRG") | 11 Sep 2025 edition, Markdown export. Read in full: overview, Part 1 sections 1 to 3, 4.1, 4.5 to 4.6, 5 to 8, 9.1; Part 2 section 12; Part 3 sections 13.0 to 13.2, 16 to 21. Skimmed or skipped: harmful-content sections 4.2 to 4.4, the long example tables in 4.7, section 10 (rating tasks), 13.3 onward except as listed, 14 to 15 (porn, foreign-language and did-not-load flags), 22 to 24, the platform appendix. Pictures survived only as garbled OCR | https://guidelines.raterhub.com/searchqualityevaluatorguidelines.pdf |
| Google Search Essentials | updated 10 Dec 2025 | https://developers.google.com/search/docs/essentials |
| Spam policies for Google web search | updated 28 Aug 2026 | https://developers.google.com/search/docs/essentials/spam-policies |
| Creating helpful, reliable, people-first content | updated 10 Dec 2025 | https://developers.google.com/search/docs/fundamentals/creating-helpful-content |
| SEO Starter Guide | updated 10 Dec 2025 | https://developers.google.com/search/docs/fundamentals/seo-starter-guide |
| AI features and your website | updated 10 Dec 2025 | https://developers.google.com/search/docs/appearance/ai-features |

**Local SEO sources (read 1 Oct 2026):**

| Document | Link | What we took |
|---|---|---|
| Tips to improve your local ranking on Google | https://support.google.com/business/answer/7091 | Relevance, distance, prominence; "no way to request or pay for a better local ranking"; complete, accurate, verified profiles; reply to reviews |
| Guidelines for representing your business on Google | https://support.google.com/business/answer/3038177 | Eligibility; storefront signage; service areas; no virtual offices; real-world name, no stuffing; categories; one profile per location; phone and website rules |
| Manage your service areas | https://support.google.com/business/answer/9157481 | Remove the address if customers aren't served there; up to 20 areas; about 2 hours' drive; no radius |
| Maps user contributed content policy (fake engagement) | https://support.google.com/contributionpolicy/answer/7400114 | No paid or incentivised reviews, no conflicts of interest, no pressure on premises; genuine reviews may be encouraged without incentives |
| LocalBusiness structured data (updated 8 Sep 2026) | https://developers.google.com/search/docs/appearance/structured-data/local-business | Required `name`, `address`; recommended properties; most specific subtype; `review`/`aggregateRating` for third-party review sites |
| Digital Markets, Competition and Consumers Act 2024, Sch. 20 para 13 | https://www.legislation.gov.uk/ukpga/2024/13/schedule/20 | Fake and concealed-incentive reviews banned; misleading presentation (hiding negatives); duty of reasonable steps; offering such services to traders is itself banned |
| CMA fake reviews guidance (CMA208, 4 Apr 2025) | https://www.gov.uk/government/publications/fake-reviews-cma208 | Only the landing page was read; read the full guidance before advising on any review scheme |

Points marked **[practice]** in the skill (NAP consistency, citations, UTM tagging, grid rank tracking, asking every customer) are common industry practice, not stated in these documents.

The Search Central pages are CC BY 4.0; the SQRG is Google copyright. Short quotes only.

**How to read the SQRG.** Raters do not rank pages. "Rater data is not used directly in our ranking algorithms"; Google uses ratings "as a restaurant might get feedback cards from diners" (helpful content page). The SQRG describes what Google is trying to reward, not a checklist of ranking factors.

### What Google says that matters most for us

| Point | Source | [Ours] |
|---|---|---|
| YMYL test: "Would a careful person seek out experts or highly trusted sources to prevent harm?" | SQRG 2.3 | Health, money, legal, safety and compliance pages are YMYL; decide per site |
| Instructions for filling in official forms (tax forms) belong to experts | SQRG 3.4.1 | Any "how to fill in an official form" guide is the same kind of page |
| YMYL pages have "very high Page Quality rating standards"; lacking expertise alone makes a page Low | SQRG 2.3, 5.1 | Named expert author; accuracy against the official source |
| Trust is the most important part of E-E-A-T; E-E-A-T is not itself a ranking factor | SQRG 3.4; helpful content page; Starter Guide | Trust first |
| Clear who is responsible for the site and content; YMYL pages need more than a bare email | SQRG 2.5.2, 2.5.3, 5.5 | Every site needs an About page and, where readers expect one, named authors |
| Fake author profiles are Lowest; exaggerated self-descriptions are Low | SQRG 4.5.3, 5.6 | Real, verifiable bios only |
| Reputation comes from independent sources; for YMYL, experts and professional bodies | SQRG 3.3 | Trade press and trade bodies matter; official listings count |
| An expert paraphrasing government policy in plain language can be valuable | SQRG 4.6.6 | Our model, if we add value |
| Typical pages on a topic are Medium; High needs effort, originality, skill or E-E-A-T | SQRG 7.1 | Aim above the official source's clarity and usefulness |
| Filler above the helpful content makes a page Low | SQRG 5.2.2 | Answer first on guides |
| Exaggerated or shocking titles are Low; titles are part of the main content | SQRG 5.2; helpful content page | Plain, descriptive titles |
| Pop-ups or interstitials that obstruct the main content | SQRG 4.5.4, 5.3; Starter Guide | Cookie banners, notice bars and chat must not block content |
| Stale answers to current-information queries are useless | SQRG 18.0 | Keep deadline facts current |
| Don't change dates to look fresh; no preferred word count; no benefit from adding or deleting content just to look "fresh" | helpful content page | Reviewed date only after a real review |
| Who, How and Why; bylines where expected; disclose substantial automation | helpful content page | Named author; "checked against" line |
| No special optimisation, files or schema for AI Overviews and AI Mode; they fan out into subtopics; clicks count in GSC "Web" | AI features page | `llms.txt` is not a Google lever; cover the journey |
| Use the words people search for in titles, headings, alt text and link text; "Tell people about your site. Be active in communities" | Search Essentials | Matches the book |
| Keywords in domain or URL have "hardly any effect"; heading order doesn't matter to Search; duplicate URLs are not a violation; no magic word count; meta keywords unused | Starter Guide | Corrects parts of the book |
| Doorway abuse includes "substantially similar pages that are closer to search results than a clearly defined, browseable hierarchy" | spam policies | Segment, location and type pages must be distinct |
| Link spam includes products in exchange for a linked write-up, links required by contract without a `nofollow` option, keyword links in widely distributed footers or templates | spam policies | Added to the "never" list |
| Scaled content abuse applies "no matter how it's created" | spam policies | Fewer, better pages |
| Machine-generated traffic (scraping results for rank checks) violates the policies | spam policies | Never scrape Google ourselves |
| Misleading functionality; impersonating an official service | spam policies | Tools must work; never look like an official service |
| Accordions, tabs and screen-reader-only text are not hidden-text abuse | spam policies | Progressive disclosure is safe |

### Where Google corrects or updates the book

- **Duplicate content**: the book warns that thin slicing and duplicates can bring penalties. Google: duplicate URLs are "not a violation" and won't cause a manual action; copying others' content is. Near-identical pages made to catch searches still fall under doorway abuse and scaled content.
- **URLs**: the book gives keywords in URLs "small weight". Google: "hardly any effect beyond appearing in breadcrumbs".
- **Headings**: the book gives headings slight weight. Google: order and number don't matter to Search. Keep the structure for readers and screen readers.
- **AI search**: the book describes SGE. Google now has AI Overviews and AI Mode, with no extra requirements and no special files.
- **Helpful content**: the book describes a separate sitewide system (2022). Google's page now frames the same questions as what its core ranking systems reward.
- **Spam policies** added since the book: scaled content abuse, site reputation abuse (with a separate EEA process from Aug 2026), expired domain abuse, back-button hijacking.

## The book in one line

AoS is a practitioner's manual: SEO is creating great value for the visitors you want and making it easy for search engines to find, understand and trust. Technical access is table stakes; relevance and content quality decide rankings; links remain a major signal and are best earned through ordinary good marketing.

## What the authors recommend that we adopt

| Theme | [Author] | [Ours] for the sites we build |
|---|---|---|
| Quick wins are rare | ch1: the only reliable quick win is fixing a technical access problem; SEO is a process, traffic grows gradually | Set expectations in months, not weeks; don't chase tricks |
| Strategy before tactics | ch5 "Strategy Before Tactics"; one primary success metric; log every change | Primary metric is qualified enquiries (the conversions in the site profile), not traffic; change log in `docs/seo-log.md` |
| Keyword valuation | ch6 "Keyword Valuation": priority > relevance > popularity > difficulty | Adopted as the order for every keyword call |
| Keyword sources | ch6 "People": sales (exact customer words), support, founders, customers, **noncustomers**; GSC and site search | With few customers, the owner, prospects, trade vocabulary, GSC and chat openers come first |
| Question journeys | ch6 "Researching Natural Language Questions": map questions back to the earliest | Build hub + spoke coverage around the journey |
| UK/US variants | ch6 "Breaking Down High-Difficulty Keywords" (prawn/shrimp) | Check UK spellings and trade terms; no misspellings |
| Striking distance | ch6 "Rank threshold values", "Acting on Your Keyword Plan" | Work the 11 to 20 band first |
| Taxonomy follows intent | ch6: keyword taxonomy must follow search intent, not the internal product taxonomy | Segment pages must match how segments search, not our plan names |
| Titles | ch7 "Title Tags": readers first, term first, brand last, about 65 characters max, no sibling page's term | Under about 60 characters; sibling-term rule added |
| Meta descriptions | ch7: honest, soft sell, not a ranking factor | Adopted |
| No keyword lists for writers | ch7 "Effective Keyword Targeting by Content Creators", ch9, ch10: word counts and keyword instructions signal search-first content | Adopted; writers get the reader and the question journey |
| Cannibalisation | ch7 "Keyword Cannibalization": plot terms per page; link back to the broader page with its term | Page-owner map in `working-tools.md` |
| Long tail | ch5 "The Long Tail of Search", ch7 "Long-Tail Keyword Targeting": win it by richer pages, not a page per phrase | Adopted |
| Themes | ch7 "Content Themes": off-topic content struggles and can weaken the site | Supports "stay tightly on the site's topic" |
| Thin and too-similar pages | ch7 "Content Uniqueness and Depth", ch9, ch10 "Thin Content": noun-swap pages, doorway pages and near-duplicates are thin | Applies to segment, location and type pages; noindex large sets of generated near-duplicates |
| Weak content hurts the site | ch9 quality section; helpful content was sitewide, recovery takes months | Fewer, better pages; prune or improve |
| EEAT for high-stakes topics | ch7 "Google's EEAT and YMYL", "Author Authority": named authors with bios, cite sources, keep content current, show experience | Named author on YMYL guides; reviewed dates; update promptly when the facts change |
| AI content | ch2, ch11: useful for outlines and clustering; drafts need an expert to rewrite and fact-check | Adopted; fits the never-AI-written house voice |
| Entities | ch7 "Entities": who is the audience, what do they want, why are you among the best | Same as the messaging skill's one idea |
| Structured data | ch7 "Structured Data": helps understanding and rich results; not a ranking factor; must match visible content | Use it through the site's SEO component; never hidden or inflated data |
| Rendering | ch7 "JavaScript Frameworks and Static Site Generators": SSR or hybrid best; click-loaded content is not indexed | Static or server-rendered pages (Astro) fit; no ranking text in client-only components |
| Interstitials | ch7 "Use of Interstitials and Dialogs": dialogs covering content on arrival from search count against the page | Cookie card, notice bar and chat must not cover content on landing |
| Page speed | ch7 "Core Web Vitals", ch15: real but small ranking effect (their own Perficient study) | Deliver rich visuals efficiently; never downgrade the design for speed scores |
| Redesigns and moves | ch7 "Domain Changes, Content Moves, and Redesigns": 301 map, both sitemaps, monitor 60 to 90 days | Keep URLs on rebuilds where possible; 301 the rest; monitor GSC |
| Don't re-URL for keywords | ch7 "Changing URLs to Include Keywords in Your URL" | Adopted |
| Staging leaks | ch10 "Hidden Content": staging noindex or robots copied live | Post-deploy check |
| Audits | ch10: scheduled plus event-driven; crawl, GSC, analytics, backlinks, human review, SERP review | Quarterly light audit; checklist in `working-tools.md` |
| Links as marketing | ch11 "Google's View on Link Building": what would you do if Google didn't exist? | The test for every tactic |
| Why people link | ch11 "Why People Link": to help their users; nobody links to help you make money | Links go to useful content; internal links pass authority up |
| Outreach | ch11 "The Basic Outreach Process": value first, brief, personal, no link ask, max two follow-ups | Adopted; founder-written |
| Testing | ch14 "SEO Testing": serial, one element at a time, control groups | Adopted within our small scale |

## Where AoS meets the marketing books (Copy Hackers Book 1, Making Websites Win)

- **They agree**: messages come from customers' own words (CH ch1; MWW research section; AoS ch6 names salespeople, support and noncustomers); be specific; trust has to be earned and shown; long content is fine if it is useful (MWW p244; AoS ch5 "Why Content Breadth and Depth Matter").
- **AoS adds** the missing half the marketing books admit they don't cover: which query a page should own, how Google finds and judges it, and how authority is earned. The messaging sources file lists SEO as a gap in CH and MWW; this fills it.
- **AoS supports the design stance**: "Beautiful, simple, easy-to-use, consumable layouts instill trust and garner far more readership and links" (ch7 "Visual layout"); good content should be "visually engaging in a way that enhances the value to users" (ch11 "Hiring Writers and Producers"). It gives no support to plain or cheap-looking pages.
- **Where they pull apart**:
  1. *Headlines.* AoS ch11 suggests numbers, emotional adjectives and superlatives in headlines as idea prompts, not rules. Our house voice bans hype and triads. **[Ours]** keep only the core: don't lie or mislead, keep it short, include the key terms.
  2. *Placement of the term vs the message.* SEO wants the term in the title and H1; CH and MWW want the most compelling message first. **[Ours]** the term is plain in title and H1; the persuading happens in the subhead, body and design.
  3. *Page scope.* MWW favours one page doing one job; AoS favours depth and breadth across a site. They fit: one page per intent, many pages across the journey.

## What AoS leaves uncovered (use other guidance)

- **Answer engines and AI search as they are now**: the book is from the SGE preview era (mid 2023). Google's AI features page now covers Google's side (no special requirements). How other assistants (ChatGPT, Perplexity, Copilot) choose and cite sources is covered by neither. An `llms.txt` and standalone FAQ answers are our own bets.
- **Small sites and niches**: most examples are large consumer or enterprise sites (WebMD, NerdWallet, ecommerce). Volume-based ROI maths and SEO A/B testing don't apply at small-business size.
- **UK law**: the privacy chapter and the endorsement rules are US-centred (FTC, US state laws). Ours are UK GDPR, PECR, the CMA and the ASA/CAP code.
- **Conversion**: the authors say SEOs should understand CRO but leave it to others. Use the marketing skills.
- **Visual craft and brand**: beyond the quotes above, no guidance. Use the design skill and the site's design system.
- **Regulated claims**: the book covers YMYL trust signals, not the accuracy of compliance facts. Verify against the primary source.

## Dated or superseded since the book

Confirmed by Google's documents above: AI Overviews and AI Mode replaced SGE; helpful-content questions now sit under core ranking; scaled content, site reputation and expired domain abuse are spam policies.

Not covered by the documents we read, from our own knowledge; verify before relying on them:
- INP replaced FID as a Core Web Vital (March 2024). The book uses FID.
- FAQ and HowTo rich results were cut back sharply (August to September 2023). FAQPage markup may still help understanding, but expect no FAQ rich result for most sites.
- The Mobile-Friendly Test tool and the Search Console Page Experience report were retired; use Lighthouse and the Core Web Vitals report.
- Chrome's third-party cookie deprecation, described as coming in 2024, was later abandoned.
- Tool names, prices and database sizes in chapters 4, 10 and 11 date quickly.

## Reading the evidence with care

- The authors run or ran agencies (Perficient's Eric Enge, Stephan Spencer) and cite their own studies alongside vendor data (Conductor, seoClarity, Ahrefs, Semrush). Figures such as "95% of keywords are long tail" (Ahrefs, via ch5) or Google's own "we use your title about 87% of the time" (September 2021, via ch7) are useful as direction, not as facts to quote.
- The book is careful about what Google says versus what it does, and says Google representatives are "managed" by communications teams (ch14 "Interpreting Commentary"). We follow the same caution.
- **[Ours]** treat each case study as an illustration of a mechanism. The GHC Housing story (ch11) teaches "a real person with an informed view gets press; a press release doesn't", not "comment on newspaper articles".

## Recommendations we do not adopt

- Local SEO was ruled out for Consigns (an online B2B service). **For other sites decide per site**: a business that serves customers in person or in an area needs it (see "Local SEO" in `SKILL.md`).
- Infographics, memes, viral pieces, contests and personality quizzes (ch11) as link tactics: off-brand for compliance software.
- Pinterest and Instagram image-search tactics (ch12).
- Paying for sponsored links for brand exposure (ch11 "Paid links"), even when correctly marked.
- Proactive disavow files (ch9, ch10): Google mostly discounts bad links; only act if a real problem appears.
- Resending an unanswered pitch from a different email domain to get past spam filters (ch11 "Following up"): it reads as evasive.
- Headline superlatives and emotional adjectives (ch11): conflicts with the house voice.
- SEO A/B tests that split pages (ch14): needs a large site.
- A mechanical opportunity-score formula (ch6): we use it only to sort.
- US-specific legal guidance (ch11 FTC, ch13 US states): replaced by UK rules.
