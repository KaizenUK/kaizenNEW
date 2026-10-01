# Site profile: Kaizen Web

The facts the marketing skills (`.claude/skills/marketing-messaging`, `marketing-page-design`, `seo-strategy`) need for kaizenweb.co.uk. Template: `.claude/skills/marketing-messaging/references/site-profile-template.md`. Started 1 Oct 2026 from what the repo already says; items marked **unknown** need Sean.

## 1. The business

- **Name and URL:** Kaizen Web, https://kaizenweb.co.uk (canonical, non-www).
- **What it does:** web design and build for businesses, based in Liverpool (the SEO audit title is "Kaizen Web - Liverpool Web Design"). Also runs the Kaizen Builder for client sites. **One sentence in a buyer's words: unknown.**
- **Who it is for (segments, in priority order):** **unknown.** Case-study material suggests trade and industrial businesses (for example Midland Oil Group).
- **Who it is not for:** **unknown.**
- **Stage, traffic:** **unknown.**
- **Who approves copy:** Sean.

## 2. House voice

- Plain English, no jargon. Confident but approachable (`CLAUDE.md`).
- The SUCCESS model applies to all copy: Simple, Unexpected, Concrete, Credible, Emotional, Stories (`CLAUDE.md`, from `guidance/Viral_Content_Guide.pdf`). How it fits the method: `marketing-messaging`, "How this fits the SUCCESS model".
- Default Kaizen voice rules from `marketing-messaging` apply unless Sean says otherwise: reading age about nine, British spelling, no em dashes, no hype words, no exclamation marks, must never read as AI-written.
- **Never** mention teams, juniors, seniors, developers or any staffing structure, and never imply either a team or a solo setup. Talk about the experience the customer gets ("you deal with the same person", consistency, no runaround). Existing headings already do this well: "One person. The whole way.", "Advice before invoices.", "Plain English. Every step."

## 3. Proof and claims

- **Proof we have:** case studies under `src/pages/case-studies/`, a pledge page, a review page. **Which testimonials have written permission, and their exact wording: unknown.**
- **Claims never to make:** invented results, ratings or client logos without permission; anything about team size.
- **Regulated or checkable facts:** none central to the business. Any performance or ranking claim ("perfect PageSpeed score") must be checkable at the time it is made.

## 4. Offer and next step

- **Primary call to action:** `/get-started` and `/contact`. What happens after it: **unknown.**
- **Smaller step for someone not ready:** the performance scanner (`/performance-scanner`) is a candidate.
- **Public pricing:** **unknown.**
- **Real urgency:** none known. Do not invent any.
- **Handover path:** **unknown.**

## 5. Design

- Clean, spacious, bright; inspired by the Aramco sponsorships site. Manifa V2 Bold headings, DM Sans body. Generous whitespace (`CLAUDE.md`).
- Tailwind CSS 4; tokens in `client/global.css`; UI kit in `client/components/ui/`.
- Mobile share of visitors: **unknown** (check analytics).

## 6. Search

- Search Console property and analytics tool: **unknown.**
- SEO change log: `docs/seo-log.md` (create on first change). Earlier technical audit: `SEO_AUDIT_REPORT.md` (Jan 2025).
- Content backlog location: **unknown.**
- **Local SEO matters here.** A Liverpool web designer is found locally ("web design Liverpool" style searches, the Business Profile, reviews). Follow "Local SEO" in `seo-strategy` and its checklist 14. Open questions for Sean: is there a Business Profile, and who owns it? Storefront or service-area? (Profiles need a place customers visit or a business that travels to them; work done only remotely may not qualify.) Which areas are served? Are there reviews, and how are they asked for?
- **Page-owner map:**

| Term | Owner URL | Notes |
|---|---|---|
| (to build from Search Console) | | |

- Terms not to target: **unknown.**
- Topic boundary: web design, build and performance for businesses.
- Credit links on client sites ("website by Kaizen"): plain brand text, `nofollow`, or none. Never a keyword anchor (`seo-strategy`, links).

## 7. Measurement

- Conversions that count: **unknown** (likely a contact or get-started submission).
- Audits go in `docs/audits/`.
