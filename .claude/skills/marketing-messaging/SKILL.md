---
name: marketing-messaging
description: "Read before deciding WHAT a marketing page, ad, email or section should say, for Kaizen's own site or any client site: finding the message (voice of customer, awareness, segments), the message hierarchy, objections and proof, and turning it into clear copy. Pairs with marketing-page-design (how the page carries the message) and seo-strategy (which page owns which search term). Needs the project's site profile."
metadata:
  author: Kaizen Web (method first written for Consigns, 24 Sep 2026; generalised 1 Oct 2026)
  sources: "Copy Hackers Book 1, Where Stellar Messages Come From (Wiebe, 2nd ed. 2014) + its three worksheets; Making Websites Win (Blanks and Jesson, 2018). Source assessment in references/sources.md."
---

## Before you start: the site profile

This skill is the method. The facts about a particular site live in its **site profile**: who it sells to, the house voice, what proof exists, the claims that must never be made, the compliance facts and where they are verified, and the page-owner map. Default location: `docs/marketing/site-profile.md` in the site's repo, with its evidence log in `docs/marketing/voice-of-customer.md`.

- If the profile exists, read it first. Where it sets a stricter rule than this skill, the profile wins for that site.
- If it does not exist, create it from `references/site-profile-template.md` before writing copy. Fill what you can from the repo and the owner; mark the rest as unknown. Never invent the gaps.
- Kaizen's own profile is `docs/marketing/site-profile.md` in the kaizenNEW repo. It includes the SUCCESS model from `guidance/Viral_Content_Guide.pdf`; see "How this fits the SUCCESS model" below.

## The one idea

Good copy is found, not invented. Both books agree the best messages come from the people who buy, in their own words, and that the writer's job is to know them well enough to say what they need to hear, at the point they need to hear it. Copy Hackers is strongest on *finding and ranking* the message. Making Websites Win is strongest on *diagnosing why a page fails* and *placing each answer where the doubt arises*. Use both. Neither is a formula, and Copy Hackers says so directly ("there is no perfect reusable formula", CH p27).

## Workflow (scale it to the job)

A one-line fix needs step 5 only. A new page or a rewrite needs all of it. Never skip step 1 by guessing, and never present a guess as research.

1. **Gather what evidence exists.** Start with the site's `voice-of-customer.md`. If the business has few or no customers yet, most evidence comes from outside: Copy Hackers has a whole chapter for exactly this case, "How to find your message if you don't have customers yet" (CH ch5, p36-45), and MWW has a section on low-traffic sites (MWW p84-86). Sources, roughly best first:
   - **The owner's own trade knowledge.** The founder or salesperson is the first "VOC aggregator" (MWW p132-134): write down how they explain the product on a call, then edit that ("speak first, write later", MWW p161-163). Interview anyone else close to the trade (CH p40 "interview your employees or co-founders"). Use the question bank in `references/working-tools.md` and add a dated entry to `voice-of-customer.md` after every call, chat or event.
   - **Existing customers and testimonials.** Mine them for phrases (CH p29-30). Talking to a real customer's staff is the nearest thing to customer research when there are few customers.
   - **People who sell to or advise the same buyers** (MWW p132-134): trade associations, consultants, resellers, published regulator or industry FAQs. Their FAQs are a record of what buyers actually ask.
   - **Where buyers talk** (CH p36-38 "go find your prospects, and listen in"): trade forums and groups, LinkedIn threads, comments under trade press, questions asked at events.
   - **Reviews of competitor and adjacent products** (CH p37-39 review mining; MWW p130-131). Log what people praise, want and are angry about.
   - **Search Console queries and site search**: the searcher's own words and a read on awareness (CH p16; MWW p112-113).
   - **Chat conversations and session replays** as they arrive: while volume is low, every chat is research (MWW p134-135 on why the first calls are gold). Keep a log.
   - **Competitor sites**, as a record of what buyers have already been told (CH p40-45), never as proof of what works.
   **Honesty rule:** most lines will start as hypotheses. Mark each message *evidence* (with the source) or *hypothesis* in your working notes, never dress a guess up as research, and never write copy that implies customers, numbers or results the business does not have. Do not run surveys, interviews or outreach unless asked; suggest the cheapest one that would settle the biggest open question. As real customers arrive, move the customer-based methods (surveys, "what nearly stopped you", interviews) to the top of this list.

