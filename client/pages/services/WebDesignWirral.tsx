import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { ArrowRight, Map } from "lucide-react";
import { Link } from "react-router-dom";
import { useCalendly } from "@/context/CalendlyContext";
import { FaqSection } from "@/components/FaqSection";

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
                Web Design on the Wirral.
                <br />
                <span className="bg-gradient-to-r from-cyan-400 to-lime-400 bg-clip-text text-transparent">
                  No fluff. Just ROI.
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-300 max-w-2xl mb-8">
                We build fast, conversion-focused sites for Heswall, West Kirby,
                Birkenhead and the wider Wirral. Clear pricing, no retainers,
                and a delivery process that respects your time.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={openCalendly}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-lime-400 text-slate-950 font-heading font-bold hover:shadow-lg hover:shadow-cyan-400/40 transition"
                >
                  Book a 15 Minute Call
                  <ArrowRight size={18} />
                </button>

                <Link
                  to="/case-studies/helen-moore-hairdressing"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full border border-white/20 text-sm font-heading text-white/80 hover:text-white hover:bg-white/5 transition"
                >
                  View Wirral case study
                </Link>
              </div>

              <p className="mt-6 text-xs font-mono text-slate-400 uppercase tracking-[0.25em]">
                Built with React, Vite and a performance-first mindset.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-slate-900/70 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-md"
            >
              <p className="text-xs font-mono uppercase tracking-[0.25em] text-slate-400 mb-4">
                Who we serve
              </p>

              <ul className="space-y-4 text-sm text-slate-200">
                <li>
                  <span className="font-semibold">Heswall</span> – owner-led
                  service businesses that need enquiries, not vanity metrics.
                </li>
                <li>
                  <span className="font-semibold">West Kirby</span> – cafes,
                  salons and experience-led brands that live or die on local
                  reputation.
                </li>
                <li>
                  <span className="font-semibold">Birkenhead</span> – B2B and
                  trades who need a site that looks credible and loads fast on
                  tired work phones.
                </li>
              </ul>

              <p className="mt-6 text-sm text-slate-300">
                If you are based on the Wirral and your current site is slow,
                hard to update or invisible in search, we can help you fix it
                without a six-month "discovery" phase.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Local case study */}
      <section className="bg-slate-50 dark:bg-slate-950 py-20 px-4 border-t border-slate-200/60 dark:border-slate-800/80">
        <div className="container mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-10 items-center">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400 mb-3">
              Trusted by Wirral businesses
            </p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white mb-4">
              Helen Moore Hairdressing, Wallasey Village.
            </h2>
            <p className="text-slate-700 dark:text-slate-300 mb-4">
              We rebuilt Helen Moore Hairdressing&apos;s online presence so new
              and existing clients could actually find, trust and book them from
              their phones.
            </p>
            <p className="text-slate-700 dark:text-slate-300 mb-6">
              The result: a faster site, clearer messaging, and a booking
              journey that feels as considered as the in-salon experience.
            </p>

            <Link
              to="/case-studies/helen-moore-hairdressing"
              className="inline-flex items-center gap-2 text-sm font-heading text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300"
            >
              Read the full case study
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 shadow-sm">
            <div className="absolute -top-6 left-6 h-12 w-12 rounded-full bg-gradient-to-br from-cyan-400 to-lime-400 blur-xl opacity-40" />
            <p className="text-xs font-mono uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400 mb-3 relative">
              Snapshot
            </p>
            <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200 relative">
              <li>
                <span className="text-emerald-500 mr-1">✓</span>
                Local SEO-friendly structure for Wirral searches.
              </li>
              <li>
                <span className="text-emerald-500 mr-1">✓</span>
                Fast-loading gallery and price list on mobile.
              </li>
              <li>
                <span className="text-emerald-500 mr-1">✓</span>
                Clear calls-to-action to call, book and find the salon.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <FaqSection
        heading="Wirral Web Design FAQs"
        eyebrow="Common Questions"
        items={[
          {
            question: "Do you work with businesses across the Wirral?",
            answer:
              "Yes. From West Kirby and Heswall to Birkenhead. We are local to the region and happy to meet at your offices or a local coffee shop for a consultation.",
          },
          {
            question: "Why are you cheaper than other agencies?",
            answer:
              "Because you aren't paying for our coffee breaks or office overheads. You are paying for a Product Owner plus AI. This cost efficiency allows us to offer enterprise-grade tech to local Wirral businesses at 'freelancer' rates.",
          },
          {
            question: "How fast can you launch a local brochure site?",
            answer:
              "Typically 4–6 weeks. We focus on getting your core services and contact details live quickly so you can start generating enquiries.",
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
              onClick={openCalendly}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-lime-400 text-slate-950 font-heading font-bold hover:shadow-lg hover:shadow-cyan-400/40 transition"
            >
              Book a 15 Minute Call
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
