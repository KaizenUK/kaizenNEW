import { useEffect, useId, useMemo } from "react";
import { motion } from "framer-motion";
import { MarketingButton } from "./untitled/MarketingButton";

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

    let script = document.getElementById(
      schemaScriptId,
    ) as HTMLScriptElement | null;
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
    <section id={id} className={`py-28 md:py-36 relative ${className}`}>
      <div className="mx-auto max-w-[1440px] px-6 lg:px-12 relative z-10">
        {/* Header — left-aligned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20 md:mb-28 max-w-2xl"
        >
          {eyebrow && (
            <p className="marketing-eyebrow text-xs font-medium tracking-[0.25em] text-gray-400 uppercase mb-5 font-body">
              {eyebrow}
            </p>
          )}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-gray-950 leading-tight">
            {heading}
          </h2>
        </motion.div>

        {/* Accordion columns */}
        <div
          className={
            secondColumn
              ? "grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-0"
              : ""
          }
        >
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
          <MarketingButton action="contact" />
        </motion.div>
      </div>
    </section>
  );
}
