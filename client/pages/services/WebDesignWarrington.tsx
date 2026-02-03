import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Zap,
  Users,
  BarChart3,
  X,
  Check,
  Star,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { FaqSection } from "@/components/FaqSection";
import { Speedometer } from "@/components/Speedometer";
import SpeedScanner from "@/components/SpeedScanner";
import { openCrisp } from "@/lib/crisp-utils";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
};

const comparisonFeatures = [
  {
    feature: "Time to Load",
    typical: "5–8 seconds (slow)",
    kaizen: "1.2 seconds (instant)",
    highlight: true,
  },
  {
    feature: "Reliability.",
    typical: "Generic Template",
    kaizen: "Unbreakable Custom Code",
    highlight: true,
  },
  {
    feature: "Built for Google",
    typical: "Hope for the best",
    kaizen: "Built to rank locally",
    highlight: true,
  },
  {
    feature: "Ownership",
    typical: "Locked In / Leased",
    kaizen: "100% Yours",
    highlight: true,
  },
  {
    feature: "Post-Launch Support",
    typical: "Ghosted",
    kaizen: "30 Day Snagging & Support",
    highlight: true,
  },
];

const getColorClass = (color: string) => {
  switch (color) {
    case "cyan":
      return "text-cyan-400";
    case "sky":
      return "text-sky-400";
    case "lime":
      return "text-lime-400";
    default:
      return "text-cyan-400";
  }
};

const getBgClass = (color: string) => {
  switch (color) {
    case "cyan":
      return "bg-cyan-500/5";
    case "sky":
      return "bg-sky-500/5";
    case "lime":
      return "bg-lime-500/5";
    default:
      return "bg-cyan-500/5";
  }
};

