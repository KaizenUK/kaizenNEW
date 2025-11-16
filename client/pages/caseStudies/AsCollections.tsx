import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function AsCollectionsCase() {
  return (
    <Layout>
      <Helmet>
        <title>A.S Collections Case Study | Kaizen Web</title>
        <meta
          name="description"
          content="How we redesigned A.S Collections' website to build trust and authority for a Liverpool debt recovery firm."
        />
      </Helmet>

      <section className="bg-white dark:bg-slate-950 min-h-screen flex flex-col justify-center py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Link
            to="/case-studies"
            className="inline-flex items-center gap-2 text-kaizen-cyan hover:text-kaizen-dark dark:hover:text-white transition mb-8"
          >
            <ArrowLeft size={18} />
            Back to Case Studies
          </Link>

          <motion.h1
            className="text-5xl md:text-6xl lg:text-7xl font-heading font-black mb-8 leading-tight text-kaizen-dark dark:text-white"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            A.S Collections
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            A complete, modern redesign for a Liverpool debt recovery firm that needed to build trust and authority.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h3 className="text-lg font-heading font-bold text-kaizen-dark dark:text-white mb-4">
                Services Provided
              </h3>
              <div className="space-y-2">
                {["Web Design", "Content Strategy", "WordPress"].map((service) => (
                  <p key={service} className="text-kaizen-text-dark/70 dark:text-white/70">
                    • {service}
                  </p>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <h3 className="text-lg font-heading font-bold text-kaizen-dark dark:text-white mb-4">
                The Challenge
              </h3>
              <p className="text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                More details about the project challenge coming soon.
              </p>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
