import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Blueprint SVG with CSS animations
 */
const LivingBlueprintEnhanced: React.FC = () => {
  // Generate data dots
  const dots = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    cx: Math.random() * 80 + 10,
    cy: Math.random() * 60 + 20,
    color: i % 2 === 0 ? "#f59e0b" : "#a855f7",
  }));

  return (
    <div className="relative w-full h-96 blueprint-grid">
      <svg
        viewBox="0 0 400 300"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="gridGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(6, 182, 212, 0.3)" />
            <stop offset="100%" stopColor="rgba(6, 182, 212, 0.05)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid Lines */}
        <g opacity="0.3" stroke="url(#gridGradient)" strokeWidth="0.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={`h-${i}`}
              className="blueprint-line"
              x1="0"
              y1={i * 40}
              x2="400"
              y2={i * 40}
            />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <line
              key={`v-${i}`}
              className="blueprint-line"
              x1={i * 40}
              y1="0"
              x2={i * 40}
              y2="300"
            />
          ))}
        </g>

        {/* Data Dots with Lines */}
        {dots.map((dot, idx) => (
          <g key={dot.id}>
            {idx < 6 && (
              <line
                className="blueprint-line"
                x1={dot.cx}
                y1={dot.cy}
                x2="200"
                y2="150"
                stroke={dot.color}
                strokeWidth="0.8"
                opacity="0.3"
              />
            )}
            <circle
              cx={dot.cx}
              cy={dot.cy}
              r="3"
              fill={dot.color}
              className="blueprint-dot"
              style={{ filter: "url(#glow)" }}
            />
          </g>
        ))}

        {/* Center Hexagon */}
        <g style={{ transform: "translate(200px, 150px)" }}>
          <polygon
            points="0,-25 21,-12 21,13 0,25 -21,13 -21,-12"
            fill="none"
            stroke="rgba(6, 182, 212, 0.6)"
            strokeWidth="1.5"
            className="blueprint-cube"
          />
          <circle
            cx="0"
            cy="0"
            r="8"
            fill="rgba(245, 158, 11, 0.4)"
            className="blueprint-cube"
          />
        </g>
      </svg>

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

/**
 * Value Proposition Section with Framer Motion animations
 */
export const ValueProposition: React.FC = () => {
  return (
    <>
      {/* Authority Bridge Section */}
      <section className="py-20 md:py-28 bg-slate-950 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0,rgba(56,189,248,0.20),transparent_55%),radial-gradient(circle_at_100%_90%,rgba(34,197,94,0.16),transparent_60%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
              >
                <p className="text-xs font-mono tracking-[0.25em] text-cyan-300 uppercase mb-4">
                  Global Tech Experience
                </p>
                <h2 className="text-3xl md:text-5xl font-heading font-black leading-tight mb-6">
                  Professional Tech.
                  <br />
                  Down-to-Earth Service.
                </h2>
                <p className="text-lg text-white/80 leading-relaxed mb-6">
                  We used to build massive systems for global companies. Now, we
                  use that same powerful technology to help local Wirral
                  businesses get more customers. You get a website that is
                  faster, safer, and smarter than your competitors, without the
                  corporate waffle.
                </p>
                <ul className="space-y-3 text-white/85">
                  <li className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    Performance budgets agreed up front
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    Release discipline: staging, QA, and safe rollbacks
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    Senior ownership: no hand-offs, no vague timelines
                  </li>
                </ul>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
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
                        "live-performance-scanner",
                      );
                      scanner?.scrollIntoView({ behavior: "smooth" as any });
                    }}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 text-gray-950 font-heading font-bold transition"
                    whileHover={{
                      scale: 1.05,
                      boxShadow: "0 0 20px rgba(34,197,94,0.5)",
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Get a Performance Audit
                    <ArrowRight size={18} />
                  </motion.button>
                </div>
              </motion.div>
            </div>

            {/* Blueprint Visualization */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ delay: 0.1 }}
              className="relative hidden lg:block"
            >
              <div className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-r from-cyan-500/20 to-emerald-500/10 blur-2xl" />
              <div className="relative rounded-[2.25rem] border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden p-8 md:p-10">
                <LivingBlueprintEnhanced />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Media Warning Section with GSAP */}
      <section
        id="social-media-warning"
        className="relative z-10 bg-slate-800 text-white py-16 border-t border-b border-white/10"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="flex justify-center mb-4"
            >
              <div className="p-3 rounded-full bg-amber-400/10 border border-amber-400/30">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
            </motion.div>

            <p className="text-xs font-mono tracking-[0.25em] text-amber-400 uppercase mb-4">
              The Social Media Warning
            </p>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-heading font-black mb-6 text-white"
            >
              Is Your Business Homeless?
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-white/85 leading-relaxed"
            >
              If your whole presence lives on Facebook or Instagram, you're
              renting attention. Algorithms change, reach disappears, accounts
              get locked, and your leads vanish overnight. A fast website is the
              asset you own: it builds trust, captures enquiries, and keeps
              working regardless of what social platforms decide.
            </motion.p>
          </div>
        </div>
      </section>
    </>
  );
};
