# Reusable marketing proof

Prepared and adopted on the homepage for F-07 on 2 October 2026. These components use the isolated Untitled UI tokens, button and action labels installed by F-01/F-02.

## Use

Import from `client/components/untitled/proof`. In an Astro page, render the components directly without a `client:*` directive. All words, dates, figures and links are in the server HTML. The components need the marketing stylesheet that already loads the Untitled UI theme and fonts.

```astro
---
import {
  CaseStudyCard,
  MetricsBlock,
  TestimonialCard,
  Testimonials,
} from "../../client/components/untitled/proof";
---

<Testimonials />
<TestimonialCard reviewId="bLoughran" />
<MetricsBlock />
<CaseStudyCard headingLevel="h2" />
```

- `Testimonials` shows the four existing Google reviews as a static grid. `ids` accepts a subset when a particular review answers the nearby doubt. A single item fills the available width. The row does not move or duplicate reviews.
- `TestimonialCard` accepts one `reviewId`. The visible words are exact excerpts, labelled as part of a review. Quotes are not clipped. The name, month, five-star rating and Google link are always shown. Initials are decorative, not invented portraits.
- `MetricsBlock` defaults to Midland's `loadTime` and `enquiries`. Optional `ids` can include `years`; this is Midland's business history, not a result achieved by Kaizen. `onDark` changes the text and rule colours for a dark surrounding band. Attribution stays with the figures. The case-study link defaults on; use `showSourceLink={false}` only when an adjacent case-study card already supplies it.
- `CaseStudyCard` defaults to `studyId="midland"` and `layout="stacked"`. It shows a real screenshot at its intrinsic ratio, a short result and the shared case-study action. Optional `layout="wide"` places the screenshot beside the copy at desktop widths and keeps the phone layout stacked. `headingLevel` can be `h2` or `h3`. The image is lazy-loaded by default; use `imageLoading="eager"` only when placed in the first screen.
- Each accepts `className`. The page owns its surrounding band, width and section spacing. No primary contact button is built in, so these blocks can sit beside a page's existing primary action.

## Evidence and provenance

| Data                                               | Exact source                                                                                                    | Treatment                                                                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Four review names, ratings, words and dates        | `src/components/homepage/Reviews.astro` at `a842521519d5700d64d702f0059a73c5adf02584`, original `reviews` array | Names, rating and stored posting dates preserved. Excerpts are contiguous text from those existing quotes; none rewritten.                             |
| Google destination                                 | Same file, `https://www.google.com/maps/place/?q=place_id:ChIJA6LmO4Mhe0gR6N1ohnoK7ZE`                          | Existing business listing URL, not an individual review permalink. The link says "Read reviews on Google".                                             |
| Midland load time, first-month enquiries and years | `docs/marketing/site-profile.md`, section 3; `src/pages/case-studies/midland-oil-group.astro`, `results`        | 1.2 seconds, down from more than 8 seconds; 3x enquiries in the first month; 40+ years in the oil trade. No new comparison period or derived multiple. |
| Midland daily enquiries                            | `docs/marketing/site-profile.md`, section 3, "Midland Oil, newer results"; board DEC-05                         | Approved on 1 October 2026: several genuine enquiries a day since the rebuild. No identity or other detail about the national business is used.        |
| Midland oil finder                                 | Same case-study page, "Ask MOG" and introductory copy                                                           | Describes how it helps buyers choose, with no new performance claim.                                                                                   |
| Midland screenshot                                 | `public/images/case-studies/midland-oil-group/mog-new-homepage.webp`                                            | Actual site screenshot already used with permission. Sharp reports 2550 by 1312 pixels. No stock photo is presented as work.                           |

Review dates are the existing repository dates, not fresh verification against Google. The profile still records written testimonial permission as unknown. The active board explicitly requests reuse of these four existing reviews; this component adds no reviewer, quote or permission claim. No review or aggregate-rating structured data is emitted.

The original quote source remains available after adoption with `git show a842521519d5700d64d702f0059a73c5adf02584:src/components/homepage/Reviews.astro`. `evidence.ts` now holds the live excerpts. Helen's excerpt focuses on the work standard; Paul's retains both ease of working together and delivery. The card explicitly labels each as part of a review.

