---
name: marketing-page-design
description: "Read before designing, restructuring or reviewing a marketing page or section, for Kaizen's own site or any client site: page structure, visual hierarchy, how objections and proof are placed, long vs short, progressive disclosure, headings, calls to action, mobile, and how to diagnose a page that is not working, all at a premium, distinctive, polished bar. Pairs with marketing-messaging (what the page says) and seo-strategy. Needs the project's site profile."
metadata:
  author: Kaizen Web (method first written for Consigns, 24 Sep 2026; generalised 1 Oct 2026)
  sources: "Making Websites Win (Blanks and Jesson, 2018); Copy Hackers Book 1 (Wiebe, 2014) and the Content and Tone Audit deck. Source assessment in ../marketing-messaging/references/sources.md."
---

## Scope

This skill decides *what the page needs to do and in what order*. Each site's design system (its component kit, tokens, page families, signature elements, named in the site profile at `docs/marketing/site-profile.md`) decides *which components build it*. Read the profile first; if there isn't one, create it from `../marketing-messaging/references/site-profile-template.md`. App and dashboard screens behind a login are out of scope.

For Kaizen's own site, the design direction in `CLAUDE.md` (clean, spacious, bright; Manifa V2 Bold headings, DM Sans body; generous whitespace) is the brief this skill works inside.

## Looking excellent is non-negotiable

**Every site must look premium, distinctive and polished. A plain, bare, template-looking or cheap page is a failure, however good its copy.** People judge whether a business is careful by whether its site is careful. This is Sean's standing requirement and it outranks anything in the books.

Read this whole skill that way. Where it says "clear", "simple" or "every element earns its place", that is about the **message** being easy to follow. It never means fewer visuals, less craft, flatter styling, stock layouts or a sparse page. A page should be clear *and* rich: strong type, confident colour, the site's own patterns and signature elements, real product or work shown in proper frames, considered motion, depth, generous spacing, and detail that rewards a second look.

**What the sources say, and what we do with it.** Making Websites Win argues top sites "design for function, not aesthetics" (MWW p62-67). We do not adopt that framing. What the authors object to is narrower: design used *instead of* understanding the visitor, and decoration that hides the words (p65-66, p177-178). They also concede beauty is right when it helps visitors buy, and that good functional design "has a beauty of its own" (p65-67). Copy Hackers wants the message "supported by meaningful design" and reasons to believe "elevated with strong visual design" (CH p13, p68).

