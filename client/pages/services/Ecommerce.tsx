import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  ArrowUpRight,
  Lock,
  Package,
  TrendingUp,
  Zap,
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
          E-commerce Development Liverpool | Fast Headless & WooCommerce | Kaizen
        </title>
        <meta
          name="description"
          content="We build high-performance e-commerce websites for Liverpool & Wirral. Stop losing sales to a slow site. We build fast, custom, headless e-commerce stores."
        />
      </Helmet>

      {/* Section 1: Hero - 50/50 Split Layout */}
      <section className="min-h-screen bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85 flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="max-w-2xl">
              <AnimatedH1 text="E-commerce That Sells." />

              <motion.div
                className="space-y-6 mb-12 text-xl text-kaizen-text-light/80 dark:text-white/70 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                <p>
                  Most e-commerce sites are slow, clunky, and lose sales. We
                  build high-performance stores for Liverpool & Wirral
                  businesses—whether it's a lightning-fast Headless build or a
                  powerful, easy-to-manage WordPress site.
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

            {/* Right: Abstract Visual */}
            <motion.div
              className="hidden md:flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              <div className="w-full h-96 rounded-2xl border border-kaizen-cyan/30 dark:border-kaizen-cyan/20 overflow-hidden bg-gradient-to-br from-kaizen-cyan/10 dark:from-kaizen-cyan/5 via-kaizen-lime/5 dark:via-kaizen-lime/3 to-kaizen-cyan/10 dark:to-kaizen-cyan/5 flex items-center justify-center">
                <div className="relative w-full h-full">
                  {/* Abstract wireframe design */}
                  <motion.div
                    className="absolute inset-0 opacity-20"
                    animate={{
                      backgroundPosition: ["0% 0%", "100% 100%"],
                    }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    style={{
                      background:
                        "linear-gradient(45deg, rgba(0,255,200,0.3) 0%, rgba(0,255,200,0) 50%, rgba(0,255,200,0.3) 100%)",
                      backgroundSize: "200% 200%",
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="space-y-4">
                      <Zap
                        size={64}
                        className="text-kaizen-cyan/40 dark:text-kaizen-cyan/20 mx-auto"
                      />
                      <p className="text-kaizen-text-dark/30 dark:text-white/20 font-heading font-bold text-sm text-center max-w-xs">
                        Lightning-Fast Performance
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2: Our E-commerce Expertise */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              Our E-commerce Expertise
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
                bestFor: "Ambitious brands who need unbeatable speed and a unique, custom-branded experience.",
                icon: Zap,
              },
              {
                title: "WordPress + WooCommerce",
                subtitle: "(For Ultimate Control)",
                copy: "The world's most popular platform for a reason. Get a powerful, secure store built on a platform you already know how to use. Easy content management, endless plugins.",
                bestFor: "Businesses who want total control to manage their own content, products, and plugins.",
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

          {/* Shopify Support Section - Visually Distinct */}
          <motion.div
            className="mt-20 mx-auto max-w-5xl overflow-hidden"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 items-stretch bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-black rounded-3xl overflow-hidden border border-slate-700/50 dark:border-slate-800">
              {/* Image on the left */}
              <div className="hidden md:block relative h-80 overflow-hidden">
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F85912ce9f05a4f7cb336598a47962b01?format=webp&width=800"
                  alt="Delivery professional delivering online store products to customer"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Content on the right */}
              <div className="p-8 md:p-12 flex flex-col justify-center">
                <h3 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-white leading-tight">
                  Shopify Expertise
                </h3>
                <p className="text-lg text-slate-300/90 leading-relaxed mb-6">
                  We also offer expert assistance with installing and configuring Shopify stores, including theme selection and customisation. From initial setup to ongoing optimisation, we ensure your store is built for conversions.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <CTAButton text="Explore Shopify Services" openChat />
                </div>
              </div>
            </div>
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

      {/* Section 4: Local Proof (Honest & Believable) */}
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
                  The Outcome
                </h4>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  The new site now handles peak season traffic with zero
                  downtime, and the improved mobile experience has led to a
                  clear, measurable increase in online sales.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-kaizen-cyan/20 dark:from-kaizen-cyan/10 to-kaizen-lime/20 dark:to-kaizen-lime/10 rounded-2xl border border-kaizen-cyan/30 dark:border-kaizen-cyan/20 p-8 h-96 flex items-center justify-center">
              <div className="text-center space-y-4">
                <TrendingUp
                  size={64}
                  className="text-kaizen-cyan/40 dark:text-kaizen-cyan/20 mx-auto"
                />
                <p className="text-kaizen-text-dark/60 dark:text-white/50 font-heading font-bold text-lg">
                  Improved Mobile Experience
                </p>
                <p className="text-kaizen-text-dark/50 dark:text-white/40 text-sm">
                  Measurable increase in online sales
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
                link: "/agile-coaching",
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

      {/* Section 6: Final Call to Action */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-text-light dark:text-white">
              Stop Losing Sales to a Slow Site.
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
