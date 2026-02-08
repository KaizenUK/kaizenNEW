import React, { Suspense, useState, lazy } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const FaqSection = lazy(() =>
  import("@/components/FaqSection").then((m) => ({ default: m.FaqSection })),
);

export const PricingSlider = () => {
  const [tier, setTier] = useState(0);
  const navigate = useNavigate();

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
      cta: "Get Help Now",
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
                    onClick={() => navigate("/contact")}
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

export const PricingCTABanner = () => {
  const currentYear = new Date().getFullYear();

  const getLastModifiedDate = () => {
    const now = new Date();
    const monthName = now.toLocaleString("en-GB", {
      month: "short",
      year: "numeric",
    });
    return monthName;
  };

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
                  website should cost in {currentYear} and what you should
                  actually expect to pay.
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
                    Updated {getLastModifiedDate()}
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

export const AIPriceNarrative = () => {
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
          <h2 className="text-3xl md:text-5xl font-heading font-bold mb-3 text-slate-900 dark:text-white">
            £15k Websites. Fraction of the Price.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="space-y-6 text-slate-800 dark:text-slate-200 text-base md:text-lg max-w-3xl"
        >
          <p>
            Most agencies bill you for every hour. We use smart tools to cut
            out the repetitive work, so you get professional results without the
            professional price tag.
          </p>
          <p className="text-xl md:text-2xl font-heading font-bold text-slate-900 dark:text-white">
            Enterprise quality. Freelancer prices. That's the deal.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export const SEOFAQSection = () => {
  return (
    <Suspense fallback={<div className="py-16 bg-slate-900" />}>
      <FaqSection
        heading="Common Questions from Wirral Businesses"
        eyebrow="Common Questions"
        items={[
          {
            question: "How quickly can you build my website?",
            answer:
              "Most websites are delivered within 2-4 weeks depending on complexity. We focus on rapid deployment of core functionality first, then iterate based on real user feedback rather than building everything upfront.",
          },
          {
            question: "Are you based on the Wirral?",
            answer:
              "Yes — we're based in Moreton on the Wirral, and we work with clients across the UK. We're happy to meet face-to-face for local projects.",
          },
          {
            question: "Do you provide hosting?",
            answer:
              "We provide high-performance VPS hosting for clients on our maintenance plans. We do not use cheap shared hosting as it compromises speed and security.",
          },
          {
            question: "What makes your websites faster than competitors?",
            answer:
              "We use modern frameworks like React and headless architecture, implement aggressive code splitting, optimize all images, use CDN delivery, and follow Google's Core Web Vitals guidelines. Most agencies still build slow WordPress sites.",
          },
          {
            question: "Can you redesign my existing website?",
            answer:
              "Absolutely. We specialize in rescuing and rebuilding underperforming websites. We'll audit your current site, identify performance bottlenecks, and deliver a faster, conversion-optimized replacement.",
          },
          {
            question: "Do you offer SEO services?",
            answer:
              "Yes. We focus on technical SEO fundamentals: fast page speeds, mobile optimization, structured data, and clean architecture. We don't do keyword stuffing — we build sites that Google naturally wants to rank.",
          },
          {
            question: "What happens after my website launches?",
            answer:
              "We offer ongoing maintenance plans that include security updates, performance monitoring, content updates, and technical support. You're never locked into a contract — month-to-month only.",
          },
          {
            question: "Can I update the website myself?",
            answer:
              "Yes. We provide an intuitive content management system (headless CMS) that lets you update text, images, and pages without touching code. We also provide training and documentation.",
          },
          {
            question:
              "What if I need help with my existing web developer's work?",
            answer:
              "We offer project rescue services. If your current build is late, over budget, or stuck, we can step in to stabilize the project, fix technical issues, and get you launched.",
          },
          {
            question: "Do you work with e-commerce sites?",
            answer:
              "Yes. We build high-performance e-commerce stores using modern platforms like Shopify Plus, headless Commerce.js, or custom React solutions. We focus on conversion optimization and fast checkout experiences.",
          },
        ]}
      />
    </Suspense>
  );
};

export const LocalMap = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-32 bg-gray-950 text-white relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="lg:order-1"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-6">
              Local Trust
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 leading-tight">
              Moreton-Based. Wirral-Focused.
            </h2>
            <p className="text-lg text-white/80 mb-8 leading-relaxed">
              We’re based in Moreton on the Wirral. You get enterprise delivery
              We're your neighbours, not a faceless agency. Face-to-face or
              fully remote — whatever gets the job done. Enterprise delivery
              standards with someone you can actually ring.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-kaizen-cyan" />
                <span className="text-white/90">Moreton (Wirral) based</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-kaizen-lime" />
                <span className="text-white/90">
                  Serving Wirral &amp; the North West
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-white/50" />
                <span className="text-white/90">
                  Local knowledge meets global expertise
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  const scanner = document.getElementById(
                    "live-performance-scanner",
                  );
                  scanner?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-gray-950 font-heading font-bold hover:shadow-lg hover:scale-105 transition-all inline-flex items-center gap-2"
              >
                Get a Performance Audit
                <ArrowRight size={20} />
              </button>
              <button
                onClick={() => navigate("/contact")}
                className="px-8 py-4 rounded-lg border-2 border-white/20 text-white font-heading font-bold hover:border-kaizen-cyan hover:text-kaizen-cyan transition-all inline-flex items-center gap-2"
              >
                Start Your Project
                <ArrowRight size={20} />
              </button>
            </div>
          </motion.div>

          <motion.div
            className="relative lg:order-2 lg:translate-x-6"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute -inset-6 bg-gradient-to-r from-kaizen-cyan/20 to-kaizen-lime/10 blur-2xl rounded-3xl" />
            <div className="relative h-96 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl">
              <img
                src="/kaizen-web-map-wirral-liverpool.svg"
                alt="Map of Wirral and Liverpool highlighting Kaizen Web's local service area."
                loading="lazy"
                decoding="async"
                width="514"
                height="363"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

