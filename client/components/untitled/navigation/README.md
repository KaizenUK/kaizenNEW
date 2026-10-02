# Marketing navigation

Kaizen's header and footer use the Untitled UI header dropdown and Footer Large 01 brand patterns, adapted to the existing colours, logo and marketing buttons. The footer remains static React; the header is one hydrated island.

## Provenance

Reviewed the official CLI's library v8 source on 2 October 2026:

- `header-navigation/header.tsx`, `dropdown-menu-simple-with-footer.tsx` and `base-components/nav-menu-item.tsx`.
- `footers/footer-large-01-brand` and `footers/footer-small-01-brand` (the latter was reviewed for future landing-page work).

Source evidence is in the ignored `.local/marketing-20261001/untitled-cli-source/` and `f06-untitled-source.json`. The implementation reuses the supplied composition and responsive grouping, with project-specific markup and content. It does not install another copy of the Button or alter dependencies.

References: [Untitled UI headers](https://www.untitledui.com/react/marketing/header-navigations), [Footer Large 01 brand](https://www.untitledui.com/react/marketing/footers/footer-large-01-brand), [React Aria Modal](https://react-aria.adobe.com/Modal), [React Aria DisclosureGroup](https://react-aria.adobe.com/DisclosureGroup).

## Host layout contract

- Pass `Astro.url.pathname` to `MarketingHeader`. Active-link markup then agrees between server rendering and hydration. Links use ordinary document navigation.
- Keep the layout's 80px top allowance. The fixed header occupies 72px: an 8px outer inset and a 64px shell.
- Give the main content `id="main-content"` and `tabindex="-1"` for the skip link. A different ID can be supplied through `mainContentId`.
- Mount the header with `client:load`. Render `MarketingFooter` without a hydration directive and pass through the existing `buildLabel` when present.
- Both host stylesheets must import the existing Untitled theme. The footer declares its own font, colour and spacing classes; it does not depend on `.marketing-page`, so it also works in `LinearLayout`.
- Footer legal text, email and service areas remain sourced from the existing shared legal and SEO modules. The registered office appears once. No new ending sales ask is added.
- The current public site has no active Sanity navigation override. Keep its independent page SEO queries intact; this component does not add a new settings fetch.

## Link data and behaviour

`navigation-data.ts` owns shared Services, Work, About and Guides groups. Contact is a direct link. The server-rendered footer preserves all 28 unique destinations audited before the replacement, including the six guide URLs, legal pages, social/public profiles and email. Keep the local-search URL until P-03 changes or redirects it. Helen Moore is a live link without the obsolete Soon label.

Desktop uses React Aria `DialogTrigger`, `Button`, a non-modal `Popover` and a labelled `Dialog`. Only one group can be open. Mobile uses `ModalOverlay`, `Modal`, `Dialog` and `DisclosureGroup`; React Aria handles Escape, dismissal, focus containment/restoration, body scroll locking and hiding background content. A breakpoint listener closes a hidden overlay and removes itself on unmount. There are no duplicate document keyboard handlers.

Links and controls have at least 44px targets, visible focus styles, reduced-motion treatment and active-page semantics. External links retain their destination and new-tab behaviour, with an accessible announcement. The mobile middle region scrolls separately from its title and action rows.

## Verification

The isolated implementation passes `pnpm exec tsc --noEmit` and a server-render check covering all 28 destinations, legal/build text, external-link attributes, active paths and closed-overlay markup. The ignored proof helper and result are `.local/marketing-20261001/f06-component-check.tsx` and `.json`.

Integrated verification is recorded in `docs/audits/2026-10-02-f06-proof.md`: production build, official desktop/phone screenshots, responsive and short-viewport checks, keyboard/focus/resize behaviour, ARIA snapshots, accessibility checks and preserved destinations. These checks cover browser semantics and operation; they do not claim a human screen-reader session.
