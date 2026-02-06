import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
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
  return (
    <Layout>
      {/* HERO - The Hook */}
      <section className="min-h-screen bg-white dark:bg-slate-950 flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <p className="text-sm font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-6">
                  A Different Kind of Agency
                </p>
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-heading font-black mb-8 leading-tight text-kaizen-dark dark:text-white">
                  We were built by accident.
                </h1>
                <p className="text-xl md:text-2xl text-kaizen-dark/70 dark:text-white/70 leading-relaxed mb-8">
                  A decade of chaos in global tech. Three redundancies in two years. A decision to stop running from burnout and start building something real.
                </p>
              </motion.div>

              <motion.button
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    (window as any).$crisp
                  ) {
                    (window as any).$crisp.push(["do", "chat:open"]);
                  }
                }}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Let's chat
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

      {/* THE REAL STORY - Full Width Narrative */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto">
              <h2 className="text-5xl md:text-6xl font-heading font-black mb-12 text-kaizen-dark dark:text-white leading-tight">
                The bit about me.
              </h2>

              <div className="space-y-8 text-lg text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                <p>
                  I'm Sean, and honestly, I'm not what you'd expect from an "agency owner". For over a decade, I lived in the high-octane world of global tech—iGaming, FinTech, massive platforms handling millions of transactions. I worked in Canada, Ireland, Malta, Spain, Bulgaria, Romania. Managed teams. Shipped things that mattered. And got made redundant three times in two years because that's the nature of that world.
                </p>

                <p>
                  That level of instability breaks something in you. You stop investing in anything. You become disposable. And you realise that despite all the scale and prestige, you're actually quite replaceable in a system designed to burn people out.
                </p>

                <p>
                  So I came home to Wirral. Met Kiko (my husband). Got a dog. And started asking a different question: what if I built something for businesses who needed stability, not chaos? Something built by someone who'd worked at scale but actually cared about the work?
                </p>

                <p>
                  That's Kaizen. The name comes from the Japanese concept of continuous improvement—but that's not corporate jargon when you've actually lived it. It means we're never done learning. Never happy with "good enough". Always looking for the smarter way.
                </p>

                <p>
                  It also means we embrace AI. Not as some trendy thing, but because it's how serious teams operate now. We use AI to do the grunt work a room full of developers would've done, then put a senior person (me) in charge so the decisions stay human. Cheaper. Faster. Better. That's Kaizen.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* HOW WE WORK - Three Principles, No Boxes */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-5xl md:text-6xl font-heading font-black mb-20 text-kaizen-dark dark:text-white text-center">
              Three things we actually believe.
            </h2>
          </ScrollReveal>

          <div className="max-w-5xl mx-auto space-y-24">
            {/* Principle 1 */}
            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <div>
                <h3 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                  Get better at everything.
                </h3>
                <p className="text-xl text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                  Kaizen—continuous improvement—isn't a buzzword. It's how we operate. There's always a smarter way. Always a detail we missed. We're obsessed with finding it. We'll spend an evening perfecting something most people won't even notice, because that's what separates good from exceptional.
                </p>
              </div>
              <div className="h-80 rounded-2xl bg-gradient-to-br from-kaizen-cyan/10 to-kaizen-lime/10 dark:from-kaizen-cyan/5 dark:to-kaizen-lime/5 border border-kaizen-cyan/20 dark:border-kaizen-cyan/10" />
            </motion.div>

            {/* Principle 2 */}
            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <div className="h-80 rounded-2xl bg-gradient-to-br from-kaizen-lime/10 to-kaizen-cyan/10 dark:from-kaizen-lime/5 dark:to-kaizen-cyan/5 border border-kaizen-lime/20 dark:border-kaizen-lime/10 lg:order-2" />
              <div className="lg:order-1">
                <h3 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                  No chaotic projects.
                </h3>
                <p className="text-xl text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                  I spent a decade managing teams through email threads at 2am, miscommunications, and vague timelines. You don't have to live like that. We run tight projects with staging, QA, rollbacks, and a single point of contact who actually knows your business. That's not luxury—that's just how it should be.
                </p>
              </div>
            </motion.div>

            {/* Principle 3 */}
            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <div>
                <h3 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                  Train people so they can leave.
                </h3>
                <p className="text-xl text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                  We don't lock you in. We hand over control. Your team will understand the platform, the process, and the reasoning. You'll never be dependent on us. That's harder than keeping people locked in—but it's the right way.
                </p>
              </div>
              <div className="h-80 rounded-2xl bg-gradient-to-br from-kaizen-cyan/10 to-kaizen-lime/10 dark:from-kaizen-cyan/5 dark:to-kaizen-lime/5 border border-kaizen-cyan/20 dark:border-kaizen-cyan/10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* WHO WE ARE - Simple Statement */}
      <section className="py-20 md:py-32 bg-kaizen-light dark:bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-5xl md:text-6xl font-heading font-black mb-8 text-kaizen-dark dark:text-white leading-tight">
                When we're not building websites
              </h2>

              <p className="text-xl text-kaizen-dark/70 dark:text-white/70 leading-relaxed mb-8">
                you'll find us gaming on the PS5, producing music, or being pulled around the Wirral by Rikki—our 5-year-old Border Collie who has absolutely no chill. We're local. We're here to stay. And we actually care about the work.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* WHAT WE'VE LEARNED - Two Big Insights */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-5xl md:text-6xl font-heading font-black mb-20 text-kaizen-dark dark:text-white text-center">
              The things we've figured out.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Insight 1 */}
            <motion.div
              className="lg:pt-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <h3 className="text-2xl md:text-3xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Expert focus beats cheap labour.
              </h3>
              <p className="text-lg text-kaizen-dark/70 dark:text-white/70 leading-relaxed mb-8">
                When you work with Kaizen, you're not handed off to a junior account manager waiting for their big break. You work with me. A Senior Product Owner who's managed £150m platforms. I bring that same obsessive detail to your project—whether it's £15k or £150k.
              </p>
              <p className="text-lg text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                We're small. We take on fewer projects. That's intentional. It means we actually care.
              </p>
            </motion.div>

            {/* Insight 2 */}
            <motion.div
              className="lg:pt-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-2xl md:text-3xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                Your website is an asset, not rent.
              </h3>
              <p className="text-lg text-kaizen-dark/70 dark:text-white/70 leading-relaxed mb-8">
                If your whole presence lives on Facebook or Instagram, you're renting attention. Algorithms change. Reach disappears. A fast, reliable website is something you own. It captures leads. Builds trust. Works regardless of what social media decides.
              </p>
              <p className="text-lg text-kaizen-dark/70 dark:text-white/70 leading-relaxed">
                That's not a nice-to-have. That's fundamental.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FINAL CTA - Bold */}
      <section className="py-20 md:py-32 bg-kaizen-dark dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 text-white">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black mb-8 leading-tight">
                Let's talk.
              </h2>
              <p className="text-xl md:text-2xl text-white/80 mb-12 leading-relaxed">
                You know our story. We'd love to hear yours.
              </p>

              <motion.button
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    (window as any).$crisp
                  ) {
                    (window as any).$crisp.push(["do", "chat:open"]);
                  }
                }}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:shadow-lg hover:shadow-kaizen-cyan/50 transition inline-flex items-center justify-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start a conversation
                <ArrowRight size={18} />
              </motion.button>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </Layout>
  );
}
