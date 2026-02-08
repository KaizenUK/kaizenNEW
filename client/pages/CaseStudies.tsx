import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCalendly } from "@/context/CalendlyContext";

const caseStudies = [
  {
    id: "high-five-games",
    client: "International Sweepstakes Casino",
    summary:
      "Architecting a dual-currency gaming economy for an international sweepstakes casino: moving from single-currency to legally-compliant sweepstakes across 43 US states, delivering 42% ARPU growth whilst maintaining financial-grade reliability.",
    services: ["System Economics", "Live Ops", "Complex Integrations"],
    slug: "high-five-games",
  },
  {
    id: "as-collections",
    client: "A.S Collections",
    summary:
      "A complete, modern redesign for a Liverpool debt recovery firm that needed to build trust and authority.",
    services: ["Web Design", "Content Strategy", "WordPress"],
    slug: "as-collections",
  },
  {
    id: "helen-moore-hairdressing",
    client: "Helen Moore Hairdressing",
    summary:
      "A 0-to-1 build for a Wirral-based salon, resulting in high local rankings and a 24/7 online booking system.",
    services: ["Web Design", "Local SEO", "Booking System"],
    slug: "helen-moore-hairdressing",
  },
  {
    id: "independent-retailer",
    client: "Independent Retailer, Liverpool",
    summary:
      "A high-performance headless e-commerce build to fix a slow, clunky site and boost mobile conversions.",
    services: ["E-commerce", "Headless (React)", "Performance"],
    slug: "independent-retailer",
  },
];

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export default function CaseStudies() {
  const navigate = useNavigate();
  const { openCalendly: openCalendlyFromContext } = useCalendly();

  return (
    <Layout>
      {/* Section 1: Hero */}
      <section className="min-h-screen bg-white flex items-center py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.h1
            className="text-5xl md:text-6xl lg:text-7xl font-heading font-black mb-8 leading-tight text-kaizen-dark"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            Fewer Projects. Better Results.
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-kaizen-text-dark/70 leading-relaxed max-w-3xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            We are not a high-volume, "churn and burn" agency. We're an
            expert-led partner. We take on fewer clients so we can apply our
            full, obsessive focus to each one. Here's a deep dive into our
            process.
          </motion.p>
        </div>
      </section>

      {/* Section 2: Case Studies List */}
      <section className="bg-kaizen-light py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            Our Work
          </motion.h2>

          <motion.ul
            className="space-y-0"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {caseStudies.map((study, index) => (
              <motion.li key={study.id} variants={fadeInUp}>
                <Link
                  to={`/case-studies/${study.slug}`}
                  className="group block border-b border-kaizen-light py-12 px-8 transition hover:bg-white"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Left Column - Client & Summary */}
                    <div>
                      <h3 className="text-3xl md:text-4xl font-heading font-bold mb-4 text-kaizen-dark group-hover:text-kaizen-cyan transition">
                        {study.client}
                      </h3>
                      <p className="text-lg text-kaizen-text-dark/70 leading-relaxed">
                        {study.summary}
                      </p>
                    </div>

                    {/* Right Column - Services */}
                    <div className="flex flex-col justify-between h-full">
                      <div>
                        <p className="text-xs font-mono text-kaizen-text-dark/50 font-bold mb-4 tracking-widest">
                          SERVICES PROVIDED
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {study.services.map((service) => (
                            <span
                              key={service}
                              className="inline-block px-4 py-2 bg-white rounded-full text-sm font-medium text-kaizen-dark border border-kaizen-light group-hover:border-kaizen-cyan transition"
                            >
                              {service}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Arrow indicator */}
                      <div className="mt-6 flex items-center gap-2 text-kaizen-cyan font-medium group-hover:gap-3 transition">
                        Read Case Study
                        <ArrowRight
                          size={18}
                          className="group-hover:translate-x-1 transition"
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* Section 3: Final CTA */}
      <section className="bg-kaizen-dark text-white py-20 md:py-32 px-4">
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
              onClick={() => navigate("/contact")}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition"
            >
              Get in Touch
            </button>

            <button
              onClick={openCalendlyFromContext}
              className="px-8 py-3 rounded-lg border-2 border-white/30 text-white font-heading font-bold hover:border-kaizen-cyan hover:text-kaizen-cyan transition"
            >
              Book a 15 Minute Call
            </button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
