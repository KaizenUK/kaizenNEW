import Layout from "@/components/Layout";
import { motion } from "framer-motion";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function PrivacyPolicy() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-kaizen-dark via-slate-900 to-kaizen-dark text-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-5xl md:text-6xl font-heading font-bold mb-6">
              Privacy Policy
            </h1>
            <p className="text-xl text-white/70">
              We're required to have this. You have a right to know what's
              happening with your data. Here's the simple, "no-jargon" version.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content Section */}
      <section className="bg-white py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-12">
            {/* Core Philosophy */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-kaizen-dark">
                Our Core Philosophy
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 leading-relaxed">
                Our business is built on trust. We have no interest in selling
                your data or sending you spam. This policy explains what little
                data we do collect and why we need it to run our business.
              </p>
            </motion.div>

            {/* What Data We Collect */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-kaizen-dark">
                What Data We Collect & Why
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-heading font-bold mb-3 text-kaizen-dark">
                    Data You Give Us Directly
                  </h3>
                  <p className="text-lg text-kaizen-text-dark/70 leading-relaxed">
                    When you use our live chat, you may provide your name or
                    email. When you book a call via Calendly, you provide your
                    name, email, and any other info you put in the form. We use
                    this data <span className="italic">only</span> to
                    communicate with you for that specific conversation or
                    meeting.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-heading font-bold mb-3 text-kaizen-dark">
                    Data We Collect Automatically
                  </h3>
                  <p className="text-lg text-kaizen-text-dark/70 mb-4 leading-relaxed">
                    Like most websites, we use a few tools that collect
                    non-personal data. This includes:
                  </p>

                  <div className="space-y-3 ml-4">
                    <div>
                      <h4 className="font-heading font-bold text-kaizen-dark mb-1">
                        Essential Cookies
                      </h4>
                      <p className="text-kaizen-text-dark/70 leading-relaxed">
                        Our platform (Builder.io) and tools (Calendly, our chat
                        widget) use cookies to function. For example, a cookie
                        is used to remember your chat history or to make the
                        booking process work.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-heading font-bold text-kaizen-dark mb-1">
                        Analytics Cookies
                      </h4>
                      <p className="text-kaizen-text-dark/70 leading-relaxed">
                        We use a standard analytics tool (like Google Analytics)
                        to see how visitors use our site (e.g., what pages are
                        popular). This data is anonymised and helps us improve
                        the site (that's the 'Kaizen' part).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* What We Will Never Do */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-kaizen-dark">
                What We Will <span className="italic">Never</span> Do
              </h2>

              <ul className="space-y-3">
                <li className="flex gap-4 text-lg text-kaizen-text-dark/70 leading-relaxed">
                  <span className="text-kaizen-cyan font-bold flex-shrink-0">
                    •
                  </span>
                  <span>
                    We will <span className="font-bold">never</span> sell your
                    data to any third party.
                  </span>
                </li>
                <li className="flex gap-4 text-lg text-kaizen-text-dark/70 leading-relaxed">
                  <span className="text-kaizen-cyan font-bold flex-shrink-0">
                    •
                  </span>
                  <span>
                    We will <span className="font-bold">never</span> send you
                    marketing spam you didn't ask for.
                  </span>
                </li>
              </ul>
            </motion.div>

            {/* Your Rights (GDPR) */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-kaizen-dark">
                Your Rights (GDPR)
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 leading-relaxed mb-4">
                You are in control. You have the right to request to see the
                data we hold about you, and the right to request that we delete
                it. If you want to do either, just ask us on the live chat or
                email us at{" "}
                <span className="font-bold">privacy@kaizenweb.co.uk</span>.
                We'll sort it out immediately.
              </p>
            </motion.div>

            {/* Cookie Policy Link */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="border-t border-kaizen-text-dark/10 pt-8"
            >
              <p className="text-lg text-kaizen-text-dark/70">
                For more details about the cookies we use, please see our{" "}
                <a
                  href="/cookie-policy"
                  className="text-kaizen-cyan hover:underline font-bold"
                >
                  Cookie Policy
                </a>
                .
              </p>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
