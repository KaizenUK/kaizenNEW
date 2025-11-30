import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Lightbulb,
  Heart,
  Users,
} from "lucide-react";
import AnimatedJapaneseSymbols from "@/components/AnimatedJapaneseSymbols";

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

export default function About() {
  return (
    <Layout>
      {/* Section 1: Hero - Manifesto Style */}
      <section className="min-h-screen bg-white dark:bg-slate-950 flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="max-w-2xl">
              {/* Main H1 */}
              <motion.h1
                className="text-5xl md:text-6xl lg:text-7xl font-heading font-black mb-8 leading-tight text-kaizen-dark dark:text-white"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                We're not another faceless agency.
              </motion.h1>

              {/* Sub-headline */}
              <motion.div
                className="text-lg md:text-xl text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed mb-8 space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
              >
                <p>
                  <strong>We</strong> are Kaizen.
                </p>
                <p>
                  We've spent over a decade in the high-stakes global tech
                  industry, and we built this agency to do things differently.
                  No buzzwords, no chaotic projects, no excuses. This is our
                  story.
                </p>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                <button
                  onClick={() => {
                    if (
                      typeof window !== "undefined" &&
                      (window as any).$crisp
                    ) {
                      (window as any).$crisp.push(["do", "chat:open"]);
                    }
                  }}
                  className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
                >
                  Start a Chat
                  <ArrowRight size={18} />
                </button>
              </motion.div>
            </div>

            {/* Animated Japanese Symbols */}
            <div className="hidden lg:flex justify-center lg:justify-end">
              <AnimatedJapaneseSymbols />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Our Story */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Our Story
              </h2>
              <h3 className="text-2xl font-heading font-semibold mb-12 text-kaizen-cyan dark:text-kaizen-cyan/80">
                About Me, the Founder
              </h3>

              <div className="space-y-6 text-lg text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                <p>
                  I'm Sean McDonnell, the founder of Kaizen. I'm not a typical
                  agency owner.
                </p>

                <p>
                  For over a decade, I've been deep in the high-stakes, chaotic
                  world of the global tech industry. I've lived and worked in
                  Canada, Ireland, Malta (where I met my husband, Kiko), Spain,
                  Bulgaria, and Romania, managing massive projects for iGaming
                  and FinTech giants. I've also seen how unstable that world
                  is—I was made redundant three times in two years. That's the
                  nature of the beast.
                </p>

                <p>
                  That kind of experience forces you to be resilient, and
                  frankly, it made me want to build something better and more
                  stable, right here at home. I set up Kaizen because I love
                  what I do, and I'm exceptionally good at it. I needed to build
                  something I could depend on.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 3: Philosophy */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              Our Philosophy
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
                icon: Lightbulb,
                title: "Kaizen (改善)",
                copy: "Kaizen means 'continuous improvement.' We believe in it because we've lived it. There is always a better way to build a website or run a project. We are obsessed with finding it.",
              },
              {
                icon: Heart,
                title: '"Love What You Do"',
                copy: "We're wired to be perfectionists. Our 'superpower' is a hyperfocus on things we're interested in—like your project. We're tech sponges. We'll work all night to get a small detail right, because we genuinely love this work.",
              },
              {
                icon: Users,
                title: '"Train to Leave"',
                copy: "We believe in the mantra: \"Train people well enough so they can leave, treat them well enough so they don't want to.\" We apply this to you. We give your team control so you're not dependent on us.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition"
              >
                <div className="mb-6 p-4 w-16 h-16 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 dark:from-kaizen-cyan/10 dark:to-kaizen-lime/10 rounded-xl flex items-center justify-center">
                  <item.icon
                    className="text-kaizen-cyan dark:text-kaizen-cyan/70"
                    size={32}
                  />
                </div>
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

      {/* Section 4: Why Us */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              Why We're the Right Choice for You
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "You Get a World-Class Expert",
                copy: "When you work with Kaizen, you're not handed off to a junior account manager. You get me, Sean, a Senior Product Owner who has managed £150m platforms. I apply that same obsessive, expert focus to your £15k project.",
              },
              {
                title: 'You Get a "No-BS" Partner',
                copy: "We're a small, expert-led agency built on stability and transparency. We don't do chaotic projects or make empty promises. We're here to be your long-term, local partner.",
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

      {/* Section 5: The Team */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-12 text-kaizen-dark dark:text-white">
                When We're Not Working
              </h2>

              <p className="text-lg md:text-xl text-kaizen-text-dark/70 dark:text-white/60 leading-relaxed">
                Kaizen is run by Sean—a local lad—and his husband, Kiko. When
                we're not running projects, gaming on the PS5, or producing
                music, you'll find us being dragged around the Wirral by our
                5-year-old Border Collie, Rikki.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 6: Next Steps */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark dark:text-white text-center">
              Want to Know More?
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
                title: "How We De-Risk Your Project",
                copy: "Want to see the expert, \"no-BS\" process we use to run projects? It's based on my 10+ years of delivering high-stakes platforms, and it's how we ensure your project is delivered without the chaos.",
                link: "/contract-product-owner",
                linkText: "See Our Process",
              },
              {
                title: 'Our "No-BS" Pledge',
                copy: "We believe in total transparency. See our page on how we work, our pricing, and what we don't do.",
                link: "/pledge",
                linkText: "Read Our Pledge",
              },
            ].map((item, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Link
                  to={item.link}
                  onClick={() => window.scrollTo(0, 0)}
                  className="block p-8 bg-white dark:bg-slate-950 rounded-2xl border border-kaizen-light dark:border-slate-800/50 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition group h-full"
                >
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

      {/* Section 7: Final CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-kaizen-text-light dark:text-white/85">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-text-light dark:text-white">
              Let's Build Something Better.
            </h2>
            <p className="text-xl text-kaizen-text-light/80 dark:text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
              Now you know our story. We'd love to hear yours.
            </p>
          </ScrollReveal>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <button
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).$crisp) {
                  (window as any).$crisp.push(["do", "chat:open"]);
                }
              }}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
            >
              Start a Live Chat
              <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
