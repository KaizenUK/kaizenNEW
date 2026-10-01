# Sources: what the books say, and what we take from them

Assessment first written 24 Sep 2026 (for Consigns) from a full read of both books and the three worksheets; generalised for any site 1 Oct 2026. Page numbers are the printed page numbers. "CH" = Copy Hackers Book 1, *Where Stellar Messages Come From*, Joanna Wiebe, 2nd edition, 2014. "MWW" = *Making Websites Win*, Karl Blanks and Ben Jesson, 2018. Short quotes only; the books are copyright.

Labels: **[Author]** = what the book explicitly recommends. **[Ours]** = our conclusion for the sites we build.

## What was read, and gaps

- CH: read in full from a Markdown export, with the PDF checked where the export dropped images (the awareness diagram p15, the message-relationship diagram p28, the Beachway headline p39/p51, the GrooveHQ and Flow examples p51). Some small screenshot examples remain unreadable in both versions (e.g. Lodgify, Pijonbox, 23andMe, Zappos images); they illustrate points the text already makes.
- CH worksheets: Amazon Review Mining (docx), Product Positioning Document (docx), Content and Tone Audit (pptx, 22 slides). All read. The deck is marked "not for public use or distribution", so `working-tools.md` adapts the ideas in our own words rather than copying it.
- MWW: read in full from a Markdown export. The PDF was too large to upload, so the images are missing: the wireframes in Section 3, the goHenry before/after pages, the eye-tracking and heat-map figures, the sample-size graph (its numbers are in the text). The text carries the argument; the visual examples could not be assessed.

## The two books in one line each

- **CH** is about *finding* the message: know the segment, its pains, motivations and awareness; mine customer language; inventory features, benefits and objections; rank them.
- **MWW** is about *diagnosing why a page fails* and fixing that specific problem: research first (25 techniques), then fourteen common failure types, each with remedies, with a strong line on writing clarity, page architecture and testing.

## Where they agree (so we lean on it hard)

| Theme | CH | MWW |
|---|---|---|
| Messages come from customers, not the writer | p5 "your best messages don't come from inside your head"; use their words verbatim | p115-135 empathy, method marketing, VOC aggregators, how others describe it |
| Research before writing | ch1, ch4, ch5 | Section 2; DiPS p75-79 |
| Talk to people who sell and support | p31 support emails; p40 interview staff | p127-135 sell face to face, VOC aggregators, phone calls |
| Mine reviews and third-party descriptions | p37-39 review mining | p130-131 reviews, Wikipedia, referral messages |
| Focus on a segment | ch2 "write for 20 to 35%" | p287-299 niching |
| Objections must be answered specifically | ch8, eight objections, prevent/pre-empt/respond | lock and key p76-79; O/CO table p242-244 |
| Specifics and data persuade | p57 "specifics stick" | p218-219 data and statistical evidence |
| Long copy is fine if it is interesting | p70 (Caples) | p244, p330 |
| Put reassurance near the action | p66 reasons to believe near the funnel | p230 guarantee near the call to action |
| Test rather than argue | p26, p44 | Principle 2 p67; whole method |

## Where they differ

1. **Features vs benefits.** CH: benefits first, drop features without a benefit (p53-57). MWW: "always benefits, not features" is a myth; features are proof (p193-195). **[Ours]** pair them; benefit leads, feature proves.
2. **Rhetoric vs plainness.** CH recommends sticky devices, including triads, hyperbole and rhyme (p49-52). MWW's writing chapter is about clarity and plain language (p157-173) and says plain language "almost always beats branding waffle" (p196). **[Ours]** clarity first; one sticky device at most, from the evidence; no triads (AI tell); no hyperbole in claims a buyer could test.
3. **Competitor audits.** CH makes a structured audit a core exercise (p40-45). MWW calls competitor analysis "not our favorite technique" and useful mainly for positioning (p153-154). **[Ours]** audit for expectations, white noise and gaps; never as proof of what works.
4. **Design.** CH barely covers design: copy "supported by meaningful design" (p13), reasons to believe "elevate with strong visual design" (p68), and the audit deck asks whether tone matches the visual design. MWW takes a position: function over aesthetics (p62-67). **[Ours]** we reject the function-over-aesthetics framing. Every site we build must look excellent; polish is part of how a page earns trust. See `marketing-page-design` "Looking excellent is non-negotiable". MWW's useful checks (the words work on their own, build on the design system, visuals that also prove the point) are kept as additions to great design, never substitutes for it.
5. **Negative framing.** CH: positive and negative both work; avoid negative associations with the brand (p70-71). MWW: negative headlines work when visitors have decided to act and fear the wrong choice (p79); guarantees should be worded positively (p228). Consistent in the end: use negatives about the problem, positives about the business.
6. **Unit of work.** CH works at the level of messages and the whole site. MWW works at the level of a diagnosed problem on a page and the whole funnel, including offline and post-sale (p316-322, p341). Together they cover message and placement.

