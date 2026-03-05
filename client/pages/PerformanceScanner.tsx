import { useState, useRef } from "react";
import { Helmet } from "@/lib/helmet";
import Layout from "@/components/Layout";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  Clock,
  AlertTriangle,
  Smartphone,
  Zap,
  FileText,
  ChevronDown,
  TrendingDown,
  MousePointer,
  Gauge,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import AppLink from "@/components/routing/AppLink";
import SpeedScanner from "@/components/SpeedScanner";

/* ==========================================================================
   FLOATING ORB BACKGROUND
   ========================================================================== */
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-br from-red-500/20 via-orange-500/10 to-transparent blur-3xl"
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "-20%", right: "-10%" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-amber-500/15 via-yellow-500/10 to-transparent blur-3xl"
        animate={{
          x: [0, -80, 0],
          y: [0, 60, 0],
          scale: [1, 0.9, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{ bottom: "10%", left: "-5%" }}
      />
    </div>
  );
}

/* ==========================================================================
   STAT CARD
   ========================================================================== */
function StatCard({
  icon: Icon,
  stat,
  description,
  index,
}: {
  icon: React.ElementType;
  stat: string;
  description: string;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="text-center p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50"
    >
      <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 mb-4">
        <Icon size={24} />
      </div>
      <div className="text-3xl font-black text-white mb-2">{stat}</div>
      <p className="text-sm text-slate-400">{description}</p>
    </motion.div>
  );
}

/* ==========================================================================
   METRIC CARD (Core Web Vitals)
   ========================================================================== */
function MetricCard({
  title,
  subtitle,
  description,
  icon: Icon,
  color,
  index,
}: {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  color: "red" | "amber" | "orange";
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const colorClasses = {
    red: "from-red-500 to-rose-500 bg-red-500/10 text-red-400",
    amber: "from-amber-500 to-yellow-500 bg-amber-500/10 text-amber-400",
    orange: "from-orange-500 to-red-500 bg-orange-500/10 text-orange-400",
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay: index * 0.15 }}
      className="group relative p-8 rounded-3xl bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300"
    >
      <div className="flex items-start gap-4 mb-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color].split(" ").slice(2).join(" ")}`}
        >
          <Icon size={24} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            {subtitle}
          </p>
          <h3
            className={`text-xl font-bold bg-gradient-to-r ${colorClasses[color].split(" ").slice(0, 2).join(" ")} bg-clip-text text-transparent`}
          >
            {title}
          </h3>
        </div>
      </div>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </motion.div>
  );
}

/* ==========================================================================
   FAQ ITEM
   ========================================================================== */
function FaqItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="border-b border-slate-700/50"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-semibold text-white group-hover:text-amber-400 transition-colors pr-8">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown
            size={20}
            className="text-slate-400 group-hover:text-amber-400 transition-colors"
          />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden"
      >
        <p className="pb-6 text-slate-400 leading-relaxed">{answer}</p>
      </motion.div>
    </motion.div>
  );
}

/* ==========================================================================
   MAIN PAGE COMPONENT
   ========================================================================== */
