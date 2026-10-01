# Phase Q layout fixes

1 October 2026. Q-05, Q-06, Q-07, Q-08 and Q-11.

## Scope and full checklist pass

- Q-05: hide the hero diamonds at phone widths so they cannot sit behind the label or main actions.
- Q-06: give each number in the local SEO page's "Do No Harm" list a fixed width, prevent shrinking and keep the digits on one line.
- Q-07: make the final homepage benefits cell fill its row, removing the empty grey cell at desktop widths.
- Q-08: remove the footer's repeated sales heading, copy and two action buttons; remove the second Blog link. Reflow the retained contact/company details and link columns. All unique destinations, company number and registered-office details remain.
- Q-11: stack name fields below 640px and set every text field and its placeholder to 16px, including later form steps.

Messaging and SEO scope: these are layout corrections and removal of duplicate footer content, with no new claim or marketing copy. No new evidence-gathering, keyword research, page brief, titles, descriptions, URLs or structured data is needed. Existing copy problems on home and local SEO remain assigned to P-01/P-03; their full-page house-style reports are unchanged, not green. Contact, scanner and WordPress pass the full-page checker. Search-relevant footer changes are recorded in the SEO log.

Design diagnosis: decoration covered an action, a grid track had no content, number columns could shrink, repeated footer asks competed with the page ending, and narrow form fields were hard to use. These corrections retain the current design ahead of the F foundations. They do not constitute premium-design or copy acceptance of the later page rebuilds. No human usability test was run; the checks below cover the specific failures at their affected widths.

## Verification

Evidence is in ignored `.local/marketing-20261001/`.

- TypeScript and Astro check pass; production build passes.
- The layout browser check covers 375, 640, 768, 1024 and 1440px. Name fields stack only below 640px. Every visible text input and textarea computes to 16px across all form steps. It stops before submission; no lead or email is created.
- The final benefits cell fills its row at tablet/desktop widths. Hero lower diamonds are hidden on phones. The footer contains one Blog link, no sales heading, and both the company number and registered-office text. Homepage has zero horizontal overflow at all five widths.
- Step numbers on local SEO compute to nowrap and fit their fixed columns at 375px and 1440px.
- House-style reports for home, local SEO and contact are identical before and after. Home's 11 existing dash hits and local SEO's 29 remain on their copy tasks; none is introduced here. WordPress (reading age 7.2) and scanner (7.4) still have zero hard-rule breaches.
- All 58 screenshot tiles were inspected at 1440px and 375px across home, local SEO, WordPress and contact. No new overlap or horizontal overflow. The corrected grid cell, step numbers, footer and form fields render as intended. A final phone hero capture verifies all five diamonds are hidden. Existing copy, typography and long-page issues remain on the F/P tasks.
- The full Windows Vitest run has 1,553 tests: 1,070 pass, 439 fail, 44 pending. The before snapshot had 1,069 pass, 440 fail, 44 pending. Comparing every previously passing test by file and full name shows zero regressions. This is not a claim that the full suite passes on Windows.

| Page | Desktop height | Phone height | Horizontal overflow |
|---|---:|---:|---:|
| Home | 13,717px | 16,661px | 0 |
| Local SEO | 12,781px | 21,051px | 0 |
| WordPress | 7,434px | 11,081px | 0 |
| Contact | 2,251px | 3,514px | 0 |

Production deployment `36896582316` passed. The live marker is `gh-36896582316-1`, commit `6059eab91907169625cd3408c3f9307e690902bf`. The same browser checks pass against production at all five widths, including all form steps without submitting. Home, local SEO and contact retain their production canonicals and `index, follow`. Stage remains unchanged until the goal ends.
