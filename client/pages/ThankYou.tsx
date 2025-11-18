import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";

const ThankYou = () => {
  const recommendedReads = [
    {
      title: "Five Website Mistakes That Quietly Kill Sales",
      slug: "website-mistakes-liverpool",
      description: "Learn the common pitfalls that are costing you conversions.",
    },
    {
      title: "How Much Does a Website Cost in Liverpool in 2025?",
      slug: "how-much-does-a-website-cost-in-liverpool-in-2025",
      description: "Transparent pricing guide for serious web projects.",
    },
    {
      title: "How to Choose a Web Design Agency Without the Fluff",
      slug: "choose-web-design-agency-liverpool",
      description: "Questions to ask before hiring. Red flags to watch for.",
    },
  ];

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

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <Layout>
      <section className="min-h-screen bg-gray-950 text-white py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            className="text-center mb-16"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime mb-6">
                <Check size={32} className="text-gray-950" />
              </div>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-5xl md:text-6xl font-heading font-bold mb-6"
            >
              We've received your request.
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed"
            >
              If you booked a call, check your email for the calendar invite. We look forward to speaking.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-gray-950 font-heading font-bold rounded-lg hover:shadow-lg hover:shadow-kaizen-cyan/50 transition"
              >
                Back to Home
                <ArrowRight size={18} />
              </Link>

              <Link
                to="/blog"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 border-2 border-kaizen-cyan text-kaizen-cyan font-heading font-bold rounded-lg hover:bg-kaizen-cyan/10 transition"
              >
                Read Our Blog
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          </motion.div>

          {/* Recommended Reads */}
          <motion.div
            className="mt-20 pt-20 border-t border-gray-800"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.h2
              variants={itemVariants}
              className="text-3xl font-heading font-bold mb-12 text-center"
            >
              Recommended Reads
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {recommendedReads.map((read) => (
                <motion.div
                  key={read.slug}
                  variants={itemVariants}
                  className="group"
                >
                  <Link
                    to={`/blog/${read.slug}`}
                    className="block p-6 border border-gray-800 rounded-lg hover:border-kaizen-cyan/50 hover:bg-gray-900/50 transition duration-300 h-full"
                  >
                    <h3 className="text-xl font-heading font-bold mb-3 group-hover:text-kaizen-cyan transition">
                      {read.title}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                      {read.description}
                    </p>
                    <div className="flex items-center gap-2 text-kaizen-cyan text-sm font-semibold group-hover:gap-3 transition">
                      Read Article
                      <ArrowRight size={16} />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default ThankYou;
