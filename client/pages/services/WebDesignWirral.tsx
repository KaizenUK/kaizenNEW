import { useState, useEffect, useRef } from "react";
import { Helmet } from "@/lib/helmet";
import Layout from "@/components/Layout";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import {
  ArrowRight,
  Check,
  X,
  Zap,
  Shield,
  Clock,
  Users,
  Scissors,
  Store,
  Wrench,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import AppLink from "@/components/routing/AppLink";
import SpeedScanner from "@/components/SpeedScanner";

/* ==========================================================================
   ANIMATED COUNTER COMPONENT
   ========================================================================== */
function AnimatedCounter({
  value,
  suffix = "",
  duration = 2,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, value, duration]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

/* ==========================================================================
   FLOATING ORB BACKGROUND
   ========================================================================== */
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl"
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "-20%", right: "-10%" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-cyan-500/15 via-sky-500/10 to-transparent blur-3xl"
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
   GRID PATTERN BACKGROUND
   ========================================================================== */
function GridPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      <svg width="100%" height="100%">
        <defs>
          <pattern
            id="grid-wirral"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-emerald-400"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-wirral)" />
      </svg>
    </div>
  );
}

/* ==========================================================================
   STAGGERED TEXT REVEAL
   ========================================================================== */
function TextReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div
        initial={{ y: "100%" }}
        animate={isInView ? { y: 0 } : { y: "100%" }}
        transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ==========================================================================
   FEATURE CARD WITH HOVER EFFECT
   ========================================================================== */
function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="group relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative p-8 rounded-3xl bg-white border border-slate-200 backdrop-blur-sm hover:border-emerald-500/50 transition-all duration-300 h-full">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
          <Icon size={28} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">
          {title}
        </h3>
        <p className="text-slate-600 leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

/* ==========================================================================
   COMPARISON ROW
   ========================================================================== */
function ComparisonRow({
  feature,
  bad,
  good,
  index,
}: {
  feature: string;
  bad: string;
  good: string;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors"
    >
      <div className="font-medium text-slate-900 flex items-center">
        {feature}
      </div>
      <div className="flex items-center gap-3 text-slate-500">
        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <X size={14} className="text-red-500" />
        </div>
        <span className="text-sm">{bad}</span>
      </div>
      <div className="flex items-center gap-3 text-emerald-700">
        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Check size={14} className="text-emerald-500" />
        </div>
        <span className="text-sm font-medium">{good}</span>
      </div>
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
      className="border-b border-slate-200"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors pr-8">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown
            size={20}
            className="text-slate-400 group-hover:text-emerald-500 transition-colors"
          />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden"
      >
        <p className="pb-6 text-slate-600 leading-relaxed">
          {answer}
        </p>
      </motion.div>
    </motion.div>
  );
}

/* ==========================================================================
   MAIN PAGE COMPONENT
   ========================================================================== */
