import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import AppLink from "@/components/routing/AppLink";

/**
 * Section 5: Two Verticals
 * Web Design + Project Rescue — the two core ways we help.
 */
export const ServiceShowcase: React.FC = () => {
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
          <h2 className="text-3xl md:text-4xl font-heading font-bold">
            Two ways we help
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-stretch"
        >
          {/* Vertical 1: Web Design */}
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
                Web Design
              </p>
              <h3 className="text-3xl md:text-4xl font-heading font-bold mb-4">
                Websites That Work for a Living
              </h3>
              <p className="text-base text-slate-200 mb-6 max-w-md">
                For Wirral businesses that want leads, not just a web presence.
                Fast on mobile. Clean for Google. Built to convert visitors into
                enquiries.
              </p>
              <ul className="space-y-3 text-base text-slate-200/90 mb-8">
                <li className="flex items-center gap-3">
                  <span className="text-cyan-400">&#10003;</span>
                  Local SEO baked in from the start
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-cyan-400">&#10003;</span>
                  Core Web Vitals passed, not patched
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-cyan-400">&#10003;</span>
                  Clear pricing — no surprise invoices
                </li>
              </ul>
              <div className="mt-auto">
                <AppLink
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-cyan-200 text-slate-950 px-5 py-2.5 text-sm font-heading font-semibold shadow-lg hover:shadow-cyan-400/60 hover:-translate-y-0.5 transition-all"
                >
                  Start Your Project
                  <ArrowRight size={18} />
                </AppLink>
              </div>
            </div>
          </motion.div>

          {/* Vertical 2: Project Rescue */}
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
                Project Rescue
              </p>
              <h3 className="text-3xl md:text-4xl font-heading font-bold mb-4">
                Stuck Project? We'll Get It Shipped.
              </h3>
              <p className="text-base text-slate-100 mb-6 max-w-md">
                Late, over budget, or falling apart. We step in, find the
                problems, fix the architecture, and get you to launch.
              </p>
              <ul className="space-y-3 text-base text-slate-100/90 mb-8">
                <li className="flex items-center gap-3">
                  <span className="text-lime-400">&#10003;</span>
                  Rapid triage — we diagnose in days, not weeks
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-lime-400">&#10003;</span>
                  Honest timelines you can actually hold us to
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-lime-400">&#10003;</span>
                  We ship where others stall
                </li>
              </ul>
              <div className="mt-auto flex items-center gap-4">
                <AppLink
                  href="/project-rescue"
                  className="inline-flex items-center gap-2 rounded-full bg-lime-300 text-slate-950 px-5 py-2.5 text-sm font-heading font-semibold shadow-lg hover:bg-lime-200 hover:shadow-lime-300/40 hover:-translate-y-0.5 transition-all"
                >
                  Get Help Now
                  <ArrowRight size={18} />
                </AppLink>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
