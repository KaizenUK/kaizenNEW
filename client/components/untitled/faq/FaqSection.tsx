import type { ReactNode } from "react";
import { cx } from "../utils/cx";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSectionProps {
  /** A unique, stable ID for this section on its page. */
  id: string;
  heading: string;
  items: readonly FaqItem[];
  eyebrow?: string;
  description?: string;
  footer?: ReactNode;
  className?: string;
}

/**
 * Untitled UI Accordion 01, adapted to Kaizen's type and spacing tokens.
 * Native disclosures keep every answer and the FAQ schema in server HTML.
 * Render from Astro without a client directive; no hydration is needed.
 */
export function FaqSection({
  id,
  heading,
  items,
  eyebrow,
  description,
  footer,
  className,
}: FaqSectionProps) {
  if (items.length === 0) return null;

  const headingId = `${id}-heading`;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  }).replace(/</g, "\\u003c");

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-marketing-faq=""
      className={cx("marketing-section bg-white", className)}
    >
      <div className="mx-auto max-w-[1440px] px-6 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow && (
            <p className="marketing-eyebrow mb-4 uppercase tracking-[0.2em]">
              {eyebrow}
            </p>
          )}
          <h2
            id={headingId}
            className="text-balance font-heading text-4xl font-bold text-uui-dark md:text-5xl"
          >
            {heading}
          </h2>
          {description && (
            <p className="mt-4 text-balance font-body text-lg leading-relaxed text-slate-600 md:text-xl">
              {description}
            </p>
          )}
        </div>

        <div className="mx-auto mt-8 max-w-3xl divide-y divide-slate-200 md:mt-12">
          {items.map(({ question, answer }, index) => (
            <details
              key={question}
              id={`${id}-question-${index + 1}`}
              className="group"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-4 rounded-lg py-5 text-left font-body text-lg font-semibold leading-7 text-uui-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uui-brand-600 md:gap-6 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">{question}</span>
                <svg
                  aria-hidden="true"
                  focusable="false"
                  className="mt-0.5 size-6 shrink-0 text-slate-500"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line
                    className="origin-center group-open:-rotate-90 motion-safe:transition-transform motion-safe:duration-150"
                    x1="12"
                    y1="8"
                    x2="12"
                    y2="16"
                  />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </summary>
              <p className="pb-6 pr-10 font-body text-base leading-relaxed text-slate-600 md:pr-12 md:text-lg">
                {answer}
              </p>
            </details>
          ))}
        </div>

        {footer && (
          <div className="mx-auto mt-8 max-w-3xl font-body text-base leading-relaxed text-slate-600 md:mt-12">
            {footer}
          </div>
        )}
      </div>
      <script
        id={`${id}-schema`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
    </section>
  );
}
