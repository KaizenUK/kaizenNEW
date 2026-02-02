import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";
import { FaqSection } from "@/components/FaqSection";
import {
  ArrowRight,
  ArrowUpRight,
  AlertCircle,
  Users,
  DollarSign,
  CheckCircle,
  BookOpen,
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

// CTA Button component
const CTAButton = ({
  text,
  onClick,
  secondary = false,
  openChat = false,
  openCalendly: openCalendlyProp = false,
}: {
  text: string;
  onClick?: () => void;
  secondary?: boolean;
  openChat?: boolean;
  openCalendly?: boolean;
}) => {
  const { openCalendly } = useCalendly();

  const handleClick = () => {
    if (openCalendlyProp) {
      openCalendly();
    } else if (openChat && typeof window !== "undefined") {
      if ((window as any).$crisp) {
        (window as any).$crisp.push(["do", "chat:open"]);
      }
    }
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`px-8 py-3 rounded-lg font-heading font-bold inline-flex items-center justify-center gap-2 transition ${
        secondary
          ? "border-2 border-kaizen-cyan text-kaizen-cyan hover:bg-kaizen-cyan/10 dark:border-kaizen-cyan/70 dark:text-kaizen-cyan/70 dark:hover:bg-kaizen-cyan/5"
          : "bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark hover:shadow-lg hover:shadow-kaizen-cyan/50"
      }`}
    >
      {text}
      <ArrowRight size={18} />
    </button>
  );
};

export default function AgileCoaching() {
  const { openCalendly: openCalendlyFromContext } = useCalendly();

  return (
    <Layout>
      {/* Section 1: Hero - Typography as Graphic */}
      <section className="min-h-screen bg-white dark:bg-slate-950 flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            {/* Main H1 - Staggered word reveal */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black mb-6 leading-tight text-kaizen-dark dark:text-white">
              {["Agile", "Coaching", "&", "Consultancy", "Liverpool"].map(
                (word, index) => (
                  <motion.span
                    key={index}
                    className="block"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: index * 0.15,
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
              Stop. Wasting. Time. Start Shipping.
            </h2>

            {/* Sub-headline */}
            <motion.p
              className="text-xl md:text-2xl text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed mb-12 max-w-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              We help Liverpool & Wirral businesses fix their chaotic workflows.
              We use practical Agile coaching to get your team focused, your
              projects on track, and your work done faster. No jargon, just
              results.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <CTAButton text="Start a Chat" openChat />
              <button
                onClick={openCalendlyFromContext}
                className="px-8 py-3 rounded-lg border-2 border-kaizen-cyan text-kaizen-cyan dark:text-kaizen-cyan/70 font-heading font-bold hover:bg-kaizen-cyan/10 dark:hover:bg-kaizen-cyan/5 transition inline-flex items-center justify-center gap-2"
              >
                Book a 15 Minute Call
                <ArrowUpRight size={18} />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2: What "Agile Coaching" Actually Means */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
                What "Agile Coaching" Actually Means
              </h2>
              <p className="text-xl text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-12">
                "Agile" is just a word for working smarter. It means breaking
                huge, scary projects into small, manageable pieces. It means
                clear communication, no one is guessing what to do, and you see
                progress every single week, not just at the end.
              </p>

              <div>
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  Who is this for?
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  This is for any business owner who is frustrated by team
                  confusion, projects that drag on forever, or a workflow that
                  feels stuck.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 3: Pain Points - Does This Sound Familiar? */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              Does This Sound Familiar?
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
                icon: AlertCircle,
                title: "Missed Deadlines",
                copy: "Projects start strong but fizzle out, and the launch date keeps slipping. No one is 100% sure who is responsible for what.",
              },
              {
                icon: Users,
                title: "Team Confusion",
                copy: "Your team is busy, but not productive. They're working in silos, communication is poor, and small tasks turn into huge problems.",
              },
              {
                icon: DollarSign,
                title: "Wasted Budget",
                copy: "You're spending time and money, but not seeing results. You're not sure if your team is working on the *right* things.",
              },
            ].map((pain, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <div className="mb-6 p-4 w-16 h-16 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 dark:from-kaizen-cyan/10 dark:to-kaizen-lime/10 rounded-xl flex items-center justify-center">
                  <pain.icon
                    className="text-kaizen-cyan dark:text-kaizen-cyan/70"
                    size={32}
                  />
                </div>
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {pain.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  {pain.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 4: Our Simple 3-Step Process */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              Our Simple 3-Step Process
            </h2>
          </ScrollReveal>

          <div className="max-w-3xl mx-auto space-y-8">
            {[
              {
                step: "01",
                title: "Audit",
                copy: "We sit with your team. We listen. We map out your current workflow, from idea to delivery, and find the real bottlenecks.",
              },
              {
                step: "02",
                title: "Workshop",
                copy: "We run a hands-on workshop (no boring PowerPoints) to introduce a simpler, Agile-based system. We give your team the tools to manage their own work.",
              },
              {
                step: "03",
                title: "Implement & Support",
                copy: 'We don\'t just hand you a report. We work with you for the first few weeks, helping you run your first "sprints" and making sure the new process sticks.',
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

      {/* Section 5: Agile is in Our DNA */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              Agile is in Our DNA
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
                icon: CheckCircle,
                title: "Our Web Design Process",
                copy: "We use this *exact* Agile method to build our websites. It's how we launch on time, every time.",
                link: "/services/web-design-liverpool",
                linkText: "Explore Web Design",
              },
              {
                icon: Users,
                title: "Need Someone to Run it?",
                copy: "If you're too busy to run the new process, you can hire one of our expert Contract Product Owners.",
                link: "/services/contract-product-owner",
                linkText: "Explore Product Ownership",
              },
              {
                icon: BookOpen,
                title: "Our Agile Insights",
                copy: 'We post regular, "no-BS" articles about practical Agile tips for real businesses. Read our blog to see how we think.',
                link: "/blog",
                linkText: "Read the Blog",
              },
            ].map((item, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Link
                  to={item.link}
                  className="block p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition group h-full"
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

      <FaqSection
        heading="Agile Coaching FAQs"
        eyebrow="Common Questions"
        items={[
          {
            question: "Do you coach non-technical teams?",
            answer:
              "Yes. Agile is about value delivery, not just code. We help marketing and operations teams in Liverpool adopt Scrum or Kanban to reduce wasted time.",
          },
          {
            question: "What is the difference between coaching and training?",
            answer:
              "Training is a one-off workshop. Coaching is us sitting with your team during their real work (sprints), fixing bad habits and improving their delivery in real time.",
          },
          {
            question: "How long does an engagement last?",
            answer:
              "Typically 3–6 months. We aim to make ourselves redundant by building the capability inside your team, rather than making you dependent on us.",
          },
        ]}
      />

      {/* Section 6: Final CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-text-light dark:text-white">
              Stop Running in Circles.
            </h2>
            <p className="text-xl text-kaizen-text-light/80 dark:text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
              Let's fix your workflow. Book a 15-minute, no-pressure call to see
              if we can help.
            </p>
          </ScrollReveal>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <CTAButton text="Start a Live Chat" openChat />
            <button
              onClick={openCalendlyFromContext}
              className="px-8 py-3 rounded-lg border-2 border-kaizen-text-light/30 dark:border-white/20 text-kaizen-text-light dark:text-white/85 font-heading font-bold hover:border-kaizen-cyan dark:hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
            >
              Book a 15 Minute Call
              <ArrowUpRight size={18} />
            </button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