function WarringtonDataBackground() {
  const rows = [40, 90, 140, 190, 240, 290, 340];

  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-30 mix-blend-screen"
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="warrington-lines" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {rows.map((y, idx) => (
        <motion.path
          key={y}
          d={`M 40 ${y} C 200 ${y - 40}, 360 ${y + 20}, 520 ${y - 30} S 760 ${
            y + 10
          }, 840 ${y - 20}`}
          fill="none"
          stroke="url(#warrington-lines)"
          strokeWidth={idx % 2 === 0 ? 1.4 : 0.8}
          strokeDasharray={idx % 3 === 0 ? "4 8" : "1 10"}
          initial={{ strokeDashoffset: 0, opacity: 0.18 }}
          animate={{
            strokeDashoffset: idx % 2 === 0 ? [-60, 0] : [0, -60],
            opacity: [0.18, 0.32, 0.18],
          }}
          transition={{
            duration: 10 + idx * 0.8,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}

      {[
        { cx: 260, cy: 150, color: "#22d3ee" },
        { cx: 420, cy: 210, color: "#06b6d4" },
        { cx: 560, cy: 130, color: "#38bdf8" },
        { cx: 640, cy: 260, color: "#22d3ee" },
      ].map((dot, i) => (
        <motion.circle
          key={i}
          cx={dot.cx}
          cy={dot.cy}
          r="3"
          fill={dot.color}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: [0.4, 0.95, 0.4] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </svg>
  );
}

function NetworkAnimation() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getBoxStyle = (stepIndex: number) => {
    const isActive = activeStep === stepIndex;
    return isActive
      ? "stroke-cyan-400 dark:stroke-cyan-300 stroke-[3px] filter drop-shadow-lg transition-all duration-300"
      : "stroke-slate-300 dark:stroke-slate-700 stroke-1 transition-all duration-300";
  };

  const getTextStyle = (stepIndex: number) => {
    const isActive = activeStep === stepIndex;
    return isActive
      ? "fill-cyan-600 dark:fill-cyan-300 font-bold transition-all duration-300"
      : "fill-slate-400 dark:fill-slate-500 font-normal transition-all duration-300";
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <svg
        className="w-full h-auto"
        viewBox="0 0 300 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Step 0: Your Goals */}
        <rect
          x="20"
          y="20"
          width="260"
          height="60"
          rx="4"
          className={`${getBoxStyle(0)} fill-white dark:fill-slate-900`}
        />
        <text
          x="150"
          y="55"
          textAnchor="middle"
          className={`text-xs font-mono ${getTextStyle(0)}`}
        >
          Your Goals
        </text>

        {/* Arrow 1 */}
        <motion.path
          d="M 150 80 L 150 110"
          stroke="currentColor"
          strokeWidth="2"
          className={activeStep >= 0 ? "text-cyan-400" : "text-slate-200"}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: activeStep >= 0 ? 1 : 0 }}
        />

        {/* Step 1: Build & Step 2: Speed */}
        <g>
          <rect
            x="20"
            y="110"
            width="120"
            height="80"
            rx="4"
            className={`${getBoxStyle(1)} fill-white dark:fill-slate-900`}
          />
          <text
            x="80"
            y="155"
            textAnchor="middle"
            className={`text-xs font-mono ${getTextStyle(1)}`}
          >
            Build
          </text>

          <rect
            x="160"
            y="110"
            width="120"
            height="80"
            rx="4"
            className={`${getBoxStyle(2)} fill-white dark:fill-slate-900`}
          />
          <text
            x="220"
            y="155"
            textAnchor="middle"
            className={`text-xs font-mono ${getTextStyle(2)}`}
          >
            Speed
          </text>
        </g>

        {/* Arrows 2 */}
        <motion.path
          d="M 80 190 L 80 220"
          stroke="currentColor"
          strokeWidth="2"
          className={activeStep >= 1 ? "text-cyan-400" : "text-slate-200"}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: activeStep >= 1 ? 1 : 0 }}
        />
        <motion.path
          d="M 220 190 L 220 220"
          stroke="currentColor"
          strokeWidth="2"
          className={activeStep >= 2 ? "text-cyan-400" : "text-slate-200"}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: activeStep >= 2 ? 1 : 0 }}
        />

        {/* Step 3: Trust & Security */}
        <rect
          x="20"
          y="220"
          width="260"
          height="60"
          rx="4"
          className={`${getBoxStyle(3)} fill-white dark:fill-slate-900`}
        />
        <text
          x="150"
          y="255"
          textAnchor="middle"
          className={`text-xs font-mono ${getTextStyle(3)}`}
        >
          Trust & Security
        </text>

        {/* Decorative dots */}
        <circle cx="290" cy="40" r="4" className="fill-cyan-400/50" />
        <circle cx="10" cy="300" r="4" className="fill-sky-400/50" />
      </svg>

      <div className="absolute bottom-10 left-0 right-0 text-center">
        <p className="text-xs font-mono uppercase tracking-widest text-slate-400 dark:text-slate-400">
          <AnimatePresence mode="wait">
            <motion.span
              key={activeStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="block font-bold text-cyan-500"
            >
              {activeStep === 0 && "Understanding your business"}
              {activeStep === 1 && "Building it properly"}
              {activeStep === 2 && "Making it fast"}
              {activeStep === 3 && "Keeping it secure"}
            </motion.span>
          </AnimatePresence>
        </p>
      </div>
    </div>
  );
}

