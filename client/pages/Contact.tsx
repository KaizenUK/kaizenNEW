import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { useCalendly } from "@/context/CalendlyContext";
import { ContactFormBox } from "@/components/ContactFormBox";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function Contact() {
  const { openCalendly } = useCalendly();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-br from-kaizen-dark via-slate-900 to-kaizen-dark dark:from-slate-950 dark:via-slate-900 dark:to-black text-white flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold mb-6 leading-tight">
                Let's Talk.
              </h1>

              <p className="text-xl text-white/70 mb-12 leading-relaxed">
                We've made it easy. Pick one of our two simple, no-pressure
                options—whatever works best for you.
              </p>
            </motion.div>

            {/* Two Column Grid with Cards and Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 w-full items-start"
            >
              {/* Column 1: Schedule */}
              <div className="p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:border-kaizen-cyan/30 transition flex flex-col h-full">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-kaizen-cyan/10 rounded-xl">
                    <Calendar className="w-8 h-8 text-kaizen-cyan flex-shrink-0" />
                  </div>
                  <h2 className="text-2xl font-heading font-bold text-white mt-2">
                    Prefer to schedule?
                  </h2>
                </div>
                <p className="text-lg text-white/70 leading-relaxed mb-8 flex-grow">
                  Pick a 15-minute call that works for your schedule. No pitch, just an honest conversation about how we can help.
                </p>
                <button
                  onClick={openCalendly}
                  className="w-full px-6 py-4 rounded-xl bg-kaizen-cyan text-kaizen-dark font-bold text-lg hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Book a Call
                </button>
              </div>

              {/* Column 2: Contact Form */}
              <div className="h-full">
                <ContactFormBox />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What to Expect Section */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center"
          >
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
              What to Expect From Us
            </h2>

            <p className="text-lg md:text-xl text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
              We don't do long sales pitches. We tend to have a brief chat to
              see if we're a good fit first. We'll listen to your problem, you
              can ask us anything, and we'll tell you how we can help. Simple.
            </p>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
