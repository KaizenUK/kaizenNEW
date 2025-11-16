import { useState } from "react";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Mail, Phone, MapPin } from "lucide-react";
import { useCalendly } from "@/context/CalendlyContext";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const contactMethods = [
  {
    icon: Mail,
    title: "Email",
    description: "Get a response within 24 hours",
    contact: "hello@kaizenweb.com",
  },
  {
    icon: Phone,
    title: "Chat with us",
    description: "Live chat during business hours",
    action: "crisp",
  },
  {
    icon: MapPin,
    title: "Based in Liverpool",
    description: "Serving Liverpool & Wirral",
    contact: "Liverpool, UK",
  },
];

export default function Contact() {
  const { openCalendly } = useCalendly();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleChatClick = () => {
    if (typeof window !== "undefined" && (window as any).$crisp) {
      (window as any).$crisp.push(["do", "chat:open"]);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Contact Kaizen | Web Design & Agile Coaching Liverpool</title>
        <meta
          name="description"
          content="Get in touch with Kaizen. We're based in Liverpool and help businesses with web design, local SEO, and agile coaching. Chat now or book a call."
        />
      </Helmet>

      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-br from-kaizen-dark via-slate-900 to-kaizen-dark dark:from-slate-950 dark:via-slate-900 dark:to-black text-white flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold mb-6 leading-tight">
                Let's Talk About Your Project
              </h1>

              <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
                Whether you need web design, local SEO, agile coaching, or digital transformation, we're here to help. No jargon, no pressure – just a practical conversation about what's right for you.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="flex flex-col sm:flex-row gap-6 justify-center items-center"
              >
                <button
                  onClick={openCalendly}
                  className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold text-lg hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
                >
                  Book a Call Now
                  <ArrowRight size={20} />
                </button>

                <button
                  onClick={handleChatClick}
                  className="px-8 py-4 rounded-lg border-2 border-white/30 text-white font-heading font-bold text-lg hover:border-kaizen-cyan hover:text-kaizen-cyan transition inline-flex items-center justify-center gap-2"
                >
                  Start a Live Chat
                  <ArrowRight size={20} />
                </button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
              How to Reach Us
            </h2>
            <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 max-w-2xl mx-auto">
              Choose what works best for you. We typically respond within 24 hours.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {contactMethods.map((method, index) => {
              const IconComponent = method.icon;
              return (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: index * 0.1 }}
                  className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
                >
                  <IconComponent className="w-8 h-8 text-kaizen-cyan mb-4" />
                  <h3 className="text-2xl font-heading font-bold mb-2 text-kaizen-dark dark:text-white">
                    {method.title}
                  </h3>
                  <p className="text-kaizen-text-dark/70 dark:text-white/60 mb-4">
                    {method.description}
                  </p>

                  {method.action === "crisp" ? (
                    <button
                      onClick={handleChatClick}
                      className="text-kaizen-cyan font-medium hover:underline"
                    >
                      Open Chat →
                    </button>
                  ) : (
                    <a
                      href={
                        method.contact.includes("@")
                          ? `mailto:${method.contact}`
                          : `tel:${method.contact}`
                      }
                      className="text-kaizen-cyan font-medium hover:underline"
                    >
                      {method.contact}
                    </a>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Reach Out Section */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
              What to Expect
            </h2>

            <div className="space-y-6">
              {[
                {
                  title: "No Sales Pressure",
                  description:
                    "We listen first. We'll ask about your challenges and goals before suggesting anything.",
                },
                {
                  title: "Honest Assessment",
                  description:
                    "We'll tell you what's realistic for your budget and timeline. If we can't help, we'll say so.",
                },
                {
                  title: "Fast Response",
                  description:
                    "We typically respond to inquiries within 24 hours, often much sooner.",
                },
                {
                  title: "Clear Next Steps",
                  description:
                    "Whether it's a project fit or not, we'll outline what comes next with no ambiguity.",
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: index * 0.1 }}
                  className="flex gap-6"
                >
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-kaizen-cyan to-kaizen-lime">
                      <span className="text-kaizen-dark font-heading font-bold">
                        {index + 1}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-heading font-bold mb-2 text-kaizen-dark dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-kaizen-text-dark/70 dark:text-white/60">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
              Ready to Get Started?
            </h2>

            <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 mb-8">
              Book a 30-minute call with Sean to discuss your project. No commitment, no catch.
            </p>

            <button
              onClick={openCalendly}
              className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold text-lg hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2 mx-auto"
            >
              Book a Call Now
              <ArrowRight size={20} />
            </button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