export default function WebDesignWarrington() {
  const [showMobileComparison, setShowMobileComparison] = useState(false);

  return (
    <Layout>
      <Helmet>
        <title>Warrington’s High-Performance Web Agency | Kaizen</title>
        <meta
          name="description"
          content="Fast, professional websites for Warrington businesses who want to lead their market. No templates, no jargon—just results."
        />
        <meta
          name="og:title"
          content="Warrington’s High-Performance Web Agency | Kaizen"
        />
        <meta
          name="og:description"
          content="Fast, professional websites for Warrington businesses who want to lead their market. No templates, no jargon—just results."
        />
        <meta name="og:type" content="website" />
        <link
          rel="canonical"
          href="https://kaizenweb.dev/web-design-warrington"
        />
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white py-24 lg:py-32 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950" />
        <WarringtonDataBackground />

        <div className="relative container mx-auto max-w-6xl">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeInUp} className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-800/50 text-cyan-300 text-xs font-mono uppercase tracking-wider mb-6">
                <Briefcase className="w-3 h-3" />
                <span>Web Design Warrington</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black leading-[1.1] mb-6 tracking-tight">
                Web Design Warrington.
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-200">
                  Built for scale.
                </span>
              </h1>

              <p className="text-xl text-slate-300 max-w-xl mb-8 leading-relaxed">
                High-performance websites and portals for Warrington&apos;s logistics,
                engineering, and tech teams. Fast on mobile, solid under load,
                and built to stay reliable.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <button
                  onClick={() => openCrisp()}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-cyan-500 text-white font-heading font-bold hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all duration-300 transform hover:-translate-y-1"
                >
                  Start A Chat
                  <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="relative perspective-1000"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-sky-500/20 rounded-[2rem] blur-2xl opacity-50" />
              <div className="relative bg-slate-900/90 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform rotate-y-12 rotate-x-6 transition-transform duration-500 hover:rotate-0">
                {/* 3D Layer Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none" />

                <div className="grid grid-cols-2 gap-4 relative z-10">
                  <div className="col-span-2 bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 shadow-inner">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 w-3/4 bg-slate-700 rounded animate-pulse" />
                      <div className="h-2 w-1/2 bg-slate-700 rounded animate-pulse delay-75" />
                    </div>
                  </div>
                  <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 flex flex-col items-center justify-center shadow-lg">
                    <div className="text-4xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                      96
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-1">
                      Performance
                    </div>
                  </div>
                  <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 flex flex-col items-center justify-center shadow-lg">
                    <div className="text-4xl font-black text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]">
                      99
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-1">
                      Security
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <p className="text-sm text-slate-400 text-center font-mono">
                    "Fast websites. Solid systems. Clear visibility."
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Speed Scanner - The "Fear" Section */}
      <section className="py-24 px-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white mb-4">
              Is Google Hiding You?
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Google hates slow websites. If your site is slow, they bury you on
              Page 2 or worse—where nobody looks. You could be paying for SEO or
              Ads, but if your site fails this test, you are sending customers
              straight to your competitors. Are you invisible?
            </p>
          </div>

          <div id="live-performance-scanner">
            <SpeedScanner />
          </div>
        </div>
      </section>

      {/* Why Warrington Businesses Choose Us */}
      <section className="py-24 px-4 bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white mb-4">
              Why Warrington Businesses Choose Us
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Engineering-grade build quality — explained in plain English.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: "Local & Accountable:",
                desc: "We are right here in the City Region. No offshoring, no hiding behind emails. You get direct access to your developer.",
              },
              {
                icon: Zap,
                title: "Built for Google:",
                desc: "We don't just make it look good. We build it to rank high and load fast on mobile.",
              },
              {
                icon: BarChart3,
                title: "Asset, Not Expense:",
                desc: "A cheap website costs you lost customers. Our sites are built to pay for themselves.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-3xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] transition-all duration-300 group border border-slate-100 dark:border-slate-700"
              >
                <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                  <item.icon size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  {item.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Local Authority Section - Serving the City Region */}
      <section className="py-24 px-4 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />

        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <span className="text-cyan-400 font-mono text-sm tracking-widest uppercase">
              City Region Expertise
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mt-4 mb-6">
              Powering the North West's Hub.
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Warrington is the engine room of the North West. Whether you are in
              logistics at Omega or engineering at Birchwood, you need systems
              that work. We build robust, high-performance websites and portals
              that handle data as well as they handle traffic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                area: "Omega & Winwick",
                title: "Logistics at Scale",
                desc: "Portals and websites that keep clients informed — tracking, updates, documents, and real-time visibility without the bloat.",
                color: "cyan",
              },
              {
                area: "Birchwood Park",
                title: "Engineering & Nuclear Tech",
                desc: "Secure, reliable builds for regulated industries — clear information architecture, fast performance, and hardened delivery.",
                color: "sky",
              },
              {
                area: "Warrington + North West",
                title: "High-Volume B2B",
                desc: "From complex service lines to multi-site operations — we build systems that scale with teams, data, and demand.",
                color: "lime",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`group relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-8 hover:border-slate-700 transition-colors ${getBgClass(item.color)}`}
              >
                <div
                  className={`absolute top-0 right-0 w-32 h-32 bg-${item.color}-500/5 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100`}
                />

                <p
                  className={`text-xs font-mono uppercase tracking-widest mb-4 ${getColorClass(item.color)}`}
                >
                  {item.area}
                </p>
                <h3 className="text-xl font-bold text-white mb-3">
                  {item.title}
                </h3>
                <p className="text-slate-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 px-4 bg-white dark:bg-slate-950 border-y border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Services
              </div>

              <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white mb-6">
                What we build for Warrington businesses
              </h2>

              <div className="prose prose-lg dark:prose-invert mb-8">
                <p className="text-slate-600 dark:text-slate-300">
                  We work with Warrington&apos;s industrial and tech sectors — from
                  logistics giants to specialised engineering firms — building
                  digital tools that improve efficiency and visibility.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-8">
                {[
                  {
                    title: "High-Impact Websites.",
                    desc: "For industrial and tech firms that need to look credible to decision-makers. Clear messaging, fast load times, and built to convert.",
                  },
                  {
                    title: "Fixing Broken Projects.",
                    desc: "Stalled portal? Slow site? We stabilise what you&apos;ve got, ship fixes quickly, and bring projects back under control.",
                  },
                  {
                    title: "Custom Booking & Systems.",
                    desc: "Client portals, document hubs, dashboards, and internal tools — secure, maintainable, and designed around your workflow.",
                  },
                ].map((service) => (
                  <div
                    key={service.title}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-5"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        className="text-cyan-500 flex-shrink-0 mt-1"
                        size={20}
                      />
                      <div>
                        <h3 className="font-heading font-bold text-slate-900 dark:text-white">
                          {service.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {service.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => openCrisp()}
                className="inline-flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold hover:gap-3 transition-all"
              >
                Start a chat
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-100 dark:border-slate-700 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-sky-500/10 rounded-full blur-xl" />

                <h3 className="text-sm font-mono uppercase tracking-widest text-slate-400 text-center mb-8">
                  How we deliver
                </h3>

                <NetworkAnimation />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-24 px-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white mb-4">
              Typical Warrington Web Designer vs Kaizen
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              See exactly what you get (and what you don't).
            </p>
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden mb-8">
            <button
              type="button"
              onClick={() => setShowMobileComparison(true)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900 text-white font-bold border border-slate-800 shadow-lg"
            >
              <span>Click to see the difference</span>
              <ArrowRight size={18} />
            </button>

            <AnimatePresence>
              {showMobileComparison && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
                  onClick={() => setShowMobileComparison(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0">
                      <h3 className="font-bold text-white">Comparison</h3>
                      <button
                        onClick={() => setShowMobileComparison(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <XCircle size={24} />
                      </button>
                    </div>
                    <div className="overflow-y-auto p-0">
                      <div className="grid grid-cols-3 bg-slate-950 p-3 text-[10px] font-mono uppercase tracking-widest text-slate-400 sticky top-0 z-10 border-b border-slate-800">
                        <div>Feature</div>
                        <div className="text-red-400 text-center">Typical</div>
                        <div className="text-emerald-500 font-bold text-center">
                          Kaizen
                        </div>
                      </div>
                      <div className="divide-y divide-slate-800">
                        {comparisonFeatures.map((row, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-3 hover:bg-slate-800/30 transition-colors"
                          >
                            <div className="p-3 border-r border-slate-800 flex items-center">
                              <div className="text-xs font-medium text-slate-300">
                                {row.feature}
                              </div>
                            </div>
                            <div className="p-3 border-r border-slate-800 flex flex-col items-center justify-center gap-1 text-center">
                              <X size={14} className="text-red-500" />
                              <div className="text-slate-400 text-[10px] leading-tight">
                                {row.typical}
                              </div>
                            </div>
                            <div className="p-3 bg-emerald-900/10 flex flex-col items-center justify-center gap-1 text-center relative overflow-hidden">
                              <div className="absolute inset-0 bg-emerald-500/5" />
                              <Check
                                size={14}
                                className="text-emerald-400 relative z-10"
                              />
                              <div className="text-emerald-100 font-bold text-[10px] leading-tight relative z-10">
                                {row.kaizen}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <div className="p-6 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 flex items-center">
                Feature
              </div>
              <div className="p-6 text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 flex items-center justify-center text-center border-l border-slate-200 dark:border-slate-800">
                Typical Designer
              </div>
              <div className="p-6 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 flex items-center justify-center text-center bg-emerald-100/50 dark:bg-emerald-900/20 border-l border-emerald-200 dark:border-emerald-900/30">
                <div className="flex items-center gap-2">
                  <Star size={14} className="fill-current" />
                  Kaizen Approach
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {comparisonFeatures.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                >
                  <div className="p-4 border-r border-slate-200 dark:border-slate-800 flex items-center">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {row.feature}
                    </div>
                  </div>
                  <div className="p-4 border-r border-slate-200 dark:border-slate-800 flex items-center gap-3">
                    <X size={18} className="text-red-500 flex-shrink-0" />
                    <div className="text-slate-600 dark:text-slate-400 text-sm">
                      {row.typical}
                    </div>
                  </div>
                  <div className="p-4 bg-emerald-50/30 dark:bg-emerald-900/5 relative overflow-hidden flex items-center gap-3 border-l border-emerald-200 dark:border-emerald-900/30">
                    <div className="absolute inset-0 bg-emerald-100/20 dark:bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                        <Check
                          size={14}
                          className="text-emerald-600 dark:text-emerald-400"
                        />
                      </div>
                      <div className="text-emerald-800 dark:text-emerald-100 font-bold text-sm">
                        {row.kaizen}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Speed Visualiser Section */}
      <section className="py-24 px-4 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-900/30 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-6">
              <Zap size={14} />
              <span>Performance</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              Websites that load instantly
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Your Warrington business deserves world-class performance. We
              deliver it.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center lg:justify-end">
              <Speedometer />
            </div>
            <div className="text-center lg:text-left">
              <h3 className="text-2xl font-bold text-white mb-4">
                Built for real customers (and Google)
              </h3>
              <p className="text-slate-400 mb-6 leading-relaxed">
                We build for speed on mobile because that’s what customers (and
                Google) care about. The result: quicker load times, better user
                experience, and more enquiries.
              </p>
              <p className="text-slate-400 mb-6 leading-relaxed">
                No buzzwords. Just a clean build, a clear message, and a site
                that performs.
              </p>
              <a
                href="https://developers.google.com/search/docs/appearance/core-web-vitals"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
              >
                Learn about Core Web Vitals
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <div className="relative bg-slate-50 dark:bg-slate-900 py-12">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-100/50 dark:to-slate-900/50 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-950/50 backdrop-blur-sm rounded-3xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 shadow-2xl">
            <FaqSection
              heading="Warrington Web Design FAQs"
              eyebrow="Common Questions"
              className="bg-transparent py-0 md:py-0"
              items={[
                {
                  question: "Why choose a Warrington agency?",
                  answer:
                    "Because we understand scale. Warrington is home to logistics, nuclear, and high-tech engineering. We don&apos;t just build pretty brochures; we build critical systems that keep your operations visible and your clients informed.",
                },
                {
                  question: "Can you build portals for logistics/supply chain?",
                  answer:
                    "Yes. We specialise in data-heavy platforms. If you need a client portal to track orders, manage documents, or visualise data, we can build it securely using React.",
                },
                {
                  question: "Do you work with WordPress?",
                  answer:
                    "Yes — and it can be fine for some sites. But if speed, reliability, and rankings matter, we often recommend a custom-built site instead of a heavy template. If your current WordPress site is slow or broken, we can fix it or rebuild it properly.",
                },
                {
                  question:
                    "Do you work with logistics, engineering, and professional services?",
                  answer:
                    "Yes. We build for operations-led teams who need a site that&apos;s fast, clear, and trustworthy — and when needed, we can extend it into portals and internal tools.",
                },
                {
                  question: "What about ongoing support?",
                  answer:
                    "We provide 30-day post-launch snagging, and we offer retainer-based support packages for SMEs and professional services. We are happy to meet at your Warrington office to discuss ongoing technical needs.",
                },
                {
                  question: "Can you connect it to our existing systems?",
                  answer:
                    "Yes. If you need your site or portal to pull data from existing tools (orders, documents, reporting), we can integrate it safely. We&apos;ll keep it simple and only add complexity where it genuinely improves efficiency.",
                },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <section className="bg-slate-950 text-white py-24 px-4 border-t border-slate-800">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-900/30 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            Ready when you are
          </div>

          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
            Ready for a website that actually wins work?
          </h2>

          <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
            Whether you&apos;re moving goods at scale, engineering complex products,
            or running a multi-site operation — we build websites and portals
            that stay fast, clear, and reliable.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <button
              onClick={() => openCrisp()}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-cyan-500 text-white font-heading font-bold hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all duration-300 transform hover:-translate-y-1"
            >
              Start a chat
              <ArrowRight size={18} />
            </button>

            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-slate-700 text-slate-300 font-heading font-medium hover:bg-slate-800 hover:text-white transition-all duration-300"
            >
              Book Discovery Call
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
