import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Layout from "@/components/Layout";

// Animation variants
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
      delayChildren: 0.2,
    },
  },
};

const letterVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Animated H1 component with staggered letter reveal
const AnimatedH1 = ({ text }: { text: string }) => {
  return (
    <motion.h1
      className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold mb-8 leading-tight"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {text.split(" ").map((word, wordIndex) => (
        <motion.span key={wordIndex} className="inline-block mr-4">
          {word.split("").map((char, charIndex) => (
            <motion.span
              key={charIndex}
              variants={letterVariants}
              initial="hidden"
              animate="visible"
              transition={{
                delay: (wordIndex * word.length + charIndex) * 0.05,
                duration: 0.4,
              }}
            >
              {char}
            </motion.span>
          ))}
        </motion.span>
      ))}
    </motion.h1>
  );
};

// Scroll-triggered fade-in component
const ScrollReveal = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    });

    const element = document.getElementById(`scroll-reveal-${delay}`);
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [delay]);

  return (
    <motion.div
      id={`scroll-reveal-${delay}`}
      variants={fadeInUp}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      transition={{ delay: delay * 0.1 }}
    >
      {children}
    </motion.div>
  );
};

// CTA Button component
const CTAButton = ({
  text,
  onClick,
  secondary = false,
  openChat = false,
}: {
  text: string;
  onClick?: () => void;
  secondary?: boolean;
  openChat?: boolean;
}) => {
  const handleClick = () => {
    if (openChat && typeof window !== "undefined") {
      // Open Crisp Chat
      if ((window as any).$crisp) {
        (window as any).$crisp.push(["do", "chat:open"]);
      }
    }
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`px-8 py-3 rounded-full font-heading font-bold inline-flex items-center justify-center gap-2 transition ${
        secondary
          ? "border-2 border-kaizen-cyan text-kaizen-cyan hover:bg-kaizen-cyan/10 dark:border-kaizen-cyan/70 dark:text-kaizen-cyan/70 dark:hover:bg-kaizen-cyan/5"
          : "bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark hover:opacity-90"
      }`}
    >
      {text}
      <ArrowRight size={18} />
    </button>
  );
}

