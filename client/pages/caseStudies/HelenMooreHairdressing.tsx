import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  ArrowUpRight,
  Star,
  Smartphone,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function HelenMooreHairdressingCase() {
  return (
    <Layout>
      <Helmet>
        <title>Wirral Web Design Case Study: Helen Moore | Kaizen</title>
        <meta
          name="description"
          content="See how we transformed a Wallasey salon with a custom React website. Faster bookings, perfect mobile scores, and better local SEO."
        />
      </Helmet>

      {/* Hero Section - Split Screen */}
      <section className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-slate-950">
        {/* Left: Image */}
        <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto relative overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/20 z-10" />
          <img
            src="https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1674&auto=format&fit=crop"
            alt="Helen Moore Hairdressing Salon Interior"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Right: Content */}
        <div className="w-full lg:w-1/2 flex items-center p-8 lg:p-20">
          <div className="max-w-xl">
            <Link
              to="/case-studies"
              className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition mb-8 text-sm font-medium"
            >
              <ArrowLeft size={16} />
              Back to Case Studies
            </Link>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="space-y-8"
            >
              <div>
                <span className="inline-block text-rose-500 text-xs font-mono font-bold uppercase tracking-widest mb-4">
                  The Salon Experience
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black leading-tight text-slate-900 dark:text-white mb-6">
                  Helen Moore Hairdressing.
                </h1>
              </div>

              <div className="space-y-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Helen Moore isn't just a salon; it's a Wirral institution. But
                  their digital presence was stuck in 2015—slow, clunky, and
                  invisible on mobile.
                </p>
                <p>
                  We didn't just 'refresh' it. We rebuilt it. A custom React
                  frontend that loads instantly for Instagram users, turning
                  'scrollers' into 'bookings' without the friction.
                </p>
              </div>

              <div className="pt-4">
                <p className="text-xs font-mono uppercase tracking-[0.25em] text-slate-400 mb-4">
                  Built With:
                </p>
                <div className="flex flex-wrap gap-2">
                  {["React", "Headless WordPress", "Local SEO"].map((item) => (
                    <span
                      key={item}
                      className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-medium"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Results Grid */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-6 text-rose-500">
                <Star size={24} />
              </div>
              <h3 className="text-3xl font-heading font-bold text-slate-900 dark:text-white mb-2">
                100%
              </h3>
              <p className="text-sm font-mono uppercase tracking-wider text-slate-500 mb-2">
                Performance Score
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Google Lighthouse score for maximum visibility and speed.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, delay: 0.1 }}
              className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-6 text-rose-500">
                <Smartphone size={24} />
              </div>
              <h3 className="text-3xl font-heading font-bold text-slate-900 dark:text-white mb-2">
                Zero
              </h3>
              <p className="text-sm font-mono uppercase tracking-wider text-slate-500 mb-2">
                Friction Booking
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Seamless flow from Instagram scroll to confirmed appointment.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, delay: 0.2 }}
              className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-6 text-rose-500">
                <Search size={24} />
              </div>
              <h3 className="text-3xl font-heading font-bold text-slate-900 dark:text-white mb-2">
                #1
              </h3>
              <p className="text-sm font-mono uppercase tracking-wider text-slate-500 mb-2">
                Local Ranking
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Dominating search results in Wallasey and across the Wirral.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Primary CTA */}
      <section className="bg-slate-900 text-white py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Want a site that performs like this?
          </motion.h2>
          <p className="text-base md:text-lg text-white/75 mb-8 max-w-2xl mx-auto">
            Share a few details about your project and we will come back with a
            straightforward, no-fluff quote.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-slate-900 font-heading font-bold hover:bg-slate-100 transition"
          >
            Get a Quote Like This
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>

      {/* Pagination */}
      <section className="bg-white dark:bg-slate-950 py-16 px-4 border-t border-slate-100 dark:border-slate-800">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <Link
              to="/case-studies/as-collections"
              className="group flex items-center gap-3 text-slate-900 dark:text-white hover:text-rose-500 transition"
            >
              <span className="group-hover:-translate-x-1 transition">←</span>
              Previous Case Study
            </Link>

            <Link
              to="/case-studies"
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition text-sm font-medium"
            >
              View All
            </Link>

            <Link
              to="/case-studies/kaizen-rebuild"
              className="group flex items-center gap-3 text-slate-900 dark:text-white hover:text-rose-500 transition"
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
