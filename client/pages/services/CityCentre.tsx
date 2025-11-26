import React from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useCalendly } from "@/context/CalendlyContext";
import { Helmet } from "react-helmet-async";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function CityCentre() {
  const { openCalendly } = useCalendly();

  return (
    <Layout>
      <Helmet>
        <title>
          Web Design Liverpool City Centre | High-Performance Websites
        </title>
        <meta
          name="description"
          content="Expert web design for Liverpool city centre businesses. Conversion-focused websites that drive local customers. React, Vite, fast performance."
        />
        <meta
          name="keywords"
          content="web design Liverpool city centre, Liverpool city centre websites, web design L1 L2 L3, local web design Liverpool"
        />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "Kaizen Web",
            description:
              "Web design and development agency in Liverpool city centre",
            url: "https://kaizenweb.co.uk",
            telephone: "+44-151-XXX-XXXX",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Liverpool",
              addressRegion: "Merseyside",
              postalCode: "L1",
              addressCountry: "GB",
            },
            areaServed: "Liverpool City Centre",
            image: "https://kaizenweb.co.uk/kaizen-logo.png",
          })}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1
              className="text-6xl lg:text-7xl font-heading font-bold mb-8 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              Web Design for Liverpool City Centre That Converts.
            </motion.h1>

            <motion.p
              className="text-2xl text-white/70 mb-12 leading-relaxed max-w-3xl font-light"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Your city centre business competes on every level. Your website
              shouldn't be generic. We build conversion-focused websites for
              Liverpool's independent retailers, hospitality, creative studios,
              and professional services. Fast. Purposeful. Built to work.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <button
                onClick={() => openCalendly()}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-gray-950 font-heading font-bold inline-flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-kaizen-cyan/50 transition text-lg"
              >
                Book a Discovery Call
                <ArrowRight size={20} />
              </button>
              <Link
                to="/contact"
                className="px-8 py-4 rounded-lg border-2 border-white text-white font-heading font-bold hover:bg-white/10 transition inline-flex items-center justify-center gap-2 text-lg"
              >
                Get in Touch
                <ArrowRight size={20} />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* The Problem & Our Approach */}
      <section className="py-24 md:py-32 bg-slate-950">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <div className="mb-16">
              <h2 className="text-5xl lg:text-6xl font-heading font-bold mb-8 text-white">
                City Centre Websites Need to Be Different.
              </h2>
              <p className="text-xl text-white/60 leading-relaxed max-w-3xl">
                Your competitors are using the same generic website builders and
                templates. They're all the same. Your customers walk past your
                shop every day—but they don't know you exist online. You need a
                website that reflects the quality of your business, ranks for
                local searches, and converts browsers into customers.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-start my-16">
              <div>
                <h3 className="text-2xl font-heading font-bold mb-6 text-white">
                  The Problem
                </h3>
                <ul className="space-y-4">
                  {[
                    "Generic website builders that look like everyone else's.",
                    "Poor performance = lost customers to faster competitors.",
                    "No local SEO optimization—you're invisible for 'near me' searches.",
                    "Website doesn't reflect your brand's real quality.",
                    "You can't update content without hiring a developer.",
                  ].map((point, i) => (
                    <li key={i} className="flex gap-3 text-white/70">
                      <span className="text-kaizen-cyan flex-shrink-0 mt-1">
                        ✓
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-2xl font-heading font-bold mb-6 text-white">
                  Our Approach
                </h3>
                <ul className="space-y-4">
                  {[
                    "High-performance React/Vite builds. Lightning-fast load times.",
                    "Optimized for local search—you'll rank for city centre + postcode searches.",
                    "Design that matches your brand's actual quality and positioning.",
                    "Headless CMS integration—update content yourself, no developer needed.",
                    "Conversion-focused. Every page designed to turn visitors into customers.",
                  ].map((point, i) => (
                    <li key={i} className="flex gap-3 text-white/70">
                      <span className="text-kaizen-lime flex-shrink-0 mt-1">
                        ✓
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-16 p-8 bg-gradient-to-r from-kaizen-cyan/10 to-kaizen-lime/10 rounded-2xl border border-kaizen-cyan/20">
              <p className="text-lg text-white/80 leading-relaxed">
                <strong>Real talk:</strong> Your website is your most
                cost-effective salesperson. It works 24/7, costs less than a
                single piece of print advertising, and reaches customers at the
                exact moment they're searching for what you sell. Don't let it
                be generic.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Who We Work With */}
      <section className="py-24 md:py-32 bg-slate-900">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-5xl lg:text-6xl font-heading font-bold mb-16 text-white">
              Built for Liverpool's City Centre Businesses.
            </h2>

            <div className="space-y-12">
              {[
                {
                  title: "Independent Retailers & Boutiques",
                  desc: "Fashion, books, vintage, antiques. We showcase what makes you different. Drive foot traffic. Build loyalty.",
                },
                {
                  title: "Hospitality & Venues",
                  desc: "Restaurants, cafés, bars, clubs. Menu showcase, reservations, events calendar, atmosphere. We make people want to visit.",
                },
                {
                  title: "Creative Agencies & Studios",
                  desc: "Design, photography, art, music. Portfolio that sells. Case studies that land clients. Show your best work.",
                },
                {
                  title: "Professional Services",
                  desc: "Law, accounting, consulting, medical. Authority. Trust. Credibility. Attract serious clients from serious searches.",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="border-l-4 border-kaizen-cyan pl-8 py-4"
                >
                  <h3 className="text-2xl font-heading font-bold mb-3 text-white">
                    {item.title}
                  </h3>
                  <p className="text-lg text-white/60 leading-relaxed">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="mt-20 p-8 bg-slate-950 rounded-xl border border-white/5">
              <p className="text-white/70 leading-relaxed">
                <span className="text-kaizen-cyan font-semibold">
                  Not just L1 and L2:
                </span>{" "}
                We work with city centre businesses across all postcodes—from
                the waterfront to Duke Street, from Lord Street to Bold Street.
                If you're in Liverpool's city centre, this is built for you.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Our Process */}
      <section className="py-24 md:py-32 bg-slate-950">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-5xl lg:text-6xl font-heading font-bold mb-20 text-white">
              How We Work.
            </h2>

            <div className="space-y-16">
              {[
                {
                  step: "01",
                  title: "Understand Your Business & Market",
                  desc: "We start with real conversations. What makes you different? Who's your customer? What does success look like? No templated questionnaires—just direct dialogue.",
                },
                {
                  step: "02",
                  title: "Design for Conversion",
                  desc: "We design a site that guides visitors toward action. Every page, every element, has a purpose. Clean. Intuitive. On-brand. Built to sell, not impress.",
                },
                {
                  step: "03",
                  title: "Build with Performance in Mind",
                  desc: "React. Vite. Modern code. Your site loads in milliseconds, ranks well in search, and works flawlessly on mobile. Technical excellence is non-negotiable.",
                },
                {
                  step: "04",
                  title: "Launch & Optimise",
                  desc: "We get you live on schedule. Then we monitor, measure, and improve. Your site is a living tool, not a set-and-forget project.",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="flex gap-8 items-start"
                >
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-kaizen-cyan to-kaizen-lime flex items-center justify-center">
                      <span className="text-gray-950 font-heading font-bold text-2xl">
                        {item.step}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-heading font-bold mb-3 text-white">
                      {item.title}
                    </h3>
                    <p className="text-lg text-white/60 leading-relaxed max-w-2xl">
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 md:py-32 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-5xl lg:text-6xl font-heading font-bold mb-8 text-white">
              Your City Centre Website Starts Here.
            </h2>
            <p className="text-xl text-white/60 mb-16 max-w-2xl mx-auto leading-relaxed">
              We've helped Liverpool city centre businesses build websites that
              rank, convert, and sell. Let's talk about what's possible for your
              business.
            </p>

            <motion.div
              className="flex flex-col sm:flex-row gap-6 justify-center"
              whileInView={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <button
                onClick={() => openCalendly()}
                className="px-8 py-4 rounded-lg bg-white text-gray-950 font-heading font-bold inline-flex items-center justify-center gap-2 hover:shadow-lg transition text-lg"
              >
                Book a Discovery Call
                <ArrowRight size={20} />
              </button>
              <Link
                to="/project-rescue"
                className="px-8 py-4 rounded-lg border-2 border-white text-white font-heading font-bold hover:bg-white/10 transition inline-flex items-center justify-center gap-2 text-lg"
              >
                Explore Project Rescue
                <ArrowRight size={20} />
              </Link>
            </motion.div>

            <p className="text-white/50 text-sm mt-12">
              Based in Liverpool. Serving city centre businesses across L1, L2,
              L3 and beyond.
            </p>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
