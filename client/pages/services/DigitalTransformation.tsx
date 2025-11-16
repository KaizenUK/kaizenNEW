import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useCalendly } from "@/context/CalendlyContext";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

// Kinetic Typography Animation
function KineticTypography() {
  const [typedText, setTypedText] = useState("");
  const automatedText = "Automated";

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < automatedText.length) {
        setTypedText(automatedText.substring(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 100);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-8 mb-12">
      {/* Animated Words */}
      <div className="text-6xl md:text-7xl lg:text-8xl font-heading font-black leading-tight">
        {/* Automated - Typing */}
        <div className="h-24 md:h-32 lg:h-40 flex items-center">
          <motion.span
            className="text-kaizen-cyan"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {typedText}
            {typedText.length < automatedText.length && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                _
              </motion.span>
            )}
          </motion.span>
        </div>

        {/* Integrated - Linking Letters */}
        {typedText === automatedText && (
          <div className="h-24 md:h-32 lg:h-40 flex items-center overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              <div className="flex items-center gap-1">
                {["I", "n", "t", "e", "g", "r", "a", "t", "e", "d"].map((letter, index) => (
                  <motion.span
                    key={index}
                    className="text-kaizen-lime"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.5 + index * 0.08,
                      duration: 0.4,
                      ease: "easeOut",
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Flowing - Sliding/Fading */}
        {typedText === automatedText && (
          <motion.div
            className="h-24 md:h-32 lg:h-40 flex items-center"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.3, duration: 0.6, ease: "easeOut" }}
          >
            <span className="text-kaizen-cyan">Flowing</span>
          </motion.div>
        )}
      </div>

      {/* Tagline */}
      {typedText === automatedText && (
        <motion.p
          className="text-lg md:text-xl text-kaizen-text-dark/60 dark:text-white/60 font-mono tracking-wider"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
        >
          clean • efficient • smart
        </motion.p>
      )}
    </div>
  );
}

export default function DigitalTransformation() {
  const { openCalendly } = useCalendly();

  return (
    <Layout>
      <Helmet>
        <title>Digital Transformation Liverpool | Business Process Automation | Kaizen</title>
        <meta
          name="description"
          content="We help Liverpool & Wirral businesses stop working in chaos. We automate manual tasks, fix inefficient workflows, and get your systems talking."
        />
      </Helmet>

      {/* Section 1: Hero - Kinetic Typography */}
      <section className="min-h-screen bg-white dark:bg-slate-950 flex items-center py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <KineticTypography />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2, duration: 0.6 }}
            className="space-y-8 mt-16"
          >
            <div>
              <h2 className="text-4xl md:text-5xl font-heading font-black mb-6 text-kaizen-dark dark:text-white">
                Stop working in chaos.
              </h2>

              <p className="text-xl md:text-2xl text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed max-w-3xl">
                You don't need "digital transformation." You need to get your systems talking to each other. We find your bottlenecks, automate your manual tasks, and build simple, efficient workflows.
              </p>
            </div>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.2, duration: 0.6 }}
            >
              <button
                onClick={() => {
                  if (typeof window !== "undefined" && (window as any).$crisp) {
                    (window as any).$crisp.push(["do", "chat:open"]);
                  }
                }}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
              >
                Book a Process Audit
                <ArrowRight size={18} />
              </button>

              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (typeof window !== "undefined" && (window as any).$crisp) {
                    (window as any).$crisp.push(["do", "chat:open"]);
                  }
                }}
                className="px-8 py-3 rounded-lg border-2 border-kaizen-cyan text-kaizen-cyan font-heading font-bold hover:bg-kaizen-cyan/10 transition"
              >
                Start a Chat
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Section 2: Who Is This For? */}
      <section className="bg-kaizen-light dark:bg-slate-900/50 py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.h2
            className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            Who We Help
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "Offline Businesses",
                desc: "You're a successful business (e.g., a trade, a consultant) running on paper, spreadsheets, and a mobile phone. You have no \"online system.\" We build your first one, connecting a new website to a simple, automated workflow.",
              },
              {
                title: "Online (But Chaotic) Businesses",
                desc: "You're already online, but it's a mess. Your systems don't talk, you're drowning in admin, and you copy-paste data all day. We find the gaps, fix the chaos, and get your systems flowing.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-white dark:bg-slate-950 rounded-2xl border border-kaizen-light dark:border-slate-800"
              >
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {item.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 3: Pain Points */}
      <section className="bg-white dark:bg-slate-950 py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.h2
            className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            Your Business is Leaking Time &amp; Money if...
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "You Do \"Copy-Paste\" Work",
                desc: "Your team manually copies customer data from an email into a spreadsheet, a CRM, or a Word doc.",
              },
              {
                title: "Your Systems Don't Talk",
                desc: "Your website is a dead end. Your booking system doesn't connect to your calendar. Your invoice software is on an island.",
              },
              {
                title: "You're Drowning in Admin",
                desc: "You and your team spend more time managing work, chasing paperwork, and sending follow-ups than doing the actual, billable work.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800"
              >
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {item.title}
                </h3>
                <p className="text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 4: Real-World Proof */}
      <section className="bg-kaizen-light dark:bg-slate-900/50 py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
              This is Our Expertise
            </h2>

            <h3 className="text-2xl font-heading font-semibold mb-6 text-kaizen-cyan">
              Real-World Proof: Fixing a Liverpool Firm
            </h3>

            <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed space-y-4">
              <span>
                This expertise is at the core of Kaizen. <strong>Our founder, Sean,</strong> led a full digital and operational transformation at <strong>SMD Credit Solutions</strong> in Liverpool. <strong>He</strong> found the inefficiencies, rebuilt the internal workflows, and implemented simple, low-code solutions. <strong>We</strong> now apply this same "fix-and-build" logic to all our clients' businesses.
              </span>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Section 5: Our Process */}
      <section className="bg-white dark:bg-slate-950 py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            Our "Fix &amp; Deliver" Process
          </motion.h2>

          <div className="space-y-12">
            {[
              {
                step: "01",
                title: "Audit",
                desc: "We sit with your team and map your actual workflow, from the first customer contact to the final invoice. We find the real bottlenecks.",
              },
              {
                step: "02",
                title: "Automate",
                desc: "We don't build a million-pound app. We use smart, modern tools to connect the apps you already use. We build simple automations to handle the manual tasks.",
              },
              {
                step: "03",
                title: "Empower",
                desc: "We deliver a streamlined, documented process and train your team on how to use it, giving you back hours every single week.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="flex gap-8"
              >
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-kaizen-cyan to-kaizen-lime">
                    <span className="text-kaizen-dark font-heading font-black text-xl">
                      {item.step}
                    </span>
                  </div>
                </div>

                <div className="flex-grow">
                  <h3 className="text-2xl font-heading font-bold mb-3 text-kaizen-dark dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6: Internal Links */}
      <section className="bg-kaizen-light dark:bg-slate-900/50 py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            Where This Connects
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "Complex Projects",
                desc: "This is a core part of what our Contract Product Owner service delivers for complex, high-stakes projects.",
                link: "/contract-product-owner",
                linkText: "Explore Product Ownership",
              },
              {
                title: "Web Design",
                desc: "A transformation often starts with your website. We build sites that connect to your business systems from day one.",
                link: "/services/web-design-liverpool",
                linkText: "Explore Web Design",
              },
            ].map((card, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={card.link}
                  className="group block p-8 bg-white dark:bg-slate-950 rounded-2xl border border-kaizen-light dark:border-slate-800 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition h-full"
                >
                  <h3 className="text-2xl font-heading font-bold mb-3 text-kaizen-dark dark:text-white group-hover:text-kaizen-cyan transition">
                    {card.title}
                  </h3>
                  <p className="text-kaizen-text-dark/70 dark:text-white/60 mb-6">
                    {card.desc}
                  </p>
                  <div className="text-kaizen-cyan font-medium flex items-center gap-2 group-hover:gap-3 transition">
                    {card.linkText}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 7: Final CTA */}
      <section className="bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-white py-20 md:py-32 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.h2
            className="text-4xl md:text-5xl lg:text-6xl font-heading font-black mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Stop Wasting Time.
          </motion.h2>

          <motion.p
            className="text-xl text-white/80 mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Let's find and fix the chaos in your business. Book a free, no-pressure call to audit your process.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <button
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).$crisp) {
                  (window as any).$crisp.push(["do", "chat:open"]);
                }
              }}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition"
            >
              Book a Process Audit
            </button>

            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (typeof window !== "undefined" && (window as any).$crisp) {
                  (window as any).$crisp.push(["do", "chat:open"]);
                }
              }}
              className="px-8 py-3 rounded-lg border-2 border-white/30 text-white font-heading font-bold hover:border-kaizen-cyan hover:text-kaizen-cyan transition"
            >
              Start a Live Chat
            </a>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
