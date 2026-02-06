import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { ArrowRight, Zap, TrendingUp, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AnimatedJapaneseSymbols from "@/components/AnimatedJapaneseSymbols";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
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

export default function About() {
  const navigate = useNavigate();
  return (
    <Layout>
      {/* HERO - The Promise */}
      <section className="min-h-screen bg-white dark:bg-slate-950 flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-heading font-black mb-6 leading-tight text-kaizen-dark dark:text-white">
                  Stop overcomplicating your website.
                </h1>
                <p className="text-xl md:text-2xl text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                  Traditional agencies are slow, expensive, and love jargon. We
                  use modern technology to build fast, effective websites that
                  just work.
                </p>
              </motion.div>

              <motion.button
                onClick={() => navigate("/contact")}
                className="mt-8 px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Let's talk
                <ArrowRight size={18} />
              </motion.button>
            </div>

            {/* Animated Japanese Symbols */}
            <div className="hidden lg:flex justify-center lg:justify-end">
              <AnimatedJapaneseSymbols />
            </div>
          </div>
        </div>
      </section>

      {/* PHILOSOPHY - Kaizen for Business */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-heading font-black mb-8 text-kaizen-dark dark:text-white">
                Continuous improvement. For your business.
              </h2>

              <div className="text-xl text-kaizen-dark/70 dark:text-white/70 leading-relaxed space-y-6">
                <p>
                  Kaizen means "continuous improvement". Most agencies launch
                  your site and disappear. That's not how we work.
                </p>

                <p>
                  Your website should grow with your business. We stick around
                  to make sure you keep winning. Better speed. Better
                  conversions. Better results.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* WHY US - Three Cards, No Borders */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-black mb-16 text-kaizen-dark dark:text-white text-center">
              Here's what's different.
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
          >
            {/* Card 1 */}
            <motion.div
              className="p-8 md:p-10 rounded-3xl bg-kaizen-light/50 dark:bg-slate-900/50"
              variants={fadeInUp}
            >
              <div className="mb-8">
                <Zap className="w-8 h-8 text-kaizen-cyan" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                We don't guess.
              </h3>
              <p className="text-lg text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                We use data to see exactly what's working and what isn't. That's
                how we know if your site is actually generating leads.
              </p>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              className="p-8 md:p-10 rounded-3xl bg-kaizen-light/50 dark:bg-slate-900/50"
              variants={fadeInUp}
            >
              <div className="mb-8">
                <TrendingUp className="w-8 h-8 text-kaizen-cyan" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                Speed wins.
              </h3>
              <p className="text-lg text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                Fast sites convert. Slow sites lose customers. We make sure your
                site loads instantly so people stay.
              </p>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              className="p-8 md:p-10 rounded-3xl bg-kaizen-light/50 dark:bg-slate-900/50"
              variants={fadeInUp}
            >
              <div className="mb-8">
                <MessageSquare className="w-8 h-8 text-kaizen-cyan" />
              </div>
              <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark dark:text-white">
                No tech-talk.
              </h3>
              <p className="text-lg text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                We speak plain English. We handle the complex stuff so you can
                focus on running your business.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* THE SHIFT - Effort vs Outcome */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-heading font-black mb-8 text-kaizen-dark dark:text-white">
                You don't pay for the hours. You pay for the result.
              </h2>

              <div className="text-xl text-kaizen-dark/70 dark:text-white/70 leading-relaxed space-y-6">
                <p>
                  Old agencies charge by the hour. More hours, more money. We
                  use modern tools—AI, automation—so we can work faster and
                  cheaper, and you get a better site.
                </p>

                <p>
                  Don't pay us for the time we spent typing. Pay us because we
                  took your site from a score of 40 to a score of 98. That's our
                  Speed Scanner. That's proof.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* MODERN ADVANTAGE - The Tech Edge */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-heading font-black mb-8 text-kaizen-dark dark:text-white">
                We're operators. Not coders.
              </h2>

              <p className="text-xl text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                We use AI and modern automation to do work that used to take a
                team of developers. We focus on results. Faster builds. Better
                performance. Lower cost. That's your modern advantage.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-white">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-5xl md:text-6xl font-heading font-black mb-8">
                Ready for something different?
              </h2>

              <motion.button
                onClick={() => navigate("/contact")}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Let's build
                <ArrowRight size={18} />
              </motion.button>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </Layout>
  );
}
