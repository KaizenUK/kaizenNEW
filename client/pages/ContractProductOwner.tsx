import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Users,
  Zap,
  BookOpen,
  Rocket,
  CheckCircle,
} from "lucide-react";

// Animation variants
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT },
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

// Scroll-triggered fade-in component
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

// Context for managing which card is flipped
const FlipCardContext = React.createContext<{
  flippedId: string | null;
  setFlippedId: (id: string | null) => void;
} | null>(null);

// Provider for Flip Cards
const FlipCardProvider = ({ children }: { children: React.ReactNode }) => {
  const [flippedId, setFlippedId] = useState<string | null>(null);

  return (
    <FlipCardContext.Provider value={{ flippedId, setFlippedId }}>
      {children}
    </FlipCardContext.Provider>
  );
};

// Flip Card Component
const FlipCard = ({
  id,
  icon: Icon,
  title,
  proof,
  matters,
}: {
  id: string;
  icon: any;
  title: string;
  proof: string;
  matters: string;
}) => {
  const context = React.useContext(FlipCardContext);
  if (!context)
    throw new Error("FlipCard must be used within FlipCardProvider");

  const { flippedId, setFlippedId } = context;
  const isFlipped = flippedId === id;

  const handleClick = () => {
    setFlippedId(isFlipped ? null : id);
  };

  return (
    <motion.div
      variants={fadeInUp}
      onClick={handleClick}
      className="h-full cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div className="relative w-full h-80 rounded-2xl border border-kaizen-light dark:border-slate-800/50 overflow-hidden">
        {/* Front Side */}
        <motion.div
          className="absolute inset-0 w-full h-full p-6 bg-kaizen-light dark:bg-slate-900/50 flex flex-col"
          animate={{
            opacity: isFlipped ? 0 : 1,
            pointerEvents: isFlipped ? "none" : "auto",
          }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-3 p-3 w-14 h-14 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 dark:from-kaizen-cyan/10 dark:to-kaizen-lime/10 rounded-lg flex items-center justify-center">
            <Icon
              className="text-kaizen-cyan dark:text-kaizen-cyan/70"
              size={28}
            />
          </div>
          <h3 className="text-base font-heading font-bold mb-2 text-kaizen-dark dark:text-white leading-snug">
            {title}
          </h3>
          <div className="flex-grow overflow-hidden">
            <p className="text-xs font-semibold text-kaizen-cyan dark:text-kaizen-cyan/80 mb-1 uppercase tracking-wide">
              Proof
            </p>
            <p className="text-xs text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
              {proof}
            </p>
          </div>
          <div className="mt-auto pt-2">
            <p className="text-xs text-kaizen-cyan/60 dark:text-kaizen-cyan/50 font-medium">
              ✨ Click to flip
            </p>
          </div>
        </motion.div>

        {/* Back Side */}
        <motion.div
          className="absolute inset-0 w-full h-full p-6 bg-gradient-to-br from-kaizen-cyan to-kaizen-lime flex flex-col"
          animate={{
            opacity: isFlipped ? 1 : 0,
            pointerEvents: isFlipped ? "auto" : "none",
          }}
          transition={{ duration: 0.5 }}
        >
          <h3 className="text-base font-heading font-bold mb-2 text-kaizen-dark leading-snug">
            Why It Matters
          </h3>
          <p className="text-xs text-kaizen-dark/95 leading-relaxed font-medium flex-grow">
            {matters}
          </p>
          <div className="mt-auto pt-2">
            <p className="text-xs text-kaizen-dark/60 font-medium">
              ✨ Click to close
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default function ContractProductOwner() {
  const { openCalendly: openCalendlyFromContext } = useCalendly();

  const comparisonRows = [
    {
      feature: "Primary Focus",
      pm: "Dates and deadlines.",
      po: "Value and ROI.",
    },
    {
      feature: "The Big Question",
      pm: '"When is this due?"',
      po: '"Should we build this at all?"',
    },
    {
      feature: "Handling Scope",
      pm: '"Yes, we can add that (Change Order)."',
      po: '"No, that adds no value. Let\'s do this instead."',
    },
    {
      feature: "Success Metric",
      pm: "The project was delivered on time.",
      po: "The product makes money or saves time.",
    },
    {
      feature: "Relationship",
      pm: "Middle-man between you and the developers.",
      po: "Strategic partner leading the developers.",
    },
  ];

  return (
    <Layout>
      {/* Section 1: Hero - Bold Typography */}
      <section className="min-h-screen bg-white dark:bg-slate-950 flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            {/* Main H1 - Staggered word reveal */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black mb-6 leading-tight text-kaizen-dark dark:text-white">
              {["Contract", "Product", "Owner", "Services"].map(
                (word, index) => (
                  <motion.span
                    key={index}
                    className="block"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: index * 0.12,
                      duration: 0.5,
                      ease: EASE_OUT,
                    }}
                  >
                    {word}
                  </motion.span>
                ),
              )}
            </h1>

            {/* Sub-headline H2 */}
            <h2 className="text-2xl md:text-3xl font-heading font-semibold mb-12 leading-tight text-kaizen-dark dark:text-white/90">
              Your project needs a leader, not just a manager.
            </h2>

            {/* Sub-headline */}
            <motion.p
              className="text-lg md:text-xl text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed mb-8 max-w-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
            >
              I'm <strong>Sean McDonnell</strong>, founder of Kaizen. While{" "}
              <strong>we</strong> are a full-service agency, this is{" "}
              <strong>my</strong> specialist service. I step in personally to
              take full responsibility for your complex project, manage your
              team, and <strong>drive it relentlessly to delivery.</strong> No
              excuses.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
            >
              <button
                onClick={openCalendlyFromContext}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
              >
                Book a 15 Minute Call with Sean
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => {
                  if (typeof window !== "undefined" && (window as any).$crisp) {
                    (window as any).$crisp.push(["do", "chat:open"]);
                  }
                }}
                className="px-8 py-3 rounded-lg border-2 border-kaizen-cyan text-kaizen-cyan dark:text-kaizen-cyan/70 font-heading font-bold hover:bg-kaizen-cyan/10 dark:hover:bg-kaizen-cyan/5 transition inline-flex items-center justify-center gap-2"
              >
                Start a Chat
                <ArrowUpRight size={18} />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2: The "No-BS" Translation */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
                Why Your Project is Failing (And How I Fix It)
              </h2>
              <p className="text-lg md:text-xl text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-8">
                Most projects fail from a lack of a single, accountable owner.
                Not a "project manager" who just shuffles tasks, but one person
                who has the authority to make decisions, protect your budget,
                and act as the single, expert link between your business goals
                and your technical team.
              </p>

              <div>
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  My job is to:
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  Act as your expert representative, de-risk your investment,
                  and ensure what you <em>ask for</em> is what gets{" "}
                  <em>built</em>.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 3: Real-World Experience */}
      <FlipCardProvider>
        <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
          <div className="container mx-auto px-4">
            <ScrollReveal>
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white">
                My Experience, Your Peace of Mind
              </h2>
            </ScrollReveal>

            <div className="max-w-4xl mx-auto text-center mb-8">
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60">
                Click any card to open it and see why this experience matters to
                your project.
              </p>
            </div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              {[
                {
                  id: "card-1",
                  icon: Briefcase,
                  title: "High-Stakes Platform Delivery",
                  proof:
                    "I've owned product strategy for platforms handling over £150m in revenue and millions of transactions, including a zero-downtime legacy migration at Playtech.",
                  matters:
                    "I know how to de-risk your most critical projects. I am not intimidated by complexity.",
                },
                {
                  id: "card-2",
                  icon: Users,
                  title: "Managing Complex Teams & Suppliers",
                  proof:
                    "At High 5 Games, I was the central PO coordinating workflows between art, music, dev, and B2B clients like MGM and FanDuel.",
                  matters:
                    "I save you from managing chaotic suppliers. I become the single point of contact that forces everyone to align.",
                },
                {
                  id: "card-3",
                  icon: Zap,
                  title: "Driving Real Transformation",
                  proof:
                    "I don't just manage projects; I fix processes. I've led digital transformations at firms like SMD Credit Solutions and implemented new Agile workflows.",
                  matters:
                    "I don't just deliver your project; I leave your team and workflow more efficient than I found them.",
                },
                {
                  id: "card-4",
                  icon: Rocket,
                  title: "Building Products From Scratch",
                  proof:
                    "At LeoVegas, I built the company's first multilingual player support platform from the ground up, creating a vital feedback loop that channelled player insights directly to the dev team.",
                  matters:
                    "I know how to take a simple idea, listen to users, and turn it into a fully functional, value-driving product.",
                },
              ].map((card) => (
                <FlipCard key={card.id} {...card} />
              ))}
            </motion.div>
          </div>
        </section>
      </FlipCardProvider>

      {/* Section 4: How I Work */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              How I Work: My "Fix & Deliver" Process
            </h2>
          </ScrollReveal>

          <div className="max-w-3xl mx-auto space-y-8">
            {[
              {
                step: "01",
                title: "Audit & Align",
                copy: 'I join your team, audit the entire project, and interview stakeholders. We establish a single, clear "to-do" list (the backlog) and get everyone aligned.',
              },
              {
                step: "02",
                title: "Prioritise & Manage",
                copy: "I ruthlessly prioritise the work based on business value. I run the weekly sprints, clear roadblocks for the team, and shield them from distractions.",
              },
              {
                step: "03",
                title: "Deliver & Report",
                copy: "I manage the release process and provide you with a simple, no-jargon report every week. You see constant, predictable progress.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                className="flex gap-8 md:gap-12 items-start"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
              >
                {/* Step number */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-kaizen-cyan to-kaizen-lime rounded-full flex items-center justify-center">
                    <span className="text-kaizen-dark font-heading font-black text-xl">
                      {item.step}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-grow pt-2">
                  <h3 className="text-2xl md:text-3xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                    {item.copy}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4b: Why We Use Product Owners, Not Project Managers */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-4xl mx-auto mb-12">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Why We Use Product Owners, Not Project Managers
              </h2>
              <p className="text-lg md:text-xl text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                Most agencies assign you a Project Manager. Their job is to
                protect the agency's margin. At Kaizen, I step in as a Contract
                Product Owner. My job is to protect your ROI.
              </p>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed mt-4">
                It sounds like a subtle title change, but the difference in
                delivery is massive.
              </p>
            </div>
          </ScrollReveal>

          <div className="max-w-4xl mx-auto">
            {/* Desktop/tablet: side-by-side comparison table */}
            <div className="hidden md:block overflow-x-auto">
              <div className="min-w-[640px] rounded-2xl border border-kaizen-light dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
                <div className="grid grid-cols-3 border-b border-kaizen-light/70 dark:border-slate-800">
                  <div className="p-4 text-sm font-heading font-semibold text-kaizen-dark dark:text-white bg-kaizen-light/70 dark:bg-slate-900/70">
                    Feature
                  </div>
                  <div className="p-4 text-sm font-heading font-semibold text-kaizen-dark dark:text-white bg-red-50 dark:bg-red-900/20 border-l border-kaizen-light/70 dark:border-slate-800">
                    Project Manager (Traditional Agency)
                  </div>
                  <div className="p-4 text-sm font-heading font-semibold text-kaizen-dark dark:text-white bg-green-50 dark:bg-green-900/20 border-l border-kaizen-light/70 dark:border-slate-800">
                    Product Owner (Kaizen)
                  </div>
                </div>

                {comparisonRows.map((row, index) => (
                  <div
                    key={row.feature}
                    className={`grid grid-cols-3 border-t border-kaizen-light/60 dark:border-slate-800 ${
                      index % 2 === 0
                        ? "bg-white dark:bg-slate-950"
                        : "bg-kaizen-light/40 dark:bg-slate-900/60"
                    }`}
                  >
                    <div className="p-4 text-sm font-heading font-semibold text-kaizen-dark dark:text-white">
                      {row.feature}
                    </div>
                    <div className="p-4 text-sm text-kaizen-text-dark/80 dark:text-white/70 border-l border-kaizen-light/60 dark:border-slate-800">
                      {row.pm}
                    </div>
                    <div className="p-4 text-sm text-kaizen-text-dark/90 dark:text-white border-l border-kaizen-light/60 dark:border-slate-800 bg-green-50/60 dark:bg-green-900/15">
                      {row.po}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile: stacked cards for each feature */}
            <div className="md:hidden space-y-4">
              {comparisonRows.map((row) => (
                <div
                  key={row.feature}
                  className="rounded-2xl border border-kaizen-light dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-kaizen-light/70 dark:border-slate-800 bg-kaizen-light/70 dark:bg-slate-900/70">
                    <p className="text-sm font-heading font-semibold text-kaizen-dark dark:text-white">
                      {row.feature}
                    </p>
                  </div>
                  <div className="divide-y divide-kaizen-light/60 dark:divide-slate-800">
                    <div className="p-4 bg-red-50 dark:bg-red-900/10">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300 mb-1">
                        Project Manager (Traditional Agency)
                      </p>
                      <p className="text-sm text-kaizen-text-dark/80 dark:text-white/75">
                        {row.pm}
                      </p>
                    </div>
                    <div className="p-4 bg-green-50/70 dark:bg-green-900/20">
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-300 mb-1">
                        Product Owner (Kaizen)
                      </p>
                      <p className="text-sm text-kaizen-text-dark/90 dark:text-white">
                        {row.po}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm md:text-base text-kaizen-text-dark/80 dark:text-white/70">
              <span className="font-semibold">The bottom line:</span> If you
              want someone to send you a weekly status report, hire a Project
              Manager. If you want someone to take ownership of the backlog,
              make the hard commercial decisions, and ensure the software
              actually solves the business problem, you need a Product Owner.
            </p>
          </div>

          <div className="max-w-4xl mx-auto mt-12 border-t border-kaizen-light dark:border-slate-800 pt-10">
            <h3 className="text-2xl md:text-3xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
              FAQ: Do I need a Product Owner or a Project Manager?
            </h3>
            <p className="text-lg text-kaizen-text-dark/80 dark:text-white/70 leading-relaxed mb-4">
              A Project Manager asks: <strong>"When will this be done?"</strong>{" "}
              They focus on dates, status reports, and Gantt charts.
            </p>
            <p className="text-lg text-kaizen-text-dark/80 dark:text-white/70 leading-relaxed mb-4">
              A Product Owner asks:{" "}
              <strong>"Should we build this at all?"</strong> I focus on value,
              risk, and what the work does to your bottom line.
            </p>
            <p className="text-lg text-kaizen-text-dark/80 dark:text-white/70 leading-relaxed">
              If your team is building the wrong features on time, you do not
              have a delivery problem, you have a strategy problem. That is
              where a Product Owner pays for themselves very quickly.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5: Professional Accreditations */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              Professional Accreditations
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              { title: "PRINCE2 Certified" },
              { title: "Project Management Institute (PMI) Member" },
              { title: "HubSpot Certified" },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="text-center"
              >
                <div className="mb-6 p-4 w-16 h-16 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 dark:from-kaizen-cyan/10 dark:to-kaizen-lime/10 rounded-xl flex items-center justify-center mx-auto">
                  <CheckCircle
                    className="text-kaizen-cyan dark:text-kaizen-cyan/70"
                    size={32}
                  />
                </div>
                <p className="text-xl font-heading font-bold text-kaizen-dark dark:text-white">
                  {item.title}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 6: When to Hire Me */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              When to Hire a Contract PO
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "You're a Founder Who's Too Busy",
                copy: "You can't be in every technical meeting. I step in and run the project so you can run your business.",
              },
              {
                title: "Your Project is Stuck or Chaotic",
                copy: "The project is drifting, deadlines are being missed, and the team is confused. I step in, create clarity, and get it back on track.",
              },
              {
                title: "You're Juggling Multiple Suppliers",
                copy: "You have a dev team, a design agency, and a marketing consultant, but no one is talking. I become the single point of control to manage all of them.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {item.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  {item.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 7: How This Fits With Kaizen */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              How This Fits With Kaizen
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                icon: Users,
                title: "Agile Coaching",
                copy: "I've implemented Agile workflows that became company models. If you want us to train your own team, we can coach them.",
                link: "/agile-coaching",
                linkText: "Explore Agile Coaching",
              },
              {
                icon: BookOpen,
                title: "Our Web Design Projects",
                copy: "This is the same expert process we use to manage all of our web design and development projects.",
                link: "/services/web-design-liverpool",
                linkText: "Explore Web Design",
              },
            ].map((item, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Link
                  to={item.link}
                  onClick={() => window.scrollTo(0, 0)}
                  className="block p-8 bg-white dark:bg-slate-950 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition group h-full"
                >
                  <div className="mb-6 p-4 w-16 h-16 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 dark:from-kaizen-cyan/10 dark:to-kaizen-lime/10 rounded-xl flex items-center justify-center">
                    <item.icon
                      className="text-kaizen-cyan dark:text-kaizen-cyan/70 group-hover:scale-110 transition"
                      size={32}
                    />
                  </div>
                  <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white group-hover:text-kaizen-cyan transition">
                    {item.title}
                  </h3>
                  <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-6">
                    {item.copy}
                  </p>
                  <div className="text-kaizen-cyan font-medium flex items-center gap-2 hover:gap-3 transition">
                    {item.linkText} <ArrowUpRight size={18} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 8: Final Call to Action */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-text-light dark:text-white">
              Get Your Project Delivered. No Excuses.
            </h2>
            <p className="text-xl text-kaizen-text-light/80 dark:text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
              Let's talk about your project. Book a 15-minute, confidential call
              with me, Sean, to see how I can help.
            </p>
          </ScrollReveal>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <button
              onClick={openCalendlyFromContext}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
            >
              Book a 15 Minute Call with Sean
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).$crisp) {
                  (window as any).$crisp.push(["do", "chat:open"]);
                }
              }}
              className="px-8 py-3 rounded-lg border-2 border-kaizen-text-light/30 dark:border-white/20 text-kaizen-text-light dark:text-white/85 font-heading font-bold hover:border-kaizen-cyan dark:hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
            >
              Start a Live Chat
              <ArrowUpRight size={18} />
            </button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
