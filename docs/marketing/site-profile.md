# Site profile: Kaizen Web

The facts the marketing skills (`.claude/skills/marketing-messaging`, `marketing-page-design`, `seo-strategy`) need for kaizenweb.co.uk. Template: `.claude/skills/marketing-messaging/references/site-profile-template.md`. Started 1 Oct 2026 from what the repo already says; items marked **unknown** need Sean.

## 1. The business

- **Name and URL:** Kaizen Web, https://kaizenweb.co.uk (canonical, non-www).
- **What it does:** web design and build for businesses. Also runs the Kaizen Builder for client sites. **One sentence in a buyer's words: unknown** (no real enquiries yet to take it from).
- **Where (Sean, 1 Oct 2026):** Sean now lives in **Cleckheaton, West Yorkshire**. West Yorkshire is the main region **in addition to** Merseyside, which Kaizen still covers. The **registered office** is Suite A, 82 James Carter Road, Mildenhall, Bury St. Edmunds, IP28 7DE (`shared/legal.ts`). **103 Old Hall Street, Liverpool L3 9BP** is the address used on the Google Business Profile and cited in many directories; customers cannot visit it. Sean travels to clients. Copy can say Kaizen works across Merseyside and West Yorkshire; it must not say Kaizen is "based in" Liverpool, because Google treats a base customers cannot visit as a false location.
- **Who it is for (Sean, 1 Oct 2026):** three segments, no priority order yet: trade and industrial businesses (for example Midland Oil Group), local service businesses (for example Helen Moore Hairdressing), and any business with a slow or tired WordPress site.
- **Who it is not for:** **unknown.**
- **Stage, traffic (Sean, 1 Oct 2026):** the site has been live a long time but has brought in almost no genuine enquiries. Fixing that is the point of the current work. Search Console data so far is thin.
- **Who approves copy:** Sean.

## 2. House voice

- Plain English, no jargon. Confident but approachable (`CLAUDE.md`).
- The SUCCESS model applies to all copy: Simple, Unexpected, Concrete, Credible, Emotional, Stories (`CLAUDE.md`, from `guidance/Viral_Content_Guide.pdf`). How it fits the method: `marketing-messaging`, "How this fits the SUCCESS model".
- Default Kaizen voice rules from `marketing-messaging` apply unless Sean says otherwise: reading age about nine, British spelling, no em dashes, no hype words, no exclamation marks, must never read as AI-written.
- **Never** mention teams, juniors, seniors, developers or any staffing structure, and never imply either a team or a solo setup. Talk about the experience the customer gets ("you deal with the same person", consistency, no runaround). Existing headings already do this well: "One person. The whole way.", "Advice before invoices.", "Plain English. Every step."

## 3. Proof and claims

- **Proof we have:** case studies under `src/pages/case-studies/`, a pledge page, a review page, and four Google reviews. **Which testimonials have written permission, and their exact wording: unknown.**
- **Midland Oil figures (Sean, 1 Oct 2026):** more than 8 seconds to load before, 1.2 seconds after, and three times the enquiries in the first month. Older copy saying "9 seconds", "under 2 seconds" or "doubled" was wrong and has been corrected. The PageSpeed 23 to 98 figures on `/get-started/` were not contradicted and stay.
- **Helen Moore hero image:** a stock photo, by design (Sean, 1 Oct 2026). Leave it.
- **Case study claims (Sean, 1 Oct 2026):** Midland Oil Group and Helen Moore Hairdressing both agreed to the numbers and claims on their case studies. The "#1" local rankings were last checked in October 2026. Say when they were checked ("checked October 2026") but **never name the search terms**. Re-check before reusing.
- **Statistics (Sean, 1 Oct 2026):** the only numbers we trust are our own, from Search Console. General industry figures ("53% leave after 3 seconds" and the like) come off the site unless a primary source is named and linked.
- **Consign Comply / Consigns:** a product Kaizen built that has become its own spin-off business. Keep it on the site as proof of what Kaizen can build, framed that way. Not a service Kaizen sells here.
- **Claims never to make:** invented results, ratings or client logos without permission; anything about team size.
- **Regulated or checkable facts:** none central to the business. Any performance or ranking claim ("perfect PageSpeed score") must be checkable at the time it is made, and dated.

