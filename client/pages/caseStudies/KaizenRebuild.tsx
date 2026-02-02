import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  ArrowUpRight,
  Code2,
  Server,
  Database,
  Zap,
  Shield,
  Globe,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";

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
    },
  },
};

function CodeRainBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
      <div className="flex justify-around w-full">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="code-rain-column text-cyan-500 text-xs font-mono"
            style={{
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random() * 2}s`,
            }}
          >
            {Array.from({ length: 20 }).map((_, j) => (
              <div key={j} style={{ opacity: Math.random() }}>
                {Math.random() > 0.5 ? "1" : "0"}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KaizenRebuildCase() {
  const { openCalendly } = useCalendly();

  return (
    <Layout>
      <Helmet>
        <title>Kaizen Web Rebuild Case Study | React + Vite Migration</title>
        <meta
          name="description"
          content="A technical deep dive into how we migrated Kaizen Web from a legacy setup to a high-performance React + Vite + Headless architecture."
        />
      </Helmet>

      {/* Hero Section */}
      <section className="relative bg-slate-950 min-h-screen flex items-center py-20 px-4 overflow-hidden">
        <CodeRainBackground />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950 z-10" />

        <div className="relative z-20 container mx-auto max-w-5xl">
          <Link
            to="/case-studies"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition mb-12 font-mono text-sm"
          >
            <ArrowLeft size={16} />
            ../case-studies
          </Link>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="space-y-8"
          >
            <span className="inline-block px-3 py-1 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-mono font-bold uppercase tracking-widest">
              The Blueprint
            </span>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black leading-tight text-white">
              Building Kaizen: <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                How We Fixed Our Own House.
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-400 leading-relaxed max-w-3xl font-light">
              We migrated from a legacy setup to a high-performance React + Vite
              + Headless architecture. Here is the autopsy.
            </p>
          </motion.div>
        </div>
      </section>

      {/* The Why (The Pain) */}
      <section className="bg-slate-950 py-20 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-8">
              The Pain: Driving a Sedan in an F1 Race
            </h2>
            <div className="prose prose-invert prose-lg max-w-none text-slate-400">
              <p>
                We were selling high-performance engines but driving a sedan.
                Our old site had 140 'ghost pages', mixed SEO signals, and slow
                WordPress cron jobs. It wasn't good enough.
              </p>
              <p>
                We needed a platform that reflected our engineering standards:
                zero bloat, instant transitions, and a perfect Lighthouse score.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Tech Stack (Bento Grid) */}
      <section className="bg-slate-950 py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            The Stack
          </motion.h2>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* React */}
            <motion.div
              variants={fadeInUp}
              className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/50 transition group"
            >
              <Code2 className="w-10 h-10 text-cyan-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-white mb-2">React</h3>
              <p className="text-slate-400 text-sm">
                Component-based UI for modularity and reusability.
              </p>
            </motion.div>

            {/* Vite */}
            <motion.div
              variants={fadeInUp}
              className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/50 transition group"
            >
              <Zap className="w-10 h-10 text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-white mb-2">Vite</h3>
              <p className="text-slate-400 text-sm">
                Next-generation frontend tooling for instant HMR and builds.
              </p>
            </motion.div>

            {/* Builder.io */}
            <motion.div
              variants={fadeInUp}
              className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-orange-500/50 transition group"
            >
              <Globe className="w-10 h-10 text-orange-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-white mb-2">Builder.io</h3>
              <p className="text-slate-400 text-sm">
                Visual headless CMS for rapid content iteration.
              </p>
            </motion.div>

            {/* Node.js */}
            <motion.div
              variants={fadeInUp}
              className="md:col-span-2 p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-green-500/50 transition group"
            >
              <Server className="w-10 h-10 text-green-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-white mb-2">Node.js</h3>
              <p className="text-slate-400 text-sm">
                Robust backend runtime for API handling and server-side logic.
              </p>
            </motion.div>

            {/* Contabo VPS */}
            <motion.div
              variants={fadeInUp}
              className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 transition group"
            >
              <Database className="w-10 h-10 text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-white mb-2">Contabo VPS</h3>
              <p className="text-slate-400 text-sm">
                High-performance private server for total control.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* SEO & Performance */}
      <section className="bg-slate-950 py-20 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            SEO & Performance Hardening
          </motion.h2>

          <div className="space-y-6">
            {[
              {
                title: "Unique Meta Descriptions",
                desc: "Every route has a tailored meta description for maximum CTR.",
              },
              {
                title: "Canonical URL Fixes",
                desc: "Eliminated duplicate content issues with strict canonical tags.",
              },
              {
                title: "AutoSSL & Security",
                desc: "Automated SSL renewal and security headers for A+ rating.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-4 p-6 rounded-xl bg-slate-900/30 border border-slate-800"
              >
                <Shield className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-slate-400">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Project Valuation */}
      <section className="bg-slate-950 py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-500/30 rounded-3xl p-8 md:p-12 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <Code2 size={120} />
            </div>

            <h2 className="text-2xl font-mono text-cyan-400 mb-2">
              Project Valuation
            </h2>
            <div className="text-4xl md:text-5xl font-heading font-bold text-white mb-8">
              £12,000 – £15,000
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-slate-300 mb-8">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Strategy & UX Design
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  React Development
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Headless CMS Integration
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Server Ops & Security
                </li>
              </ul>
            </div>

            <button
              onClick={openCalendly}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-cyan-500 text-slate-950 font-heading font-bold hover:bg-cyan-400 transition w-full md:w-auto justify-center"
            >
              Book a Technical Discovery Call
              <ArrowUpRight size={18} />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Pagination */}
      <section className="bg-slate-950 py-16 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <Link
              to="/case-studies/helen-moore-hairdressing"
              className="group flex items-center gap-3 text-white hover:text-cyan-400 transition"
            >
              <span className="group-hover:-translate-x-1 transition">←</span>
              Previous Case Study
            </Link>

            <Link
              to="/case-studies"
              className="text-slate-500 hover:text-white transition text-sm font-medium"
            >
              View All
            </Link>

            <Link
              to="/case-studies/as-collections"
              className="group flex items-center gap-3 text-white hover:text-cyan-400 transition"
            >
              Next Case Study
              <span className="group-hover:translate-x-1 transition">→</span>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
