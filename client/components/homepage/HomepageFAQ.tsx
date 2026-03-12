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
    question: "How long does a typical project take?",
    answer:
      "It depends on the scope. A performance audit and action plan can be done in days. A full site build usually takes a few weeks. We'll give you a realistic timeline before we start — and stick to it.",
  },
];

const highIntent = [
  {
    question: "My website gets traffic but nobody enquires. Can you fix that?",
    answer:
      "That's one of the most common problems we solve. Traffic without conversions usually means the site isn't giving visitors a clear reason to act. We'll identify what's blocking them and fix it.",
  },
  {
    question: "My site is slow and it's hurting my Google rankings. What can you do?",
    answer:
      "We'll run a full performance audit, find the exact bottlenecks, and fix them in priority order. Most sites we work on go from failing Core Web Vitals to passing within the first round of changes.",
  },
  {
    question: "I've been burned by an agency before. How are you different?",
    answer:
      "You deal with one person from start to finish. No account managers, no disappearing acts. We'll tell you what your site actually needs — even if the answer is less than you expected.",
  },
  {
    question: "Can you help if I already have a developer but need direction?",
    answer:
      "That's exactly what our product owner service is for. We step in to manage priorities, translate between you and your developers, and make sure the project actually ships.",
  },
  {
    question: "I need a website that ranks on Google, not just looks good.",
    answer:
      "Every site we build is performance-optimised and structured for search from day one. Fast load times, clean code, proper meta data, and content that Google can actually understand.",
  },
];

export function HomepageFAQ() {
  return (
    <Suspense fallback={<div className="py-16 bg-white" />}>
      <FaqSection
        heading="Got questions? Good."
        eyebrow="Before you ask"
        items={items}
        secondColumn={highIntent}
        className="bg-white"
      />
    </Suspense>
  );
}
