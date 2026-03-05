import { useEffect, useState, useRef } from "react";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { useCalendly } from "@/context/CalendlyContext";

// Typing animation for hero
const useTyping = (text: string, speed: number = 50) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.substring(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return displayedText;
};

// Sticky section observer
const useStickySection = () => {
  const [activeSection, setActiveSection] = useState(0);
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const viewportCenter = window.innerHeight / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;

      sectionsRef.current.forEach((section, index) => {
        if (!section) return;

        const rect = section.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const distance = Math.abs(sectionCenter - viewportCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveSection(closestIndex);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return { activeSection, sectionsRef };
};

const pledgeSections = [
  {
    label: "01. AI & EXPERTISE",
    content: `Let's start with the big one: AI.

Yes, we use it. It's ${new Date().getFullYear()}, and any agency that says they don't is either lying to you or just plain inefficient. We're neither. We are not traditional, university-educated developers stuck in old ways. We are modern, agile, and relentlessly curious. We really know what we are doing, and we use every smart tool available to get you the best result.

We use AI as a co-pilot, not as the chef. A 'prompt' can't understand your business strategy, design a unique brand, or build a secure React app. We use it to handle the grunt work, which means we spend more time on what actually matters: strategy, custom design, and building code that is secure and maintainable. For you, it just means a better, cleaner site, delivered faster.`,
  },
  {
    label: "02. PRICING",
    content: `Our pledge also covers your money.

The price we quote is the price you will pay. Period. If we've undercharged you or underestimated the work, that's on us. We'll take the hit and learn from it—that's Kaizen (our philosophy of 'continuous improvement') in action.

The only time that changes is if the project scope changes. If you come to us after we've agreed and say, 'actually, I need this, and this, and that,' we will have an honest chat and ask for more. That's just fair.`,
  },
  {
    label: "03. PROCESS",
    content: `The same goes for our process.

We won't disappear. We provide 45 days of free snagging after we launch. If you find a bug, we fix it, no questions asked. We'll even do minor changes for free (within reason).

For anything bigger, we'll have an honest chat about whether it's a 'new feature' (which costs) or a 'quick fix' (which doesn't). The full scope will be agreed upon at the start, so there are no surprises.`,
  },
  {
    label: "04. FIT",
    content: `Finally, our pledge is to be honest about 'fit.'

We're looking for partners, and that requires a good fit. We'll be the first to tell you if we don't think we're right for you. You might love our work but find our direct style isn't for you. That's fair. And if we don't think we can genuinely help you, we'll tell you that, too.

We don't build cheap, 'quick-fix' sites. We are a premium, expert-led agency for businesses that are serious about growth. If that's you, you'll get a partner who is 100% transparent. That's our pledge.`,
  },
];

export default function Pledge() {
  const goToContact = () => {
    if (typeof window !== "undefined") {
      window.location.assign("/contact");
    }
  };
  const { openCalendly: openCalendlyFromContext } = useCalendly();
  const heroH1 = '> Our "No-BS" Pledge.';
  const displayedText = useTyping(heroH1, 40);
  const { activeSection, sectionsRef } = useStickySection();
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <Layout>
      {/* Section 1: Hero - Code Commit Style */}
      <section className="min-h-screen bg-slate-900 flex items-center justify-center py-20 px-4">
        <div className="max-w-3xl w-full">
          <h1 className="font-mono text-kaizen-cyan text-4xl md:text-6xl font-bold leading-tight">
            <span>{displayedText}</span>
            <span
              className={`${cursorVisible ? "opacity-100" : "opacity-0"} transition-opacity`}
            >
              _
            </span>
          </h1>

          <motion.div
            className="mt-12 space-y-3 font-mono text-sm md:text-base text-gray-400"
            initial={{ opacity: 0, y: 20 }}
            animate={
              displayedText.length === heroH1.length ? { opacity: 1, y: 0 } : {}
            }
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <p>
              // This page exists because you deserve to know exactly how we
              work.
            </p>
            <p>// No marketing jargon. No black box. No surprise bills.</p>
            <p>// This is our pledge to you—a fully transparent partnership.</p>
          </motion.div>
        </div>
      </section>

      {/* Section 2: The Pledge - Sticky Scroller */}
      <section className="bg-white py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-7xl mx-auto px-4">
          {/* Left Column - Sticky Headline */}
          <div className="hidden lg:flex">
            <div className="sticky top-1/2 -translate-y-1/2 h-fit w-full">
              <motion.h2
                className="text-5xl md:text-6xl lg:text-7xl font-heading font-black text-kaizen-dark"
                key={activeSection}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {pledgeSections[activeSection].label}
              </motion.h2>
            </div>
          </div>

          {/* Right Column - Scrolling Content */}
          <div className="space-y-20">
            {pledgeSections.map((section, index) => (
              <div
                key={index}
                ref={(el) => {
                  if (el) sectionsRef.current[index] = el;
                }}
                className="min-h-96"
              >
                {/* Mobile heading */}
                <motion.h3
                  className="lg:hidden text-4xl md:text-5xl font-heading font-black mb-8 text-kaizen-dark"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6 }}
                >
                  {section.label}
                </motion.h3>

                <motion.div
                  className="text-lg text-kaizen-text-dark/70 leading-relaxed space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  {section.content.split("\n\n").map((paragraph, pIndex) => (
                    <p key={pIndex}>{paragraph}</p>
                  ))}
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Final CTA */}
      <section className="bg-kaizen-dark text-white py-20 md:py-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            className="text-4xl md:text-5xl lg:text-6xl font-heading font-black mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Ready for a Transparent Partner?
          </motion.h2>

          <motion.p
            className="text-xl text-white/80 mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Now that you know exactly how we work, let's talk about your
            project.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <button
              onClick={() => goToContact()}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
            >
              Get in Touch
              <ArrowRight size={18} />
            </button>

            <button
              onClick={openCalendlyFromContext}
              className="px-8 py-3 rounded-lg border-2 border-white/30 text-white font-heading font-bold hover:border-kaizen-cyan hover:text-kaizen-cyan transition inline-flex items-center justify-center gap-2"
            >
              Book a 15 Minute Call
              <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
