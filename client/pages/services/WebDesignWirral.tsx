import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Map, CheckCircle2, Zap, Users, BarChart3, X, Check, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useCalendly } from "@/context/CalendlyContext";
import { FaqSection } from "@/components/FaqSection";
import { TypewriterEffect } from "@/components/TypewriterEffect";
import { WirralTicker } from "@/components/WirralTicker";
import { Speedometer } from "@/components/Speedometer";
import { openCrisp } from "@/lib/crisp-utils";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
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
    feature: "Mobile Load Speed",
    typical: "5-8 seconds (Slow)",
    kaizen: "1.2 seconds (Instant)",
    highlight: true,
  },
  {
    feature: "Technology Stack",
    typical: "Bloated WordPress Theme",
    kaizen: "Custom React + Headless",
    highlight: true,
  },
  {
    feature: "Local SEO Strategy",
    typical: "Generic / None",
    kaizen: "Wirral-Specific Schema",
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
    kaizen: "Quarterly Growth Sprints",
    highlight: true,
  },
];

function WirralTopoBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-30 mix-blend-screen"
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wirral-lines" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#22c55e" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {[40, 90, 140, 190, 240, 290, 340].map((y, idx) => (
        <path
          key={y}
          d={`M 40 ${y} C 200 ${y - 40}, 360 ${y + 20}, 520 ${y - 30} S 760 ${
            y + 10
          }, 840 ${y - 20}`}
          fill="none"
          stroke="url(#wirral-lines)"
          strokeWidth={idx % 2 === 0 ? 1.4 : 0.8}
          strokeDasharray={idx % 3 === 0 ? "4 8" : "1 10"}
        />
      ))}

      <circle cx="260" cy="150" r="3" fill="#22d3ee" opacity="0.9" />
      <circle cx="420" cy="210" r="3" fill="#22c55e" opacity="0.9" />
      <circle cx="560" cy="130" r="3" fill="#38bdf8" opacity="0.9" />
    </svg>
  );
}

function BlueprintAnimation() {
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
        {/* Step 0: Hero */}
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
          Hero: "Book Now"
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

        {/* Step 1: Services & Booking */}
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
            Services
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
            Booking
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

        {/* Step 3: Contact */}
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
          Contact & Trust
        </text>

        {/* Decorative dots */}
        <circle cx="290" cy="40" r="4" className="fill-cyan-400/50" />
        <circle cx="10" cy="300" r="4" className="fill-lime-400/50" />
      </svg>
      
      <div className="absolute bottom-10 left-0 right-0 text-center">
        <p className="text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">
          <AnimatePresence mode="wait">
            <motion.span
              key={activeStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="block font-bold text-cyan-500"
            >
              {activeStep === 0 && "Capturing Attention"}
              {activeStep === 1 && "Guiding Interest"}
              {activeStep === 2 && "Securing Commitment"}
              {activeStep === 3 && "Building Trust"}
            </motion.span>
          </AnimatePresence>
        </p>
      </div>
    </div>
  );
}