## What each adds that the other lacks

- CH only: state of awareness (p14-17); motivation vs pain vs value proposition (p8-13); the product positioning document (p55-58); swipe-worthiness tests (p49); the eight objections and prevent/pre-empt/respond (p60-62); "no perfect reusable formula" (p27).
- MWW only: DiPS (p75-79); the fourteen failure types (Section 3); readability mechanics (memory buffer, nominalisations, sentence shape, p163-168); "speak first, write later" (p161-163); separation of concerns, heading depth, spoiler headings, progressive disclosure (p250-285); future pacing (p197-199); guarantees design (p226-233); readiness and multi-step funnels (p233-240); handover problems (p311-316); low-traffic testing (p84-86, p149-152); mobile as a different audience (p326-328, p345); "What nearly stopped you buying from us?" (p102-104); proof magnets and proof investment (p222-225).

## What neither covers well (use other guidance)

- **Visual craft and brand distinctiveness**: type, colour, composition, motion, image direction. Governed by each site's design system and our design standard, which requires every site to look premium and distinctive, never plain.
- **Accessibility**: only a passing mention in MWW (contrast in bright light p345, a tool list p142). WCAG AA and visible focus states stand on every site.
- **SEO and answer engines**: CH uses search terms as an awareness signal (p16); MWW says SEO gets easier when a site converts (p37). Neither covers search intent, titles or structured data. Use `seo-strategy`, built from *The Art of SEO* (4th ed.).
- **Regulated claims**: neither deals with claims a regulator or trade body could test. Verify against the primary source.
- **AI-written tells**: pre-date the problem. The house voice rules cover it.
- **B2B buying groups**: touched only as objections (CH p60-61 "authority", "convincing others"; MWW p209 "someone else's money"). Consider each person in the buying group (owner, office manager, the person who uses it daily) as a separate reader.
- **Long-term brand building** (memory, distinctive assets over years): both are conversion books, focused on the next action.

## Reading the evidence with care

- Both books are written by practitioners selling services (MWW's agency, CH's courses and the Disco survey tool plugged at p6). Results are their own client case studies, mostly A/B test uplifts without published sample sizes. MWW's own disclaimer says results cannot be viewed as typical (front matter).
- Both assume you have customers and traffic to learn from. Many small-business sites have little of either, so CH ch5 (no customers yet) and MWW's low-traffic advice (p84-86, p149-152) often matter most, and most messages start as hypotheses.
- Examples are dated (CH 2011 to 2014, MWW to 2018) and mostly B2C or high-traffic web businesses. Tools named in both have changed or gone.
- **[Ours]** treat each example as an illustration of a mechanism, not a rule. "Eliminate up to 99% of your paper files" beat its control for one company (CH p29-30); the lesson is "swipe tangible outcomes from testimonials", not "use percentages". The goHenry Visa placement (MWW p331-332) teaches "use the trust you already have", not "put a partner logo above your own".

## Recommendations we do not adopt

- Manufactured urgency: live-viewer notices, countdowns, rolling deadlines (MWW p306-310). Real deadlines only.
- Price-presentation tactics for a public price list (MWW p212-214) on business sites; consider them case by case for consumer sites with public prices.
- Rewards for people spending their employer's money (MWW p209).
- Celebrity endorsement (MWW p219), unless genuinely relevant and permissioned.
- Size and fan-count claims the business cannot back (MWW p217).
- Asking for contact details the moment someone lands (MWW p305).
- Rhetorical triads (CH p50) and hyperbole in claims (CH p50, p72 "magic button").
- Demographic questions such as gender (CH p18); for B2B use role, company type and what brought them.
