import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Zap,
  Smartphone,
  Settings,
} from "lucide-react";
import { useCalendly } from "@/context/CalendlyContext";
import { FaqSection } from "@/components/FaqSection";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const letterVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Animated H1 component with staggered letter reveal
const AnimatedH1 = ({ text }: { text: string }) => {
  return (
    <motion.h1
      className="text-5xl md:text-6xl lg:text-6xl font-heading font-bold mb-8 leading-tight"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {text.split(" ").map((word, wordIndex) => (
        <motion.span key={wordIndex} className="inline-block mr-4">
          {word.split("").map((char, charIndex) => (
            <motion.span
              key={charIndex}
              variants={letterVariants}
              initial="hidden"
              animate="visible"
              transition={{
                delay: (wordIndex * word.length + charIndex) * 0.05,
                duration: 0.4,
              }}
            >
              {char}
            </motion.span>
          ))}
        </motion.span>
      ))}
    </motion.h1>
  );
};

// Scroll-triggered fade-in component
const ScrollReveal = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    });

    const element = document.getElementById(`scroll-reveal-${delay}`);
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [delay]);

  return (
    <motion.div
      id={`scroll-reveal-${delay}`}
      variants={fadeInUp}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      transition={{ delay: delay * 0.1 }}
    >
      {children}
    </motion.div>
  );
};

// CTA Button component
const CTAButton = ({
  text,
  onClick,
  secondary = false,
  openChat = false,
  openCalendly: openCalendlyProp = false,
}: {
  text: string;
  onClick?: () => void;
  secondary?: boolean;
  openChat?: boolean;
  openCalendly?: boolean;
}) => {
  const { openCalendly } = useCalendly();

  const handleClick = () => {
    if (openCalendlyProp) {
      openCalendly();
    } else if (openChat && typeof window !== "undefined") {
      if ((window as any).$crisp) {
        (window as any).$crisp.push(["do", "chat:open"]);
      }
    }
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`px-8 py-3 rounded-full font-heading font-bold inline-flex items-center justify-center gap-2 transition ${
        secondary
          ? "border-2 border-kaizen-cyan text-kaizen-cyan hover:bg-kaizen-cyan/10 dark:border-kaizen-cyan/70 dark:text-kaizen-cyan/70 dark:hover:bg-kaizen-cyan/5"
          : "bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark hover:opacity-90"
      }`}
    >
      {text}
      <ArrowRight size={18} />
    </button>
  );
};

