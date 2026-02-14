import { useState } from "react";
import type {
  SanityFaqSection,
  SanitySectionSettings,
} from "../../../../src/lib/sanity/client";
import SectionWrapper from "../SectionWrapper";
import { SectionHeading } from "../shared";

type Props = SanityFaqSection & { settings?: SanitySectionSettings };

export default function FaqSectionBlock(props: Props) {
  const { heading, items, settings } = props;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <SectionWrapper settings={settings}>
      {heading && (
        <div className="mb-12 text-center">
          <SectionHeading text={heading} />
        </div>
      )}
      <div className="space-y-3">
        {(items || []).map((item, index) => (
          <div
            key={item._key || `faq-${index}`}
            className="rounded-xl border border-white/10 bg-white/5"
          >
            <button
              type="button"
              onClick={() => toggle(index)}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <span className="text-base font-semibold text-white">
                {item.question || "Untitled question"}
              </span>
              <span className="ml-4 shrink-0 text-slate-400">
                {openIndex === index ? "−" : "+"}
              </span>
            </button>
            {openIndex === index && item.answer && (
              <div className="px-6 pb-4">
                <p className="text-sm leading-relaxed text-slate-300">
                  {item.answer}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
