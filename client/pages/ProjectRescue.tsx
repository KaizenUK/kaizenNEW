import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { useCalendly } from "@/context/CalendlyContext";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const ScrollReveal = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    });

    const element = document.getElementById(`scroll-reveal-${delay}`);
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [delay]);

  return (
    <motion.div
      id={`scroll-reveal-${delay}`}
      variants={fadeInUp}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      transition={{ delay: delay * 0.1 }}
    >
      {children}
    </motion.div>
  );
};

export default function ProjectRescue() {
  const { openCalendly } = useCalendly();

  return (
    <Layout>
      <Helmet>
        <title>
          Project Rescue & Contract Product Ownership | Kaizen Liverpool
        </title>
        <meta
          name="description"
          content="When your build is over budget, late, or stuck, Kaizen steps in as a hands-on Contract Product Owner to stabilise delivery and actually ship."
        />
        <meta
          name="keywords"
          content="project rescue liverpool, contract product owner, failing web projects, agile rescue, product ownership"
        />
      </Helmet>

      {/* Hero Section */}
      <section className="min-h-screen bg-slate-950 text-white flex items-center py-20 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,255,0.1),transparent_50%)]" />
        <div className="pointer-events-none absolute top-20 right-10 h-96 w-96 rounded-full bg-kaizen-cyan/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-20 left-10 h-96 w-96 rounded-full bg-kaizen-lime/10 blur-3xl" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <motion.p
              className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan mb-4 uppercase"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              HANDS-ON PRODUCT LEADERSHIP
            </motion.p>

            <motion.h1
              className="text-5xl md:text-7xl font-heading font-black mb-8 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Project Rescue for Failing Web and Software Projects
            </motion.h1>

            <motion.p
              className="text-xl md:text-2xl text-white/80 leading-relaxed mb-12 max-w-3xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              When your build is over budget, late, or stuck, Kaizen steps in as
              a hands-on Contract Product Owner to stabilise delivery, rebuild
              trust, and actually ship.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <button
                onClick={openCalendly}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold text-lg hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
              >
                Book a Project Triage Call
                <ArrowRight size={20} />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Symptom Checklist */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Is your project going off the rails?
              </h2>
              <p className="text-xl text-kaizen-text-dark/70 dark:text-white/70 max-w-2xl mx-auto">
                If any of these sound familiar, you need Project Rescue.
              </p>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              "You've spent serious money but don't have usable software to show for it.",
              "Deadlines keep slipping and nobody can clearly explain why.",
              "Every change request turns into an argument about scope.",
              "Stakeholders have lost confidence in the delivery team.",
              "The backlog is a mess with no clear priorities.",
              "Stand-ups are status updates, not problem-solving sessions.",
              "You're paying developers who seem stuck or blocked.",
              "The project feels out of control and you've lost visibility.",
            ].map((symptom, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="flex items-start gap-4 p-6 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/30"
              >
                <AlertTriangle
                  className="text-red-600 dark:text-red-400 flex-shrink-0 mt-1"
                  size={24}
                />
                <p className="text-base text-kaizen-dark dark:text-white font-medium">
                  {symptom}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* The Process */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                How Project Rescue Works
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                title: "Rapid Audit",
                content:
                  "Review scope, backlog, architecture. Output: Diagnosis & priority list.",
              },
              {
                step: "02",
                title: "Stabilise & Replan",
                content:
                  "We step in as Product Owner. Define realistic goals, tidy backlog, agree on 'Definition of Done'.",
              },
              {
                step: "03",
                title: "Deliver & Hand Over",
                content:
                  "Run sprints focused on shipping. Hand over with a clear roadmap and sustainable rituals.",
              },
            ].map((item, index) => (
              <ScrollReveal key={index} delay={index}>
                <div className="relative p-8 bg-white dark:bg-slate-900 rounded-2xl border border-kaizen-light dark:border-slate-800">
                  <p className="text-6xl font-heading font-black text-kaizen-cyan/20 dark:text-kaizen-cyan/10 mb-4">
                    {item.step}
                  </p>
                  <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-base text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                    {item.content}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Expert Intervention
              </h2>
              <p className="text-xl text-kaizen-text-dark/70 dark:text-white/70 max-w-2xl mx-auto">
                What we actually do when we step in.
              </p>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              "Own and prioritise the backlog as a formal Product Owner.",
              "Set up sprint planning, reviews, and stand-ups.",
              "Bridge the gap between developers and stakeholders.",
              "Leave behind a sustainable way of working.",
              "Remove blockers and make decisions quickly.",
              "Build stakeholder confidence with visible progress.",
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="flex items-start gap-4 p-6 bg-kaizen-light dark:bg-slate-900/50 rounded-xl"
              >
                <CheckCircle
                  className="text-kaizen-cyan flex-shrink-0 mt-1"
                  size={24}
                />
                <p className="text-base text-kaizen-dark dark:text-white font-medium">
                  {item}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Qualification */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Is this right for you?
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <ScrollReveal delay={0}>
              <div className="p-8 bg-green-50 dark:bg-green-900/10 rounded-2xl border-2 border-green-300 dark:border-green-900/30">
                <h3 className="text-2xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white flex items-center gap-3">
                  <CheckCircle
                    className="text-green-600 dark:text-green-400"
                    size={32}
                  />
                  Best Fit
                </h3>
                <ul className="space-y-3 text-base text-kaizen-dark dark:text-white">
                  <li>✓ You have dev/design resources but lack leadership</li>
                  <li>✓ The project is commercially critical</li>
                  <li>✓ You're open to changing workflows</li>
                  <li>
                    ✓ You need someone to own the backlog and make decisions
                  </li>
                  <li>✓ You want to ship working software, not manage chaos</li>
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={1}>
              <div className="p-8 bg-red-50 dark:bg-red-900/10 rounded-2xl border-2 border-red-300 dark:border-red-900/30">
                <h3 className="text-2xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white flex items-center gap-3">
                  <XCircle
                    className="text-red-600 dark:text-red-400"
                    size={32}
                  />
                  Not a Fit
                </h3>
                <ul className="space-y-3 text-base text-kaizen-dark dark:text-white">
                  <li>✗ You're just shopping for the cheapest build</li>
                  <li>✗ You aren't open to changing workflows</li>
                  <li>✗ You want a fixed-price miracle</li>
                  <li>✗ You need a team to build it from scratch</li>
                  <li>
                    ✗ You're looking for marketing advice, not delivery
                    leadership
                  </li>
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 bg-slate-950 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,255,0.1),transparent_50%)]" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
                Stop the bleeding. Start shipping.
              </h2>
              <p className="text-xl text-white/80 leading-relaxed mb-12">
                Book a free 30-minute triage call. We'll listen, diagnose, and
                tell you honestly if we can help.
              </p>
              <button
                onClick={openCalendly}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold text-lg hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
              >
                Book a Free 30-Minute Triage Call
                <ArrowRight size={20} />
              </button>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </Layout>
  );
}
