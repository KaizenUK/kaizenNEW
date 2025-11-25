import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Layout from "@/components/Layout";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
  const heroRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 35 });
  const [parallaxOffset, setParallaxOffset] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;

      const rect = heroRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      setMousePos({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      });
    };

    const handleScroll = () => {
      setParallaxOffset(window.scrollY * 0.5);
    };

    const hero = heroRef.current;
    if (hero) {
      hero.addEventListener("mousemove", handleMouseMove);
    }

    window.addEventListener("scroll", handleScroll);
    return () => {
      hero?.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const openChat = () => {
    if (typeof window !== "undefined" && (window as any).$crisp) {
      (window as any).$crisp.push(["do", "chat:open"]);
    }
  };

  return (
    <section
      ref={heroRef}
      className="relative min-h-[100vh] bg-gray-950 text-white flex items-center py-20 overflow-hidden"
    >
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
          <radialGradient
            id="glow-center"
            cx={`${mousePos.x}%`}
            cy={`${mousePos.y}%`}
          >
            <stop offset="0%" stopColor="rgba(0, 255, 255, 0.25)" />
            <stop offset="35%" stopColor="rgba(132, 204, 22, 0.08)" />
            <stop offset="100%" stopColor="rgba(0, 255, 255, 0)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
        <rect width="100%" height="100%" fill="url(#glow-center)" />
      </svg>

      <motion.div
        className="absolute top-1/4 right-20 w-80 h-80 bg-kaizen-cyan rounded-full blur-3xl opacity-10"
        style={{ willChange: "transform", y: parallaxOffset * 0.3 }}
        animate={{ y: [0, -40, 0], x: [0, 30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-kaizen-lime rounded-full blur-3xl opacity-8"
        style={{ willChange: "transform", y: parallaxOffset * 0.4 }}
        animate={{ y: [0, 40, 0], x: [0, -30, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan mb-6 uppercase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Product Owner-Led Web Design
          </motion.p>

          <motion.h1
            className="text-5xl md:text-7xl font-heading font-black mb-8 leading-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Web Design Liverpool &amp; Wirral: Stop Managing Your Own Build.
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-white/85 leading-relaxed mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Serving Merseyside businesses. We build high-performance websites with
            a dedicated Product Owner driving every decision. Fast timelines.
            Protected budgets. Zero fluff.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <button
              onClick={openChat}
              className="px-8 py-4 rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 text-gray-950 font-heading font-bold text-lg hover:shadow-2xl hover:shadow-green-500/60 hover:scale-105 transition-all inline-flex items-center justify-center gap-2 relative group"
            >
              <motion.div
                className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-300"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              Start a Project Chat
              <ArrowRight size={20} />
            </button>
            <button
              onClick={() => {
                const slider = document.getElementById("pricing-slider-section");
                slider?.scrollIntoView({ behaviour: "smooth" });
              }}
              className="px-8 py-4 rounded-lg border-2 border-white/30 text-white font-heading font-bold text-lg hover:border-kaizen-cyan hover:text-kaizen-cyan hover:shadow-lg hover:shadow-kaizen-cyan/30 transition-all inline-flex items-center justify-center gap-2"
            >
              See Our Pricing
              <ArrowUpRight size={20} />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const PricingSlider = () => {
  const [tier, setTier] = useState(2);

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

  const openChat = () => {
    if (typeof window !== "undefined" && (window as any).$crisp) {
      (window as any).$crisp.push(["do", "chat:open"]);
    }
  };

  return (
    <section
      id="pricing-slider-section"
      className="py-20 md:py-32 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/50 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-30 dark:opacity-10">
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-kaizen-cyan rounded-full blur-3xl opacity-10" />
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-kaizen-lime rounded-full blur-3xl opacity-10" />
      </div>

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
              className="w-full h-3 bg-gradient-to-r from-cyan-400 via-lime-400 to-cyan-400 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              style={{
                background: `linear-gradient(to right, rgb(34, 211, 238), rgb(132, 204, 22), rgb(34, 211, 238))`,
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
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
                            <span className="text-kaizen-cyan">✓</span> Ready-made
                            template
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Basic SEO
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
                            <span className="text-kaizen-cyan">✓</span> Lead capture
                            forms
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Analytics
                            setup
                          </li>
                        </>
                      )}
                      {tier === 2 && (
                        <>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> React/Headless
                            build
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> 96+ Lighthouse
                            score
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
                            <span className="text-kaizen-cyan">✓</span> Dedicated
                            Product Owner
                          </li>
                        </>
                      )}
                      {tier === 4 && (
                        <>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Full project
                            audit
                          </li>
                          <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-kaizen-cyan">✓</span> Recovery plan
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
                    onClick={
                      currentTier.cta.includes("Chat") ? openChat : undefined
                    }
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

      <motion.div
        className="absolute top-1/2 right-0 w-96 h-96 bg-kaizen-lime rounded-full blur-3xl opacity-5"
        animate={{ y: [0, 50, 0], x: [0, 20, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />

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
              Kaizen—continuous improvement—is about more than just an agile methodology.
              It's a mindset. Most agencies launch a website and vanish. We build systems
              that evolve. We embed ourselves in your process with a dedicated Product
              Owner who shields you from chaos, protects your budget, and ensures you ship
              on time.
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
                    We assign a dedicated senior professional to your project. Not an
                    account manager shuffling between clients. One person, hands-on, making
                    strategic decisions every day.
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
                    Two-week sprints. Clear deliverables. Predictable progress. We kill the
                    "scope creep monster" and replace it with transparent planning and
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
                    We benchmark performance from day one. Lighthouse scores. Core Web Vitals.
                    Conversion funnels. You'll see concrete data, not marketing fluff.
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
      <div className="absolute inset-0 opacity-20 dark:opacity-10">
        <motion.div
          className="absolute top-20 right-1/4 w-96 h-96 bg-kaizen-lime rounded-full blur-3xl"
          animate={{ y: [0, 50, 0], x: [0, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

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
              architecture, and the Senior Product Owner steering the ship—not
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
                  Manual coding. Junior developers. Long timelines. Scope creep. Surprise costs.
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
                  AI-augmented development. Strategic thinking. Two-week sprints. Predictable costs.
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
      <motion.div
        className="absolute top-1/4 left-1/4 w-80 h-80 bg-kaizen-cyan rounded-full blur-3xl opacity-8"
        animate={{ y: [0, -40, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

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
                animate={{ strokeDashoffset: 565.48 * (1 - fillPercent / 100) }}
                transition={{ duration: 2, ease: "easeOut" }}
                strokeLinecap="round"
              />

              <motion.circle
                cx="100"
                cy="100"
                r="90"
                fill="url(#shimmer)"
                opacity="0.3"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
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
              We don't guess. We benchmark. Every build is tested against industry
              standards.
            </p>
            <a
              href="https://gtmetrix.com/reports/www.kaizenweb.co.uk/e2VJJsxv/"
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
  const liverpoollCoords = [53.4084, -2.9916];
  const wirralCoords = [53.375, -3.0425];

  const customIcon = L.icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-cyan.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const wirralIcon = L.icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-lime.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  return (
    <section className="py-20 md:py-32 bg-gray-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-kaizen-cyan rounded-full blur-3xl"
          animate={{ y: [0, 40, 0], x: [0, 30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative h-96 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl"
          >
            <MapContainer
              center={[53.391, -3.017]}
              zoom={9}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              <Marker position={liverpoollCoords} icon={customIcon}>
                <Popup>Liverpool • Merseyside</Popup>
              </Marker>
              <Marker position={wirralCoords} icon={wirralIcon}>
                <Popup>Wirral • Merseyside</Popup>
              </Marker>
            </MapContainer>
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
              Kaizen is based in Liverpool city centre. We serve businesses across
              Liverpool, Wirral, and Merseyside. We understand how locals search,
              what they need, and how to get them found.
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
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).$crisp) {
                  (window as any).$crisp.push(["do", "chat:open"]);
                }
              }}
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
      <PricingSlider />
      <KaizenPhilosophy />
      <AIValueProp />
      <PerformanceBadge />
      <LocalMap />
    </Layout>
  );
}
