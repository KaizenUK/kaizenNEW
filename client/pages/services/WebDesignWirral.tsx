import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { ArrowRight, Map } from "lucide-react";
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

const comparisonRows = [
  {
    label: "Build approach",
    typical: "Drag-and-drop WordPress theme with 40+ plugins",
    kaizen: "Custom React + Headless build tuned for Core Web Vitals",
  },
  {
    label: "Pricing logic",
    typical: "£1,000–£3,000 for a template clone, then upsells for basics",
    kaizen: "Transparent, fixed-price brochure and e‑commerce builds scoped by a Product Owner",
  },
  {
    label: "Mobile performance",
    typical: "5–8 second load times on 4G – customers bounce before it loads",
    kaizen: "~1.2 second loads on real devices with 90+ scores in Lighthouse & PageSpeed",
  },
  {
    label: "Local SEO",
    typical: "Generic copy with no schema, no local landing pages, and thin blogs",
    kaizen: "Wirral-specific content, schema, and technical SEO baked in from day one",
  },
  {
    label: "Ownership",
    typical: "Locked into proprietary hosting or a mystery CMS you never see",
    kaizen: "You own the repo, the code, and the domain – we hand over the keys on launch day",
  },
  {
    label: "Post-launch",
    typical: "\"Launch and leave\" – no roadmap, no optimisation, no data",
    kaizen: "Quarterly improvement cycles, analytics reviews, and test‑and‑learn experiments",
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

export default function WebDesignWirral() {
  const { openCalendly } = useCalendly();

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <WirralTopoBackground />

        <div className="relative container mx-auto max-w-5xl">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-12 items-center"
          >
            <motion.div variants={fadeInUp}>
              <p className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.25em] text-cyan-300/80 mb-4">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-400/40">
                  <Map className="w-3 h-3" />
                </span>
                Web Design on the Wirral
              </p>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black leading-tight mb-4">
                <p>Web Design Wirral</p>
                <span className="bg-gradient-to-r from-cyan-400 to-lime-400 bg-clip-text text-transparent">
                  <TypewriterEffect
                    words={["No fluff. Just ROI.", "Fast.", "Secure.", "Profitable."]}
                    speed={80}
                    delayBetweenWords={1600}
                    className="inline-block"
                  />
                </span>
                <br />
              </h1>

              <div className="text-lg md:text-xl text-slate-300 max-w-2xl mb-8">
                <p>
                  High-Performance Websites for Bromborough, Heswall, West Kirby
                  &amp; Birkenhead and more.{" "}
                </p>
                <p>
                  <br />
                </p>
                <p>Led by Contract Product Owners, not Salespeople.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={openCalendly}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-lime-400 text-slate-950 font-heading font-bold hover:shadow-lg hover:shadow-cyan-400/40 transition"
                >
                  Book a 15 Minute Call
                  <ArrowRight size={18} />
                </button>

                <a
                  href="https://kaizenweb.co.uk/blog/bespoke-web-design-vs-templates-wirral"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full border border-white/20 text-sm font-heading text-white/80 hover:text-white hover:bg-white/5 transition"
                >
                  View Wirral case study
                </a>
              </div>

              <p className="mt-6 text-xs font-mono text-slate-400 uppercase tracking-[0.25em]">
                Built with React, Vite and a performance-first mindset.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} className="space-y-4">
              <p className="text-xs font-mono uppercase tracking-[0.25em] text-slate-400">
                Who we serve
              </p>

              <div className="grid grid-cols-1 gap-4">
                {/* Heswall - Premium Service Brands */}
                <div className="bg-slate-900/70 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md hover:border-cyan-400/30 transition">
                  <img
                    src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F980902625e90433687c83e0f3aa10a5d?format=webp&width=800"
                    alt="Premium web design for professional services in Heswall and Wirral"
                    className="w-full h-32 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Heswall</h3>
                    <p className="text-sm text-slate-300">Premium Service Brands. Owner-led service businesses that need enquiries, not vanity metrics.</p>
                  </div>
                </div>

                {/* West Kirby - Experience & Retail */}
                <div className="bg-slate-900/70 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md hover:border-cyan-400/30 transition">
                  <img
                    src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F094cdc9be84c41ee9db80308cbe5ea73?format=webp&width=800"
                    alt="Bespoke website design for West Kirby cafes, retail, and lifestyle brands"
                    className="w-full h-32 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">West Kirby</h3>
                    <p className="text-sm text-slate-300">Experience & Retail. Cafes, salons and experience-led brands that live or die on local reputation.</p>
                  </div>
                </div>

                {/* Birkenhead - Industrial & B2B */}
                <div className="bg-slate-900/70 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md hover:border-cyan-400/30 transition">
                  <img
                    src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fbbfbdeb9f4684103a86bcdf7d0ac4d6a?format=webp&width=800"
                    alt="B2B web development for Birkenhead industrial and trade businesses"
                    className="w-full h-32 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Birkenhead</h3>
                    <p className="text-sm text-slate-300">Industrial & B2B. Trades who need a site that looks credible and loads fast on tired work phones.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Scrolling Ticker */}
      <WirralTicker />

      {/* Helen Moore Blueprint Section - With Animated Flow */}
      <section className="bg-slate-50 dark:bg-slate-950 py-20 px-4 border-t border-slate-200/60 dark:border-slate-800/80">
        <div className="container mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-10 items-center">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400 mb-3">
              Trusted by Wirral Businesses (Work in Progress)
            </p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white mb-2">
              A Sneak Peek: Transforming Helen Moore Hairdressing, Wallasey.
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-6 italic">Launching Q1 2026</p>

            <p className="text-slate-700 dark:text-slate-300 mb-4">
              We are currently rebuilding Helen Moore&apos;s digital presence from the ground up. The old site was invisible to Google and hard for clients to use on mobile.
            </p>

            <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-4">The Fix: Re-architecting the business logic.</h3>

            <ul className="space-y-3 mb-8 text-slate-700 dark:text-slate-300">
              <motion.li
                className="flex gap-3"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <span className="text-cyan-400 font-bold flex-shrink-0">→</span>
                <span><span className="font-semibold">Mobile-First Booking:</span> Creating a friction-free path from Instagram to Appointment.</span>
              </motion.li>
              <motion.li
                className="flex gap-3"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <span className="text-cyan-400 font-bold flex-shrink-0">→</span>
                <span><span className="font-semibold">Local SEO Engine:</span> Structuring the site to dominate searches for 'Hairdresser Wallasey' before it even launches.</span>
              </motion.li>
              <motion.li
                className="flex gap-3"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <span className="text-cyan-400 font-bold flex-shrink-0">→</span>
                <span><span className="font-semibold">Zero-Bloat Build:</span> Replacing heavy plugins with custom, lightweight code for instant load speeds.</span>
              </motion.li>
            </ul>

            <button
              onClick={() => openCrisp()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-400 to-lime-400 text-slate-950 font-heading font-bold hover:shadow-lg hover:shadow-cyan-400/40 transition"
            >
              Want to see the blueprints? Start a chat
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Blueprint Visual with Flow Animation */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-lg"
          >
            <svg
              className="w-full h-64"
              viewBox="0 0 300 400"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Wireframe boxes */}
              <rect x="20" y="20" width="260" height="60" className="stroke-cyan-400 dark:stroke-cyan-300" strokeWidth="2" />
              <text x="150" y="55" textAnchor="middle" className="text-xs fill-cyan-500 dark:fill-cyan-300 font-mono">Hero: "Book Now"</text>

              {/* Animated arrow down */}
              <defs>
                <linearGradient id="arrow-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="url(#arrow-gradient)" />
                </marker>
              </defs>

              <motion.line
                x1="150"
                y1="80"
                x2="150"
                y2="110"
                stroke="url(#arrow-gradient)"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
                initial={{ opacity: 0, y1: "80", y2: "80" }}
                animate={{ opacity: 1, y1: 80, y2: 110 }}
                transition={{
                  duration: 0.8,
                  delay: 0.2,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              />

              {/* Two columns */}
              <rect x="20" y="110" width="120" height="80" className="stroke-amber-400 dark:stroke-amber-300" strokeWidth="2" />
              <text x="80" y="155" textAnchor="middle" className="text-xs fill-amber-500 dark:fill-amber-300 font-mono">Services</text>

              <rect x="160" y="110" width="120" height="80" className="stroke-lime-400 dark:stroke-lime-300" strokeWidth="2" />
              <text x="220" y="155" textAnchor="middle" className="text-xs fill-lime-500 dark:fill-lime-300 font-mono">Booking</text>

              {/* Arrows connecting */}
              <motion.line
                x1="80"
                y1="190"
                x2="80"
                y2="220"
                stroke="currentColor"
                strokeWidth="2"
                className="text-lime-400"
                initial={{ opacity: 0, y1: "190", y2: "190" }}
                animate={{ opacity: 1, y1: 190, y2: 220 }}
                transition={{
                  duration: 0.8,
                  delay: 0.5,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              />

              <motion.line
                x1="220"
                y1="190"
                x2="220"
                y2="220"
                stroke="currentColor"
                strokeWidth="2"
                className="text-lime-400"
                initial={{ opacity: 0, y1: "190", y2: "190" }}
                animate={{ opacity: 1, y1: 190, y2: 220 }}
                transition={{
                  duration: 0.8,
                  delay: 0.6,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              />

              {/* Contact section */}
              <rect x="20" y="220" width="260" height="60" className="stroke-emerald-400 dark:stroke-emerald-300" strokeWidth="2" />
              <text x="150" y="255" textAnchor="middle" className="text-xs fill-emerald-500 dark:fill-emerald-300 font-mono">Contact & Trust</text>

              {/* Decorative elements */}
              <circle cx="290" cy="40" r="8" className="fill-cyan-400" opacity="0.5" />
              <circle cx="20" cy="370" r="6" className="fill-lime-400" opacity="0.5" />
            </svg>
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-4 text-center">
              <TypewriterEffect
                words={["Architecting the perfect booking journey", "Mobile-First Strategy", "Conversion Optimised"]}
                speed={80}
                delayBetweenWords={2000}
              />
            </p>
          </motion.div>
        </div>
      </section>

      {/* Context Section - About Different Client Types */}
      <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <p className="text-xs font-mono uppercase tracking-[0.25em] text-cyan-400 mb-4">
              One Peninsula, Many Journeys
            </p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              Wirral businesses are not one-size-fits-all.
            </h2>
            <p className="text-slate-300 max-w-3xl mx-auto">
              Instead of forcing every client into the same template, we design funnels around how people actually find and book you – from high street footfall to late‑night mobile searches.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-slate-900/60 pointer-events-none" />
              <div className="relative">
                <p className="text-xs font-mono uppercase tracking-[0.25em] text-cyan-300 mb-3">
                  Downtown Birkenhead
                </p>
                <h3 className="text-lg font-semibold text-white mb-2">Office towers & trade counters</h3>
                <p className="text-sm text-slate-300">
                  Fast-loading, trust-heavy brochure sites that make you look credible from the first click – even on tired work phones on site.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-slate-900/60 pointer-events-none" />
              <div className="relative">
                <p className="text-xs font-mono uppercase tracking-[0.25em] text-sky-300 mb-3">
                  Coastal Villages
                </p>
                <h3 className="text-lg font-semibold text-white mb-2">Hoylake, West Kirby & New Brighton</h3>
                <p className="text-sm text-slate-300">
                  Experience-led sites that move people from Instagram and Google Maps into bookings, tables, and repeat visits.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-lime-500/10 via-transparent to-slate-900/60 pointer-events-none" />
              <div className="relative">
                <p className="text-xs font-mono uppercase tracking-[0.25em] text-lime-300 mb-3">
                  Industrial Hubs
                </p>
                <h3 className="text-lg font-semibold text-white mb-2">Edges of the peninsula</h3>
                <p className="text-sm text-slate-300">
                  No-nonsense landing pages built to capture RFQs, tenders, and phone calls – not just look pretty.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="bg-slate-950 py-20 px-4 border-t border-slate-800/80">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-xs font-mono uppercase tracking-[0.25em] text-cyan-400 mb-4">
              Reality Check
            </p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              Typical Wirral Web Designer vs Kaizen
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Same peninsula. Completely different experience.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-xl">
            <div className="grid grid-cols-[1.2fr,1fr,1fr] text-xs md:text-sm font-mono uppercase tracking-[0.2em] bg-slate-900/90 text-slate-400">
              <div className="px-4 py-4 text-left">Decision Point</div>
              <div className="px-4 py-4 text-left text-red-400">Typical Designer</div>
              <div className="px-4 py-4 text-left text-emerald-400">Kaizen</div>
            </div>

            <div className="divide-y divide-slate-800">
              {comparisonRows.map((row, index) => (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  whileHover={{ backgroundColor: "rgba(15,23,42,0.9)", scale: 1.01 }}
                  className="grid grid-cols-[1.2fr,1fr,1fr] text-slate-200"
                >
                  <div className="px-4 py-5 border-r border-slate-800/80">
                    <p className="text-xs font-semibold text-slate-400 mb-1">{String(index + 1).padStart(2, "0")}</p>
                    <p className="text-sm md:text-base font-medium text-white">{row.label}</p>
                  </div>
                  <div className="px-4 py-5 border-r border-slate-800/80">
                    <p className="text-xs md:text-sm text-slate-300">{row.typical}</p>
                  </div>
                  <div className="px-4 py-5 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-transparent">
                    <p className="text-xs md:text-sm text-emerald-200">{row.kaizen}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Speed Visualiser Section */}
      <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-xs font-mono uppercase tracking-[0.25em] text-cyan-400 mb-4">
              Performance
            </p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              We Build the Fastest Sites on the Wirral
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Google loves speed. Your customers love speed. We deliver it.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-16"
          >
            <Speedometer />
          </motion.div>
        </div>
      </section>

      {/* Why Us Section - Dark Theme */}
      <section className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-6">
              Why Kaizen is Different
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              Most Wirral web designers are stuck in 2015. They use slow themes, generic templates, and forget about mobile speed.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 rounded-2xl p-8 md:p-12 border border-cyan-400/20 backdrop-blur-sm relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.12),_transparent_55%)]" />
            <div className="relative">
              <p className="text-lg md:text-xl text-white leading-relaxed mb-6">
                <span className="font-semibold text-cyan-300">Kaizen is different.</span> We bring Enterprise-Grade React & Headless WordPress tech to local businesses. You get the same tech stack used by major brands, built by a local team that understands the difference between West Kirby and Wallasey.
              </p>
            </div>
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-cyan-600/30 border border-cyan-400/50 text-white">
                    <span className="text-xl font-bold">⚡</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Enterprise Tech</h3>
                  <p className="text-sm text-slate-400">React & Headless architecture that scales</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-lime-600/30 border border-lime-400/50 text-white">
                    <span className="text-xl font-bold">🎯</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">AI-Augmented</h3>
                  <p className="text-sm text-slate-400">Smarter, faster development process</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-cyan-600/30 border border-cyan-400/50 text-white">
                    <span className="text-xl font-bold">📍</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Local Knowledge</h3>
                  <p className="text-sm text-slate-400">We understand Wirral businesses</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <FaqSection
        heading="Wirral Web Design FAQs"
        eyebrow="Common Questions"
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

      {/* CTA */}
      <section className="bg-slate-900 text-white py-16 px-4">
        <div className="container mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold mb-3">
              Ready to level up your Wirral site?
            </h2>
            <p className="text-sm md:text-base text-slate-300 max-w-xl">
              Whether you&apos;re based in Heswall, West Kirby, Birkenhead or
              anywhere on the peninsula, we&apos;ll help you ship a site that
              looks sharp, loads fast and actually wins work.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => openCrisp()}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-lime-400 text-slate-950 font-heading font-bold hover:shadow-lg hover:shadow-cyan-400/40 transition"
            >
              Launch Chat
              <ArrowRight size={18} />
            </button>

            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full border border-white/20 text-sm font-heading text-white/80 hover:text-white hover:bg-white/5 transition"
            >
              Send a brief
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