export default function PerformanceScanner() {
  const goToContact = () => {
    if (typeof window !== "undefined") {
      window.location.assign("/contact");
    }
  };
  const heroRef = useRef<HTMLElement>(null);

  const stats = [
    {
      icon: TrendingDown,
      stat: "53%",
      description: "of visits abandoned if mobile load exceeds 3 seconds",
    },
    {
      icon: Clock,
      stat: "7%",
      description: "conversion drop for every 1-second delay",
    },
    {
      icon: Smartphone,
      stat: "100%",
      description: "of Google rankings now based on mobile speed",
    },
  ];

  const metrics = [
    {
      title: "The First Impression",
      subtitle: "LCP Score",
      description:
        "How long until your visitor sees real content? If this metric is red, they have already left. Your LCP score directly impacts your Google ranking and conversion rate.",
      icon: Gauge,
      color: "red" as const,
    },
    {
      title: "The Annoyance Factor",
      subtitle: "CLS Score",
      description:
        "Does your text jump around while reading? Google hates this because it frustrates users. Layout shift kills trust and tanks your Core Web Vitals score.",
      icon: MousePointer,
      color: "amber" as const,
    },
    {
      title: "The Frozen Screen",
      subtitle: "TBT Score",
      description:
        "Can they click 'Call Now' or is the phone frozen loading scripts? If your site is unresponsive for even 300ms, you are losing mobile customers.",
      icon: ShieldAlert,
      color: "orange" as const,
    },
  ];

  const faqs = [
    {
      question: "How does website speed affect Google ranking?",
      answer:
        "Google's Core Web Vitals are now a direct ranking factor. If your mobile site speed fails their LCP, CLS, and TBT thresholds, you will be pushed down in search results—regardless of how good your content is. Google PageSpeed Insights measures these metrics, and anything below 90 is risky for competitive keywords.",
    },
    {
      question: "Why is my WordPress site so slow on mobile?",
      answer:
        "Most WordPress sites suffer from bloated themes, too many plugins, unoptimised images, and cheap shared hosting. Each plugin adds JavaScript that blocks your page from loading. WordPress speed optimisation requires stripping out the bloat, but often a custom rebuild is more cost-effective than endless patching.",
    },
    {
      question: "What is a good PageSpeed score?",
      answer:
        "Anything under 90 is risky. Google PageSpeed Insights scores below 50 are considered 'Poor' and will hurt your ranking. Scores between 50-89 are 'Needs Improvement.' Only scores of 90+ are considered 'Good.' We build sites that score 95+ by default.",
    },
    {
      question: "Can you fix my speed without rebuilding the whole site?",
      answer:
        "Sometimes. We can audit your current site and implement WordPress speed optimisation techniques—image compression, caching, code minification. But if your foundation is a bloated theme with 30 plugins, patching will only get you so far. A lean rebuild often costs less than years of maintenance on broken code.",
    },
    {
      question: "What is the SEO audit tool measuring?",
      answer:
        "Our performance scanner uses the same Google PageSpeed Insights API that Google uses to rank your site. It measures your Core Web Vitals—LCP, CLS, and TBT—plus overall performance, accessibility, and SEO best practices. You get the same data Google sees.",
    },
    {
      question:
        "How long does it take to improve Google ranking after fixing speed?",
      answer:
        "Google recrawls sites regularly, but you will typically see ranking improvements within 2-4 weeks after fixing your Core Web Vitals. Combined with improved website conversion rate from faster load times, clients often see ROI within the first month.",
    },
  ];

  return (
    <Layout>
      <Helmet>
        <title>
          Free Website Speed Test | Check Your Google PageSpeed Score
        </title>
        <meta
          name="description"
          content="Is your slow website costing you customers? Run a free Google PageSpeed test and check your Core Web Vitals. Get instant results and fix your mobile site speed today."
        />
        <meta
          property="og:title"
          content="Free Website Speed Test | Check Your Google PageSpeed Score"
        />
        <meta
          property="og:description"
          content="Is your slow website costing you customers? Run a free Google PageSpeed test and check your Core Web Vitals. Get instant results and fix your mobile site speed today."
        />
        <meta property="og:type" content="website" />
        <link
          rel="canonical"
          href="https://kaizenweb.co.uk/performance-scanner"
        />
      </Helmet>

      {/* ================================================================
          SECTION 1: HERO - THE "3-SECOND RULE" HOOK
          ================================================================ */}
      <section
        ref={heroRef}
        className="relative min-h-[85vh] flex items-center overflow-hidden bg-slate-950 pt-8"
      >
        <FloatingOrbs />

        <div className="relative z-10 container mx-auto max-w-5xl px-4 py-16 lg:py-24">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium mb-8"
            >
              <AlertTriangle size={16} />
              Free Performance Audit
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-heading font-black text-white leading-[1.1] mb-6"
            >
              Is Your Website{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-amber-400">
                Losing You Money
              </span>{" "}
              Every Second?
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl md:text-2xl text-slate-300 mb-4 leading-relaxed max-w-3xl mx-auto"
            >
              Google penalises slow websites. If your mobile site takes longer
              than 3 seconds to load, you are being buried on Page 2 while your
              competitors take your customers.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg text-slate-400 mb-10"
            >
              Check your Google PageSpeed score. It takes 15 seconds.
            </motion.p>
          </div>

          {/* Speed Scanner Component */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-8"
          >
            <SpeedScanner />
          </motion.div>

          {/* Micro-copy */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-center text-sm text-slate-500"
          >
            100% Free • No Login Required • Instant Results
          </motion.p>
        </div>
      </section>

      {/* ================================================================
          SECTION 2: THE AGITATION - "SILENT KILLER"
          ================================================================ */}
      <section className="py-24 px-4 bg-slate-900 relative overflow-hidden">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-6"
            >
              <TrendingDown size={16} />
              The Invisible Cost
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-heading font-bold text-white mb-6"
            >
              Your Slow Website Is a{" "}
              <span className="text-red-400">Silent Killer</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-slate-400 max-w-2xl mx-auto"
            >
              Most visitors check on their phones—on 4G, not WiFi. Your office
              broadband speed is irrelevant. Mobile site speed is the only
              metric that matters.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, i) => (
              <StatCard key={i} {...stat} index={i} />
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-center text-slate-400 mt-12 max-w-2xl mx-auto"
          >
            Google&apos;s Mobile-First Indexing means they judge you on your
            mobile speed, not your desktop. If your mobile site speed is slow,
            your rankings suffer—no matter how good your content is.
          </motion.p>
        </div>
      </section>

      {/* ================================================================
          SECTION 3: THE "SCIENCE" - DEMYSTIFYING CORE WEB VITALS
          ================================================================ */}
      <section className="py-24 px-4 bg-slate-950 relative overflow-hidden">
        <FloatingOrbs />
        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6"
            >
              <Gauge size={16} />
              Core Web Vitals Explained
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-heading font-bold text-white mb-6"
            >
              What Google Is Actually Measuring
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-slate-400 max-w-2xl mx-auto"
            >
              Forget the jargon. Here is what these scores actually mean for
              your business—and why Google cares.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {metrics.map((metric, i) => (
              <MetricCard key={i} {...metric} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 4: THE "WORDPRESS TRAP" - THE ENEMY
          ================================================================ */}
      <section className="py-24 px-4 bg-slate-900 relative overflow-hidden">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium mb-6">
                <AlertTriangle size={16} />
                The WordPress Trap
              </div>

              <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-6">
                "Why Is My Site So Slow?"
              </h2>

              <p className="text-slate-400 mb-6 leading-relaxed">
                Most agencies use bloated WordPress themes, cheap plugins, and
                shared hosting. It is like putting a Ferrari engine in a
                tractor. Your WordPress speed optimisation efforts are wasted on
                a broken foundation.
              </p>

              <ul className="space-y-4 mb-8">
                {[
                  "Heavy themes with 500KB+ of unused CSS",
                  "30+ plugins, each adding JavaScript bloat",
                  "Unoptimised images that load at full resolution",
                  "Cheap shared hosting that crashes under traffic",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle size={12} className="text-red-400" />
                    </div>
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
                <Zap size={16} />
                The Kaizen Fix
              </div>

              <h3 className="text-2xl font-bold text-white mb-4">
                We Don&apos;t Patch. We Rebuild.
              </h3>

              <p className="text-slate-400 mb-6 leading-relaxed">
                We build with lean, custom technology designed to score 90+ by
                default. No bloat. No plugins. No excuses.
              </p>

              <ul className="space-y-4">
                {[
                  "Custom React builds—zero bloat",
                  "Enterprise hosting with 99.9% uptime",
                  "Optimised images that load progressively",
                  "Clean code that Google loves",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                    </div>
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 5: THE "GATE" VALUE PROPOSITION
          ================================================================ */}
      <section className="py-24 px-4 bg-slate-950 relative overflow-hidden">
        <FloatingOrbs />
        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-3xl p-8 md:p-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-6"
            >
              <FileText size={16} />
              Full Report
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-4xl font-heading font-bold text-white mb-6"
            >
              Don&apos;t Just Get a Number.{" "}
              <span className="text-amber-400">Get a Plan.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed"
            >
              Your free scan gives you a score. But we can go deeper. Get a
              plain-English checklist showing exactly which images are too big,
              which code is blocking your load time, and how to improve your
              Google ranking.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <button
                onClick={goToContact}
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 hover:-translate-y-1"
              >
                Request Full Audit
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 6: FAQ - SEO KEYWORD RICH
          ================================================================ */}
      <section className="py-24 px-4 bg-slate-900">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-heading font-bold text-white mb-6"
            >
              Speed &amp; SEO Questions
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-400"
            >
              Straight answers about Google PageSpeed, Core Web Vitals, and how
              to fix a slow website.
            </motion.p>
          </div>

          <div className="bg-slate-800/50 rounded-3xl border border-slate-700/50 p-8 md:p-10">
            {faqs.map((faq, i) => (
              <FaqItem key={i} {...faq} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 7: FINAL CTA - THE "NO-BRAINER"
          ================================================================ */}
      <section className="py-32 px-4 bg-slate-950 relative overflow-hidden">
        <FloatingOrbs />

        <div className="container mx-auto max-w-4xl relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8"
          >
            <Zap size={16} />
            Stop Guessing
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-heading font-bold text-white mb-8"
          >
            Stop Guessing.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Start Ranking.
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            It takes 15 seconds to run the test. It could save you thousands in
            lost revenue from a fix slow website that ranks where it should.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <AppLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="group inline-flex items-center justify-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:-translate-y-1"
            >
              Run My Free Audit Now
              <ArrowRight
                size={20}
                className="group-hover:translate-x-1 transition-transform"
              />
            </AppLink>
            <button
              onClick={goToContact}
              className="inline-flex items-center justify-center gap-2 px-10 py-5 rounded-full border border-slate-600 text-slate-300 font-medium text-lg hover:bg-slate-800 hover:text-white hover:border-slate-500 transition-all duration-300"
            >
              Talk to an Expert
            </button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