2. **Name who the page is for and what they already know.**
   - *Segment.* Write for the visitors most likely to act and be glad they did, not everyone who lands (CH ch2, p19-26: "vague is the enemy of conversion"; MWW p287-299 on niching). Take the segment split from the site profile. Let the visitor see themselves: name them ("For [segment]", CH p22 "ideal for").
   - *Awareness.* How much do they know about the problem, about solutions, about this business? (CH p14-17, after Schwartz.) Less aware needs more explanation and story; more aware needs the offer and a fast path. A rough map that fits most sites (check it against data): guides and blog = problem-aware; checkers, calculators and deadline pages = aware of the problem, not of solutions; product, service and industry pages = solution-aware; comparison and alternative pages and branded search = product-aware; ad landing pages depend on the keyword.
   - *Readiness.* Many visitors are not ready to buy yet (MWW p238-240). Give them a useful next step that is not a sale.

3. **Build the message inventory.** Before any wordsmithing, list:
   - *Pains and motivations.* Pain is what hurts now; motivation is the deeper want the page should reflect, not create (CH p8-13).
   - *Features and their benefits.* Every feature, whether it is unique, the pain it solves (in customer words), the benefit, and a priority (CH ch7, p53-58, the product positioning document). Drop features with no real benefit (CH p57).
   - *Objections and counter-objections.* One row each (MWW p242-244 "O/CO table"; CH ch8). Start from the eight common ones (CH p60-61: no need, no authority, don't want to be sold to, other priorities, current way works, doubt your capability, price, having to convince others) and replace them with the real ones as evidence arrives.
   - *Proof and reasons to believe.* What the business can show for each claim. The site profile lists what is allowed; see "Proof" below.
   Templates for all four are in `references/working-tools.md`.

4. **Rank it into a message hierarchy.** Order by what matters most to the chosen segment, weighted by how often it comes up in the evidence (CH p56 and worksheet note 5). Then map each objection to the point on the page, or in the funnel, where the visitor will think it (MWW p78-79: "counter each objection at the exact moment that the visitors are thinking it"). The problem is a lock and the answer is the key: a guarantee does not fix "I don't understand what it does", only a clear explanation does (MWW p76-78). Hand this ranked list to `marketing-page-design`; it decides how the page reveals it.

5. **Write, then cut.** Overwrite from the inventory, then trim hard (CH p70, quoting Caples). Apply the clarity rules below. Read it aloud. Then test it on a person (see "Checking copy").

## Clarity rules (from MWW "are written well", p157-173)

- Plain *language*, not plain *design*: the words are simple, the page around them is rich and polished; see `marketing-page-design`.
- Plain language beats "branding waffle" (MWW p195-196). The visitor must know what the thing does within seconds. "Music, meet home" loses to what it actually does. Say what the business does in the words a buyer would use.
- Short sentences. The reader holds about fifteen words before they need meaning to land (MWW p163-165). Keep subject and verb close.
- Use real verbs, not nouns made from verbs: "we check the note", not "we carry out a verification" (MWW p165-167).
- Default shape: someone does something to something. Usually "you" and "we" (MWW p167).
- Concrete over abstract: if you filmed the sentence, what would the camera show? (MWW p167-168.)
- Put the point at the end of the sentence (MWW p168).
- Specifics stick; summaries slide off (CH p57). "Files your report with the regulator" beats "compliance made easy".
- Keep offers simple enough to repeat (CH p72).
- If you are stuck, say it out loud as you would on a call, record it, and edit the transcript (MWW p161-163, the Moz example).
- **House voice.** Each site profile sets its own (reading age, spelling, banned words, terms to use and avoid). The default for every Kaizen-built site unless its profile says otherwise: reading age about nine; British spelling; plain ASCII punctuation (no em or en dashes, no curly quotes, no ellipsis glyph); no hype words (seamless, streamline, leverage, cutting-edge, robust, unlock, empower, revolutionise, game-changer, hassle-free, effortless); no exclamation marks; must never read as AI-written.
- **Rule of three:** Copy Hackers recommends anaphora "ideally in sets of 3" (CH p50). We do not. A rhetorical triad is the most recognisable AI tell and many readers are sceptical. Use pairs, or one strong line. A factual list with three members is fine.

## Sticky lines, used sparingly

Copy Hackers lists devices that make a line memorable: repetition, hyperbole with a simile, "if this, then that", comparison to something known, bending a word's grammar, sound and rhyme (CH p49-52). Its best example, "If you think you need rehab, you do" (CH p39, p51), came straight from a book review, not a brainstorm.

How we use them: clarity first, stickiness second. At most one device per page, usually in the H1 or a section heading, and only if the phrase comes from, or survives contact with, the evidence. "If this, then that" and "compared to what you know" suit most business buyers best (example from Consigns: "Like parcel tracking, for your waste movements", which came from how the founder pitches on calls). Hyperbole does not suit anything regulated, financial or safety-related. Frequency in the evidence is the first test of a phrase (CH p49).

## Features, benefits and proof

The books disagree here, and both are partly right.
- Copy Hackers: work out benefits first; cut features without a benefit (CH p53-57).
- MWW: "always talk benefits, not features" is a myth. State features when they prove the benefit, benefits when the feature means nothing on its own, and often both (MWW p193-195). "Really safe" needs "has air bags".
- Our default: pair them. The benefit carries the heading; the feature is the proof underneath ("Nothing to re-type. The driver's signed note becomes the report."). Practical, sceptical buyers treat a feature as a fact they can check.
- Remember the benefits nobody mentions (MWW p197): check every element of value, including the ones the owner or support take for granted, and the benefit of *how* the business works (CH p57: no pushy sales, a real person to talk to, how fast they reply).

## Proof (what we may claim)

The site profile lists the proof that exists and any wording rules (for example an official listing that must be described with the regulator's own word). Never invent quotes, names, logos, ratings or numbers. Never claim an approval or certification the business does not hold. Within that:
- Put the proof where the doubt is (MWW p222-224 "proof magnets"; CH p66: reasons to believe near the action).
- Treat proof as something to earn, not only display (MWW p224-225 "proof investment"): if the evidence says buyers want to see others like them using it, the job is to get more permissioned testimonials and case studies, not to fake the look of them. Log the gap.
- Demonstration is proof you can always use: real screens, real work, the real process (MWW p220).
- Separate "do I trust the company" from "do I trust the product or service does this job" (MWW p225-226). Both need an answer.

## Risk, urgency and offers

- **Future-pace.** Show what happens after they say yes, step by step (MWW p197-199). This answers "what am I letting myself in for" and lowers the perceived cost of the first step.
- **Lower the first commitment** and use as many words as the decision needs (MWW p244-249). If the first step is small (a chat, a free audit), say so.
- **Risk reversal** works only when the visitor is worried about risk or doubts a claim, and it must be worded as a promise, not a get-out clause (MWW p226-230).
- **Urgency must be real and explained** (MWW p310-311: have a deadline and give the reason). Real dates (a law coming in, a season, a genuine price change) are fine; take them from the source the site profile names. Never invent urgency: no "people viewing now" notices, fake countdowns, rolling "offer ends" dates (the MWW travel and Bose examples, p306-310, are not for us). One fake signal costs more trust than it wins.
- The pricing-display tactics in MWW (odd prices, showing decimals, repeating "free", comparing to lattes; p212-214) suit consumer sites with a public price list. Check the site profile: most business sites we build should not use them.

## When two ideas get confused, split them

A pattern worth reusing on any site: when buyers mix up two separate things (two duties, two products, two deadlines, two prices), copy must never let one sentence carry both. Answer in two labelled parts, each with its own date or fact, or a plain "there isn't one". Say out loud the reassuring fact people assume is false. Use exact modal verbs: "must" only for what is required, "may" for someone's choice. Give the reader one useful thing to do that isn't a sale. The design skill keeps the two in separate modules.

Worked example (Consigns, Sep 2026): carriers thought digital waste tracking meant "electronic transfer notes by law". The fix was always two parts, the regulator reporting duty first and the paper notes second, saying plainly "paper notes are still legal", and ending with "ask your site what they'll need from you".

## Where messages go (site-wide)

- Minor objections: FAQs, especially on the money path (CH p62).
- Major objections: the highest-traffic pages, near the action (CH p62).
- An objection hard enough to lose deals may earn its own page (CH p62), if the evidence shows it.
- Reuse what wins: a heading or counter-objection that works on one page probably works on its siblings (MWW p338).
- Keep the message consistent from ad or search result to page to chat to onboarding email. MWW calls the break between them the "handover of death" (MWW p313). Write down the site's handover path in its profile.

## Checking copy

Low traffic means A/B tests rarely reach significance (MWW p84-86, p149-152). So:
- **Readability test** (MWW p161): have someone read it aloud and note every stumble. An agent can approximate this by reading line by line and marking every point where meaning does not resolve, but a human reader is the real test.
- **User test** a page with a task and silence (MWW p136-143). Non-web-savvy users find more (p138).
- **Five-second test** (MWW p179-180): what do they remember? It should be what the business does and who it is for.
- **Plain-text test** (MWW p177-178): paste the page's text into a plain editor. The argument should still work without the design.
- If a test is possible, test a bold change, not a tweak (MWW p72-75).
- Before launch, user tests are the main check: recruit buyers through the owner's network or an existing customer, or failing that anyone who fits the role (MWW p85, p136-138).
- Once customers exist, ask every new one "What nearly stopped you signing up?" (MWW p102-104) and "What was going on that made you look for this?" (CH p16, p34). Those two questions feed step 1 better than anything else.

## Competitor audits

Useful to know what buyers have already seen, so you meet expectations and avoid white noise, and to spot gaps (CH p40-45). MWW is cooler on it: learn from them, but "to beat them, you'll need to do things they don't" (MWW p153-154). Audit at most around ten sites, home page plus one product page, noting value proposition, top messages, calls to action, reasons to believe, tone, and whether tone matches the visual design (the Content and Tone Audit deck). Do not copy. The audit is not evidence of what works (CH p44).

## How this fits the SUCCESS model (Kaizen)

Kaizen's `CLAUDE.md` asks all copy to follow the SUCCESS model (Simple, Unexpected, Concrete, Credible, Emotional, Stories). It fits this method; use it in step 5 as a check on the draft:
- **Simple, Concrete, Credible** say the same as the clarity rules and the proof rules here. No conflict.
- **Stories** match future-pacing and using the customer's own story (MWW p197-199; CH's review mining).
- **Unexpected and Emotional** are allowed, but never at the cost of clarity or truth. A surprise must be true and come from the evidence; emotion comes from the buyer's real pain and motivation (step 3), not from hype words or high-arousal claims. One sticky device per page still applies.

## Output expected from this skill

When asked to write or rewrite a page, return: (a) who it is for and their awareness, (b) the ranked message list with the evidence for each line or "hypothesis", (c) the objection map with where each is answered, (d) the copy, (e) what would prove it right or wrong. Keep (a) to (c) short. They are for the design skill and for the owner, not the page.

## Glue

- `marketing-page-design`: turns the ranked messages into page structure, hierarchy and visuals. The two skills share one page brief (`references/working-tools.md`).
- `seo-strategy`: target terms and which page owns them. The H1 must carry both the search term and the message; if they fight, the SEO skill decides the term and this skill decides the promise around it.
- The site profile: voice, proof, banned claims, compliance facts and where they are verified. Verify any regulated fact (dates, laws, fees, codes) against the primary source before it ships.
- Sources and our reading of them: `references/sources.md`. Change history: `references/changelog.md`.
