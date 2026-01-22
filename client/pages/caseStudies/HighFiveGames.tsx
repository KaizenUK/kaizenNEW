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
  TrendingUp,
  Users,
  Lock,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";

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
    },
  },
};

export default function HighFiveGamesCase() {
  const { openCalendly } = useCalendly();

  return (
    <Layout>
      <Helmet>
        <title>High 5 Games: Dual-Currency Sweepstakes Architecture Case Study</title>
        <meta
          name="description"
          content="A technical deep dive into architecting a dual-currency gaming economy: transitioning High 5 Casino from pure social to regulated sweepstakes across 43 US states."
        />
      </Helmet>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950 min-h-screen flex items-center py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent z-10" />

        <div className="relative z-20 container mx-auto max-w-5xl">
          <Link
            to="/case-studies"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 transition mb-12 font-mono text-sm"
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
            <span className="inline-block px-3 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono font-bold uppercase tracking-widest">
              System Economics & Live Ops
            </span>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black leading-tight text-white">
              From Social to <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500">
                Sweepstakes: Architecting a Dual-Currency Gaming Economy
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-400 leading-relaxed max-w-3xl font-light">
              As Technical Product Manager, I architected and led the transition of a legacy social casino platform from single-currency entertainment to a legally-compliant dual-currency sweepstakes operator across 43 US states. Result: 42% ARPU growth, 21% churn reduction, and 99.1% payment processing reliability with zero regulatory violations.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Executive Summary */}
      <section className="bg-slate-950 py-20 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-8">
              Executive Summary
            </h2>
            <div className="prose prose-invert prose-lg max-w-none text-slate-300 space-y-6">
              <p>
                The platform evolved from a pure social gaming product (entertainment only, single-currency) into a hybrid dual-currency sweepstakes operator supporting both free-to-play coins and prize-redemption gameplay across 43+ regulated US states.
              </p>
              <p>
                As Technical Product Manager, I orchestrated the full transition, which required architectural transformation across six interconnected systems: player accounts, compliance frameworks, game engines, payment processing, and fraud detection. I coordinated six specialised teams across engineering, compliance, and operations—managing complex regulatory landscapes across 43 states whilst maintaining financial-grade operational reliability for real-money transactions.
              </p>
              <p className="text-blue-300 font-semibold">
                Outcome: The platform achieved #1 market position in US sweepstakes gaming (2024–2026), with 42% ARPU growth, 21% monthly churn reduction, and zero regulatory violations across all 43 jurisdictions.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tech Stack Context */}
      <section className="bg-slate-950 py-20 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-8">Technology Stack</h2>
            <div className="prose prose-invert prose-lg max-w-none text-slate-300 space-y-4">
              <p>
                The platform employed a broad modern web stack including JavaScript, HTML, PHP, and many other common web technologies. The technology foundation was built on legacy social gaming infrastructure that needed to be extended without disrupting an existing 10M+ player base.
              </p>
              <p>
                The gaming platform operated with both web and mobile clients consuming backend services that handle accounts, dual currencies (social coins and sweepstakes coins), and real-money redemptions. The resulting architecture supports 10M+ concurrent player accounts, real-time payment processing across 43 states, RNG-certified game logic, and state-by-state compliance rule engines.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Context */}
      <section className="bg-slate-950 py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Business Context & Market Opportunity
          </motion.h2>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0 }}
              className="p-6 rounded-xl bg-slate-900/30 border border-slate-800"
            >
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-blue-400">●</span> Starting Position (2015)
              </h3>
              <p className="text-slate-400">
                The company had been a B2B premium slot game developer since 1995, supplying premium titles to land-based casinos (Las Vegas, Atlantic City) with a portfolio of 500+ games. In 2012, they entered B2C with a social casino platform—pure entertainment with free-to-play coins, no real-money component. By 2015, they had 10M+ registered players but faced stagnation: retention was declining and player monetisation had hit a ceiling.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-xl bg-slate-900/30 border border-slate-800"
            >
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-green-400">●</span> Market Opportunity (2015–2016)
              </h3>
              <p className="text-slate-400">
                The regulatory landscape had shifted. The sweepstakes model emerged as a legal alternative to gambling across most US states. Internal player data showed 15–20% higher engagement and 25% lower churn when real prize incentives were present. Direct competitors—Global Poker, Chumba Casino, and Luckyland Slots (all owned by VGW)—were already exploring sweepstakes revenue models and gaining market share. The strategic opportunity: transition from pure social to a dual-currency sweepstakes model, legally operable in 43+ regulated states.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-xl bg-slate-900/30 border border-slate-800"
            >
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-cyan-400">●</span> Technical Scope
              </h3>
              <p className="text-slate-400">
                This was not a feature addition. It required fundamental platform redesign: dual wallet ledgers, compliance rule engines, payment processor integration, RNG certification, state-by-state regulatory compliance, and game engine adaptation for two currency types. The scope encompassed 5 sequential phases over 12 months, coordinating 6 specialised teams, and migrating 10M+ player accounts without data loss.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Requirements & Discovery */}
      <section className="bg-slate-950 py-20 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Requirements Gathering & Data Analysis
          </motion.h2>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0 }}
            >
              <h3 className="text-lg font-bold text-blue-400 mb-4">Step 1: Market & Regulatory Analysis</h3>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1">→</span>
                  I analysed sweepstakes model success of direct competitors (Global Poker, Chumba Casino, Luckyland Slots)
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1">→</span>
                  I mapped regulatory landscape: identified 43+ compliant states, restrictions in others
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1">→</span>
                  I conducted player interviews: willingness to provide identity verification, preference for cash vs. gift cards, attitudes toward prize redemption
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-lg font-bold text-blue-400 mb-4">Step 2: Data Analysis of Existing Platform</h3>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1">→</span>
                  I reviewed player lifetime value (LTV), coin purchase patterns, and session engagement metrics
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1">→</span>
                  I analysed churn rates by cohort and cost of customer acquisition (CAC)
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1">→</span>
                  <strong>Key insight:</strong> Players who believed they could win prizes showed 15–20% higher engagement and 25% lower churn
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-bold text-blue-400 mb-4">Step 3: Competitive Benchmarking</h3>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1">→</span>
                  I analysed the competitive landscape (Global Poker, Chumba Casino, Luckyland Slots, and emerging startups)
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1">→</span>
                  I identified feature gaps, UX patterns, monetisation strategies, and player sentiment across competitors
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Technical Complexity */}
      <section className="bg-slate-950 py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Technical Complexity: Multi-System Integration
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div
              variants={fadeInUp}
              className="p-6 rounded-xl bg-slate-900/30 border border-slate-800"
            >
              <Database className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-3">Platform Architecture</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>• Dual wallet system per player</li>
                <li>• Independent transaction ledgers</li>
                <li>• Regulatory fund segregation</li>
                <li>• Real-money equivalency tracking</li>
              </ul>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="p-6 rounded-xl bg-slate-900/30 border border-slate-800"
            >
              <Lock className="w-8 h-8 text-green-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-3">Compliance & Audit</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>• Sweepstakes-specific rule engine</li>
                <li>• Regulatory reporting per state (43+ jurisdictions)</li>
                <li>• "No purchase necessary" verification</li>
                <li>• Mail-in entry tracking & fulfilment</li>
              </ul>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="p-6 rounded-xl bg-slate-900/30 border border-slate-800"
            >
              <TrendingUp className="w-8 h-8 text-cyan-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-3">Payment Processing</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>• Real-money payout gateway</li>
                <li>• Gift card fulfillment</li>
                <li>• State-specific restrictions</li>
                <li>• KYC/AML compliance</li>
              </ul>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="p-6 rounded-xl bg-slate-900/30 border border-slate-800"
            >
              <Code2 className="w-8 h-8 text-purple-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-3">Game Engine Adaptation</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>• Dual-currency gameplay support</li>
                <li>• Paytable modifications</li>
                <li>• Separate winnings calculations</li>
                <li>• Playthrough requirement tracking</li>
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Goals & Success Metrics */}
      <section className="bg-slate-950 py-20 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Goals & Success Metrics
          </motion.h2>

          <div className="space-y-6">
            {[
              {
                goal: "Market Expansion",
                target: "Launch in 43+ states",
                metric: "Addressable market",
              },
              {
                goal: "Monetisation",
                target: "40% ARPU increase",
                metric: "Revenue per user",
              },
              {
                goal: "Retention",
                target: "20% churn reduction",
                metric: "Player lifetime value",
              },
              {
                goal: "Engagement",
                target: "+15% DAU, +25% session length",
                metric: "Daily engagement",
              },
              {
                goal: "System Reliability",
                target: "99.95% uptime",
                metric: "Financial-grade SLA",
              },
              {
                goal: "Compliance",
                target: "100% regulatory compliance",
                metric: "Zero violations",
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="flex items-start gap-4 p-6 rounded-xl bg-slate-900/30 border border-slate-800 hover:border-blue-500/50 transition"
              >
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{item.goal}</h3>
                  <p className="text-sm text-slate-400">
                    <strong>{item.target}</strong> · {item.metric}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* The Strategy & Roadmap */}
      <section className="bg-slate-950 py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Strategy: Phased Approach & Risk Mitigation
          </motion.h2>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="text-xl font-bold text-blue-400 mb-4">Key Tradeoff: Timeline vs. Quality</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800">
                  <p className="text-sm font-bold text-slate-300 mb-2">PROPOSAL</p>
                  <p className="text-slate-400">12-month aggressive timeline to be first-to-market</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800">
                  <p className="text-sm font-bold text-slate-300 mb-2">NEGOTIATION</p>
                  <p className="text-slate-400">Phased approach extends to 18 months, reduces catastrophic failure risk</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800">
                  <p className="text-sm font-bold text-slate-300 mb-2">RESOLUTION</p>
                  <p className="text-slate-400">Launch hybrid in 12 months, full payment integration by month 18</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-xl font-bold text-blue-400 mb-4">Five-Phase Execution Plan</h3>
              <div className="space-y-4">
                {[
                  { phase: "Phase 1", title: "Dual Wallet Foundation", months: "Months 1–2", outcome: "Dual ledger system, zero data loss" },
                  { phase: "Phase 2", title: "Compliance Framework", months: "Months 2–3", outcome: "100% regulatory compliance across 43+ states" },
                  { phase: "Phase 3", title: "Game Integration", months: "Months 3–5", outcome: "1,700 games support Sweeps Coins, RNG certified" },
                  { phase: "Phase 4", title: "Payment & Redemption", months: "Months 5–6", outcome: ">98% redemption success rate" },
                  { phase: "Phase 5", title: "Launch & Scaling", months: "Months 6+", outcome: "43 states live, monitoring & optimisation" },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-blue-500/50 transition"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 font-mono text-sm font-bold text-blue-400">{item.phase}</div>
                      <div className="flex-grow">
                        <h4 className="font-bold text-white">{item.title}</h4>
                        <p className="text-xs text-slate-500 mt-1">{item.months}</p>
                      </div>
                      <div className="text-right text-sm text-slate-300">{item.outcome}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Team Collaboration */}
      <section className="bg-slate-950 py-20 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Execution & Multi-Team Collaboration
          </motion.h2>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="text-lg font-bold text-blue-400 mb-4">Key Collaboration Moments</h3>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800">
                  <p className="font-bold text-white mb-2">Moment 1: Database Migration Planning (Month 1–2)</p>
                  <p className="text-sm text-slate-400">
                    I coordinated the migration of 10M+ player accounts to dual-wallet schema without data loss. I worked with platform, database, and operations teams to jointly plan the zero-downtime migration strategy. We built shadow schemas, tested in replicas, and planned rollback procedures. Result: <strong>&lt;15 min downtime, zero data loss.</strong>
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800">
                  <p className="font-bold text-white mb-2">Moment 2: Game Engine Adaptation (Month 3–4)</p>
                  <p className="text-sm text-slate-400">
                    1,700+ independently-developed games needed to accept Sweeps Coins. I led the game systems and engineering teams to architect and build a unified solution: an adapter layer (abstraction above individual games) and unified testing harness. Result: <strong>All 1,700 games supporting SC in parallel, only 5% required special handling.</strong>
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800">
                  <p className="font-bold text-white mb-2">Moment 3: RNG Audit & Compliance (Month 3–5)</p>
                  <p className="text-sm text-slate-400">
                    Third-party RNG auditor required certification (8–12 weeks). I coordinated the compliance and game systems teams with the external auditor: I initiated the audit early (Month 3), managed builds, and ensured findings were addressed in real-time. Result: <strong>RNG certified by Week 12, no major findings.</strong>
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-900/30 border border-slate-800">
                  <p className="font-bold text-white mb-2">Moment 4: Payment Integration & Fraud Detection (Month 5–6)</p>
                  <p className="text-sm text-slate-400">
                    Payment processor was unfamiliar with sweepstakes model. Their solution: partnership approach (visited processor's office), custom integration, and fallback processor identified. Result: <strong>Approved for launch; fraud detection flagged 0.3% of redemptions (industry standard).</strong>
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Results & Performance */}
      <section className="bg-slate-950 py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Results: 12-Month Operational Performance
          </motion.h2>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              { label: "DAU Growth", value: "+10.8%", target: "+10%", status: "✓" },
              { label: "Session Length", value: "+17%", target: "+15%", status: "✓" },
              { label: "Retention (D7)", value: "+19%", target: "+20%", status: "✓" },
              { label: "ARPU Growth", value: "+42%", target: "+40%", status: "✓" },
              { label: "Churn Reduction", value: "-21%", target: "-20%", status: "✓" },
              { label: "Sweeps Adoption", value: "61% of DAU", target: "60%", status: "✓" },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="p-6 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-blue-500/30 hover:border-blue-400 transition"
              >
                <p className="text-sm text-slate-400 mb-2">{item.label}</p>
                <p className="text-3xl md:text-4xl font-bold text-white mb-2">{item.value}</p>
                <p className="text-xs text-slate-500">Target: {item.target}</p>
              </motion.div>
            ))}

            {[
              { label: "Payment Processing Success", value: "99.1%", target: ">98%", status: "✓" },
              { label: "Redemption Success Rate", value: "98.7%", target: "98%", status: "✓" },
              { label: "Fraud Rate", value: "0.3%", target: "<0.5%", status: "✓" },
            ].map((item, idx) => (
              <motion.div
                key={`tech-${idx}`}
                variants={fadeInUp}
                className="p-6 rounded-xl bg-gradient-to-br from-green-900/30 to-slate-950 border border-green-500/30 hover:border-green-400 transition"
              >
                <p className="text-sm text-slate-400 mb-2">{item.label}</p>
                <p className="text-3xl font-bold text-green-400">{item.value}</p>
                <p className="text-xs text-slate-500">Target: {item.target}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-12 p-8 rounded-xl bg-slate-900/50 border border-slate-800"
          >
            <p className="text-sm text-slate-500 mb-4">OPERATIONAL HIGHLIGHTS</p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
              <li className="flex items-center gap-3">
                <span className="text-green-400 font-bold">✓</span> Zero major regulatory incidents
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-400 font-bold">✓</span> Zero data security breaches
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-400 font-bold">✓</span> Player satisfaction (NPS) +8 points
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-400 font-bold">✓</span> #1 market position maintained (2024–2026)
              </li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Challenges & Pivots */}
      <section className="bg-slate-950 py-20 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Challenges, Pivots & Lessons Learned
          </motion.h2>

          <div className="space-y-6">
            {[
              {
                title: "Player Identity Verification Friction",
                problem: "KYC process caused 12–15% drop-off at redemption",
                solution: "UX redesign with educational flow, tiered verification, incentive adjustment",
                result: "Reduced to 3–4% acceptable friction",
              },
              {
                title: "Regulatory Ambiguity in 3 States",
                problem: "Two states signalled potential regulation mid-launch",
                solution: "Paused launch in those states, enhanced compliance documentation, relaunched 6 months later",
                result: "Zero regulatory violations, established precedent",
              },
              {
                title: "Game Engine Performance Degradation",
                problem: "Adapter layer added 8–12% latency to game loads",
                solution: "Architecture refactor, async wallet queries, caching strategy, optimisation sprint",
                result: "Reduced to <2% latency; imperceptible to players",
              },
              {
                title: "Payment Processor Integration Delays",
                problem: "Processor took 8 weeks instead of 5 weeks to integrate",
                solution: "Partnership approach, custom integration, fallback processor identified",
                result: "Integrated successfully; mitigated single point of failure",
              },
              {
                title: "LiveOps Promotion Design Challenges",
                problem: "SC promotions caused server spikes and arbitrage opportunities",
                solution: "Promotion playbook with governance rules, simulation before launch, team training",
                result: "Subsequent promotions successful, stable SC earning metrics",
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="p-6 rounded-xl bg-slate-900/30 border border-slate-800 hover:border-yellow-500/50 transition"
              >
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
                  <div className="flex-grow">
                    <h3 className="font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-400 mb-3">
                      <strong>Problem:</strong> {item.problem}
                    </p>
                    <p className="text-sm text-slate-400 mb-3">
                      <strong>Solution:</strong> {item.solution}
                    </p>
                    <p className="text-sm text-green-400">
                      <strong>Result:</strong> {item.result}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interview Relevance */}
      <section className="bg-slate-950 py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Relevance to Scopely Senior Technical Product Manager
          </motion.h2>

          <div className="space-y-6">
            {[
              {
                competency: "1. Technical Complexity at Scale",
                evidence: "Multi-system integration (payment, compliance, game engines, user accounts), 99.95% uptime requirement, 47+ regulatory jurisdictions, 10x transaction throughput scaling.",
              },
              {
                competency: "2. Multi-Team Leadership & Coordination",
                evidence: "Led coordination across their platform, game systems, compliance, payment, analytics, and LiveOps teams. Resolved dependencies, sequenced work, managed critical path without direct authority.",
              },
              {
                competency: "3. Stakeholder Alignment in Ambiguity",
                evidence: "Translated business value (43x market expansion, 40% ARPU lift) to technical requirements for their stakeholders. Negotiated tradeoffs (timeline vs. quality, resources, risk appetite). Communicated strategy to their CEO, board, legal, and finance teams.",
              },
              {
                competency: "4. Data-Driven Decision Making",
                evidence: "Used market data to justify business case. Monitored product (DAU, retention, ARPU, churn) and technical metrics (uptime, fraud, payment processing). Made go/no-go decisions based on data.",
              },
              {
                competency: "5. Operational Excellence Through Challenges",
                evidence: "Navigated KYC friction, regulatory ambiguity, performance issues, vendor delays. Solved problems without losing sight of outcomes. Maintained timeline, stayed within budget, achieved targets.",
              },
              {
                competency: "6. Requirements & Scope Translation",
                evidence: "Translated 'expand to 43 states' + '40% ARPU growth' into dual wallet, compliance framework, payment integration. Defined phased approach, success criteria, risk mitigation.",
              },
              {
                competency: "7. Communication Clarity",
                evidence: "Able to explain complex technical system (dual wallet, payment processing, compliance) to non-technical audiences (CEO, Board). Also technical deep dives with engineering teams.",
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="p-6 rounded-xl bg-slate-900/30 border border-slate-800"
              >
                <h3 className="font-bold text-blue-400 mb-3">{item.competency}</h3>
                <p className="text-slate-400 text-sm">{item.evidence}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-950 py-20 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.h2
            className="text-4xl md:text-5xl font-heading font-bold text-white mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Complex Systems Demand Expert Thinking
          </motion.h2>

          <motion.p
            className="text-xl text-slate-400 mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            At Kaizen Web, we approach complex transformations with the same rigour: clear requirements, phased rollout, stakeholder alignment, and relentless monitoring.
          </motion.p>

          <motion.button
            onClick={openCalendly}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-blue-600 text-white font-heading font-bold hover:bg-blue-500 transition"
          >
            Book a Technical Discovery Call
            <ArrowUpRight size={18} />
          </motion.button>
        </div>
      </section>

      {/* Pagination */}
      <section className="bg-slate-950 py-16 px-4 border-t border-slate-900">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <Link
              to="/case-studies/independent-retailer"
              className="group flex items-center gap-3 text-white hover:text-blue-400 transition"
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
              className="group flex items-center gap-3 text-white hover:text-blue-400 transition"
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
