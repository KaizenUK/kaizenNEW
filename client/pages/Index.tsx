import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Layout from "@/components/Layout";
import { useCalendly } from "@/context/CalendlyContext";

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

const LETTERS = "01<>[]{}+=-*/$#&%ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const getRandomChar = () =>
  LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));

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
      // Open Crisp Chat
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

type HeroPhase = "rain" | "resolve" | "content";

const CodeRainHero = () => {
  const [phase, setPhase] = useState<HeroPhase>("rain");

  const rainColumns = 36;
  const rainRows = 16;

  const [matrix] = useState<string[][]>(() =>
    Array.from({ length: rainColumns }, () =>
      Array.from({ length: rainRows }, () => getRandomChar()),
    ),
  );

  useEffect(() => {
    const rainTimeout = setTimeout(() => setPhase("resolve"), 1200);
    const contentTimeout = setTimeout(() => setPhase("content"), 1800);

    return () => {
      clearTimeout(rainTimeout);
      clearTimeout(contentTimeout);
    };
  }, []);

  const showOverlay = phase !== "content";
  const showContent = phase === "content";

  const title = "Web Design Liverpool.";

  return (
    <section className="relative min-h-screen bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85 flex items-center py-20 overflow-hidden">
      {/* Code Rain Overlay */}
      {showOverlay && (
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
            phase === "resolve" ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-slate-900/90 to-black/95" />
          <div className="relative h-full w-full flex">
            {matrix.map((column, colIndex) => (
              <div
                key={colIndex}
                className="flex-1 flex items-start justify-center overflow-hidden"
              >
                <div className="code-rain-column">
                  {column.map((char, rowIndex) => (
                    <span
                      key={rowIndex}
                      className="block text-sm md:text-base font-mono bg-gradient-to-b from-cyan-400 to-lime-400 bg-clip-text text-transparent opacity-80"
                    >
                      {char}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* H1 formed from the code rain */}
          <motion.h1
            className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold mb-8 leading-tight"
            initial={{ opacity: 0, y: 40 }}
            animate={
              phase === "rain" ? { opacity: 0, y: 40 } : { opacity: 1, y: 0 }
            }
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {title.split("").map((char, index) => (
              <motion.span
                key={index}
                className="inline-block"
                initial={{
                  opacity: 0,
                  y: 20,
                  x: (index % 2 === 0 ? -1 : 1) * 20,
                }}
                animate={
                  phase === "rain"
                    ? {
                        opacity: 0,
                        y: 20,
                        x: (index % 2 === 0 ? -1 : 1) * 20,
                      }
                    : { opacity: 1, y: 0, x: 0 }
                }
                transition={{
                  delay: 0.05 * index + 0.2,
                  duration: 0.45,
                  ease: "easeOut",
                }}
              >
                {char === " " ? "\u00A0" : char}
              </motion.span>
            ))}
          </motion.h1>

          {/* Sub-headline */}
          <motion.div
            className="space-y-6 mb-12 text-xl text-kaizen-text-light/80 dark:text-white/70 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          >
            <p>
              We build high-performance websites for Liverpool &amp; Wirral
              businesses. Our sites are fast, clean-coded, and delivered with an
              Agile process that means you launch on time, without the typical
              agency headaches.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          >
            <CTAButton text="Start a Chat" openChat />
            <Link
              to="/case-studies"
              className="px-8 py-3 rounded-full border-2 border-kaizen-text-light/30 dark:border-white/20 text-kaizen-text-light dark:text-white/85 font-heading font-bold hover:border-kaizen-cyan dark:hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
            >
              See Our Work
              <ArrowUpRight size={18} />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  const { openCalendly: openCalendlyFromContext } = useCalendly();

  return (
    <Layout>
      {/* Section 1: Hero */}
      <CodeRainHero />

      {/* Section 2: Who We Help */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Websites for Liverpool &amp; Wirral Businesses
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
                title: "Professional Services",
                copy: "For solicitors, accountants, and consultants. We build credible sites that showcase your expertise and generate qualified enquiries.",
              },
              {
                title: "Trades & Home Services",
                copy: "For builders, plumbers, and local services. We get you found in local search and make it easy for mobile users to book your services.",
              },
              {
                title: "E-commerce & Retail",
                copy: "For independent shops and online brands. We build fast, secure online stores that make your products simple to find and buy.",
              },
            ].map((card, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {card.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  {card.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 3: Local Trust Block (Asymmetrical) */}
      <section className="relative py-20 md:py-32 bg-slate-950 text-kaizen-text-light dark:text-white/85 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-transparent via-kaizen-dark/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-kaizen-dark via-slate-950 to-transparent" />

        <div className="relative container mx-auto px-4">
          <ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-stretch">
              <div className="md:col-span-7 flex flex-col justify-center">
                <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan mb-4 uppercase">
                  LIVERPOOL & WIRRAL · NORTH WEST
                </p>

                <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-text-light dark:text-white">
                  Your Local Partner for Liverpool & Wirral
                </h2>

                <p className="text-lg md:text-xl text-kaizen-text-light/80 dark:text-white/70 mb-6 leading-relaxed">
                  We are a Liverpool studio working with businesses across the
                  North West – from high-street independents in Wirral to
                  professional services firms in the city centre.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-sm font-heading text-white mb-1">
                      Local-first thinking
                    </p>
                    <p className="text-sm text-white/70">
                      Clear calls-to-action, local SEO baked in, and content
                      that actually sounds like you.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-sm font-heading text-white mb-1">
                      Built for growth
                    </p>
                    <p className="text-sm text-white/70">
                      Fast, secure builds that can scale from a one-person
                      practice to a growing team.
                    </p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-5">
                <div className="relative h-full p-8 rounded-2xl border border-white/10 bg-gradient-to-br from-kaizen-dark via-slate-900 to-black shadow-2xl overflow-hidden">
                  <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-kaizen-cyan/20 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-32 -left-20 h-48 w-48 rounded-full bg-kaizen-lime/20 blur-3xl" />

                  <div className="relative">
                    <h3 className="text-2xl font-heading font-bold mb-4 text-white">
                      A site built for real people
                    </h3>
                    <p className="text-base text-white/75 mb-6">
                      We design around how your customers actually find, read,
                      and contact you – not how a theme looks in a demo.
                    </p>
                    <ul className="space-y-3 text-white/80 text-sm">
                      <li>
                        Layouts that work on busy thumbs, not just big monitors.
                      </li>
                      <li>
                        Copy and structure tuned for local search and real
                        enquiries.
                      </li>
                      <li>
                        Measured, iterative improvements instead of one big
                        risky relaunch.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </Layout>
  );
}
