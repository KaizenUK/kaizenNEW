import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { ArrowUpRight } from "lucide-react";

const caseStudies = [
  {
    id: "as-collections",
    client: "A.S Collections",
    category: "Debt Recovery",
    summary: "A complete redesign transforming a dated website into a high-trust, authoritative platform for a leading Liverpool debt recovery firm.",
    services: ["Web Design", "Content Strategy", "WordPress"],
    slug: "as-collections",
    color: "from-blue-500 to-blue-600",
  },
  {
    id: "helen-moore-hairdressing",
    client: "Helen Moore Hairdressing",
    category: "Salon & Beauty",
    summary: "A 0-to-1 build: taking a top-rated Wirral salon from 'no website' to a fully booked, high-end online brand with local dominance.",
    services: ["Web Design", "Local SEO", "Booking System"],
    slug: "helen-moore-hairdressing",
    color: "from-rose-500 to-rose-600",
  },
  {
    id: "independent-retailer",
    client: "Independent Retailer, Liverpool",
    category: "E-commerce",
    summary: "A high-performance headless e-commerce build that fixed a slow, clunky platform and boosted mobile conversions.",
    services: ["E-commerce", "Headless (React)", "Performance"],
    slug: "independent-retailer",
    color: "from-amber-500 to-amber-600",
  },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

export default function CaseStudies() {
  return (
    <Layout>
      <Helmet>
        <title>Case Studies | Liverpool Web Design Results | Kaizen</title>
        <meta
          name="description"
          content="Proof, not promises. See our real, 'no-BS' case studies for Liverpool & Wirral businesses. We deliver results."
        />
      </Helmet>

      {/* Section 1: Hero */}
      <section className="min-h-screen bg-gradient-to-br from-kaizen-dark via-kaizen-dark to-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 flex items-center py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <motion.span
              className="text-kaizen-cyan text-sm font-mono font-bold uppercase tracking-widest"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.6 }}
            >
              Our Portfolio
            </motion.span>

            <motion.h1
              className="text-5xl md:text-6xl lg:text-7xl font-heading font-black leading-tight text-white"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            >
              Proof, Not Promises.
            </motion.h1>

            <motion.p
              className="text-xl md:text-2xl text-white/70 leading-relaxed max-w-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              We're not just another agency that talks a good game. Here are the real-world, "no-BS" results we've delivered for local businesses.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Section 2: Case Studies Grid */}
      <section className="bg-white dark:bg-slate-950 py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {caseStudies.map((study) => (
              <motion.div key={study.id} variants={fadeInUp}>
                <Link
                  to={`/case-studies/${study.slug}`}
                  className="group h-full flex flex-col"
                >
                  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${study.color} aspect-video mb-6 transition group-hover:shadow-2xl group-hover:shadow-kaizen-cyan/20`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-white/30 text-6xl font-bold mb-2">#{caseStudies.indexOf(study) + 1}</div>
                        <p className="text-white/60 text-sm font-mono">{study.category}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-grow flex flex-col">
                    <span className="text-xs font-mono text-kaizen-cyan font-bold uppercase tracking-widest mb-3">
                      {study.category}
                    </span>

                    <h3 className="text-2xl font-heading font-bold text-kaizen-dark dark:text-white mb-3 group-hover:text-kaizen-cyan transition">
                      {study.client}
                    </h3>

                    <p className="text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-6 flex-grow">
                      {study.summary}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-6">
                      {study.services.map((service) => (
                        <span
                          key={service}
                          className="text-xs px-3 py-1 bg-kaizen-light dark:bg-slate-800 text-kaizen-dark dark:text-white rounded-full font-medium"
                        >
                          {service}
                        </span>
                      ))}
                    </div>

                    <div className="text-kaizen-cyan font-medium flex items-center gap-2 group-hover:gap-3 transition">
                      Read Case Study
                      <ArrowUpRight size={16} className="group-hover:translate-y-[-2px] group-hover:translate-x-[2px] transition" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 3: Final CTA */}
      <section className="bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-white py-20 md:py-32 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.h2
            className="text-4xl md:text-5xl lg:text-6xl font-heading font-black mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Ready to Be Our Next Case Study?
          </motion.h2>

          <motion.p
            className="text-xl text-white/80 mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Let's talk about the results we can get for you.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <button
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).$crisp) {
                  (window as any).$crisp.push(["do", "chat:open"]);
                }
              }}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition"
            >
              Start a Live Chat
            </button>

            <a
              href="#"
              className="px-8 py-3 rounded-lg border-2 border-white/30 text-white font-heading font-bold hover:border-kaizen-cyan hover:text-kaizen-cyan transition"
            >
              Book a 15-Minute Call
            </a>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
