# Shared marketing FAQ

Shared F-05 section used on home, WordPress, local search and the speed scanner.

## Source

Adapted from the licensed [Untitled UI Accordion 01](https://www.untitledui.com/react/marketing/faq-sections/faq-accordion-01), library v8, retrieved on 2 October 2026 through the official CLI components endpoint using the existing account login. The registry path is `faq/faq-accordion-01`; the source file is `components/marketing/faq/faq-accordion-01.tsx`.

The centred heading, narrow list, dividing lines and circular plus/minus icons follow that source. Native `details` replaces its state and motion handling. Demo people, questions, support copy and avatar dependencies are omitted. No packages were installed. The downloaded source is retained locally under `.local/marketing-20261001/f05-untitled-source.json` as evidence, without credentials.

## API

```astro
---
import { FaqSection } from "../../client/components/untitled/faq";

const faqs = [
  {
    question: "Can you check the site I have?",
    answer: "Yes. We can look at your site and explain what needs attention.",
  },
];
---

<FaqSection
  id="page-faq"
  heading="Get clear answers before you decide."
  eyebrow="Common questions"
  items={faqs}
/>
```

Required props: `id`, `heading`, `items` (`readonly { question: string; answer: string }[]`). Optional props: `eyebrow`, `description`, `footer` (React content), `className`. Keep IDs unique within the page. No fallback questions or marketing claims are built in. An empty list renders nothing.

Render from Astro without a `client:*` directive. Native details work without JavaScript and all answers remain in the initial HTML. Every answer starts closed and can be opened independently. The summary is a native keyboard control; its icon is decorative and its focus outline is visible.

The component renders exactly one FAQPage script from the same questions and answers. Remove the caller's old FAQPage script or effect to avoid duplicates. Separate Service or other structured data must remain. Answers are rendered as text, and `<` is escaped in JSON-LD to prevent strings from ending the script.

The outer band uses F-04's `marketing-section`. Add `className="marketing-section--joined"` when the preceding band has the same background, as on home. Default background is white; use a background override only if the surrounding page requires it. F-03 typography and eyebrow classes are inherited from the marketing layout. The component is scoped to public marketing pages and does not add spacing fallbacks for the builder.

## Integrations

- Home: `HomepageFAQ.tsx` directly imports this component with `id="home-faq"`. Its ten plain-English answers and contact footer render without lazy/Suspense or a client directive.
- Local SEO: `src/pages/services/local-seo.astro` uses ten revised answers and `id="local-seo-faq"`. The component owns FAQPage; separate Service data remains.
- WordPress: `src/pages/services/wordpress-web-design.astro` uses its unchanged ten answers and `id="wordpress-faq"`. Separate Service data and the three buying-option disclosures remain.
- Scanner: `src/pages/performance-scanner.astro` uses its unchanged eight answers and `id="scanner-faq"`. Its three guidance links pass through the named `footer` slot.

The builder's shadcn accordion, Sanity FaqSectionBlock and city-page FAQs keep their existing implementation.

## Focused verification completed

- Isolated strict TypeScript check passes for this component and its barrel export.
- Prettier check passes for all three new files.
- In-memory server rendering with the existing four data sets confirms all 38 questions and answers are in their native details, every item starts closed, and exactly one matching FAQPage is emitted for each rendered section.
- Heading IDs, footer links and both standard/joined section classes are retained. JSON-LD safely preserves strings containing script-like text; visible answers remain plain text. Empty input emits no section or schema.

Evidence for these isolated checks: `.local/marketing-20261001/f05-component-check.json`; repeatable local check: `node --import tsx .local/marketing-20261001/f05-check.mjs`. This check does not build the site, start a server or write dist.

## Integrated verification

The deployment build contains all 38 answers, closed initially, with one matching FAQPage per route. WordPress/scanner answers and other metadata/structured data are unchanged. Home/local copy removes unsupported promises and jargon before those answers reach search. All four FAQ copy sets meet the house-style targets. See `docs/audits/2026-10-02-f05-proof.md` for the integrated type, build, regression, visual and browser evidence, including operation without JavaScript.

See `.local/marketing-20261001/f05-plan.md` for the source inventory and detailed integration plan.