export default function WebDesignWirral() {
  const { openCalendly } = useCalendly();
  const [showMobileComparison, setShowMobileComparison] = useState(false);

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white py-24 lg:py-32 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950" />
        <WirralTopoBackground />

        <div className="relative container mx-auto max-w-6xl">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeInUp} className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-800/50 text-cyan-300 text-xs font-mono uppercase tracking-wider mb-6">
                <Map className="w-3 h-3" />
                <span>Web Design Wirral</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black leading-[1.1] mb-6 tracking-tight">
                Bespoke Web Design <br />
                <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-lime-400 bg-clip-text text-transparent">
                  <TypewriterEffect
                    words={[
                      "Fast.",
                      "Secure.",
                      "Profitable.",
                    ]}
                    speed={80}
                    delayBetweenWords={1600}
                    className="inline-block"
                  />
                </span>
              </h1>

              <p className="text-xl text-slate-300 max-w-xl mb-8 leading-relaxed">
                Don't settle for slow templates. We build high-performance, bespoke websites for Wirral businesses that rank, convert, and scale.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={openCalendly}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-cyan-500 text-white font-heading font-bold hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all duration-300 transform hover:-translate-y-1"
                >
                  Book a Demo
                  <ArrowRight size={18} />
                </button>

                <a
                  href="https://kaizenweb.co.uk/blog/bespoke-web-design-vs-templates-wirral"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-slate-700 bg-slate-900/50 text-slate-300 font-heading font-medium hover:bg-slate-800 hover:text-white transition-all duration-300 backdrop-blur-sm"
                >
                  Read the Case Study
                </a>
              </div>
            </motion.div>

            <motion.div variants={fadeInUp} className="relative perspective-1000">
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-lime-500/20 rounded-[2rem] blur-2xl opacity-50" />
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
                    <div className="text-4xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">96</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-1">Performance</div>
                  </div>
                  <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 flex flex-col items-center justify-center shadow-lg">
                    <div className="text-4xl font-black text-lime-400 drop-shadow-[0_0_10px_rgba(163,230,53,0.3)]">99</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-1">SEO</div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <p className="text-sm text-slate-400 text-center font-mono">
                    "Kaizen rebuilt our site and enquiries doubled in 30 days."
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Scrolling Ticker */}
      <WirralTicker />

      {/* Why Wirral Businesses Choose Us */}
      <section className="py-24 px-4 bg-white dark:bg-slate-950">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white mb-4">
              Why Wirral Businesses Choose Us
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              We're not just another remote agency. We're your neighbours, and we understand the local market.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Map,
                title: "Local Understanding",
                desc: "We know the difference between West Kirby footfall and Birkenhead trade counters.",
              },
              {
                icon: Users,
                title: "Face-to-Face",
                desc: "We're happy to meet you at your office or a local coffee shop to discuss your goals.",
              },
              {
                icon: Zap,
                title: "No Jargon",
                desc: "We speak plain English. No confusing tech-talk, just clear business strategy.",
              },
              {
                icon: BarChart3,
                title: "Results Focused",
                desc: "We care about ROI. If the site doesn't make money, we haven't done our job.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-3xl bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] transition-all duration-300 group border border-slate-100 dark:border-slate-800"
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

      {/* Helen Moore Blueprint Section */}
      <section className="py-24 px-4 bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                Work in Progress
              </div>
              
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white mb-6">
                Trusted by Wirral Businesses
              </h2>
              
              <div className="prose prose-lg dark:prose-invert mb-8">
                <p className="text-slate-600 dark:text-slate-300">
                  We are currently rebuilding <strong>Helen Moore Hairdressing</strong> (Wallasey) from the ground up. The old site was invisible to Google and hard for clients to use on mobile.
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  <strong>The Fix:</strong> Re-architecting the business logic to create a friction-free path from Instagram to Appointment.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {[
                  "Mobile-First Booking Strategy",
                  "Local SEO Engine for 'Hairdresser Wallasey'",
                  "Zero-Bloat Custom Build"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="text-cyan-500 flex-shrink-0" size={20} />
                    <span className="text-slate-700 dark:text-slate-200 font-medium">{item}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => openCrisp()}
                className="inline-flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold hover:gap-3 transition-all"
              >
                See the blueprints
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-100 dark:border-slate-700 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-lime-500/10 rounded-full blur-xl" />
                
                <h3 className="text-sm font-mono uppercase tracking-widest text-slate-400 text-center mb-8">
                  Site Architecture v2.0
                </h3>
                
                <BlueprintAnimation />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Context Section - About Different Client Types */}
      <section className="py-24 px-4 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <span className="text-cyan-400 font-mono text-sm tracking-widest uppercase">One Peninsula, Many Journeys</span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mt-4 mb-6">
              Wirral businesses are not one-size-fits-all.
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              We design funnels around how people actually find and book you – from high street footfall to late‑night mobile searches.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                area: "Downtown Birkenhead",
                title: "Office towers & trade counters",
                desc: "Fast-loading, trust-heavy brochure sites that make you look credible from the first click.",
                color: "cyan"
              },
              {
                area: "Coastal Towns",
                title: "Hoylake, West Kirby & New Brighton",
                desc: "Experience-led sites that move people from Instagram and Google Maps into bookings.",
                color: "sky"
              },
              {
                area: "Industrial Hubs",
                title: "Edges of the peninsula",
                desc: "No-nonsense landing pages built to capture RFQs, tenders, and phone calls.",
                color: "lime"
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-8 hover:border-slate-700 transition-colors"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-${item.color}-500/5 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100`} />
                
                <p className={`text-xs font-mono uppercase tracking-widest text-${item.color}-400 mb-4`}>
                  {item.area}
                </p>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-24 px-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white mb-4">
              Typical Wirral Web Designer vs Kaizen
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              See exactly what you get (and what you don't).
            </p>
          </div>

          {/* Feature Comparison Table */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
            {/* Header */}
            <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <div className="col-span-4 p-6 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center">
                Feature
              </div>
              <div className="col-span-4 p-6 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center justify-center text-center border-l border-slate-200 dark:border-slate-800">
                Typical Designer
              </div>
              <div className="col-span-4 p-6 text-xs font-bold uppercase tracking-widest text-white flex items-center justify-center text-center bg-emerald-600 relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-2">
                  <Star size={14} className="fill-white" />
                  Kaizen Approach
                </div>
              </div>
            </div>

            {/* Rows */}
            <div className="bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800">
              {comparisonFeatures.map((row, i) => (
                <div key={i} className="grid grid-cols-12 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                  {/* Feature Name */}
                  <div className="col-span-4 p-6 flex items-center">
                    <span className="font-bold text-slate-900 dark:text-white text-sm md:text-base">
                      {row.feature}
                    </span>
                  </div>

                  {/* Typical Designer */}
                  <div className="col-span-4 p-6 flex flex-col items-center justify-center text-center border-l border-slate-100 dark:border-slate-800">
                    <X className="text-red-400 mb-2" size={24} />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {row.typical}
                    </span>
                  </div>

                  {/* Kaizen */}
                  <div className="col-span-4 p-6 flex flex-col items-center justify-center text-center bg-emerald-50/50 dark:bg-emerald-900/10 border-l border-emerald-100 dark:border-emerald-900/30 relative">
                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-emerald-500/20 transition-colors pointer-events-none" />
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-2">
                      <Check className="text-emerald-600 dark:text-emerald-400" size={18} />
                    </div>
                    <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                      {row.kaizen}
                    </span>
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
              <span>Performance First</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              We Build the Fastest Sites on the Wirral
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Google loves speed. Your customers love speed. We deliver it.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center lg:justify-end">
              <Speedometer />
            </div>
            <div className="text-center lg:text-left">
              <h3 className="text-2xl font-bold text-white mb-4">
                Ready for Core Web Vitals
              </h3>
              <p className="text-slate-400 mb-6 leading-relaxed">
                Our builds regularly score <span className="text-emerald-400 font-bold">95%+ in Lighthouse</span>, often ahead of giants like Amazon (~90) and the BBC (~88).
              </p>
              <p className="text-slate-400 mb-6 leading-relaxed">
                We achieve this with A-grade GTMetrix scores and a relentless focus on code quality.
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

      <div className="relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />
        <FaqSection
          heading="Wirral Web Design FAQs"
          eyebrow="Common Questions"
          className="bg-slate-50 dark:bg-slate-900/50"
          items={[
            {
              question: "How much does a website cost in the Wirral?",
              answer:
                "Prices vary from £500 for a template to £10,000+ for a custom build. At Kaizen, our bespoke brochure sites start from £3,500. That might not be what you need for your business—it really depends on what your business needs. However, we provide a fixed-price quote after a quick chat, so you never get hit with hidden fees. If it ends up costing more than we anticipated, that's on us. So you have peace of mind.",
            },
            {
              question: "Can I just use AI to build my own website?",
              answer:
                "Sure you can, but AI cannot define your business strategy. Without a Product Owner to guide the architecture, DIY AI sites often end up as 'spaghetti code' that breaks in 6 months. We use AI to speed up the build, but human experts ensure it actually generates revenue.",
            },
            {
              question: "Do I own the website after it launches?",
              answer:
                "Yes. Unlike some Wirral agencies that lock you into a proprietary system, you own your code and your domain 100%. We hand over the keys (and the repo) on launch day.",
            },
            {
              question: "Are you actually based in the Wirral?",
              answer:
                "Our registered office is in Liverpool city centre, but we work from and with clients across the peninsula—from Spital to Moreton. We are happy to meet you at your offices for a face-to-face discovery session.",
            },
            {
              question: "Can you fix my existing WordPress site?",
              answer:
                "Yes. If your current site is slow or broken, our 'Project Rescue' team can audit the code, strip out the bloat, and move you to high-performance hosting.",
            },
          ]}
        />
      </div>

      {/* CTA - Project Rescue Style */}
      <section className="bg-slate-950 text-white py-24 px-4 border-t border-slate-800">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/30 text-emerald-400 text-xs font-mono uppercase tracking-wider mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Ready to Sprint?
          </div>
          
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
            Ready to level up your Wirral site?
          </h2>
          
          <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
            Whether you're based in Heswall, West Kirby, Birkenhead or anywhere on the peninsula, we'll help you ship a site that looks sharp, loads fast and actually wins work.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <button
              onClick={() => openCrisp()}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-emerald-500 text-white font-heading font-bold hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-300 transform hover:-translate-y-1"
            >
              Start Project
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
