import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Zap,
  LifeBuoy,
  MapPin,
} from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { LeafletMap } from "@/components/LeafletMap";
import { FaqSection } from "@/components/FaqSection";
import { openCrisp } from "@/lib/crisp-utils";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { fetchPosts } from "../../src/api/wordpress";
import { decodeAndStrip } from "@/lib/html-utils";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
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

const HeroSection = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  return (
    <motion.section
      onMouseMove={handleMouseMove}
      className="relative min-h-[100vh] bg-gray-950 text-white flex items-center py-20 overflow-hidden"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.4 }}
    >
      {/* Hidden preload-optimized hero image for LCP */}
      <img
        src={DEFAULT_OG_IMAGE}
        alt=""
        loading="eager"
        fetchPriority="high"
        decoding="async"
        width="1200"
        height="630"
        className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      />
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="hero-grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(0, 255, 255, 0.08)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950" />

      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          background: [
            `radial-gradient(circle at ${mousePosition.x * 100}% ${
              mousePosition.y * 100
            }%, rgba(34, 211, 238, 0.1) 0%, transparent 50%)`,
          ],
        }}
        transition={{ type: "tween", duration: 0.3 }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan mb-6 uppercase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Wirral Web Design
          </motion.p>

          <motion.h1
            className="text-5xl md:text-7xl font-heading font-black mb-8 leading-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Web Design Wirral: Lean, Fast, &amp; Profitable Websites.
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-white/85 leading-relaxed mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Stop losing customers to slow loading times. We build streamlined
            sites designed to convert traffic into leads.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <button
              onClick={() => openCrisp()}
              className="px-8 py-4 rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 text-gray-950 font-heading font-bold text-lg hover:shadow-2xl hover:shadow-green-500/60 hover:scale-105 transition-all inline-flex items-center justify-center gap-2 relative group"
            >
              <motion.div
                className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-300"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              Get a Performance Audit
              <ArrowRight size={20} />
            </button>
            <button
              onClick={() => {
                const slider = document.getElementById(
                  "pricing-slider-section",
                );
                slider?.scrollIntoView({ behavior: "smooth" as any });
              }}
              className="px-8 py-4 rounded-lg border-2 border-white/30 text-white font-heading font-bold text-lg hover:border-kaizen-cyan hover:text-kaizen-cyan hover:shadow-lg hover:shadow-kaizen-cyan/30 transition-all inline-flex items-center justify-center gap-2"
            >
              See Our Pricing
              <ArrowUpRight size={20} />
            </button>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

const AuthorityBridge = () => {
  return (
    <section className="py-20 md:py-28 bg-slate-950 text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0,rgba(56,189,248,0.20),transparent_55%),radial-gradient(circle_at_100%_90%,rgba(34,197,94,0.16),transparent_60%)]" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
          >
            <p className="text-xs font-mono tracking-[0.25em] text-cyan-300 uppercase mb-4">
              Global Tech Experience
            </p>
            <h2 className="text-3xl md:text-5xl font-heading font-black leading-tight mb-6">
              Enterprise standards, without the enterprise hassle.
            </h2>
            <p className="text-lg text-white/80 leading-relaxed mb-6">
              We bring senior product leadership and engineering discipline from
              high-traffic platforms into local delivery. That means clear
              decisions, measurable performance targets, and a site that ships
              fast and keeps improving.
            </p>
            <ul className="space-y-3 text-white/85">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                Performance budgets agreed up front
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                Release discipline: staging, QA, and safe rollbacks
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                Senior ownership: no hand-offs, no vague timelines
              </li>
            </ul>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/case-studies/high-five-games"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/15 bg-white/5 text-white font-heading font-semibold hover:bg-white/10 transition"
              >
                See proof in a case study
                <ArrowUpRight size={18} />
              </Link>
              <button
                onClick={() => openCrisp()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 text-gray-950 font-heading font-bold hover:shadow-lg hover:shadow-green-500/50 transition"
              >
                Get a Performance Audit
                <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-r from-cyan-500/20 to-emerald-500/10 blur-2xl" />
            <div className="relative rounded-[2.25rem] border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden p-8 md:p-10">
              <div className="h-64 rounded-2xl bg-[linear-gradient(110deg,rgba(56,189,248,0.18),rgba(34,197,94,0.10)),radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.22),transparent_55%),radial-gradient(circle_at_85%_70%,rgba(34,197,94,0.18),transparent_60%)]" />
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
                  <div className="text-white font-heading font-bold">
                    Enterprise QA mindset
                  </div>
                  <div className="text-white/70 mt-1 text-sm">
                    Clear acceptance criteria and predictable releases.
                  </div>
                </div>
                <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
                  <div className="text-white font-heading font-bold">
                    Conversion-first builds
                  </div>
                  <div className="text-white/70 mt-1 text-sm">
                    Pages engineered to turn visits into enquiries.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const SocialMediaWarning = () => {
  return (
    <section className="py-16 md:py-20 bg-slate-900 text-white border-y border-white/10">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          className="max-w-4xl mx-auto text-center"
        >
          <p className="text-xs font-mono tracking-[0.25em] text-amber-200 uppercase mb-4">
            The Social Media Warning
          </p>
          <h2 className="text-3xl md:text-4xl font-heading font-black mb-5">
            Is Your Business Homeless?
          </h2>
          <p className="text-lg text-white/80 leading-relaxed">
            If your whole presence lives on Facebook or Instagram, you’re renting
            attention. Algorithms change, reach disappears, accounts get locked,
            and your leads vanish overnight. A fast website is the asset you own:
            it builds trust, captures enquiries, and keeps working regardless of
            what social platforms decide.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

const ServicePillars = () => {
  const pillars = [
    {
      title: "High-Speed Websites",
      description:
        "Lean React/modern builds that load fast, rank better, and convert more visitors.",
      icon: <Zap className="w-5 h-5" />,
      href: "/services/local-seo",
      accent: "from-cyan-300/25 to-transparent",
    },
    {
      title: "Project Rescue",
      description:
        "When a build is late, over budget, or stuck: we stabilise delivery and ship.",
      icon: <LifeBuoy className="w-5 h-5" />,
      href: "/project-rescue",
      accent: "from-lime-300/25 to-transparent",
    },
    {
      title: "Google Visibility",
      description:
        "Local intent + technical SEO fundamentals, backed by performance and clean architecture.",
      icon: <MapPin className="w-5 h-5" />,
      href: "/services/local-seo",
      accent: "from-amber-200/25 to-transparent",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-gray-950 text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0_0,rgba(56,189,248,0.14),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(34,197,94,0.12),transparent_60%)]" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          className="max-w-3xl mx-auto text-center mb-12"
        >
          <p className="text-xs font-mono tracking-[0.25em] text-cyan-300 uppercase mb-4">
            What We Actually Do
          </p>
          <h2 className="text-3xl md:text-4xl font-heading font-black mb-4">
            Speed, control, and visibility.
          </h2>
          <p className="text-white/75 text-lg">
            Three pillars that keep your site fast, profitable, and independent.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map((pill, index) => (
            <motion.div
              key={pill.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: index * 0.08 }}
              className="h-full"
            >
              <Link
                to={pill.href}
                className="group block h-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-7 hover:bg-white/10 transition"
              >
                <div
                  className={`h-full rounded-2xl bg-gradient-to-br ${pill.accent} p-0.5`}
                >
                  <div className="h-full rounded-2xl bg-black/25 border border-white/10 p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/10 text-cyan-200">
                        {pill.icon}
                      </span>
                      <h3 className="text-xl font-heading font-bold">
                        {pill.title}
                      </h3>
                    </div>
                    <p className="text-white/75 leading-relaxed flex-1">
                      {pill.description}
                    </p>
                    <div className="mt-6 inline-flex items-center gap-2 text-cyan-200 font-heading font-semibold group-hover:gap-3 transition-all">
                      Learn more
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const PricingSlider = () => {
  const [tier, setTier] = useState(0);

  const tiers = [
    {
      name: "Starter",
      description: "Trades & Sole Traders",
      price: "From £500",
      detail: "Template setup, fast launch.",
      cta: "Get a Starter Quote",
    },
    {
      name: "Growth",
      description: "Small Business / Marketing",
      price: "£2k – £5k",
      detail: "Custom design, lead gen focused.",
      cta: "Book a Growth Call",
    },
    {
      name: "Scale",
      description: "High-Performance",
      price: "£8k – £15k",
      detail: "React/Headless, instant load.",
      cta: "Get a Scale Quote",
    },
    {
      name: "Enterprise",
      description: "SaaS / Web App",
      price: "£15k+",
      detail: "Complex logic, user portals.",
      cta: "Book an Enterprise Call",
    },
    {
      name: "Rescue",
      description: "Broken Project?",
      price: "Custom Triage",
      detail: "We fix what others broke.",
      cta: "Start a Rescue Chat",
    },
  ];

  const currentTier = tiers[tier];

  return (
    <section
      id="pricing-slider-section"
      className="py-20 md:py-32 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/50 relative overflow-hidden"
    >
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
            Pricing That Fits
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-950 dark:text-white">
            Choose Your Build
          </h2>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <input
              type="range"
              min="0"
              max="4"
              value={tier}
              onChange={(e) => setTier(parseInt(e.target.value))}
              className="pricing-slider w-full h-3 bg-gradient-to-r from-cyan-400 via-lime-400 to-cyan-400 rounded-lg appearance-none cursor-pointer"
              style={{
                background:
                  "linear-gradient(to right, rgb(34, 211, 238), rgb(132, 204, 22), rgb(34, 211, 238))",
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2 font-mono">
              <span>Starter</span>
              <span>Growth</span>
              <span>Scale</span>
              <span>Enterprise</span>
              <span>Rescue</span>
            </div>
          </motion.div>

          <motion.div
            key={tier}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] as const }}
            className="relative group"
          >
            <div className="absolute -inset-px bg-gradient-to-r from-kaizen-cyan via-kaizen-lime to-kaizen-cyan rounded-3xl opacity-0 group-hover:opacity-20 blur transition duration-300" />
            <div className="relative bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/10 p-8 md:p-12 mb-8 shadow-xl dark:shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-3xl font-heading font-bold text-gray-950 dark:text-white mb-2">
                    {currentTier.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {currentTier.description}
                  </p>
                  <div className="text-4xl font-heading font-black bg-gradient-to-r from-kaizen-cyan to-kaizen-lime bg-clip-text text-transparent mb-4">
                    {currentTier.price}
                  </div>
                  <p className="text-lg text-gray-700 dark:text-gray-300">
                    {currentTier.detail}
                  </p>
                </div>

                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-mono tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-3">
                      What's Included
                    </p>
                    <ul className="space-y-2">
                      {tier === 0 && (
                        <>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span>{" "}
                            Ready-made template
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Basic
                            SEO
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Mobile
                            responsive
                          </li>
                        </>
                      )}
                      {tier === 1 && (
                        <>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Custom
                            design
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Lead
                            capture forms
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span>{" "}
                            Analytics setup
                          </li>
                        </>
                      )}
                      {tier === 2 && (
                        <>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span>
                            React/Headless build
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> 96+
                            Lighthouse score
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Full SEO
                            optimisation
                          </li>
                        </>
                      )}
                      {tier === 3 && (
                        <>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Complex
                            features
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> User
                            authentication
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span>{" "}
                            Dedicated Product Owner
                          </li>
                        </>
                      )}
                      {tier === 4 && (
                        <>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Full
                            project audit
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Recovery
                            plan
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> New team
                            stabilisation
                          </li>
                        </>
                      )}
                    </ul>
                  </div>

                  <button
                    onClick={() => openCrisp()}
                    className="mt-6 w-full px-6 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-gray-950 font-heading font-bold hover:shadow-lg hover:scale-105 transition-all inline-flex items-center justify-center gap-2"
                  >
                    {currentTier.cta}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const PricingCTABanner = () => {
  return (
    <section className="py-16 md:py-20 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden border-y border-white/10">
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl md:text-3xl font-heading font-bold text-white mb-4">
                  Not sure what you need?
                </h3>
                <p className="text-white/80 text-lg mb-6">
                  Read our transparent pricing guide so you know what a serious
                  website should cost in 2025 and what you should actually
                  expect to pay.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/blog/how-much-does-a-website-cost-in-liverpool-in-2025"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-full bg-kaizen-cyan text-slate-950 font-heading font-semibold hover:bg-kaizen-cyan/90 hover:shadow-lg hover:translate-y-0.5 transition-all gap-2"
                >
                  Open Pricing Guide
                  <ChevronRight size={20} />
                </Link>
                <div className="flex items-center justify-center">
                  <span className="text-xs font-mono tracking-widest text-kaizen-cyan/70 uppercase">
                    Updated Nov 2025
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const AIPriceNarrative = () => {
  return (
    <section className="py-20 md:py-28 bg-white dark:bg-slate-950 border-t border-slate-200/60 dark:border-slate-800/80">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mb-10"
        >
          <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
            AI-Augmented Delivery
          </p>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3 text-slate-900 dark:text-white">
            Enterprise Tech. Freelancer Prices.
          </h2>
          <p className="text-lg md:text-xl text-slate-700 dark:text-slate-300">
            How we build £15k React platforms for £4k.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="space-y-4 text-slate-800 dark:text-slate-200 text-base md:text-lg max-w-3xl"
        >
          <p>
            Most agencies bill you for manual labour. They charge for every hour
            a developer spends typing syntax.
          </p>
          <p>We don't.</p>
          <p>Kaizen is an AI-augmented agency.</p>
          <p>
            We use proprietary AI workflows to handle the heavy lifting of code
            generation. This cuts development time by around 70%.
          </p>
          <p>
            You get the blistering speed of React, the security of headless
            architecture, and the polish of a custom build, but you only pay for
            the product strategy, not the typing.
          </p>
          <p>Same code. Same quality. Unfair price.</p>
        </motion.div>
      </div>
    </section>
  );
};

const CoreServiceVerticals = () => {
  return (
    <section className="py-20 md:py-28 bg-slate-950 text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.18),transparent_55%)]" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          className="max-w-4xl mx-auto text-center mb-14"
        >
          <p className="text-xs font-mono tracking-[0.25em] text-cyan-300 mb-4 uppercase">
            What We Do
          </p>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">
            Our business is split into two main verticals
          </h2>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl mx-auto">
            High-performance websites for local businesses, and hands-on product
            leadership for complex or failing digital projects.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-stretch"
        >
          <motion.div
            initial={{ opacity: 0, x: -24, rotate: -0.3 }}
            whileInView={{ opacity: 1, x: 0, rotate: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            whileHover={{ y: -6, rotate: -0.6 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
            className="relative rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden shadow-[0_24px_70px_rgba(8,47,73,0.9)]"
          >
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_10%_0,rgba(56,189,248,0.5),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(45,212,191,0.4),transparent_55%)]" />
            <div className="relative p-8 md:p-10 flex flex-col h-full">
              <p className="text-xs font-mono tracking-[0.25em] text-cyan-300 mb-4 uppercase">
                Vertical One
              </p>
              <h3 className="text-3xl md:text-4xl font-heading font-bold mb-4">
                Wirral Web Design
              </h3>
              <p className="text-sm md:text-base text-slate-200 mb-6 max-w-md">
                High-performance web design for SMEs that want speed and
                conversions. We build lean sites that turn search traffic into
                leads and keep improving over time.
              </p>
              <ul className="space-y-2 text-sm md:text-base text-slate-200/90 mb-8">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-cyan-400" />
                  Local-first SEO built around real search intent
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-cyan-400" />
                  Performance-led builds (Core Web Vitals in mind)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-cyan-400" />
                  Clear pricing for brochure, ecommerce &amp; web apps
                </li>
              </ul>
              <div className="mt-auto flex items-center justify-between gap-4">
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-cyan-200 text-slate-950 px-5 py-2.5 text-sm font-heading font-semibold shadow-lg hover:shadow-cyan-400/60 hover:-translate-y-0.5 transition-all"
                >
                  Get a Performance Audit
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24, rotate: 0.3 }}
            whileInView={{ opacity: 1, x: 0, rotate: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            whileHover={{ y: -6, rotate: 0.6 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
            className="relative rounded-3xl border border-lime-400/40 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 overflow-hidden shadow-[0_24px_70px_rgba(22,101,52,0.9)]"
          >
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_15%_0,rgba(190,242,100,0.5),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(22,163,74,0.5),transparent_55%)]" />
            <div className="relative p-8 md:p-10 flex flex-col h-full">
              <p className="text-xs font-mono tracking-[0.25em] text-lime-300 mb-4 uppercase">
                Vertical Two
              </p>
              <h3 className="text-3xl md:text-4xl font-heading font-bold mb-4">
                Contract Product Owner
              </h3>
              <p className="text-sm md:text-base text-slate-100 mb-6 max-w-md">
                Senior contract product ownership for remote &amp; local teams.
                We rescue failing builds, run Agile sprints, and keep budgets,
                scope and outcomes under control.
              </p>
              <ul className="space-y-2 text-sm md:text-base text-slate-100/90 mb-8">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-lime-400" />
                  Hands-on ownership of backlog, roadmap &amp; delivery
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-lime-400" />
                  Ideal for complex rebuilds and project rescue
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-lime-400" />
                  Works alongside your in-house or agency dev team
                </li>
              </ul>
              <div className="mt-auto flex items-center justify-between gap-4">
                <Link
                  to="/contract-product-owner"
                  className="inline-flex items-center gap-2 rounded-full bg-lime-300 text-slate-950 px-5 py-2.5 text-sm font-heading font-semibold shadow-lg hover:bg-lime-200 hover:shadow-lime-300/40 hover:-translate-y-0.5 transition-all"
                >
                  Explore Contract PO
                  <ArrowRight size={18} />
                </Link>
                <Link
                  to="/project-rescue"
                  className="hidden md:inline-flex text-xs font-mono tracking-widest text-lime-200/80 hover:text-lime-100 transition-colors uppercase"
                >
                  Project Rescue
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

const LatestInsights = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts()
      .then((data) => {
        const processed = (data || [])
          .map((post: any) => {
            const image =
              post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ||
              "https://images.unsplash.com/photo-1460925895917-aae19e488e71?w=800&h=600&fit=crop";

            return {
              id: String(post.id),
              slug: post.slug || "",
              title: decodeAndStrip(post.title?.rendered || "Untitled"),
              excerpt: decodeAndStrip(post.excerpt?.rendered || ""),
              date: post.date || new Date().toISOString(),
              image,
            };
          })
          .sort(
            (a: any, b: any) =>
              new Date(b.date).getTime() - new Date(a.date).getTime(),
          );

        setPosts(processed.slice(0, 3));
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch posts:", error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Loading insights...
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
            Knowledge Base
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-950 dark:text-white mb-6">
            Latest Insights
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Stay updated with our latest thoughts on web design, development,
            and digital transformation for local and remote teams.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="group relative overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-900/50 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 hover:border-kaizen-cyan/50 transition-all duration-300"
            >
              <div className="absolute -inset-px bg-gradient-to-br from-kaizen-cyan to-kaizen-lime rounded-2xl opacity-0 group-hover:opacity-10 blur transition duration-300" />
              <div className="relative">
                <div className="h-40 w-full overflow-hidden rounded-t-2xl border-b border-slate-200/50 dark:border-slate-800/50">
                  <img
                    src={post.image}
                    alt={`Featured image for ${post.title} - Kaizen Web`}
                    loading="lazy"
                    width="800"
                    height="600"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-mono tracking-widest text-kaizen-cyan uppercase">
                      Article
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(post.date).toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <h3 className="text-xl font-heading font-bold text-gray-950 dark:text-white mb-3 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 text-kaizen-cyan font-heading font-bold hover:gap-3 transition-all duration-300"
                  >
                    Read Article
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const SEOFAQSection = () => {
  return (
    <FaqSection
      heading="Common Questions from Liverpool Businesses"
      eyebrow="Common Questions"
      items={[
        {
          question: "What is your role if AI does the coding?",
          answer:
            "AI is the engine; we are the pilots. Our Contract Product Owners define the strategy, user journey, and business logic. We ensure the AI builds the right product that actually solves your business problem.",
        },
        {
          question: "Are you a Liverpool agency?",
          answer:
            "Yes, we are based in Liverpool and the Wirral, but we work with clients across the UK. We are happy to meet face-to-face for local projects.",
        },
        {
          question: "Do you provide hosting?",
          answer:
            "We provide high-performance VPS hosting for clients on our maintenance plans. We do not use cheap shared hosting as it compromises speed and security.",
        },
      ]}
    />
  );
};

const KaizenPhilosophy = () => {
  return (
    <section className="py-20 md:py-32 bg-gray-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <svg
          className="w-full h-full"
          viewBox="0 0 1200 600"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern
              id="philosophy-pattern"
              width="120"
              height="120"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 120 0 L 0 0 0 120"
                fill="none"
                stroke="rgba(0, 255, 255, 0.05)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="1200" height="600" fill="url(#philosophy-pattern)" />
        </svg>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-6">
              Our Philosophy
            </p>

            <h2 className="text-5xl md:text-6xl font-heading font-black mb-8 leading-tight">
              Why We're Different
            </h2>

            <p className="text-xl md:text-2xl font-light text-white/80 mb-8 leading-relaxed">
              Kaizen—continuous improvement—is a mindset, not a buzzword. Most
              agencies launch a website and vanish. We build systems that
              evolve. We embed ourselves in your process with a dedicated
              Product Owner who shields you from chaos, protects your budget,
              and ensures you ship on time.
            </p>

            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="flex gap-4"
              >
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-kaizen-cyan/20">
                    <span className="text-kaizen-cyan font-bold">→</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold mb-2">
                    You Get a Product Owner, Not a Contact
                  </h3>
                  <p className="text-white/70">
                    We assign a dedicated senior professional to your project.
                    Not an account manager shuffling between clients. One
                    person, hands-on, making strategic decisions every day.
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="flex gap-4"
              >
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-kaizen-lime/20">
                    <span className="text-kaizen-lime font-bold">→</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold mb-2">
                    Agile Sprints Over Chaos
                  </h3>
                  <p className="text-white/70">
                    Two-week sprints. Clear deliverables. Predictable progress.
                    We replace scope creep with transparent planning and
                    realistic timelines.
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="flex gap-4"
              >
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-kaizen-cyan/20">
                    <span className="text-kaizen-cyan font-bold">→</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold mb-2">
                    Real Results Measured, Not Promised
                  </h3>
                  <p className="text-white/70">
                    We benchmark performance from day one. Lighthouse scores.
                    Core Web Vitals. Conversion funnels. You'll see concrete
                    data, not marketing fluff.
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const AIValueProp = () => {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900/50 dark:to-slate-950 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
              Modern Tech, Old-School Standards
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-950 dark:text-white mb-6">
              Why We're Better Value
            </h2>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
              We use advanced AI to handle boilerplate. You pay for strategy,
              architecture, and the Senior Product Owner steering the ship, not
              junior developers typing HTML.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="group relative overflow-hidden rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-lg border border-red-200/50 dark:border-red-900/30 p-8 hover:border-red-300/80 dark:hover:border-red-800/60 transition-all duration-300"
            >
              <div className="absolute -inset-px bg-gradient-to-br from-red-200 to-red-100 dark:from-red-900 dark:to-red-800 rounded-2xl opacity-0 group-hover:opacity-10 blur transition duration-300" />
              <div className="relative">
                <h3 className="text-2xl font-heading font-bold text-red-600 dark:text-red-400 mb-3">
                  Traditional Agency
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4 leading-relaxed">
                  Manual coding. Junior developers. Long timelines. Scope creep.
                  Surprise costs.
                </p>
                <p className="font-heading font-bold text-red-600 dark:text-red-400 text-xl">
                  Cost: £££ (and climbing)
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="group relative overflow-hidden rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-lg border border-green-200/50 dark:border-green-900/30 p-8 hover:border-green-300/80 dark:hover:border-green-800/60 transition-all duration-300"
            >
              <div className="absolute -inset-px bg-gradient-to-br from-green-200 to-green-100 dark:from-green-900 dark:to-green-800 rounded-2xl opacity-0 group-hover:opacity-10 blur transition duration-300" />
              <div className="relative">
                <h3 className="text-2xl font-heading font-bold text-green-600 dark:text-green-400 mb-3">
                  Kaizen
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300 mb-4 leading-relaxed">
                  AI-augmented development. Strategic thinking. Two-week
                  sprints. Predictable costs.
                </p>
                <p className="font-heading font-bold text-green-600 dark:text-green-400 text-xl">
                  Cost: Better ROI
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

const PerformanceBadge = () => {
  const [fillPercent, setFillPercent] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setFillPercent(96);
      }
    });

    const element = document.getElementById("performance-badge");
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 md:py-32 bg-slate-50 dark:bg-slate-900/50 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
            Proof, Not Promises
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-950 dark:text-white">
            Grade A Performance
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <motion.div
            id="performance-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative w-64 h-64 mx-auto mb-12"
          >
            <svg
              className="w-full h-full drop-shadow-2xl"
              viewBox="0 0 200 200"
            >
              <defs>
                <linearGradient
                  id="shimmer"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.6)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
              </defs>

              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />

              <motion.circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="#22c55e"
                strokeWidth="8"
                strokeDasharray={565.48}
                initial={{ strokeDashoffset: 565.48 }}
                animate={{
                  strokeDashoffset: 565.48 * (1 - fillPercent / 100),
                }}
                transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] as const }}
                strokeLinecap="round"
              />

              <motion.circle
                cx="100"
                cy="100"
                r="90"
                fill="url(#shimmer)"
                opacity="0.3"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: [0, 0, 1, 1] as const }}
                style={{ transformOrigin: "100px 100px" }}
              />

              <text
                x="100"
                y="95"
                textAnchor="middle"
                className="font-heading font-black text-4xl"
                fill="#047857"
              >
                {fillPercent}%
              </text>
              <text
                x="100"
                y="125"
                textAnchor="middle"
                className="text-xs"
                fill="#6b7280"
              >
                Performance
              </text>
            </svg>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-4 text-center mb-12"
          >
            <motion.div
              whileHover={{ y: -5 }}
              className="group relative rounded-2xl bg-white/50 dark:bg-slate-950/50 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 p-6 hover:border-kaizen-cyan/50 transition-all duration-300 cursor-default"
            >
              <div className="absolute -inset-px bg-gradient-to-br from-kaizen-cyan to-kaizen-lime rounded-2xl opacity-0 group-hover:opacity-10 blur transition duration-300" />
              <div className="relative">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono uppercase tracking-widest mb-2">
                  LCP
                </p>
                <p className="text-2xl font-heading font-bold text-gray-950 dark:text-white">
                  0.8s
                </p>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="group relative rounded-2xl bg-white/50 dark:bg-slate-950/50 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 p-6 hover:border-kaizen-cyan/50 transition-all duration-300 cursor-default"
            >
              <div className="absolute -inset-px bg-gradient-to-br from-kaizen-cyan to-kaizen-lime rounded-2xl opacity-0 group-hover:opacity-10 blur transition duration-300" />
              <div className="relative">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono uppercase tracking-widest mb-2">
                  TBT
                </p>
                <p className="text-2xl font-heading font-bold text-gray-950 dark:text-white">
                  0ms
                </p>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="group relative rounded-2xl bg-white/50 dark:bg-slate-950/50 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 p-6 hover:border-kaizen-cyan/50 transition-all duration-300 cursor-default"
            >
              <div className="absolute -inset-px bg-gradient-to-br from-kaizen-cyan to-kaizen-lime rounded-2xl opacity-0 group-hover:opacity-10 blur transition duration-300" />
              <div className="relative">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono uppercase tracking-widest mb-2">
                  CLS
                </p>
                <p className="text-2xl font-heading font-bold text-gray-950 dark:text-white">
                  0.01
                </p>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7 }}
            className="text-center"
          >
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              We don't guess. We benchmark. Core Web Vitals are Google's way of
              measuring real user experience: how quickly your page loads, how
              responsive it feels, and how stable it looks as it renders. A 96%
              score means your site feels instant on real devices and gives
              Google fewer reasons to push you down the results.
            </p>
            <a
              href="https://gtmetrix.com/reports/kaizenweb.co.uk/e2VJJsxv/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-kaizen-cyan/50 text-kaizen-cyan font-heading font-bold hover:border-kaizen-cyan hover:bg-kaizen-cyan/10 transition-all duration-300"
            >
              View Full Report
              <ArrowUpRight size={18} />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const LocalMap = () => {
  return (
    <section className="py-20 md:py-32 bg-gray-950 text-white relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="relative h-96 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl">
              <LeafletMap className="w-full h-full" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-6">
              Local Authority
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 leading-tight">
              Made Local, For Local.
            </h2>
            <p className="text-lg text-white/80 mb-8 leading-relaxed">
              Kaizen is based in Liverpool city centre. We serve businesses
              across Liverpool, Wirral, and Merseyside. We understand how locals
              search, what they need, and how to get them found.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-kaizen-cyan" />
                <span className="text-white/90">
                  Liverpool city centre based
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-kaizen-lime" />
                <span className="text-white/90">
                  Serving all Merseyside locations
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-white/50" />
                <span className="text-white/90">
                  Local knowledge meets global expertise
                </span>
              </div>
            </div>

            <button
              onClick={() => openCrisp()}
              className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-gray-950 font-heading font-bold hover:shadow-lg hover:scale-105 transition-all inline-flex items-center gap-2"
            >
              Ready to Build? Start a Chat
              <ArrowRight size={20} />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  return (
    <Layout>
      <HeroSection />
      <RescueStrip />
      <PricingSlider />
      <PricingCTABanner />
      <AIPriceNarrative />
      <CoreServiceVerticals />
      <KaizenPhilosophy />
      <AIValueProp />
      <PerformanceBadge />
      <LocalMap />
      <LatestInsights />
      <SEOFAQSection />
    </Layout>
  );
}
