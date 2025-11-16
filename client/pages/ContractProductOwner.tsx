import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Users,
  Zap,
  BookOpen,
} from "lucide-react";

// Animation variants
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

export default function ContractProductOwner() {
  return (
    <Layout>
      <Helmet>
        <title>Sean McDonnell | Contract Product Owner Liverpool | Kaizen</title>
        <meta
          name="description"
          content="Sean McDonnell, a Liverpool-based Senior Product Owner with 10+ years' experience in iGaming & high-stakes platform migration. I deliver complex projects, on time."
        />
      </Helmet>

      {/* Section 1: Hero - Bold Typography */}
      <section className="min-h-screen bg-white dark:bg-slate-950 flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            {/* Main H1 - Staggered word reveal */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black mb-12 leading-tight text-kaizen-dark dark:text-white">
              {["Your", "£100k", "project", "needs", "one", "owner."].map(
                (word, index) => (
                  <motion.span
                    key={index}
                    className="block"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: index * 0.12,
                      duration: 0.5,
                      ease: "easeOut",
                    }}
                  >
                    {word}
                  </motion.span>
                )
              )}
            </h1>

            {/* Sub-headline */}
            <motion.p
              className="text-lg md:text-xl text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed mb-8 max-w-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
            >
              I'm <strong>Sean McDonnell</strong>, a Senior Product Owner with over a decade of experience, acting as the expert link between your business goals and your technical team. I take full responsibility for complex projects and see them through to delivery. No excuses.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
            >
              <Link
                to="/contact"
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
              >
                Book a Call with Sean
                <ArrowRight size={18} />
              </Link>
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
                What a "Product Owner" Actually Does
              </h2>
              <p className="text-lg md:text-xl text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-8">
                A Product Owner is not just a "project manager." They are the one person with the authority to make decisions. They protect your budget, they ruthlessly prioritise the "to-do" list (the backlog), and they are the single, expert link between your commercial goals and your technical, art, and compliance teams.
              </p>

              <div>
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  In short:
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  I act as your expert representative, ensuring what you <em>ask for</em> is what gets <em>built</em>.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 3: Real-World Experience */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white">
              My Experience, Your Peace of Mind
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                icon: Briefcase,
                title: "High-Stakes Platform Delivery",
                copy: "I've owned product strategy for platforms handling over £150m in revenue and millions of transactions. I am comfortable managing high-stakes, zero-downtime projects, like the core legacy platform migration I managed at Playtech.",
              },
              {
                icon: Users,
                title: "Managing Complex Teams",
                copy: "I act as the central hub. At High 5 Games, I was the central PO for new titles, coordinating workflows between art, music, dev, and B2B clients like MGM and FanDuel.",
              },
              {
                icon: Zap,
                title: "Driving Transformation",
                copy: "I don't just manage projects; I fix processes. I've led full digital transformations at firms like SMD Credit Solutions and implemented new Agile workflows that became company models.",
              },
            ].map((card, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <div className="mb-6 p-4 w-16 h-16 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 dark:from-kaizen-cyan/10 dark:to-kaizen-lime/10 rounded-xl flex items-center justify-center">
                  <card.icon
                    className="text-kaizen-cyan dark:text-kaizen-cyan/70"
                    size={32}
                  />
                </div>
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {card.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  {card.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 4: When to Hire Me */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
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
                className="p-8 bg-white dark:bg-slate-950 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
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

      {/* Section 5: Internal Links (Cross-Sell) */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              My Core Expertise
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
                copy: "I've implemented Agile workflows that became company models. If you want to train your own team, I can coach them.",
                link: "/agile-coaching",
                linkText: "Explore Agile Coaching",
              },
              {
                icon: BookOpen,
                title: "Web Design Projects",
                copy: "This is the same expert process I use to manage all of our web design and development projects.",
                link: "/services/web-design-liverpool",
                linkText: "Explore Web Design",
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

      {/* Section 6: Final CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-text-light dark:text-white">
              Get Your Project Delivered. No Excuses.
            </h2>
            <p className="text-xl text-kaizen-text-light/80 dark:text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
              Let's talk about your project. Book a 15-minute, confidential call with me, Sean, to see how I can help.
            </p>
          </ScrollReveal>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Link
              to="/contact"
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
            >
              Book a Call with Sean
              <ArrowRight size={18} />
            </Link>
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
