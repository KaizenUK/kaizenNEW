import { useState, useEffect } from "react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, CheckCircle } from "lucide-react";
import Layout from "@/components/Layout";
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

// Glowing Grid Hero with Tracing Beam Effect
const GlowingGridHero = () => {
  const { openCalendly } = useCalendly();

  return (
    <section className="relative min-h-screen bg-gray-950 text-white flex items-center py-20 overflow-hidden">
      {/* SVG Grid Pattern */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      </svg>

      {/* Animated Glow Background */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-20"
        animate={{
          x: ["-20%", "20%", "-20%"],
          y: ["-20%", "20%", "-20%"],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background: "radial-gradient(circle at center, rgba(0, 255, 255, 0.4) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Subtle gradient overlay for text clarity */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan mb-6 uppercase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            High-Performance Web Design for Liverpool
          </motion.p>

          <motion.h1
            className="text-5xl md:text-7xl font-heading font-black mb-8 leading-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Web Design Liverpool: Product Owner-Led & Agile
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-white/85 leading-relaxed mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            We build high-performance sites, fix chaotic projects, and coach
            your team to deliver in sprints. No jargon, just results.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <Link
              to="/contact"
              className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-gray-950 font-heading font-bold text-lg hover:shadow-2xl hover:shadow-kaizen-cyan/60 hover:scale-105 transition-all inline-flex items-center justify-center gap-2"
            >
              Get a Liverpool web design quote
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/case-studies"
              className="px-8 py-4 rounded-lg border-2 border-white/30 text-white font-heading font-bold text-lg hover:border-kaizen-cyan hover:text-kaizen-cyan hover:shadow-lg hover:shadow-kaizen-cyan/30 transition-all inline-flex items-center justify-center gap-2"
            >
              View case studies
              <ArrowUpRight size={20} />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  const { openCalendly } = useCalendly();

  return (
    <Layout>
      {/* Section 1: The "Wow" Hero */}
      <GlowingGridHero />

      {/* Section 2: The "Three Pillars" */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                The Three Pillars
              </h2>
              <p className="text-xl text-kaizen-text-dark/70 dark:text-white/70 max-w-2xl mx-auto">
                Our unique 3-part offering combines technical excellence with
                hands-on delivery leadership.
              </p>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "High-Performance Web Design",
                copy: "Fast, modern builds in WordPress and React. Mobile-first, SEO-ready, and easy for your team to manage.",
                link: "/services/web-design-liverpool",
                linkText: "Learn more",
              },
              {
                title: "Agile Coaching & Delivery Training",
                copy: "We help teams run in sprints. Simple rituals: backlog, planning, reviews. Delivery habits that actually stick.",
                link: "/agile-coaching",
                linkText: "Learn more",
              },
              {
                title: "Contract Product Owner & Project Rescue",
                copy: "We step in when projects are late, over budget, or stuck. Hands-on leadership to bring clarity and momentum.",
                link: "/project-rescue",
                linkText: "See Project Rescue",
              },
            ].map((card, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="group p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                  {card.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed mb-6">
                  {card.copy}
                </p>
                <Link
                  to={card.link}
                  className="inline-flex items-center gap-2 text-kaizen-cyan hover:gap-3 transition-all font-heading font-bold"
                >
                  {card.linkText} <ArrowRight size={18} />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 3: Who We Help */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Websites for Liverpool businesses like yours
              </h2>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "Professional Services",
                copy: "Turn expertise into enquiries with credible, mobile-ready sites.",
                subtitle: "(Solicitors, Accountants)",
              },
              {
                title: "Trades & Home Services",
                copy: "Showcase work and get 'call now' leads from people on the move.",
                subtitle: "(Builders, Electricians)",
              },
              {
                title: "E-commerce & Retail",
                copy: "Fast product pages, simple checkout, and SEO-friendly structure.",
                subtitle: "(Shops, DTC brands)",
              },
            ].map((card, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <h3 className="text-2xl font-heading font-bold mb-2 text-kaizen-dark dark:text-white">
                  {card.title}
                </h3>
                <p className="text-sm text-kaizen-text-dark/60 dark:text-white/50 mb-4">
                  {card.subtitle}
                </p>
                <p className="text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                  {card.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 4: Proudly Based in Liverpool */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
                Proudly based in Liverpool
              </h2>
              <p className="text-xl text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                Kaizen is based near the Baltic Triangle. We work with clients
                across Merseyside and understand how locals actually search
                ('near me', area names). We're always happy to meet for a quick
                video call or a coffee in town.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 5: The "Agile Process" (How We Work) */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                How We Work: The Agile Process
              </h2>
              <p className="text-xl text-kaizen-text-dark/70 dark:text-white/70 max-w-2xl mx-auto">
                Proving the Product Owner difference through clear, iterative
                delivery.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {[
              {
                step: "01",
                title: "Discover & Define",
                content:
                  "Workshop to define goals. Output: a prioritised backlog, not a wishlist.",
              },
              {
                step: "02",
                title: "Design the Journey",
                content: "Wireframes focused on clarity and conversion.",
              },
              {
                step: "03",
                title: "Build in Sprints",
                content:
                  "Short sprints with clear acceptance criteria. You see progress often, not just at the end.",
              },
              {
                step: "04",
                title: "Launch & Improve",
                content: "Careful launch, then iterations based on real data.",
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

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/services/digital-transformation"
              className="inline-flex items-center gap-2 text-kaizen-cyan hover:gap-3 transition-all font-heading font-bold text-lg"
            >
              See Digital Transformation <ArrowRight size={18} />
            </Link>
            <span className="text-kaizen-text-dark/30 dark:text-white/30">
              |
            </span>
            <Link
              to="/contract-product-owner"
              className="inline-flex items-center gap-2 text-kaizen-cyan hover:gap-3 transition-all font-heading font-bold text-lg"
            >
              Learn about Contract PO support <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Section 6: Project Rescue Teaser */}
      <section className="py-20 md:py-32 bg-slate-950 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.1),transparent_50%)]" />
        <div className="container mx-auto px-4 relative">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
                Project already in trouble?
              </h2>
              <p className="text-xl text-white/80 leading-relaxed mb-12">
                Is your current build over budget, late, or messy? Do you have
                endless scope changes and no clear owner? We can help.
              </p>
              <Link
                to="/project-rescue"
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-red-500 to-red-700 text-white font-heading font-bold text-lg hover:shadow-lg hover:shadow-red-500/50 transition inline-flex items-center justify-center gap-2"
              >
                Learn about Project Rescue
                <ArrowRight size={20} />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 7: Recent Work & Blog */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Work */}
            <ScrollReveal>
              <div>
                <h2 className="text-3xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
                  Recent Work
                </h2>
                <div className="space-y-6">
                  {[
                    {
                      title: "Professional Services - Liverpool",
                      subtitle: "Custom WordPress site with local SEO",
                      link: "/case-studies/as-collections",
                    },
                    {
                      title: "Hairdressing Salon - Wirral",
                      subtitle: "Booking system & online presence",
                      link: "/case-studies/helen-moore-hairdressing",
                    },
                  ].map((item, index) => (
                    <Link
                      key={index}
                      to={item.link}
                      className="block p-6 bg-kaizen-light dark:bg-slate-900/50 rounded-xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition group"
                    >
                      <h3 className="text-xl font-heading font-bold mb-2 text-kaizen-dark dark:text-white group-hover:text-kaizen-cyan transition">
                        {item.title}
                      </h3>
                      <p className="text-base text-kaizen-text-dark/70 dark:text-white/60">
                        {item.subtitle}
                      </p>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/case-studies"
                  className="inline-flex items-center gap-2 text-kaizen-cyan hover:gap-3 transition-all font-heading font-bold text-lg mt-6"
                >
                  View all case studies <ArrowRight size={18} />
                </Link>
              </div>
            </ScrollReveal>

            {/* Blog */}
            <ScrollReveal delay={1}>
              <div>
                <h2 className="text-3xl font-heading font-bold mb-8 text-kaizen-dark dark:text-white">
                  Latest Insights
                </h2>
                <div className="space-y-6">
                  <Link
                    to="/blog/new-kaizen-website-relaunch"
                    className="block p-6 bg-kaizen-light dark:bg-slate-900/50 rounded-xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition group"
                  >
                    <h3 className="text-xl font-heading font-bold mb-2 text-kaizen-dark dark:text-white group-hover:text-kaizen-cyan transition">
                      More Than a Refresh: Why We Rebuilt the Kaizen Website
                    </h3>
                    <p className="text-base text-kaizen-text-dark/70 dark:text-white/60">
                      We didn't just refresh our site; we tore it down to the
                      studs...
                    </p>
                  </Link>
                </div>
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-2 text-kaizen-cyan hover:gap-3 transition-all font-heading font-bold text-lg mt-6"
                >
                  View all blog posts <ArrowRight size={18} />
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Section 8: Final CTA */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-kaizen-dark via-slate-900 to-black text-white relative overflow-hidden">
        <div className="pointer-events-none absolute top-20 right-10 h-96 w-96 rounded-full bg-kaizen-cyan/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-20 left-10 h-96 w-96 rounded-full bg-kaizen-lime/10 blur-3xl" />
        <div className="container mx-auto px-4 relative">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
                Ready to talk about your website or project?
              </h2>
              <p className="text-xl text-white/80 leading-relaxed mb-12">
                No hard sell. Just a straightforward chat about what's going
                wrong and what you want to achieve.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/contact"
                  className="px-8 py-4 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold text-lg hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
                >
                  Get a Liverpool web design quote
                  <ArrowRight size={20} />
                </Link>
                <Link
                  to="/about"
                  className="text-white/80 hover:text-kaizen-cyan transition font-heading font-bold text-lg inline-flex items-center gap-2"
                >
                  Or learn how we work <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </Layout>
  );
}
