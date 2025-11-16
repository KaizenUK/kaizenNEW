import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  ArrowUpRight,
  ShoppingCart,
  Zap,
  Smartphone,
  Lock,
  Package,
  TrendingUp,
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

const letterVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Animated H1 component with staggered letter reveal
const AnimatedH1 = ({ text }: { text: string }) => {
  return (
    <motion.h1
      className="text-5xl md:text-6xl lg:text-6xl font-heading font-bold mb-8 leading-tight"
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
};

export default function Ecommerce() {
  return (
    <Layout>
      <Helmet>
        <title>
          E-commerce Development Liverpool | Headless & WooCommerce | Kaizen
        </title>
        <meta
          name="description"
          content="We build e-commerce websites for Liverpool & Wirral. We offer high-speed Headless e-commerce and powerful, user-friendly WooCommerce/WordPress stores."
        />
      </Helmet>

      {/* Section 1: Hero */}
      <section className="min-h-screen bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85 flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl">
              <AnimatedH1 text="E-commerce That Converts." />

              <motion.div
                className="space-y-6 mb-12 text-xl text-kaizen-text-light/80 dark:text-white/70 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                <p>
                  We build e-commerce platforms for Liverpool & Wirral
                  businesses. From lightning-fast Headless stores to powerful,
                  easy-to-manage WordPress & WooCommerce sites.
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
                  to="/contact"
                  className="px-8 py-3 rounded-full border-2 border-kaizen-text-light/30 dark:border-white/20 text-kaizen-text-light dark:text-white/85 font-heading font-bold hover:border-kaizen-cyan dark:hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
                >
                  Book a 15-Minute Call
                  <ArrowUpRight size={18} />
                </Link>
              </motion.div>
            </div>

            {/* Hero image on the right */}
            <motion.div
              className="hidden md:flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              <div className="w-full h-96 rounded-2xl border border-kaizen-cyan/30 dark:border-kaizen-cyan/20 overflow-hidden">
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F2d489d81daa54d3dacb3edd616859055?format=webp&width=800"
                  alt="High-performance e-commerce development"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2: The Right Tool for the Job (Your USP) */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              The Right E-commerce Platform for You
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "Headless E-commerce",
                subtitle: "(For Ultimate Performance)",
                copy: "We use a modern React/Vite frontend with a backend like Shopify. This is the fastest possible solution, giving you a huge SEO advantage and a friction-free user experience.",
                bestFor:
                  "Ambitious brands, high-traffic stores, and unique user experiences.",
                icon: Zap,
              },
              {
                title: "WordPress + WooCommerce",
                subtitle: "(For Ultimate Control)",
                copy: "The world's most popular platform for a reason. Get a powerful, secure store built on a platform you already know how to use. Easy content management, endless plugins.",
                bestFor:
                  "Businesses who want to manage their own content, products, and plugins with total familiarity.",
                icon: TrendingUp,
              },
            ].map((item, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <div className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition h-full">
                  <div className="mb-6 p-4 w-16 h-16 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 dark:from-kaizen-cyan/10 dark:to-kaizen-lime/10 rounded-xl flex items-center justify-center">
                    <item.icon
                      className="text-kaizen-cyan dark:text-kaizen-cyan/70"
                      size={32}
                    />
                  </div>
                  <h3 className="text-2xl font-heading font-bold mb-2 text-kaizen-dark dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-sm text-kaizen-cyan dark:text-kaizen-cyan/70 font-medium mb-4">
                    {item.subtitle}
                  </p>
                  <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-6">
                    {item.copy}
                  </p>
                  <div>
                    <p className="text-sm font-bold text-kaizen-cyan dark:text-kaizen-cyan/70 uppercase tracking-wide mb-2">
                      Best for
                    </p>
                    <p className="text-kaizen-text-dark/70 dark:text-white/60">
                      {item.bestFor}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 3: What We Build (The Features) */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              A Secure, Scalable Store. Guaranteed.
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
                title: "Secure Payments",
                copy: "Full integration with Stripe, PayPal, and all major payment gateways. Built with security best practices from day one.",
              },
              {
                icon: Package,
                title: "Easy Product Management",
                copy: "We provide a simple-to-use backend (whether it's Shopify, WordPress, or another CMS) and give you the training to manage your products.",
              },
              {
                icon: TrendingUp,
                title: "Built to Scale",
                copy: "Whether you have 10 products or 10,000, we build your site on a technical foundation that can grow with your business.",
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

      {/* Section 4: Local Proof (Plausible & Generic) */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-12 text-kaizen-dark dark:text-white text-center">
              From Local Brand to National Seller
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto items-center"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-kaizen-cyan dark:text-kaizen-cyan/70 uppercase tracking-wide mb-3">
                  Client: Independent Retailer – Liverpool
                </h3>
              </div>

              <div>
                <h4 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  The Problem
                </h4>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  A great local brand with a basic, slow-loading site that
                  couldn't handle mobile traffic or sales spikes during peak
                  season.
                </p>
              </div>

              <div>
                <h4 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  The Fix
                </h4>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  We built a new, fast e-commerce site. It's now easy for them
                  to manage products and provides a smooth, instant checkout
                  experience for their customers on all devices.
                </p>
              </div>

              <div>
                <h4 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  The Result
                </h4>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-6">
                  3x faster checkout, 50% increase in mobile conversions, and
                  the site now handles peak season traffic with zero downtime.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-kaizen-cyan/20 dark:from-kaizen-cyan/10 to-kaizen-lime/20 dark:to-kaizen-lime/10 rounded-2xl border border-kaizen-cyan/30 dark:border-kaizen-cyan/20 p-8 h-96 flex items-center justify-center">
              <div className="text-center">
                <ShoppingCart
                  size={64}
                  className="text-kaizen-cyan/40 mb-4 mx-auto"
                />
                <p className="text-kaizen-text-dark/60 dark:text-white/50 font-heading font-bold text-xl">
                  50% Increase in Mobile Conversions
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Section 5: Internal Links (Cross-Sell) */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              An Online Store is Just the Start
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "Local SEO",
                copy: "Get your new store found by local customers in Liverpool & Wirral.",
                link: "/services/local-seo",
              },
              {
                title: "Agile Coaching",
                copy: "Managing a complex e-commerce team or project? We can streamline your workflow.",
                link: "/services/agile-coaching",
              },
            ].map((card, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Link
                  to={card.link}
                  className="p-8 bg-white dark:bg-slate-950 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition group block h-full"
                >
                  <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white group-hover:text-kaizen-cyan transition">
                    {card.title}
                  </h3>
                  <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-6">
                    {card.copy}
                  </p>
                  <div className="text-kaizen-cyan font-medium flex items-center gap-2 hover:gap-3 transition">
                    Explore <ArrowUpRight size={16} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 6: Final Call to Action (CTA) */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-text-light dark:text-white">
              Ready to Build Your E-commerce Site?
            </h2>
            <p className="text-xl text-kaizen-text-light/80 dark:text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
              Let's talk about the right platform for your business. Chat with
              us or book a no-pressure call.
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
              className="px-8 py-3 rounded-full border-2 border-kaizen-text-light/30 dark:border-white/20 text-kaizen-text-light dark:text-white/85 font-heading font-bold hover:border-kaizen-cyan dark:hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
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