## 4. Offer and next step

- **Primary call to action:** `/get-started` and `/contact`. What happens after it: **unknown.**
- **Smaller step for someone not ready:** the performance scanner (`/performance-scanner`) is a candidate.
- **Public pricing:** **unknown.**
- **Real urgency:** none known. Do not invent any.
- **Handover path:** **unknown.**

## 5. Design

- Clean, spacious, bright; inspired by the Aramco sponsorships site. Manifa V2 Bold headings, DM Sans body. Generous whitespace (`CLAUDE.md`).
- Tailwind CSS 4; tokens in `client/global.css`; UI kit in `client/components/ui/`.
- Mobile share: about 30% of search impressions (Search Console, Jun 2025 to Sep 2026). Probably higher for real visitors, because most of the suspected bot clicks are desktop.

## 6. Search

- Search Console: Sean has access. First 16-month export read 1 Oct 2026 (findings in `docs/audits/2026-10-01-site-copy-design-seo-audit.md`, section 11). Most non-brand clicks in it look like bots: 11 near-identical "seo agency in liverpool" searches with a 100% click rate at positions 50 to 140. Analytics tool: **unknown.**
- SEO change log: `docs/seo-log.md` (create on first change). Earlier technical audit: `SEO_AUDIT_REPORT.md` (Jan 2025).
- Content backlog location: **unknown.**
- **Local SEO matters here, and the region has grown.** West Yorkshire is added to Merseyside (Sean is in Cleckheaton). Follow "Local SEO" in `seo-strategy` and its checklist 14.
  - Customers can't visit 103 Old Hall Street, so under Google's rules Kaizen is a **service-area business**, not a storefront: the Business Profile should hide that address and name the service areas instead (towns or postcodes, up to 20, within about 2 hours' drive). A profile showing an address customers cannot visit risks suspension. Sean currently uses Old Hall Street on the profile and in directories; changing it is his call and is on hold with the service areas. The Mildenhall registered office stays on the site, labelled "Registered office", for company-law purposes.
  - Staging (`stage.kaizenweb.co.uk`) must never be searchable (Sean, 1 Oct 2026). Every build from the `stage` branch is noindex (`isStagingBuild()` in `src/lib/site.ts`).
  - Sean travels to clients, so a service-area profile is allowed. Sean owns the Business Profile.
  - Areas (Sean, 1 Oct 2026): keep the existing Merseyside areas, and add Cleckheaton, Gomersal and the surrounding area, including Leeds and Bradford. **Do not change the service areas on the site or the profile yet**; Sean will say when.
  - Still open: how reviews are asked for.
  - Existing Liverpool-targeted pages and posts (slugs with "liverpool") are kept at their URLs (don't change URLs for a keyword), but their titles, H1s and copy need a decision once the area list is settled.
- **Page-owner map:**

| Term | Owner URL | Notes |
|---|---|---|
| (to build from Search Console) | | |

- Terms not to target (from Search Console, Oct 2026): people looking for Google's own speed test ("google speed test", "test my site google" and about 300 variants); Shopify, Magento and WooCommerce work in Liverpool, unless Kaizen starts offering it; "kaizen seo ..." searches, which look like people looking for a different company called Kaizen.
- Topic boundary: web design, build and performance for businesses. Consign Comply sits outside it as a showcase product (noindex here; the spin-off's own site owns its terms). Contract product owner work stays on the site (Sean, 1 Oct 2026).
- Credit links on client sites ("website by Kaizen"): plain brand text, `nofollow`, or none. Never a keyword anchor (`seo-strategy`, links).

## 7. Measurement

- Conversions that count: **unknown** (likely a contact or get-started submission).
- Audits go in `docs/audits/`.
