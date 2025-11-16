import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  ArrowUpRight,
  Lock,
  Zap,
  Settings,
  Check,
} from "lucide-react";

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
      className={`px-8 py-3 rounded-lg font-heading font-bold inline-flex items-center justify-center gap-2 transition ${
        secondary
          ? "border-2 border-kaizen-cyan text-kaizen-cyan hover:bg-kaizen-cyan/10 dark:border-kaizen-cyan/70 dark:text-kaizen-cyan/70 dark:hover:bg-kaizen-cyan/5"
          : "bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark hover:shadow-lg hover:shadow-kaizen-cyan/50"
      }`}
    >
      {text}
      <ArrowRight size={18} />
    </button>
  );
};

export default function WordPressWebDesign() {
  return (
    <Layout>
      <Helmet>
        <title>WordPress Web Design Liverpool | Fast, Secure WP Sites | Kaizen</title>
        <meta
          name="description"
          content="We build custom WordPress websites for Liverpool & Wirral. Get the power and familiarity of WordPress, built the right way: fast, secure, and with no bloat."
        />
      </Helmet>

      {/* Section 1: Hero - Layered Card & Reveal Style */}
      <section className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-black overflow-hidden flex items-center py-20">
        {/* Background visual - abstract WordPress editor aesthetic */}
        <motion.div
          className="absolute inset-0 opacity-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          transition={{ duration: 1.2, delay: 0.2 }}
        >
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(0,255,200,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,255,200,0.3) 0%, transparent 60%)",
              filter: "blur(80px)",
            }}
          />
        </motion.div>

        {/* Subtle animated accent shapes */}
        <motion.div
          className="absolute top-20 right-20 w-96 h-96 rounded-full"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.05, 0.1, 0.05],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            background: "radial-gradient(circle, rgba(0,255,200,0.5) 0%, transparent 70%)",
          }}
        />

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Floating Text Card */}
            <motion.div
              className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-2xl border border-white/20 dark:border-slate-800/50"
              initial={{ opacity: 0, x: -60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              <motion.h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black mb-6 leading-tight text-kaizen-dark dark:text-white">
                {["WordPress", "Web Design", "Liverpool."].map((word, index) => (
                  <motion.span
                    key={index}
                    className="block"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.3 + index * 0.15,
                      duration: 0.6,
                      ease: "easeOut",
                    }}
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.h1>

              <motion.p
                className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.8 }}
              >
                Get the platform you know and love, built the right way. We build fast, secure, and easy-to-manage WordPress websites for Liverpool & Wirral businesses. No clunky themes, no bloat—just performance.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
              >
                <CTAButton text="Start a Chat" openChat />
                <Link
                  to="/contact"
                  className="px-8 py-3 rounded-lg border-2 border-kaizen-cyan text-kaizen-cyan dark:text-kaizen-cyan/70 font-heading font-bold hover:bg-kaizen-cyan/10 dark:hover:bg-kaizen-cyan/5 transition inline-flex items-center justify-center gap-2"
                >
                  Book a 15-Minute Call
                  <ArrowUpRight size={18} />
                </Link>
              </motion.div>
            </motion.div>

            {/* Right side - subtle visual indicator */}
            <motion.div
              className="hidden md:flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.9 }}
            >
              <div className="relative w-full h-96">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/10 dark:from-kaizen-cyan/10 dark:to-kaizen-lime/5 rounded-2xl"
                  animate={{
                    rotateZ: [-1, 1, -1],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fa18f81c064614dceb4a9d1fcb2c9f64b?format=webp&width=800"
                  alt="WordPress block editor interface for easy content management"
                  className="w-full h-full object-cover rounded-2xl"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2: The "Why" - Pain Point */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
              A WordPress Site Doesn't Have to Be Slow.
            </h2>
            <p className="text-xl text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed max-w-3xl">
              The problem isn't WordPress; it's the way most agencies build on it. They use cheap, bloated themes and dozens of clunky plugins that break your site and kill your page speed. We're different. We build custom, clean WordPress sites from the ground up, giving you a fast, secure foundation.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 3: The Kaizen WordPress Method */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              The Kaizen WordPress Method
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
                icon: Lock,
                title: "Total Control, No Bloat",
                copy: "We give you the full power of the WordPress block editor on a clean, custom build. You can manage 100% of your content without the limitations of a rigid theme.",
              },
              {
                icon: Zap,
                title: "Fast & Secure",
                copy: "Our builds are performance-optimised from day one. We follow security best practices, ensuring your site is fast for users and safe from attacks.",
              },
              {
                icon: Settings,
                title: "Full Ecosystem",
                copy: "Need WooCommerce? A booking system? Advanced plugins? We are experts at integrating complex features into WordPress in a clean and scalable way.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-white dark:bg-slate-950 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <div className="mb-6 p-4 w-16 h-16 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 dark:from-kaizen-cyan/10 dark:to-kaizen-lime/10 rounded-xl flex items-center justify-center">
                  <item.icon
                    className="text-kaizen-cyan dark:text-kaizen-cyan/70"
                    size={32}
                  />
                </div>
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {item.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  {item.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 4: Real Results for Local Businesses */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              Real Results for Local Businesses
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                client: "Helen Moore Hairdressing",
                industry: "Boutique Salon – Wirral",
                problem:
                  "A top-rated salon in Wallasey Village with no website, missing out on online discovery and relying on phone-only bookings.",
                outcome:
                  "We built a classy, easy-to-manage WordPress site that captures her brand and includes a 24/7 online booking system.",
              },
              {
                client: "A.S Collections",
                industry: "Professional Services – Liverpool",
                problem:
                  "Their previous site was dated, performed poorly on mobile, and failed to build trust in the competitive commercial debt recovery sector.",
                outcome:
                  "A complete, modern redesign on an easy-to-use platform. The new site is fast, authoritative, and simple for their team to update.",
              },
            ].map((caseStudy, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50"
              >
                <h3 className="text-sm font-bold text-kaizen-cyan dark:text-kaizen-cyan/70 uppercase tracking-wide mb-2">
                  {caseStudy.client}
                </h3>
                <p className="text-xs font-medium text-kaizen-text-dark/60 dark:text-white/50 mb-6">
                  {caseStudy.industry}
                </p>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-heading font-bold text-kaizen-dark dark:text-white mb-2">
                      The Problem
                    </h4>
                    <p className="text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                      {caseStudy.problem}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-heading font-bold text-kaizen-dark dark:text-white mb-2">
                      The Outcome
                    </h4>
                    <p className="text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                      {caseStudy.outcome}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 5: Internal Links - Cross-Sell */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-12 text-kaizen-dark dark:text-white text-center">
              Looking for Ultimate Performance?
            </h2>
          </ScrollReveal>

          <motion.div
            className="max-w-2xl mx-auto"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <Link
              to="/services/web-design-liverpool"
              className="block p-8 md:p-12 bg-white dark:bg-slate-950 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition group"
            >
              <h3 className="text-3xl md:text-4xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white group-hover:text-kaizen-cyan transition">
                Need a Headless Build?
              </h3>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-6">
                WordPress is perfect for most businesses. But for ambitious brands needing unbeatable speed and a fully custom app-like experience, we also offer high-performance Headless builds.
              </p>
              <div className="text-kaizen-cyan font-medium flex items-center gap-2 hover:gap-3 transition">
                Explore Headless Web Design <ArrowUpRight size={20} />
              </div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Section 6: Final Call to Action */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-text-light dark:text-white">
              Get a WordPress Site You Can Rely On.
            </h2>
            <p className="text-xl text-kaizen-text-light/80 dark:text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
              Let's talk about building a fast, secure WordPress site for your Liverpool business. Chat with us or book a no-pressure call.
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
              className="px-8 py-3 rounded-lg border-2 border-kaizen-text-light/30 dark:border-white/20 text-kaizen-text-light dark:text-white/85 font-heading font-bold hover:border-kaizen-cyan dark:hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
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
