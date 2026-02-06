import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { MessageCircle, Calendar } from "lucide-react";
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

  const handleChatClick = () => {
    if (typeof window !== "undefined" && (window as any).$crisp) {
      (window as any).$crisp.push(["do", "chat:open"]);
    }
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-br from-kaizen-dark via-slate-900 to-kaizen-dark dark:from-slate-950 dark:via-slate-900 dark:to-black text-white flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
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
                We've made it easy. We just have three simple, no-pressure options—pick what works best for you.
              </p>
            </motion.div>

            {/* Two Column Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16"
            >
              {/* Column 1: Chat Now */}
              <div className="p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:border-kaizen-cyan/30 transition">
                <div className="flex items-start gap-4 mb-6">
                  <MessageCircle className="w-8 h-8 text-kaizen-cyan flex-shrink-0 mt-1" />
                  <h2 className="text-3xl font-heading font-bold text-white">
                    Want to chat now?
                  </h2>
                </div>
                <p className="text-lg text-white/70 leading-relaxed">
                  Got a quick question? We're available on live chat. Click the
                  icon in the bottom corner to start a conversation.
                </p>
              </div>

              {/* Column 2: Schedule */}
              <div className="p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:border-kaizen-cyan/30 transition">
                <div className="flex items-start gap-4 mb-6">
                  <Calendar className="w-8 h-8 text-kaizen-cyan flex-shrink-0 mt-1" />
                  <h2 className="text-3xl font-heading font-bold text-white">
                    Prefer to schedule?
                  </h2>
                </div>
                <p className="text-lg text-white/70 leading-relaxed">
                  Skip the email tennis. Book a 15-minute, no-pressure discovery
                  call directly in our calendar. Pick a time that works for you.
                </p>
              </div>
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex justify-center"
            >
              <button
                onClick={openCalendly}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold text-lg hover:shadow-lg hover:shadow-kaizen-cyan/50 transition"
              >
                Book a 15 Minute Call
              </button>
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
              We don't do long sales pitches. We tend to have a brief chat to see if we're a good fit first. We'll listen to your problem, you can ask us anything, and we'll tell you how we can help. Simple.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-kaizen-dark via-slate-900 to-kaizen-dark dark:from-slate-950 dark:via-slate-900 dark:to-black">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4 text-white text-center">
              Or Drop Us a Line
            </h2>
            <p className="text-center text-white/70 mb-12">
              Prefer to reach out via email? Send us a message and we'll get
              back to you shortly.
            </p>
            <ContactFormBox />
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
