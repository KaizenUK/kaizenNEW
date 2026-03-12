import { Suspense, lazy } from "react";

const FaqSection = lazy(() =>
  import("@/components/FaqSection").then((m) => ({ default: m.FaqSection })),
);

const items = [
  {
    question: "Do you only build new websites, or can you fix existing ones?",
    answer:
      "Both. Sometimes a site needs a fresh start, sometimes it just needs the right fixes. We'll look at what you've got and tell you honestly which makes more sense.",
  },
  {
    question: "My site is on WordPress. Can you still help?",
    answer:
      "Absolutely. We work with WordPress every day — cleaning up slow plugins, improving page speed, and fixing the issues that quietly kill your Google rankings.",
  },
  {
    question: "I'm not technical — will I understand what you're doing?",
    answer:
      "That's the whole point. Everything gets explained in plain English. No jargon, no acronyms, no assuming you know what a CDN is. You'll always know what's happening and why.",
  },
  {
    question: "What does a performance audit actually include?",
    answer:
      "Page speed, Google's quality scores, mobile usability, accessibility, and security. You get a clear report with a prioritised list of fixes — and what each one will actually change.",
  },
  {
    question: "How much does it cost?",
    answer:
      "It depends on what you need. A performance audit starts from a few hundred pounds. Design projects typically range from £2k to £15k. You'll always get a clear quote upfront — no surprises.",
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