Our position (ours, not the authors'): **beautiful design is part of how the page works, not a cost to it.**
- Trust sells. MWW says trust decides sales in finance and health (p221), and one of its biggest wins came from making the trust signal visually dominant (goHenry, p331-332). Polish is a trust signal. A careless page reads as a careless business.
- Distinctiveness is how a business gets remembered. MWW's own advice is to stand out in a crowded field (p291-292, p301-303). A generic template look is invisible.
- Craft shows care. Buyers judge whether a business sweats the detail on their job by whether it sweats it on its site.

**What we do keep from MWW**, as quality checks that sit alongside great design and never replace it:
1. **The words work on their own.** Paste the text into a plain editor and the argument still holds (MWW p177-178). This tests the copy, not the design. The page itself should look nothing like plain text.
2. **Build on the design system.** Pages built from the site's kit, families and tokens stay consistent and are quick to improve. Extend the kit when it is not enough; never downgrade a design to fit it.
3. **Visuals do work as well as look good.** Real screens, real work, the customer's journey, timelines and future-pacing flows are the richest visuals because they also prove the point. Patterns and motion set the tone and lift the page; they must never hide the message or slow the page down.

## Diagnose before you prescribe

MWW's core method is DiPS: Diagnose, find the Problem, then pick the Solution that fits it (p75-79). "Best practices" sprayed onto a page add clutter and bury the one answer the visitor needed; "your visitors' attention is limited" (p76). Before redesigning, name the problem. MWW's list of the usual ones (Section 3, p156-322) is a good checklist:

| If visitors... | The fix is about... | MWW |
|---|---|---|
| can't understand the words | clearer writing | p157-173 |
| can't work the page | usability | p173-182 |
| can't find what they came for | the offer or the IA | p182-191, p257-259 |
| don't see why it matters to them | benefits and value proposition | p191-200 |
| don't think it's a good deal | the offer and risk | p200-216, p226-233 |
| don't trust us or the product | proof, placed where the doubt is | p216-226 |
| aren't ready yet | a smaller next step and a way to come back | p233-240, p300-306 |
| are lost in detail | structure and progressive disclosure | p241-286 |
| pick a competitor | a sharper niche and difference | p287-299 |
| mean to come back later | real urgency, memorability | p300-311 |
| drop at the handover | the chat, call and setup steps | p311-316 |

Evidence for which one applies comes from the messaging skill's step 1, session replays, scroll and click maps (a "false bottom" where scrolling stops, p91-92), and user tests. With low traffic, user tests and replays beat A/B tests (p152).

## Start from the page brief

Every new page or substantial redesign starts from the shared page brief (`../marketing-messaging/references/working-tools.md`): who, what they know, the one job of the page, the target query, the ranked messages, the objection map, the proof, the next step. If there is no brief, write a short one first. This is the handoff between the skills. It is a set of questions, not a template for the layout.

## Structure

**Order follows the visitor's questions, not a formula.** Open by joining the conversation already in their head (CH p28). For a solution-aware buyer that is usually: what is this, is it for me, does it do my job, can I trust it, what happens if I say yes. For a problem-aware reader of a guide it is the answer to their question first, the product later. There is no fixed section order; MWW and CH both warn against one (CH p27; MWW p78-79).

**Long enough, and never boring.** A page needs at least as many words as you would use selling face to face (MWW p244). "There's no such thing as a too-long page, only a too-boring one" (MWW p330). But:
- **Long like a phone book, not a Russian novel** (MWW p250). Break content into clearly bounded modules, one concern each, so a reader can jump to theirs and skip the rest (p250-255).
- **Make the boundaries obvious.** Band tones, cards and spacing do this; alternate them deliberately (p255-257). Keep one idea per band.
- **Keep heading depth shallow.** Readers track H1 and H2, just about H3, and get lost below (p255).
- **Reduce the commitment before adding words.** A smaller first step needs less persuasion (p244-247).
- **Offer a dual path.** The action is always within reach for the ready visitor, and the detail is there for the careful one; repeat the call to action after each major objection is answered (p246-249, goHenry p330).

**Headings are signposts that carry the message.** MWW distinguishes categorisers ("Media mentions"), teasers and spoilers (p259-261). A skim-reader should get the argument from the headings alone, so prefer spoilers: not "Features" but "Nothing to re-type"; not "Security" but "Your records are kept for as long as the law says". Avoid "surprise navigation": labels only an insider understands, including product names in nav (p258-259).

**Navigation mirrors the visitor's mental model** (p257-258). Build the nav around a buyer's questions in order; keep new pages inside that logic. Card sorting or a tree test settles disagreements (p258, p181).

**Progressive disclosure adds depth without clutter** (p261-285). Tooltips, accordions, overlays and "read more" let a page answer the long tail of doubts without sending people away. Prefer on-page disclosure to a new page when you want them to stay in the flow (p261, the sunshine.co.uk "Where's our phone number?" overlay p266-267). Never hide the H1, the lead, the calls to action or anything a test reads. Disclosed content must still be in the page's HTML (see `seo-strategy`).

**Place each answer where the doubt arises.** Use the objection map. Proof near claims; risk reversal near the action (MWW p230; CH p66); price and commitment worries on the money path (goHenry pricing page p334-337: "many companies assume they don't need to do any selling on their pricing page").

**Two confusable ideas, two modules.** When the messaging skill splits two things buyers mix up (two duties, two products, two deadlines), the design keeps them apart so the eye can't merge them:
- Two clearly bounded modules, side by side on desktop and stacked on phones, in the order the messaging skill sets. Each gets its own spoiler heading, its own date or fact (or a plain "none"), and its own visual treatment. Never one timeline or list that runs both down the same line.
- The one call to action sits after both modules, never inside the one that carries a legal duty, so the page never reads as "the law says buy this".
- Checked on a phone at 375px: both modules keep their headings and dates in view without an accordion.
- Worked example (Consigns): "Report to DEFRA" and "Your paper notes" as two modules, with headings like "Paper notes are still legal".

**Show what happens next.** A future-pacing flow (MWW p197-200) tells the customer's story from first contact to first result. Draw it with real screens or real work. Prototype it rough and test it before polishing (p199-200).

**Specific to the segment.** Each audience page should look and read like it was made for that audience (CH ch2). The segment's own words, the segment's day, the segment's work. Nothing looks the same twice.

## Calls to action

- One primary action per view; follow the site profile's rules on which actions to offer.
- The label says what happens ("Chat with us", "Get a quote"), and a small line under it removes the fear ("A real person, usually within minutes" only if true).
- The competitor CTA audit (CH p44-45) is worth doing when changing the main action: know what buyers expect before departing from it.

## Mobile

Check the site's mobile share in analytics; it is often a third or more. MWW's goHenry case found mobile visitors were not desktop visitors on a small screen: more impulsive, less informed, more worried about trust (p326-328). Research and design them separately. Also: slower connections, fiddly keyboards, forms are harder, bright light kills low-contrast text (p345). Contrast and tap targets are part of polish. Form inputs at 16px or more, so phones don't zoom on focus.

## Visual hierarchy and eye path

- The eye goes where the design sends it (MWW p143-145, p175). Decide the one thing each band must say and make it the most visible thing in it.
- People look where a face in the image looks (MWW p143). If you use photography of people, point their gaze at the message.
- Real product screens and real work beat illustrations as proof and as design (demonstration, MWW p220). Re-capture them when the product changes.
- Check tone against the visuals: the Content and Tone Audit deck asks "does the copy tone match the visual design?" A calm, precise voice needs a calm, precise page.

## Checking a design

Before calling a page done, in addition to the site's own definition of done:
- **Five-second test**: what the business does and who it is for should be what people remember (MWW p179-180).
- **Headings-only read**: the argument survives.
- **Plain-text read**: the words work alone (a copy check only; the page must still look rich).
- **Premium check**: would it sit comfortably next to the best-designed sites in its field? Does it look like this brand and its page family, not a template? If any band looks bare, flat or unfinished, it is not done.
- **Phone at 375px**: the first screen says what, for whom, and the next step.
- **Objection map check**: each major objection has a visible answer on the page, near where it arises.
- **Confusable-ideas check** (where the messaging skill split two ideas): separate modules, separate facts, the reassuring fact said plainly, nothing implying a duty that doesn't exist.
- **Polish pass**: spacing rhythm, alignment, type scale, contrast, image crops, hover and focus states, no layout shift, dark sections flip correctly. Inspect, don't eyeball: check a button's computed padding and a container's centring rather than trusting a screenshot.
- Where possible, a real user test of the key task (MWW p136-143). Three tests usually surface something important (p139).

## Change in steps, not big bangs

MWW's view is that top sites change often and in parts, and that most big redesigns lose (p68-69, p344). After a launch or a large rebuild, improve page by page, one diagnosed problem at a time, and watch the result in analytics before the next change. Bold changes, not meek tweaks (p72-75): a new argument or structure, not a button colour.

## Glue

- `marketing-messaging`: the ranked messages, objections and proof this skill lays out.
- `seo-strategy`: target terms, page ownership, and the technical rules that affect layout (text in the HTML, nothing covering content on arrival).
- The site profile: design system, tokens, signature elements, calls to action, mobile share.
