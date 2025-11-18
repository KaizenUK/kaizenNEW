import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  const location = useLocation();
  const { openCalendly } = useCalendly();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <Layout>
      <section className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4 py-20">
        <motion.div
          className="text-center max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.h1
            className="text-7xl md:text-8xl font-heading font-bold mb-6 bg-gradient-to-r from-kaizen-cyan to-kaizen-lime bg-clip-text text-transparent"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            404
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Project Not Found
            </p>
            <p className="text-lg text-gray-400 mb-8 leading-relaxed max-w-2xl mx-auto">
              Looks like you've ventured into the void. Don't let your own project end up here.
            </p>
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-gray-950 font-heading font-bold rounded-lg hover:shadow-lg hover:shadow-kaizen-cyan/50 transition"
            >
              Go Home
              <ArrowRight size={18} />
            </Link>

            <button
              onClick={() => openCalendly()}
              className="inline-flex items-center gap-2 px-8 py-3 border-2 border-kaizen-cyan text-kaizen-cyan font-heading font-bold rounded-lg hover:bg-kaizen-cyan/10 transition"
            >
              Book a Project Rescue
              <ArrowRight size={18} />
            </button>
          </motion.div>
        </motion.div>
      </section>
    </Layout>
  );
};

export default NotFound;
