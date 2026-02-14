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

export default function CookiePolicy() {
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
              Cookie Policy
            </h1>
            <p className="text-xl text-white/70">
              A simple, clear list of the cookies this site uses and why.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content Section */}
      <section className="bg-white py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-12">
            {/* What is a Cookie */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-kaizen-dark">
                What is a Cookie?
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 leading-relaxed">
                A cookie is a tiny text file stored on your browser. It helps a
                website remember you. We use them to make the site work, not to
                track you personally across the internet.
              </p>
            </motion.div>

            {/* The Cookies We Use */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-kaizen-dark">
                The Cookies We Use
              </h2>

              <div className="space-y-6">
                <div className="p-6 bg-kaizen-light border border-kaizen-light rounded-lg">
                  <h3 className="text-xl font-heading font-bold mb-3 text-kaizen-dark">
                    Strictly Necessary Cookies
                  </h3>
                  <p className="text-kaizen-text-dark/70 leading-relaxed">
                    These are essential for the site to function. They are used
                    by our platform (Builder.io) to serve pages, and to remember
                    your cookie consent choice. You cannot turn these off.
                  </p>
                </div>

                <div className="p-6 bg-kaizen-light border border-kaizen-light rounded-lg">
                  <h3 className="text-xl font-heading font-bold mb-3 text-kaizen-dark">
                    Functional Cookies
                  </h3>
                  <p className="text-kaizen-text-dark/70 mb-3 leading-relaxed">
                    These cookies make your experience better. For example, our{" "}
                    <span className="font-bold">Chat Widget</span> uses a cookie
                    to remember your conversation, and{" "}
                    <span className="font-bold">Calendly</span> uses cookies to
                    make the booking process work.
                  </p>
                </div>

                <div className="p-6 bg-kaizen-light border border-kaizen-light rounded-lg">
                  <h3 className="text-xl font-heading font-bold mb-3 text-kaizen-dark">
                    Analytics Cookies
                  </h3>
                  <p className="text-kaizen-text-dark/70 leading-relaxed">
                    We use an analytics tool to understand how visitors use our
                    site (like which pages are most popular). This data is
                    anonymous and helps us improve our website. These will{" "}
                    <span className="italic">only</span> run if you accept them.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* How to Manage Your Consent */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6 text-kaizen-dark">
                How to Manage Your Consent
              </h2>
              <p className="text-lg text-kaizen-text-dark/70 leading-relaxed">
                You can change your cookie preferences at any time by clicking
                the "Manage Cookies" link, which will always be visible at the
                bottom of our site. You can also block or delete cookies at any
                time by changing your browser settings.
              </p>
            </motion.div>

            {/* Privacy Policy Link */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="border-t border-kaizen-text-dark/10 pt-8"
            >
              <p className="text-lg text-kaizen-text-dark/70">
                For more information about how we use your data, please see our{" "}
                <a
                  href="/privacy-policy"
                  className="text-kaizen-cyan hover:underline font-bold"
                >
                  Privacy Policy
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