export default function WebDesign() {
  const { openCalendly: openCalendlyFromContext } = useCalendly();

  return (
    <Layout>
      {/* Section 1: Hero */}
      <section className="min-h-screen bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85 flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            <AnimatedH1 text="Web Design Liverpool." />

            <motion.div
              className="space-y-6 mb-12 text-xl text-kaizen-text-light/80 dark:text-white/70 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <p>
                A website is a high-performance asset designed to get you leads.
                We build websites in Liverpool that are fast, secure, and built
                on a modern technical stack.
              </p>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <CTAButton text="Start a Chat" openChat />
              <Link
                to="/contact"
                className="px-8 py-3 rounded-full border-2 border-kaizen-text-light/30 dark:border-white/20 text-kaizen-text-light dark:text-white/85 font-heading font-bold hover:border-kaizen-cyan dark:hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
              >
                Book a 15 Minute Call
                <ArrowUpRight size={18} />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2: Outcomes (Not Features) */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Beyond the Design: What You Actually Get
              </h2>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                icon: Zap,
                title: "More Qualified Enquiries",
                copy: "Our designs are data-informed, guiding users to a clear call to action. We build conversion funnels, not just pretty pages.",
              },
              {
                icon: Smartphone,
                title: "A Blazing Fast Site",
                copy: "We build with React/Vite, not with clunky themes or plugins. This means better Core Web Vitals, a lower bounce rate, and a site Google loves.",
              },
              {
                icon: Settings,
                title: "A Site You Can Manage",
                copy: "We hook your site up to a user-friendly headless CMS, so you and your team can update content without needing a developer.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <div className="mb-6 p-4 w-16 h-16 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 dark:from-kaizen-cyan/10 dark:to-kaizen-lime/10 rounded-xl flex items-center justify-center">
                  <item.icon
                    className="text-kaizen-cyan dark:text-kaizen-cyan/70"
                    size={32}
                  />
                </div>
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {item.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  {item.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 3: Our Process - Vertical Stepper */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              Our Straightforward, Agile Process
            </h2>
          </ScrollReveal>

          <div className="max-w-3xl mx-auto mb-12">
            <div className="rounded-2xl border border-kaizen-light dark:border-slate-800/60 bg-white dark:bg-slate-950/70 p-6 md:p-8">
              <p className="text-sm font-mono tracking-[0.25em] text-kaizen-cyan mb-3 uppercase">
                Tech Stack ROI
              </p>
              <p className="text-lg md:text-xl text-kaizen-text-dark/80 dark:text-white/80 mb-4 leading-relaxed">
                Not sure which tech stack fits your budget? We broke down the
                three-year commercial difference between WordPress and React in
                plain English.
              </p>
              <a
                href="https://kaizenweb.co.uk/blog/wordpress-vs-react-business-roi"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-kaizen-cyan hover:text-kaizen-lime font-heading font-semibold text-sm md:text-base"
              >
                WordPress vs React: A Business ROI Comparison
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>

          <div className="max-w-3xl mx-auto">
            {[
              {
                step: "01",
                title: "Discover",
                copy: "No 50-page questionnaires. We start with a direct workshop to define your goals, audience, and project scope. We get to the 'why' before the 'what'.",
              },
              {
                step: "02",
                title: "Design",
                copy: "We create clean, modern, mobile-first designs in Figma. We focus on a simple, intuitive user experience that makes conversion easy.",
              },
              {
                step: "03",
                title: "Build",
                copy: "This is where our technical expertise shines. We build your site with clean, performant code (React/Vite) that is secure and scalable.",
              },
              {
                step: "04",
                title: "Launch & Improve",
                copy: "We get you live, on time. After launch, we analyse the data and can help you make continuous, small improvements. That's the Agile way.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: index * 0.1 }}
                className="mb-12 last:mb-0 flex gap-8"
              >
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-kaizen-cyan to-kaizen-lime flex items-center justify-center flex-shrink-0">
                    <span className="text-kaizen-dark font-heading font-bold text-2xl">
                      {item.step}
                    </span>
                  </div>
                  {index < 3 && (
                    <div className="w-1 h-20 bg-gradient-to-b from-kaizen-cyan to-kaizen-lime mt-4"></div>
                  )}
                </div>
                <div className="pt-4 pb-4">
                  <h3 className="text-2xl font-heading font-bold mb-3 text-kaizen-dark dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed max-w-xl">
                    {item.copy}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Local Proof */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white text-center">
              Real Results for Liverpool & Wirral
            </h2>
            <p className="text-xl text-kaizen-text-dark/70 dark:text-white/60 text-center max-w-2xl mx-auto mb-16">
              We help local businesses get more enquiries, rank higher, and grow
              online.
            </p>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                client: "A.S Collections",
                industry: "Professional Services – Liverpool",
                problem:
                  "Their previous site was dated, performed poorly on mobile, and failed to build trust in the competitive commercial debt recovery sector.",
                outcome:
                  "A complete, modern redesign. The new site is fast, authoritative, and projects the high level of professionalism their Liverpool clients expect.",
                link: "https://ascollections.co.uk",
                linkText: "View Live Site",
              },
              {
                client: "Helen Moore Hairdressing",
                industry: "Boutique Salon – Wirral",
                problem:
                  "A top-rated salon in Wallasey Village with no website, missing out on online discovery and relying on phone-only bookings.",
                outcome:
                  "We designed a classy, boutique-style website that captures her brand perfectly. It now ranks for local searches and includes a 24/7 online booking system.",
                link: "https://helenmoorehairdressing.co.uk",
                linkText: "View Live Site",
              },
            ].map((study, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <div className="text-sm font-bold text-kaizen-cyan dark:text-kaizen-cyan/70 uppercase tracking-wide mb-2">
                  {study.client}
                </div>
                <div className="text-xs font-medium text-kaizen-text-dark/60 dark:text-white/50 uppercase tracking-wide mb-4">
                  {study.industry}
                </div>
                <h3 className="text-xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  The Challenge
                </h3>
                <p className="text-kaizen-text-dark/70 dark:text-white/60 mb-6 leading-relaxed">
                  {study.problem}
                </p>
                <h3 className="text-xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  The Outcome
                </h3>
                <p className="text-kaizen-text-dark/70 dark:text-white/60 mb-6 leading-relaxed">
                  {study.outcome}
                </p>
                <a
                  href={study.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-kaizen-cyan dark:text-kaizen-cyan/70 font-medium flex items-center gap-2 hover:gap-3 transition"
                >
                  {study.linkText}
                  <ArrowUpRight size={16} />
                </a>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 5: Internal Links (Cross-Selling) */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-text-light dark:text-white text-center">
              Need More Than Just a Website?
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "Local SEO",
                copy: "Get your new website found by local customers in Liverpool & Wirral.",
                link: "/services/local-seo",
              },
              {
                title: "E-commerce Development",
                copy: "Need to sell online? We build fast, secure e-commerce stores.",
                link: "/services/ecommerce",
              },
              {
                title: "Agile Coaching",
                copy: "Our process is Agile. We can also train your team to be.",
                link: "/agile-coaching",
              },
            ].map((service, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Link
                  to={service.link}
                  className="p-8 bg-white/10 dark:bg-slate-900/50 rounded-2xl border border-kaizen-text-light/20 dark:border-white/10 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition group block h-full"
                >
                  <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-text-light dark:text-white group-hover:text-kaizen-cyan transition">
                    {service.title}
                  </h3>
                  <p className="text-lg text-kaizen-text-light/80 dark:text-white/70 leading-relaxed mb-6">
                    {service.copy}
                  </p>
                  <div className="text-kaizen-cyan font-medium flex items-center gap-2 hover:gap-3 transition">
                    Explore <ArrowUpRight size={16} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <FaqSection
        heading="Common Questions from Liverpool Businesses"
        eyebrow="Common Questions"
        items={[
          {
            question: "How much does a bespoke website cost in Liverpool?",
            answer:
              "For a professional, custom-built site (not a template), prices in Liverpool typically range from £3,500 for a brochure site to £15,000+ for a complex React application. We provide fixed-price quotes after a scope session.",
          },
          {
            question: "How is your delivery so fast?",
            answer:
              "We use AI-augmented development. By using AI to handle the heavy lifting of coding, we can build custom React platforms in weeks, not months. You get enterprise quality without paying for hundreds of hours of manual labour.",
          },
          {
            question: "Do you use junior developers?",
            answer:
              "No. We replace the 'junior developer' layer with AI coding agents. Your project is managed by a Senior Product Owner who directs the AI. This reduces human error and keeps your costs drastically lower.",
          },
          {
            question: "Can you fix my existing site without rebuilding it?",
            answer:
              "Yes. Our Project Rescue service is designed to audit and fix broken code. However, if the technical debt is too high, we may recommend a rebuild for financial safety.",
          },
        ]}
      />

      {/* Section 6: Final CTA */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
              Ready to Start Your Liverpool Web Design Project?
            </h2>
            <p className="text-xl text-kaizen-text-dark/70 dark:text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed">
              We're available on chat, or you can book a 15-minute, no-pressure
              discovery call to see if we're a good fit.
            </p>
          </ScrollReveal>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <CTAButton text="Start a Live Chat" openChat />
            <button
              onClick={openCalendlyFromContext}
              className="px-8 py-3 rounded-full border-2 border-kaizen-dark dark:border-white/20 text-kaizen-dark dark:text-white/85 font-heading font-bold hover:border-kaizen-cyan dark:hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
            >
              Book a 15 Minute Call
              <ArrowUpRight size={18} />
            </button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
