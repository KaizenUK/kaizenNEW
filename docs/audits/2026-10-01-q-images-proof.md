# Phase Q arrows and image dimensions

1 October 2026. Q-09 and Q-10.

## Scope

- Replaced the 11 literal `->` spans in the case studies index, Helen Moore, contract product owner, thank-you page and retained city-page component with the existing Lucide ArrowRight icon. Icons are decorative and server rendered; no new hydrated island.
- Added the actual file dimensions to all 16 Midland images, including the six walkthrough images. Dimensions came from the local WebP metadata, not guessed ratios.
- Added 1200 by 690 dimensions to the blog cover image, matching the existing cropped image URL. The author image already has dimensions.

No marketing claim, title, description, URL or structured data changed. The existing P/B copy tasks remain open. This is a targeted rendering correction, not acceptance of those pages against the full redesign checklist. No keyword research or new copy brief is needed. The search-related image change is in `docs/seo-log.md`.

## Verification

Evidence is in ignored `.local/marketing-20261001/`.

- TypeScript, Astro check and production build pass.
- Fresh browser crawl: all 16 Midland images and both images on each of the ten blog posts have positive width and height attributes. Zero images without size across these 11 pages.
- Source search has zero literal arrow spans. Browser text has no `->` on the four live routes, and each contains the SVG icon.
- The house-style hard-rule counts are unchanged. All copy is unchanged; removing arrow text slightly changes the sentence counter on contract product owner. Existing Midland/index dash fixes and page reading-age work remain assigned to P-07/P-08/P-09 and B-03.
- All 57 screenshot tiles were inspected at 1440px and 375px across the index, both case studies, contract product owner, thank-you and a representative blog post. Images keep their ratios, icons align with labels, and every page has zero horizontal overflow. Existing typography, copy and large-spacing issues remain on the later page tasks.

Production deployment `36897445612` passed. Live marker `gh-36897445612-1` identifies commit `5ecc3c9b8bc419916a24511cf21df3d71161d934`. The image crawl and all four arrow checks also pass on production. Stage remains unchanged until the goal ends.
