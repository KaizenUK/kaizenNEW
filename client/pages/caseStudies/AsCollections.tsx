import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function AsCollectionsCase() {
  return (
    <Layout>
      <Helmet>
        <title>A.S Collections Case Study | Kaizen Web</title>
        <meta
          name="description"
          content="How we redesigned A.S Collections' website to build trust and authority for a Liverpool debt recovery firm."
        />
      </Helmet>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-blue-600 to-blue-700 dark:from-slate-900 dark:to-slate-950 min-h-screen flex items-center py-20 px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23fff%22 width=%2250%22 height=%2250%22/><rect fill=%22%23fff%22 x=%2250%22 y=%2250%22 width=%2250%22 height=%2250%22/></svg>')]" />
        </div>

        <div className="relative container mx-auto max-w-4xl">
          <Link
            to="/case-studies"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white transition mb-12"
          >
            <ArrowLeft size={18} />
            Back to Case Studies
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-6"
          >
            <span className="inline-block text-blue-200 text-sm font-mono font-bold uppercase tracking-widest">
              Case Study
            </span>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black leading-tight text-white">
              A.S Collections
            </h1>

            <p className="text-xl md:text-2xl text-white/80 leading-relaxed max-w-3xl">
              Transforming a dated website into a high-trust, authoritative
              platform for a leading Liverpool debt recovery firm.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 3-Column Summary Bar */}
      <section className="bg-white dark:bg-slate-950 py-16 px-4 border-b border-kaizen-light dark:border-slate-800">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <h3 className="text-sm font-mono font-bold text-kaizen-cyan uppercase tracking-widest mb-4">
                The Problem
              </h3>
              <p className="text-lg text-kaizen-text-dark dark:text-white/80 leading-relaxed">
                Dated, untrustworthy site that was failing to convert on mobile
                and didn't reflect the firm's authority.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, delay: 0.1 }}
            >
              <h3 className="text-sm font-mono font-bold text-kaizen-cyan uppercase tracking-widest mb-4">
                The Solution
              </h3>
              <p className="text-lg text-kaizen-text-dark dark:text-white/80 leading-relaxed">
                A 100% custom, "no-BS" WordPress redesign focused on
                transparency, clarity, and building instant trust.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, delay: 0.2 }}
            >
              <h3 className="text-sm font-mono font-bold text-kaizen-cyan uppercase tracking-widest mb-4">
                Services Provided
              </h3>
              <p className="text-lg text-kaizen-text-dark dark:text-white/80 leading-relaxed">
                Web Design, Content Strategy, WordPress Development
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* The Story Section */}
      <section className="bg-kaizen-light dark:bg-slate-900/50 py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="space-y-16">
            {/* Challenge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                The Challenge: A Site That Didn't Build Trust
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                A.S Collections is a leader in commercial debt recovery, but
                their old website was letting them down. It was a "boxy,"
                old-fashioned design that performed poorly on mobile. For a
                business built on trust and professionalism, their digital
                presence was a major weak point.
              </p>
            </motion.div>

            {/* Solution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                The Solution: Transparency and Authority
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed mb-8">
                We threw out the old site and started from scratch. We designed
                and built a clean, modern, "no-BS" platform that positions A.S
                Collections as the clear, professional choice. We focused on
                what a potential client <em>actually</em> needs:
              </p>

              <ul className="space-y-4">
                {[
                  {
                    title: "A Crystal-Clear Process",
                    desc: "We mapped out their exact 'Letter Before Action' and 'Legal' process, so clients know exactly what to expect.",
                  },
                  {
                    title: '"No-BS" Transparent Pricing',
                    desc: "We built a clear, public pricing table. This is a massive trust signal in an industry that's often vague.",
                  },
                  {
                    title: "Obvious Trust Signals",
                    desc: "We prominently featured their 'No Win, No Fee' policy, '85%+ Success Rate,' and '115+ 5-Star Reviews.'",
                  },
                  {
                    title: "A Frictionless CTA",
                    desc: "The 'Instruct Us Now' form is simple, clear, and takes 2 minutes to fill out.",
                  },
                ].map((item, index) => (
                  <li key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-kaizen-cyan/20 flex items-center justify-center mt-1">
                      <span className="text-kaizen-cyan text-xs font-bold">
                        ✓
                      </span>
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-kaizen-dark dark:text-white mb-1">
                        {item.title}
                      </h4>
                      <p className="text-kaizen-text-dark/70 dark:text-white/70">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Outcome */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-kaizen-dark dark:text-white">
                The Result: A Digital Front Door That Converts
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 dark:text-white/70 leading-relaxed">
                The new A.S Collections site is now a fast, mobile-first,
                authoritative platform that perfectly matches their professional
                reputation. It's a "no-BS" tool that builds trust and funnels
                new clients directly into their "Instruct Us Now" form.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Internal Links CTA */}
      <section className="bg-white dark:bg-slate-950 py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            className="text-4xl md:text-5xl font-heading font-bold mb-16 text-center text-kaizen-dark dark:text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Need a Similar Result?
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "View Our Web Design Services",
                desc: "Explore our complete web design process and packages.",
                link: "/services/web-design-liverpool",
              },
              {
                title: "Read Our 'No-BS' Pledge",
                desc: "Understand our transparent approach to every project.",
                link: "/pledge",
              },
            ].map((card, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={card.link}
                  className="group block p-8 bg-kaizen-light dark:bg-slate-900/50 rounded-2xl border border-kaizen-light dark:border-slate-800 hover:border-kaizen-cyan dark:hover:border-kaizen-cyan/50 transition h-full"
                >
                  <h3 className="text-2xl font-heading font-bold mb-3 text-kaizen-dark dark:text-white group-hover:text-kaizen-cyan transition">
                    {card.title}
                  </h3>
                  <p className="text-kaizen-text-dark/70 dark:text-white/60 mb-6">
                    {card.desc}
                  </p>
                  <div className="text-kaizen-cyan font-medium flex items-center gap-2 group-hover:gap-3 transition">
                    Learn More
                    <ArrowUpRight
                      size={18}
                      className="group-hover:translate-y-[-2px] group-hover:translate-x-[2px] transition"
                    />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pagination */}
      <section className="bg-kaizen-light dark:bg-slate-900/50 py-16 px-4 border-t border-kaizen-light dark:border-slate-800">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <Link
              to="/case-studies/high-five-games"
              className="group flex items-center gap-3 text-kaizen-dark dark:text-white hover:text-kaizen-cyan transition"
            >
              <span className="group-hover:-translate-x-1 transition">←</span>
              Previous Case Study
            </Link>

            <Link
              to="/case-studies"
              className="text-kaizen-cyan hover:text-kaizen-dark dark:hover:text-white transition text-sm font-medium"
            >
              View All
            </Link>

            <Link
              to="/case-studies/helen-moore-hairdressing"
              className="group flex items-center gap-3 text-kaizen-dark dark:text-white hover:text-kaizen-cyan transition"
            >
              Next Case Study
              <span className="group-hover:translate-x-1 transition">→</span>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