export default function Home() {
  return (
    <Layout>
      <Helmet>
        <title>Web Design Liverpool | Kaizen – Agile Web Development</title>
        <meta
          name="description"
          content="Kaizen is a Liverpool web design agency. We build fast, high-performance websites and offer Agile coaching to improve your team's workflow. No-BS, just results."
        />
      </Helmet>

      {/* Section 1: Hero */}
      <section className="min-h-screen bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85 flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <AnimatedH1 text="Web Design Liverpool." />

            <motion.div
              className="space-y-6 mb-12 text-xl text-kaizen-text-light/80 dark:text-white/70 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <p>
                We build high-performance websites for Liverpool &amp; Wirral
                businesses. Our sites are fast, clean-coded, and delivered with
                an Agile process that means you launch on time, without the
                typical agency headaches.
              </p>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <CTAButton text="Start a Chat" openChat />
              <Link
                to="/case-studies"
                className="px-8 py-3 rounded-full border-2 border-kaizen-text-light/30 dark:border-white/20 text-kaizen-text-light dark:text-white/85 font-heading font-bold hover:border-kaizen-cyan dark:hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
              >
                See Our Work
                <ArrowUpRight size={18} />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2: Who We Help */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Websites for Liverpool &amp; Wirral Businesses
              </h2>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "Professional Services",
                copy: "For solicitors, accountants, and consultants. We build credible sites that showcase your expertise and generate qualified enquiries.",
              },
              {
                title: "Trades &amp; Home Services",
                copy: "For builders, plumbers, and local services. We get you found in local search and make it easy for mobile users to book your services.",
              },
              {
                title: "E-commerce &amp; Retail",
                copy: "For independent shops and online brands. We build fast, secure online stores that make your products simple to find and buy.",
              },
            ].map((card, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {card.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  {card.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 3: Local Trust Block (Asymmetrical) */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-7">
                <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-text-light dark:text-white">
                  Your Local Partner for Liverpool &amp; Wirral
                </h2>

                <div className="space-y-6 text-xl text-kaizen-text-light/80 dark:text-white/70 leading-relaxed">
                  <p>
                    We're a local agency with a deep understanding of the
                    business landscape. We know how customers search in
                    Liverpool, from the city centre to the suburbs, and across
                    the water in the Wirral.
                  </p>
                  <p>
                    We build websites and local SEO strategies that actually
                    capture this intent. No fluff, just local knowledge.
                  </p>
                </div>

                <div className="mt-8">
                  <CTAButton text="Book a 15-Minute Discovery Call" secondary />
                </div>
              </div>

              <div className="md:col-span-5 hidden md:flex items-center justify-center">
                <div className="w-full h-64 bg-gradient-to-br from-kaizen-cyan/20 dark:from-kaizen-cyan/10 to-kaizen-lime/20 dark:to-kaizen-lime/10 rounded-2xl border border-kaizen-cyan/30 dark:border-kaizen-cyan/20"></div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 4: Core Services */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Our Core Services
              </h2>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "Web Design Liverpool",
                copy: "High-performance, mobile-first websites. Built on a modern stack, designed to convert.",
                link: "/services/web-design",
              },
              {
                title: "E-commerce Development",
                copy: "Secure, scalable, and user-friendly online stores that drive sales and integrate with your tools.",
                link: "/services/ecommerce",
              },
              {
                title: "Local SEO",
                copy: "Get found by the customers who matter—the ones in your local area searching for your services.",
                link: "/services/local-seo",
              },
            ].map((service, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition group"
              >
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white group-hover:text-kaizen-cyan transition">
                  {service.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-6">
                  {service.copy}
                </p>
                <Link
                  to={service.link}
                  className="text-kaizen-cyan dark:text-kaizen-cyan/70 font-medium flex items-center gap-2 hover:gap-3 transition"
                >
                  Learn more
                  <ArrowUpRight size={16} />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 5: Agile USP */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              More Than Just a Web Agency
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-12"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "Agile Coaching",
                copy: "Our web design process is built on Agile principles. We also offer this as a standalone service to coach and improve your in-house teams.",
                link: "/services/agile-coaching",
                linkText: "Explore Agile Coaching",
              },
              {
                title: "Contract Product Owner",
                copy: "Need an expert to manage a complex project or digital transformation? Hire one of our experienced Product Owners.",
                link: "/services/contract-product-owner",
                linkText: "Hire a Product Owner",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-white dark:bg-slate-950 rounded-2xl border border-kaizen-light dark:border-slate-800/50"
              >
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {item.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-6">
                  {item.copy}
                </p>
                <Link
                  to={item.link}
                  className="text-kaizen-cyan dark:text-kaizen-cyan/70 font-medium flex items-center gap-2 hover:gap-3 transition"
                >
                  {item.linkText}
                  <ArrowUpRight size={16} />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 6: Case Study Teaser */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white text-center">
              Proof, Not Promises
            </h2>
            <p className="text-xl text-kaizen-text-dark/70 dark:text-white/60 text-center max-w-2xl mx-auto mb-16">
              Real results for Liverpool and Wirral businesses.
            </p>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                industry: "Professional Services – Liverpool",
                problem: "Outdated site was failing to generate quality leads.",
                outcome:
                  "Launched a new, authoritative site. Result: a 40% rise in qualified enquiries.",
              },
              {
                industry: "Home Services – Wirral",
                problem: "Invisible in local search; reliant on word-of-mouth.",
                outcome:
                  "Secured top-3 rankings on Google Business Profile. Result: a new, consistent lead source.",
              },
            ].map((study, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50"
              >
                <div className="text-sm font-bold text-kaizen-cyan dark:text-kaizen-cyan/70 uppercase tracking-wide mb-4">
                  {study.industry}
                </div>
                <h3 className="text-xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  The Challenge
                </h3>
                <p className="text-kaizen-text-dark/70 dark:text-white/60 mb-6 leading-relaxed">
                  {study.problem}
                </p>
                <h3 className="text-xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  The Outcome
                </h3>
                <p className="text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  {study.outcome}
                </p>
              </motion.div>
            ))}
          </motion.div>

          <ScrollReveal delay={2}>
            <div className="text-center">
              <Link
                to="/case-studies"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full border-2 border-kaizen-cyan text-kaizen-cyan dark:border-kaizen-cyan/70 dark:text-kaizen-cyan/70 font-heading font-bold hover:bg-kaizen-cyan/10 dark:hover:bg-kaizen-cyan/5 transition"
              >
                View All Case Studies
                <ArrowUpRight size={18} />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 7: The Kaizen Way */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-text-light dark:text-white text-center">
              How We Work
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "Direct &amp; Transparent",
                copy: "Our Agile process means you see progress in real-time. We have regular check-ins, launch on time, and adapt to changes without derailing the project.",
              },
              {
                title: "We Build, You Control",
                copy: "We build sites on modern platforms that are easy for you to manage. We provide the training so you're not reliant on a developer for every small change.",
              },
              {
                title: "Local &amp; Technical Experts",
                copy: "We live and work here. We understand the Liverpool and Wirral market, but we're also expert-level developers. You get both: local service and world-class code.",
              },
            ].map((item, index) => (
              <motion.div key={index} variants={fadeInUp} className="space-y-4">
                <h3 className="text-2xl font-heading font-bold text-kaizen-text-light dark:text-white">
                  {item.title}
                </h3>
                <p className="text-lg text-kaizen-text-light/80 dark:text-white/70 leading-relaxed">
                  {item.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 8: Final CTA */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
              Ready to Start Your Project?
            </h2>
            <p className="text-xl text-kaizen-text-dark/70 dark:text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed">
              We're available on chat right now. Or, book a 15-minute,
              no-pressure discovery call at a time that suits you.
            </p>
          </ScrollReveal>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <CTAButton text="Start a Live Chat" openChat />
            <Link
              to="/contact"
              className="px-8 py-3 rounded-full border-2 border-kaizen-dark dark:border-white/20 text-kaizen-dark dark:text-white/85 font-heading font-bold hover:border-kaizen-cyan dark:hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
            >
              Book Your 15-Minute Call
              <ArrowUpRight size={18} />
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