## Homepage adoption in F-07

`src/components/homepage/Reviews.astro` replaces the moving, duplicate and clipped carousel with `Testimonials`. The existing Organization schema expression and script are unchanged. `src/components/homepage/CaseSpotlight.astro` uses the wide card followed by the two confirmed metrics across the band's full width. This avoids a tall empty column beside the screenshot. The adjacent card supplies the one case-study action, so the metrics' duplicate source link is hidden here. Section order, band colours, Google destination and case-study URL stay unchanged. The old plugin count and AI wording are removed from these replaced sections.

There is no Helen screenshot preset because the current image is explicitly a stock salon photo. There is no ranking metric because the profile requires a fresh check before a ranking claim is reused. Add further case presets only with a real screenshot and the relevant confirmed evidence.

P-01 subsequently keeps `Testimonials` near the closing ask and distributes Midland proof through the hero, buyer routes and screenshot comparison. `CaseSpotlight.astro` is no longer rendered on the homepage; the standalone card and metrics remain available for later pages. P-01 also replaces only the Organization description with the current plain-English website offer. See `docs/audits/2026-10-02-p01-proof.md` for the current homepage acceptance.

The board's [Social cards 01](https://www.untitledui.com/react/marketing/testimonial-sections/testimonial-social-cards-01), [Simple accent line](https://www.untitledui.com/react/marketing/metrics-sections/metrics-simple-accent-line) and [Case study cards](https://www.untitledui.com/react/marketing/testimonial-sections/testimonial-case-study-cards) catalogue patterns informed these Kaizen components. Their Pro source was not downloaded or represented as copied; this is a custom implementation on the installed F-01 primitives and theme.

## Brief and checklist

Audience: an owner considering a replacement site after a disappointing previous purchase. These are supporting proof, not a new landing page.

Ranked messages and evidence:

1. Work is delivered and communication is clear: the existing Google quotes.
2. A rebuild changed a real buyer journey: Midland's screenshot and oil finder.
3. The outcome can be checked: Midland's approved figures and linked case study.

Place the relevant block next to the claim or contact action. The reviews answer "will this be another bad experience?"; the case study answers "what would you change?"; the figures support the result. Page copy must still explain the next step and agreed response time. Whether these blocks increase genuine enquiries remains a hypothesis; compare contact outcomes after page integration.

- Messaging: the existing profile and voice-of-customer evidence were read. New prose is plain British English. Customer words remain verbatim. No new pricing, guarantee, staffing claim or urgency was added. Competitor research and interviews were not repeated for a component that reuses already selected proof.
- Design: the grid and standalone card support desktop and phone placement. Meaningful screenshot dimensions are set; links use the shared button and keyboard focus styles. There is no autoplay, hidden quote or new client behaviour. Homepage integration passed desktop/phone visual, contrast and keyboard checks. Each later page still needs its own placement and five-second page check.
- SEO: no new URL, title, H1 or keyword owner. Evidence is server-rendered. The case-study link is internal; the Google link is labelled for its real destination. No ranking claim, new client logo or review schema is added. Log the actual page adoption when integrating.
- Initial component preparation passed TypeScript and in-memory server rendering. Adoption checks compare every excerpt, name, date and rating against the pinned historical review source, compare the unchanged Organization schema expression, parse both Astro sections, check the screenshot's real dimensions and confirm server HTML contains four unique quotes and one case-study action. Evidence: `.local/marketing-20261001/f07-adoption-check.json`. Isolated house-style results: reviews reading age 9.7, average sentence 8.5 words; Midland age 9.3, average 10.3; both have no sentence over 20 words and zero hard-rule, staffing or AI-pattern hits. No build or `dist` mutation was run by this component task.
- Integration acceptance is recorded in `docs/audits/2026-10-02-f07-proof.md`: production build, TypeScript, Astro check, built-section house style, all desktop/phone screenshot tiles, shared-code test comparison and home/service/contact regression checks passed. The native focus fallback in `theme.css` also supports links rendered without hydration. The parent task owns the board/log/commit/deployment and live verification.
