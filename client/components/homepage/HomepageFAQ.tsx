import { Suspense, lazy } from "react";

const FaqSection = lazy(() =>
  import("@/components/FaqSection").then((m) => ({ default: m.FaqSection })),
);

const items = [
  {
    question: "Do you only build new websites, or can you fix existing ones?",
    answer:
      "Both. Most of our work involves improving existing sites — making them faster, easier to use, and better at converting visitors. If a rebuild makes more sense, we'll tell you honestly.",
  },
  {
    question: "My site is on WordPress. Can you still help?",
    answer:
      "Absolutely. WordPress is where we do a lot of our best work. We optimise what you've already got — cleaning up slow plugins, improving page speed, and fixing the issues that hold your Google rankings back.",
  },
  {
    question: "I'm not technical — will I understand what you're doing?",
    answer:
      "That's the whole point. We explain everything in plain English. No jargon, no acronyms, no assuming you know what a CDN is. You'll always know what we're doing and why.",
  },
  {
    question: "What does a performance audit actually include?",
    answer:
      "We check your page load speed, Google's quality scores, mobile usability, accessibility, and security. You get a clear report with a prioritised list of what to fix — and what difference each fix will make.",
  },
  {
    question: "How much does it cost?",
    answer:
      "It depends on what you need. A performance audit starts from a few hundred pounds. Web design projects typically range from £2k to £15k. We'll always give you a clear quote upfront — no surprises.",
  },
];

export function HomepageFAQ() {
  return (
    <Suspense fallback={<div className="py-16 bg-white" />}>
      <FaqSection
        heading="Got questions? Good."
        eyebrow="Before you ask"
        items={items}
        className="bg-white"
      />
    </Suspense>
  );
}
