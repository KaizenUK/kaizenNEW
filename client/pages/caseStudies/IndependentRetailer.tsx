import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function IndependentRetailerCase() {
  return (
    <Layout>
      <Helmet>
        <title>Independent Retailer Case Study | Kaizen Web</title>
        <meta
          name="description"
          content="How we built a high-performance headless e-commerce site for a Liverpool retailer, fixing speed and mobile conversions."
        />
      </Helmet>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-amber-500 to-amber-600 dark:from-slate-900 dark:to-slate-950 min-h-screen flex items-center py-20 px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23fff%22 width=%2250%22 height=%2250%22/><rect fill=%22%23fff%22 x=%2250%22 y=%2250%22 width=%2250%22 height=%2250%22/></svg>')]" />
        </div>

        <div className="relative container mx-auto max-w-4xl">
          <Link
            to="/case-studies"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white transition mb-12"
          >
            <ArrowLeft size={18} />
            Back to Case Studies
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
            className="space-y-6"
          >
            <span className="inline-block text-amber-200 text-sm font-mono font-bold uppercase tracking-widest">
              Case Study
            </span>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black leading-tight text-white">
              Independent Retailer, Liverpool
            </h1>

            <p className="text-xl md:text-2xl text-white/80 leading-relaxed max-w-3xl">
              A high-performance headless e-commerce build to fix a slow, clunky
              site and boost mobile conversions.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 3-Column Summary Bar */}
      <section className="bg-white dark:bg-slate-950 py-16 px-4 border-b border-kaizen-light dark:border-slate-800">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <h3 className="text-sm font-mono font-bold text-kaizen-cyan uppercase tracking-widest mb-4">
                The Problem
              </h3>
              <p className="text-lg text-kaizen-text-dark dark:text-white/80 leading-relaxed">
                A slow, clunky e-commerce platform that was hemorrhaging
                customers on mobile. Page load times were over 5 seconds, and
                conversion rates were abysmal.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-sm font-mono font-bold text-kaizen-cyan uppercase tracking-widest mb-4">
                The Solution
              </h3>
              <p className="text-lg text-kaizen-text-dark dark:text-white/80 leading-relaxed">
                A modern, headless e-commerce build using React on the frontend
                with optimised inventory management and lightning-fast
                performance.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-sm font-mono font-bold text-kaizen-cyan uppercase tracking-widest mb-4">
                Services Provided
              </h3>
              <p className="text-lg text-kaizen-text-dark dark:text-white/80 leading-relaxed">
                E-commerce Architecture, Headless (React), Performance
                Optimisation
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* The Story Section */}
      <section className="bg-kaizen-light dark:bg-slate-900/50 py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="space-y-16">
            {/* Challenge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                The Challenge: A Slow Platform Losing Sales
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                This independent retailer had built their business with heart
                and expertise, but their e-commerce platform was a technical
                liability. The site was bloated, slow, and frankly terrible on
                mobile. Customers were abandoning carts at alarming rates, and
                the retailer was losing revenue by the day.
              </p>
            </motion.div>

            {/* Solution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                The Solution: Headless, Modern, and Fast
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed mb-8">
                We rebuilt the entire e-commerce platform from the ground up
                using a modern headless architecture. This is about getting out
                of the way and letting the product shine.
              </p>

              <ul className="space-y-4">
                {[
                  {
                    title: "Lightning-Fast Performance",
                    desc: "Page load times dropped from 5+ seconds to under 1 second. This isn't just better UX; it directly impacts conversion rates.",
                  },
                  {
                    title: "Mobile-First Design",
                    desc: "60% of traffic is mobile. We built this site mobile-first, ensuring every customer gets a flawless experience on their phone.",
                  },
                  {
                    title: "Scalable Architecture",
                    desc: "As the business grows, the platform grows with it. No more 'outgrowing' the technology.",
                  },
                  {
                    title: "Real-Time Inventory",
                    desc: "Customers always see accurate stock levels. No more overselling or angry customers.",
                  },
                ].map((item, index) => (
                  <li key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-kaizen-cyan/20 flex items-center justify-center mt-1">
                      <span className="text-kaizen-cyan text-xs font-bold">
                        ✓
                      </span>
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-kaizen-dark dark:text-white mb-1">
                        {item.title}
                      </h4>
                      <p className="text-kaizen-text-dark/70 dark:text-white/70">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Outcome */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                The Result: A Platform Built to Convert
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                The new e-commerce platform is fast, reliable, and built for
                growth. Mobile conversions have skyrocketed, cart abandonment is
                down, and the retailer can now focus on what matters: growing
                their business, not managing their tech.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Internal Links CTA */}
      <section className="bg-white dark:bg-slate-950 py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            className="text-4xl md:text-5xl font-heading font-bold mb-16 text-center text-kaizen-dark dark:text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Need a Similar Result?
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "View Our E-commerce Services",
                desc: "Learn how we build high-performance e-commerce platforms that convert.",
                link: "/services/ecommerce",
              },
              {
                title: "Explore Digital Transformation",
                desc: "See how we modernize legacy systems and unlock new potential.",
                link: "/services/digital-transformation",
              },
            ].map((card, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={card.link}
                  className="group block p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition h-full"
                >
                  <h3 className="text-2xl font-heading font-bold mb-3 text-kaizen-dark dark:text-white group-hover:text-kaizen-cyan transition">
                    {card.title}
                  </h3>
                  <p className="text-kaizen-text-dark/70 dark:text-white/60 mb-6">
                    {card.desc}
                  </p>
                  <div className="text-kaizen-cyan font-medium flex items-center gap-2 group-hover:gap-3 transition">
                    Learn More
                    <ArrowUpRight
                      size={18}
                      className="group-hover:translate-y-[-2px] group-hover:translate-x-[2px] transition"
                    />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pagination */}
      <section className="bg-kaizen-light dark:bg-slate-900/50 py-16 px-4 border-t border-kaizen-light dark:border-slate-800">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <Link
              to="/case-studies/helen-moore-hairdressing"
              className="group flex items-center gap-3 text-kaizen-dark dark:text-white hover:text-kaizen-cyan transition"
            >
              <span className="group-hover:-translate-x-1 transition">←</span>
              Previous Case Study
            </Link>

            <Link
              to="/case-studies"
              className="text-kaizen-cyan hover:text-kaizen-dark dark:hover:text-white transition text-sm font-medium"
            >
              View All
            </Link>

            <Link
              to="/case-studies/as-collections"
              className="group flex items-center gap-3 text-kaizen-dark dark:text-white hover:text-kaizen-cyan transition"
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
