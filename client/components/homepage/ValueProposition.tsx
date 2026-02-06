import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Section 2: Social Media Warning (The Pain)
 * Goes immediately after the hero to make them feel the risk.
 */
export const SocialMediaWarning: React.FC = () => {
  return (
    <section className="relative z-10 bg-slate-800 text-white py-20 md:py-28 border-t border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-mono tracking-[0.25em] text-amber-400 uppercase mb-6">
              The Uncomfortable Truth
            </p>

            <h2 className="text-4xl md:text-5xl font-heading font-black mb-8 text-white leading-tight">
              Don't Build Your Business on Rented Land
            </h2>

            <div className="space-y-6 text-lg text-white/85 leading-relaxed">
              <p>
                If your only online presence is Facebook or Instagram, you don't own anything. Algorithms change overnight. Accounts get locked without warning. Reach gets throttled unless you pay.
              </p>

              <p className="text-xl font-heading font-semibold text-white">
                A website is the only bit of the internet that's actually yours.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

/**
 * Section 4: Credibility (Global Standards)
 * Explains WHY they can deliver — after the prospect has seen the proof.
 */
export const CredibilitySection: React.FC = () => {
  return (
    <section className="py-20 md:py-28 bg-slate-950 text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0,rgba(56,189,248,0.20),transparent_55%),radial-gradient(circle_at_100%_90%,rgba(34,197,94,0.16),transparent_60%)]" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
          >
            <p className="text-xs font-mono tracking-[0.25em] text-cyan-300 uppercase mb-4">
              Why Us
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-black leading-tight mb-8">
              Big-Tech Discipline. Wirral Postcode.
            </h2>
            <p className="text-lg text-white/80 leading-relaxed mb-10 max-w-3xl">
              We spent years building systems for global companies. Now we use that same rigour for local businesses. You get senior-level ownership from day one — no juniors learning on your project, no vanishing act after the deposit clears.
            </p>

            <ul className="space-y-4 text-white/90 text-lg mb-10">
              <li className="flex gap-3 items-start">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300 flex-shrink-0" />
                Performance budgets agreed before we write a line of code
              </li>
              <li className="flex gap-3 items-start">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300 flex-shrink-0" />
                Staging, QA, and safe rollbacks on every project
              </li>
              <li className="flex gap-3 items-start">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300 flex-shrink-0" />
                One senior dev owns your build start to finish
              </li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  to="/case-studies/helen-moore-hairdressing"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/15 bg-white/5 text-white font-heading font-semibold hover:bg-white/10 transition"
                >
                  See proof in a case study
                  <ArrowUpRight size={18} />
                </Link>
              </motion.div>
              <motion.button
                onClick={() => {
                  const scanner = document.getElementById(
                    'live-performance-scanner'
                  );
                  scanner?.scrollIntoView({ behavior: 'smooth' as any });
                }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 text-gray-950 font-heading font-bold transition"
                whileHover={{
                  scale: 1.05,
                  boxShadow: '0 0 20px rgba(34,197,94,0.5)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                Get a Performance Audit
                <ArrowRight size={18} />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

/**
 * Combined export for backwards compatibility
 */
export const ValueProposition: React.FC = () => {
  return (
    <>
      <SocialMediaWarning />
    </>
  );
};