export default function WebDesignWirral() {
  const goToContact = () => {
    if (typeof window !== "undefined") {
      window.location.assign("/contact");
    }
  };
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const features = [
    {
      icon: Clock,
      title: "Fast by Default",
      description:
        "Every site we build loads in under two seconds on mobile. Slow websites lose customers. Ours do not.",
    },
    {
      icon: Shield,
      title: "Solid and Secure",
      description:
        "Built to stay online and stay safe. We do not cut corners on hosting, backups, or security.",
    },
    {
      icon: Users,
      title: "Local and Accountable",
      description:
        "We are based in the North West. Happy to meet you on the peninsula. No offshoring, no call centres.",
    },
    {
      icon: Zap,
      title: "Built to Rank",
      description:
        "Google rewards fast, well-built websites. Ours are designed to help Wirral businesses get found locally.",
    },
  ];

  const sectors = [
    {
      icon: Scissors,
      title: "Salons and Beauty",
      location: "Wallasey & West Kirby",
      description:
        "Booking-focused websites for hairdressers, beauty salons, and spas. Built to move people from Instagram to your appointment book.",
    },
    {
      icon: Store,
      title: "Local Retail and Hospitality",
      location: "Hoylake & New Brighton",
      description:
        "Experience-led websites for cafes, restaurants, and local shops. Built to capture footfall from Google Maps and social media.",
    },
    {
      icon: Wrench,
      title: "Trades and Services",
      location: "Birkenhead & Beyond",
      description:
        "Lead-generation websites for builders, plumbers, electricians, and trades. Built to bring in work, not just look pretty.",
    },
  ];

  const comparisons = [
    {
      feature: "Page Load Speed",
      bad: "5–8 seconds",
      good: "Under 2 seconds",
    },
    {
      feature: "Mobile Experience",
      bad: "Afterthought",
      good: "Designed First",
    },
    {
      feature: "Google Rankings",
      bad: "Hope for the best",
      good: "Built to perform",
    },
    {
      feature: "Code Ownership",
      bad: "Locked in or leased",
      good: "100% yours",
    },
    {
      feature: "After Launch Support",
      bad: "Hard to reach",
      good: "30-day snagging included",
    },
  ];

  const faqs = [
    {
      question: "Why choose a local Wirral web agency?",
      answer:
        "Because we understand the peninsula. We know the difference between West Kirby footfall and Birkenhead trade counters. We are happy to meet you at your salon, office, or a local coffee shop to discuss your goals.",
    },
    {
      question: "How much does a website cost on the Wirral?",
      answer:
        "Prices vary from £500 for a template to £10,000+ for a custom build. Our bespoke brochure sites start from £3,500. We give you a fixed-price quote after a quick chat, so you never get hit with hidden fees.",
    },
    {
      question: "How long does a website take to build?",
      answer:
        "Most websites take four to six weeks from start to finish. If you need something faster, we can discuss a priority build. We will always give you a clear timeline upfront.",
    },
    {
      question: "Do you work with WordPress?",
      answer:
        "We can. But if speed and reliability matter to you, we often recommend a custom build instead. WordPress can work well for simple sites, but it can also slow things down. We will advise you honestly.",
    },
    {
      question: "What happens after the site goes live?",
      answer:
        "You get 30 days of snagging support included — we fix any issues, answer questions, and make small tweaks. After that, we offer ongoing support packages if you need them.",
    },
    {
      question: "Can you fix our current website if it is slow or broken?",
      answer:
        "Yes. We often take on rescue projects where another developer has left a site in a mess. We will audit what you have, explain your options, and fix what needs fixing.",
    },
  ];

  return (
    <Layout>
      <Helmet>
        <title>Web Design Wirral | Local Sites That Get Results</title>
        <meta
          name="description"
          content="Fast, professional websites for Wirral businesses. From Heswall to Birkenhead, we build sites that rank on Google and bring in customers."
        />
        <meta
          property="og:title"
          content="Web Design Wirral | Local Sites That Get Results"
        />
        <meta
          property="og:description"
          content="Fast, professional websites for Wirral businesses. From Heswall to Birkenhead, we build sites that rank on Google and bring in customers."
        />
        <meta property="og:type" content="website" />
        <link
          rel="canonical"
          href="https://kaizenweb.co.uk/web-design-wirral"
        />
      </Helmet>

      {/* ================================================================
          HERO SECTION
          ================================================================ */}
      <section
        ref={heroRef}
        className="relative min-h-[90vh] flex items-center overflow-hidden bg-slate-950"
      >
        <FloatingOrbs />
        <GridPattern />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 container mx-auto max-w-6xl px-4 py-24 lg:py-32"
        >
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Web Design Wirral
            </motion.div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black text-white leading-[1.05] mb-8">
              <TextReveal delay={0.1}>Fast websites</TextReveal>
              <TextReveal delay={0.2}>for Wirral</TextReveal>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-300">
                <TextReveal delay={0.3}>businesses.</TextReveal>
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-xl md:text-2xl text-slate-300 mb-10 leading-relaxed max-w-2xl"
            >
              We build professional websites that load quickly, look great on
              mobile, and help you get found on Google. No jargon. No fuss. Just
              results.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <button
                onClick={goToContact}
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:-translate-y-1"
              >
                Get in Touch
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
              <AppLink
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-slate-600 text-slate-300 font-medium hover:bg-slate-800 hover:text-white hover:border-slate-500 transition-all duration-300"
              >
                Book a Call
              </AppLink>
            </motion.div>
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-20 grid grid-cols-3 gap-8 max-w-xl"
          >
            {[
              { value: 96, suffix: "+", label: "Speed Score" },
              { value: 99, suffix: "%", label: "Uptime" },
              { value: 30, suffix: " day", label: "Support" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-black text-white mb-1">
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    duration={2}
                  />
                </div>
                <div className="text-xs uppercase tracking-wider text-slate-500 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-slate-600 flex items-start justify-center p-2"
          >
            <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </motion.div>
        </motion.div>
      </section>

      {/* ================================================================
          SPEED TEST SECTION
          ================================================================ */}
      <section className="py-24 px-4 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm font-medium mb-6"
            >
              <Zap size={16} />
              Free Speed Check
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-heading font-bold text-slate-900 mb-6"
            >
              Is Your Website Slowing You Down?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-slate-600 max-w-2xl mx-auto"
            >
              Google pushes slow websites down the rankings. If your site takes
              more than three seconds to load, you are losing visitors. Test
              yours below.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <SpeedScanner />
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          FEATURES SECTION
          ================================================================ */}
      <section className="py-24 px-4 bg-slate-50 relative overflow-hidden">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-5xl font-heading font-bold text-slate-900 mb-6"
            >
              Why Wirral Businesses Choose Us
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-600 max-w-2xl mx-auto"
            >
              We are not just another remote agency. We are your neighbours, and
              we understand the local market.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <FeatureCard key={i} {...feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          LOCAL SECTORS SECTION
          ================================================================ */}
      <section className="py-24 px-4 bg-slate-950 relative overflow-hidden">
        <FloatingOrbs />
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6"
            >
              Peninsula Expertise
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-heading font-bold text-white mb-6"
            >
              Built for the Wirral
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-slate-400 max-w-2xl mx-auto"
            >
              Wirral businesses are not one-size-fits-all. We design websites
              around how people actually find and book you — from high street
              footfall to late-night mobile searches.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sectors.map((sector, i) => {
              const ref = useRef<HTMLDivElement>(null);
              const isInView = useInView(ref, { once: true, margin: "-50px" });

              return (
                <motion.div
                  ref={ref}
                  key={i}
                  initial={{ opacity: 0, y: 40 }}
                  animate={
                    isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }
                  }
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className="group relative p-8 rounded-3xl bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-slate-700/50 backdrop-blur-sm hover:border-emerald-500/30 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
                      <sector.icon size={24} />
                    </div>
                    <p className="text-xs font-medium uppercase tracking-wider text-emerald-400 mb-2">
                      {sector.location}
                    </p>
                    <h3 className="text-xl font-bold text-white mb-3">
                      {sector.title}
                    </h3>
                    <p className="text-slate-400 leading-relaxed">
                      {sector.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================
          COMPARISON SECTION
          ================================================================ */}
      <section className="py-24 px-4 bg-white relative overflow-hidden">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-5xl font-heading font-bold text-slate-900 mb-6"
            >
              The Difference
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-600"
            >
              What you get with us versus a typical web designer.
            </motion.p>
          </div>

          <div className="bg-slate-50 rounded-3xl border border-slate-200 p-6 md:p-8">
            <div className="hidden md:grid grid-cols-3 gap-4 pb-4 mb-4 border-b border-slate-200">
              <div className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Feature
              </div>
              <div className="text-sm font-bold uppercase tracking-wider text-red-500 text-center">
                Typical
              </div>
              <div className="text-sm font-bold uppercase tracking-wider text-emerald-500 text-center">
                Kaizen
              </div>
            </div>
            <div className="space-y-2">
              {comparisons.map((row, i) => (
                <ComparisonRow key={i} {...row} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          FAQ SECTION
          ================================================================ */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-5xl font-heading font-bold text-slate-900 mb-6"
            >
              Common Questions
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-600"
            >
              Straight answers to the things people ask most.
            </motion.p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10">
            {faqs.map((faq, i) => (
              <FaqItem key={i} {...faq} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FINAL CTA
          ================================================================ */}
      <section className="py-32 px-4 bg-slate-950 relative overflow-hidden">
        <FloatingOrbs />
        <GridPattern />

        <div className="container mx-auto max-w-4xl relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Ready When You Are
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-heading font-bold text-white mb-8"
          >
            Ready to Level Up
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              Your Wirral Site?
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Whether you are based in Heswall, West Kirby, Birkenhead or anywhere
            on the peninsula — we will help you ship a site that looks sharp,
            loads fast, and actually wins work.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <button
              onClick={goToContact}
              className="group inline-flex items-center justify-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:-translate-y-1"
            >
              Get in Touch
              <ArrowRight
                size={20}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
            <AppLink
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-10 py-5 rounded-full border border-slate-600 text-slate-300 font-medium text-lg hover:bg-slate-800 hover:text-white hover:border-slate-500 transition-all duration-300"
            >
              Book a Discovery Call
            </AppLink>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
