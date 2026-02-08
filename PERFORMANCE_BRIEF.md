# Performance Brief

## Objective
Reach and maintain Lighthouse Performance at 90+ without changing visual design or user-facing behavior.

## Non-Negotiable Strategy
1. Protect the critical path. Only load code required for first paint and first interaction.
2. Defer everything else by route, viewport, interaction, or idle time.
3. Measure after every change. Keep only proven wins.

## Current Architecture to Preserve
1. `client/App.tsx`: home route eager, all other routes lazy.
2. `client/pages/Index.tsx`: below-the-fold sections deferred with `IntersectionObserver`.
3. `client/components/layout/Header.tsx`: desktop nav loaded lazily and desktop-only gated.
4. `client/components/layout/HeaderDesktopNav.tsx`: mega-menu logic isolated from initial mobile payload.
5. `client/components/layout/header-menu-data.ts`: loaded on menu hover only.
6. `client/components/RouteChangeTracker.tsx`: lazy-loaded after idle, not in initial critical path.
7. `vite.config.ts`: modulepreload polyfill disabled (`build.modulePreload.polyfill = false`).

## Rules for Performance Work
1. Do not add eager imports in homepage/header for non-critical features.
2. Do not idle-preload `header-menu-data` (this re-enters Lighthouse critical chain).
3. Keep analytics, cookie banner, footer, modal UI deferred.
4. Prefer local lightweight SVG icons in critical components over heavy runtime icon paths.
5. Any preload must be justified by measurable LCP/FCP impact.

## Anti-Patterns to Avoid
1. Prefetch/preload work that runs during initial load without user intent.
2. Pulling desktop-only logic into mobile critical bundle.
3. Chasing warnings without validating in trace and Lighthouse deltas.

## Validation Protocol
1. Run `npm run build:client`.
2. Run Lighthouse and compare JSON reports against previous baseline.
3. Inspect critical request chain. Target: primarily `HTML -> index-*.js`.
4. Check trace deltas with `npm run trace:summary`.
5. Keep changes only when trends improve or stay neutral with clear tradeoff.

## Definition of Done
1. Lighthouse Performance remains around or above 90 on live.
2. No UX regressions.
3. No new optional modules in initial critical chain.
4. No unnecessary main-thread work introduced.

## Notes for Future Builders
1. This project already made major gains by reducing initial JS and isolating desktop/nav logic.
2. Remaining Lighthouse variability at this level (90-94) is normal run-to-run noise.
3. Further major gains likely require architectural shifts (SSR/prerender), not micro-tuning.
