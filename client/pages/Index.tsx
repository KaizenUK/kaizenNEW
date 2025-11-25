import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import Layout from "@/components/Layout";

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

// Hero Section with new headline and CTA
const HeroSection = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 35 });

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

    const hero = heroRef.current;
    if (hero) {
      hero.addEventListener("mousemove", handleMouseMove);
      return () => hero.removeEventListener("mousemove", handleMouseMove);
    }
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
      {/* SVG Grid Background */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
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
              stroke="rgba(0, 255, 255, 0.1)"
              strokeWidth="0.5"
            />
          </pattern>
          <radialGradient
            id="glow-center"
            cx={`${mousePos.x}%`}
            cy={`${mousePos.y}%`}
          >
            <stop offset="0%" stopColor="rgba(0, 255, 255, 0.3)" />
            <stop offset="35%" stopColor="rgba(132, 204, 22, 0.12)" />
            <stop offset="100%" stopColor="rgba(0, 255, 255, 0)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
        <rect width="100%" height="100%" fill="url(#glow-center)" />
      </svg>

      {/* Animated glow orbs */}
      <motion.div
        className="absolute top-1/4 right-20 w-80 h-80 bg-kaizen-cyan rounded-full blur-3xl opacity-15"
        style={{ willChange: "transform" }}
        animate={{ y: [0, -40, 0], x: [0, 30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-kaizen-lime rounded-full blur-3xl opacity-10"
        style={{ willChange: "transform" }}
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
            Web Design Liverpool: Stop Managing Your Own Build.
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-white/85 leading-relaxed mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Most projects fail because they lack leadership. We provide a
            dedicated Product Owner to drive your build, protect your budget,
            and ship on time. No account managers. No fluff.
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
              Estimate Your Cost
              <ArrowUpRight size={20} />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// Kaizen Philosophy Section
const KaizenPhilosophy = () => {
  return (
    <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
              Our Philosophy
            </p>
            <h2 className="text-5xl md:text-6xl font-heading font-black mb-6 text-gray-950 dark:text-white">
              What is Kaizen?
            </h2>
            <p className="text-2xl font-light text-gray-600 dark:text-gray-300 mb-8">
              Japanese (n): Continuous Improvement.
            </p>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-200 leading-relaxed">
              Most agencies 'launch and leave.' We build systems that evolve. By
              using Agile sprints, we improve your product every two weeks. We
              don't just build websites; we build assets.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// Interactive Pricing Slider
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
      className="py-20 md:py-32 bg-slate-50 dark:bg-slate-900/50"
    >
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
            Pricing That Scales
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-950 dark:text-white">
            The Interactive Pricing Slider
          </h2>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {/* Slider */}
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

          {/* Tier Card */}
          <motion.div
            key={tier}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-3xl font-heading font-bold text-gray-950 dark:text-white mb-2">
                  {currentTier.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {currentTier.description}
                </p>
                <div className="text-4xl font-heading font-black text-kaizen-cyan mb-4">
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
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// AI Efficiency Value Prop
const AIValueProp = () => {
  return (
    <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
              Modern Tech. Old-School Standards.
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-950 dark:text-white mb-6">
              We Leverage AI to Lower Your Cost
            </h2>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
              We use advanced AI to handle the boilerplate coding. This lowers
              your cost. You pay for high-level strategy, architecture, and the
              Senior Product Owner who manages it all—not for junior devs typing
              HTML.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/50"
            >
              <h3 className="text-2xl font-heading font-bold text-red-600 dark:text-red-400 mb-4">
                Traditional Agency
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                Manual coding. Junior developers. Long timelines.
              </p>
              <p className="font-heading font-bold text-red-600 dark:text-red-400 text-lg">
                Cost: $$$
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="p-8 bg-green-50 dark:bg-green-950/20 rounded-2xl border border-green-200 dark:border-green-900/50"
            >
              <h3 className="text-2xl font-heading font-bold text-green-600 dark:text-green-400 mb-4">
                Kaizen
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                AI-augmented development. Strategic thinking. Speed + Value.
              </p>
              <p className="font-heading font-bold text-green-600 dark:text-green-400 text-lg">
                Cost: Better ROI
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Animated Performance Badge
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
    <section className="py-20 md:py-32 bg-slate-50 dark:bg-slate-900/50">
      <div className="container mx-auto px-4">
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
            {/* SVG circular badge */}
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

              {/* Background circle */}
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />

              {/* Fill circle */}
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

              {/* Shimmer effect */}
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

              {/* Center text */}
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

          {/* Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-4 text-center mb-12"
          >
            <div className="p-4 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">LCP</p>
              <p className="text-2xl font-heading font-bold text-gray-950 dark:text-white">
                0.8s
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">TBT</p>
              <p className="text-2xl font-heading font-bold text-gray-950 dark:text-white">
                0ms
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">CLS</p>
              <p className="text-2xl font-heading font-bold text-gray-950 dark:text-white">
                0.01
              </p>
            </div>
          </motion.div>

          <div className="text-center">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We don't guess. We benchmark. See our actual GTMetrix report.
            </p>
            <a
              href="https://gtmetrix.com/reports/www.kaizenweb.co.uk/e2VJJsxv/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-kaizen-cyan text-kaizen-cyan font-heading font-bold hover:bg-kaizen-cyan/10 transition"
            >
              View Full Report
              <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

// Local Authority Map
const LocalMap = () => {
  return (
    <section className="py-20 md:py-32 bg-slate-950 text-white relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Map */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative h-96 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800"
          >
            <svg
              className="w-full h-full"
              viewBox="0 0 400 400"
              preserveAspectRatio="xMidYMid slice"
            >
              {/* Simple map background */}
              <defs>
                <linearGradient
                  id="map-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>
              <rect width="400" height="400" fill="url(#map-grad)" />

              {/* Liverpool pin */}
              <motion.g
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <circle
                  cx="140"
                  cy="180"
                  r="12"
                  fill="#06b6d4"
                  opacity="0.8"
                />
                <circle cx="140" cy="180" r="6" fill="#06b6d4" />
              </motion.g>

              {/* Wirral pin */}
              <motion.g
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              >
                <circle
                  cx="110"
                  cy="140"
                  r="12"
                  fill="#84cc16"
                  opacity="0.8"
                />
                <circle cx="110" cy="140" r="6" fill="#84cc16" />
              </motion.g>

              {/* Text labels */}
              <text x="140" y="220" textAnchor="middle" fill="#06b6d4" fontSize="12">
                Liverpool
              </text>
              <text x="110" y="100" textAnchor="middle" fill="#84cc16" fontSize="12">
                Wirral
              </text>
            </svg>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
              Local Authority
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
              Made Local, For Local.
            </h2>
            <p className="text-lg text-white/80 mb-8 leading-relaxed">
              Kaizen is based in Liverpool city centre. We understand how locals
              search and what local businesses actually need. We're always happy
              to meet for a quick video call or a coffee in town.
            </p>

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
      <KaizenPhilosophy />
      <PricingSlider />
      <AIValueProp />
      <PerformanceBadge />
      <LocalMap />
    </Layout>
  );
}
