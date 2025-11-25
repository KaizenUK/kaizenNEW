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

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-rose-500 to-rose-600 dark:from-slate-900 dark:to-slate-950 min-h-screen flex items-center py-20 px-4">
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
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-6"
          >
            <span className="inline-block text-rose-200 text-sm font-mono font-bold uppercase tracking-widest">
              Case Study
            </span>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black leading-tight text-white">
              Helen Moore Hairdressing
            </h1>

            <p className="text-xl md:text-2xl text-white/80 leading-relaxed max-w-3xl">
              A 0-to-1 build: taking a top-rated Wirral salon from "no website"
              to a fully booked, high-end online brand.
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
                A top-rated salon that was completely invisible online. All
                bookings were manual (via phone), and they had no way to
                showcase their premium brand.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, delay: 0.1 }}
            >
              <h3 className="text-sm font-mono font-bold text-kaizen-cyan uppercase tracking-widest mb-4">
                The Solution
              </h3>
              <p className="text-lg text-kaizen-text-dark dark:text-white/80 leading-relaxed">
                A high-end, "boutique" website with a 24/7 online booking system
                and a full Local SEO build-out.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, delay: 0.2 }}
            >
              <h3 className="text-sm font-mono font-bold text-kaizen-cyan uppercase tracking-widest mb-4">
                Services Provided
              </h3>
              <p className="text-lg text-kaizen-text-dark dark:text-white/80 leading-relaxed">
                Web Design, Local SEO, Booking System Integration
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
                The Challenge: A Top Salon With No Online Presence
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                Helen Moore is one of the top-rated salons in Wallasey Village,
                but they had zero online presence. They were losing clients to
                competitors who were on Google Maps, and all their time was
                spent manually answering the phone to manage bookings. They
                needed a site that matched their high-end, boutique brand.
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
                The Solution: A Premium Brand with a Booking Engine
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed mb-8">
                We didn't just build a website; we built an online brand.
              </p>

              <ul className="space-y-4">
                {[
                  {
                    title: '"Boutique" Design',
                    desc: "We created a classy, elegant, and simple design that feels premium and matches the salon's real-world atmosphere.",
                  },
                  {
                    title: "24/7 Online Booking",
                    desc: "We integrated a full-featured booking system. Clients can now see availability, choose their service, and book online anytime, from any device.",
                  },
                  {
                    title: "Dominant Local SEO",
                    desc: "We built the site from the ground up for Local SEO, targeting 'Hairdresser Wallasey' and 'Salon Wirral.'",
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
                The Result: High Rankings and a Full Calendar
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                Helen Moore Hairdressing now ranks highly on Google for her key
                local search terms. The online booking system has dramatically
                reduced her admin, and clients love the new, easy-to-use site.
                She's gone from invisible to a dominant online presence in her
                area.
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
                title: "View Our Local SEO Services",
                desc: "Discover how we help businesses dominate their local search results.",
                link: "/services/local-seo",
              },
              {
                title: "See Our Web Design Process",
                desc: "Learn about our approach to building high-end, conversion-focused websites.",
                link: "/services/web-design-liverpool",
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
              to="/case-studies/as-collections"
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
              to="/case-studies/independent-retailer"
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
