import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Helmet } from "react-helmet-async";

import { Link } from "react-router-dom";

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
  id?: string;
  className?: string;
}

export function FaqSection({
  heading,
  eyebrow = "Common Questions",
  items,
  id,
  className = "bg-slate-50",
}: FaqSectionProps) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section
      id={id}
      className={`py-20 md:py-32 relative overflow-hidden ${className}`}
    >
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 max-w-2xl mx-auto"
        >
          {eyebrow && (
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
              {eyebrow}
            </p>
          )}
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-950 mb-6">
            {heading}
          </h2>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {items.map((item, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-b border-gray-200"
              >
                <AccordionTrigger className="text-left text-lg font-heading font-bold text-gray-950 hover:text-kaizen-cyan transition-colors">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-gray-700 mb-6">
            Still have questions? We're here to help.
          </p>
          <Link
            to="/contact"
            className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-gray-950 font-heading font-bold hover:shadow-lg hover:scale-105 transition-all inline-flex items-center gap-2"
          >
            Get in Touch
            <ArrowRight size={20} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
