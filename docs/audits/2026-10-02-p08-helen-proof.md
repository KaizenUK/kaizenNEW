# P-08: Helen Moore Hairdressing case study

2 October 2026. Local verification passes; production release pending. P-08 stays open until this page is verified live; Midland's release is recorded in `2026-10-02-p08-midland-proof.md`.

## What changed

The first screen now names the client and local-service buyer, explains the website rebuild and offers the agreed contact action/reply. Sean's chosen stock photo remains, with an explicit example caption. Its original declared height was wrong: the remote image is 1674 by 1256 pixels, now declared correctly.

The approved steady-booking result sits near the beginning. The existing ranking claim and "Checked October 2026" wording remain on this same case-study page; the date is not refreshed and no search terms are published. A real, dated homepage screenshot provides separate evidence of the booking/service choices. A short ordered journey explains finding the salon, choosing a next step and asking for an appointment. The closing section explains the free chat, agreed price and deposit, with descriptive service and pledge links.

F typography, spacing and buttons replace the earlier mixed margins, badges, low-contrast labels and extra footer actions. Only this page and its new screenshot change application content. No shared component or CMS write is required. Metadata, schema, URL and sitemap membership remain unchanged.

## Screenshot provenance and client-site check

The source is [Helen's live homepage](https://www.helenmoorehairdressing.co.uk/), captured at 1440 by 1000 pixels on 2 October 2026 at 08:49:56 UTC. It returns 200 with valid TLS; branding, Wallasey details, matching social links and the Kaizen footer identify the client. The capture is unaltered apart from WebP encoding. Public file: `public/images/case-studies/helen-moore-hairdressing/helen-homepage-2026-10-02.webp`, 39,654 bytes, SHA-256 `371c0ed41869a3e17f5d5edafa7599b32b207cc857791818ca3ab8f6a2bb3969`. The source and encoded result were inspected. It can also supply P-07's real screenshot requirement.

The homepage's booking link was followed in a fresh phone browser and reached the appointment page with contact options. No booking, enquiry or form was submitted. Copy describes an appointment request and does not claim that the workflow completes a confirmed booking.

An external client-site issue was also observed: direct navigation to `/services` and `/booking` returns 404, while the homepage's in-app booking navigation works. The non-`www` hostname has a certificate mismatch. These are existing client-host routing/certificate issues outside the Kaizen marketing board; no client hosting or source was changed. The Kaizen case study links the working HTTPS homepage. This check does not establish a fresh search ranking.

## Verification

- Brief: `docs/audits/2026-10-02-p08-brief.md`; approved claims and photo choice are in the site profile.
- All 53 baseline HTML documents retain their metadata/schema. Only Helen's body changes. The single H1, three booking steps, approved result/date, stock-photo label, screenshot caption and five required page links exist in initial HTML.
- House style: reading age 9.5, average sentence 10.4 words, zero hard-rule breaches. No actual paragraph sentence exceeds 20 words. The two checker strings over 20 combine the button label with the separate agreed reply sentence.
- Types pass. Astro check: 495 files, zero errors, zero warnings, 189 inherited hints. Full main production build passes after correcting the image dimensions.
- All five baseline and seven final screenshot tiles inspected. Final heights: 4,318 pixels desktop and 5,999 phone, compared with 2,913/4,222 before. The added actual work, booking explanation and buying process fit within the phone page budget. No overlap, horizontal overflow or unfinished bands.
- Eight browser views cover 375/768/1024/1440 pixels with JavaScript off/on. Both images load at their declared dimensions; all three journey steps and the retained dated claim appear. The first action ends at 623 pixels and its reply at 683 pixels on a 375-pixel phone, inside the first 812-pixel view.
- Eight keyboard image journeys open the full screenshot and return. Both contact actions have visible keyboard focus; eight keyboard contact journeys reach the form page. No form is submitted. All four JavaScript views have zero axe violations; browser errors and overflow are zero in all eight views.
- This page-only change does not trigger another full shared-code Vitest run. P-08 Midland's latest full run remains the baseline: 1,561 total, 1,078 pass, 439 inherited environment failures, 44 pending, no regressions by test name.

Private evidence is in `.local/marketing-20261001/p08-helen-*` and `p07-helen-*`. Stage stays unchanged until the whole goal ends.

## Definition of done

- [x] First phone screen explains the client, work, reader and next step.
- [x] Headings tell the booking story and link the result to the work.
- [x] Agreed contact action and exact reply, with one closing ask.
- [x] Approved claims and real screenshot; chosen stock photo labelled honestly.
- [x] Copy and actual sentence lengths pass.
- [x] Final desktop/phone tiles, intermediate widths and keyboard journeys reviewed.
- [x] Metadata/schema preserved; content exists in initial HTML.
- [x] Descriptive links to service, index, pledge, contact and Midland.
- [x] Final local checks pass.
- [ ] Production deployment and live checks pass.

No new ranking or enquiry improvement is claimed from this layout. S-04 still requires verified reporting.
