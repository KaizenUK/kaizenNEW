import { FaqSection } from "../untitled/faq";

const items = [
  {
    question: "Do I need a new site, or can you fix mine?",
    answer:
      "We can fix an existing site, including WordPress. We look at what works and what needs to change. A rebuild may help if small fixes are not enough.",
  },
  {
    question: "Will I still be able to edit my pages?",
    answer:
      "You can edit your pages and blog. We show you how before launch. We can also make changes for you.",
  },
  {
    question: "How will I know what I am paying for?",
    answer:
      "We explain what needs to change in plain English. We agree what the work covers and what it costs before you pay.",
  },
  {
    question: "What does the free website check show?",
    answer:
      "It tests how fast one page loads on a phone. You see your score first. If it is below 90, we ask for your email before showing the full report.",
  },
  {
    question: "How long will the work take?",
    answer:
      "It depends on your site and what needs to change. We agree the work and dates with you before we start.",
  },
  {
    question: "My site gets visits but no calls. Can you help?",
    answer:
      "We can check what people see and how they contact you. Then we explain what may be getting in their way.",
  },
  {
    question: "Can you help with a slow website?",
    answer:
      "We look for what is slowing your pages down. Then we agree which fixes to make first.",
  },
  {
    question: "I paid for a site that let me down. What would be different?",
    answer:
      "You deal with the same person from the first chat. We agree what the work covers before it starts. You see the pages before they go live.",
  },
  {
    question: "Can you help if my website project has got stuck?",
    answer:
      "We can look at the work so far. We help you decide what matters next and agree what our role will be.",
  },
  {
    question: "What happens when I get in touch?",
    answer:
      "One of us will get back to you the same day, or the next working day at the latest. The first chat about your site is free. Work starts after you pay a non-refundable deposit.",
  },
];

export function HomepageFAQ() {
  return (
    <FaqSection
      id="home-faq"
      heading="Get the answers before you commit."
      eyebrow="Common questions"
      items={items}
    />
  );
}
