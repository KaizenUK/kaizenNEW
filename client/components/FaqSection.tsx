import { useEffect, useId, useMemo } from "react";
import { motion } from "framer-motion";
import AppLink from "@/components/routing/AppLink";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  heading: string;
  eyebrow?: string;
  items: FaqItem[];
  secondColumn?: FaqItem[];
  id?: string;
  className?: string;
}

export function FaqSection({
  heading,
  eyebrow = "FAQ",
  items,
  secondColumn,
  id,
  className = "bg-white",
}: FaqSectionProps) {
  const schemaInstanceId = useId().replace(/:/g, "");
  const schemaScriptId = `faq-schema-${schemaInstanceId}`;

  const allItems = secondColumn ? [...items, ...secondColumn] : items;

  const faqSchemaJson = useMemo(
    () =>
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: allItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }),
    [allItems],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    let script = document.getElementById(schemaScriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = schemaScriptId;
      document.head.appendChild(script);
    }

    script.text = faqSchemaJson;

    return () => {
      if (script?.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [faqSchemaJson, schemaScriptId]);

  return (
    <section
      id={id}
      className={`py-28 md:py-36 relative ${className}`}
    >
      <div className="mx-auto max-w-[1440px] px-6 lg:px-12 relative z-10">
        {/* Header — left-aligned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20 md:mb-28 max-w-2xl"
        >
          {eyebrow && (
            <p className="text-xs font-medium tracking-[0.25em] text-gray-400 uppercase mb-5 font-body">
              {eyebrow}
            </p>
          )}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-950 leading-tight">
            {heading}
          </h2>
        </motion.div>

        {/* Accordion columns */}
        <div className={secondColumn ? "grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-0" : ""}>
          <div className={secondColumn ? "" : "max-w-3xl"}>
            <Accordion type="single" collapsible className="w-full">
              {items.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border-b border-gray-200 py-2"
                >
                  <AccordionTrigger className="text-left text-xl md:text-2xl font-heading font-bold text-gray-950 hover:text-gray-600 transition-colors">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-base md:text-lg font-body text-gray-500 leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {secondColumn && (
            <div>
              <Accordion type="single" collapsible className="w-full">
                {secondColumn.map((item, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-b-${index}`}
                    className="border-b border-gray-200 py-2"
                  >
                    <AccordionTrigger className="text-left text-xl md:text-2xl font-heading font-bold text-gray-950 hover:text-gray-600 transition-colors">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-base md:text-lg font-body text-gray-500 leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>

        {/* CTA — minimal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 flex items-center gap-6"
        >
          <AppLink
            href="/contact"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-lg bg-gray-950 text-white font-heading font-bold text-xl hover:scale-[1.03] hover:bg-gray-800 active:scale-[0.97] transition-all duration-200"
          >
            Ask us anything
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </AppLink>
        </motion.div>
      </div>
    </section>
  );
}
