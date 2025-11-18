import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Users, TrendingUp } from "lucide-react";
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
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
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

export default function CityCentre() {
  const { openCalendly } = useCalendly();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-black text-white flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            <motion.h1
              className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Web Design for Liverpool City Centre.
            </motion.h1>

            <motion.div
              className="space-y-6 mb-12 text-xl text-white/70 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <p>
                Your business is in the Baltic Triangle neighbourhood—where culture and commerce collide. We're neighbours too. We understand your market, your competition, and what it takes to stand out in Liverpool City Centre.
              </p>
              <p>
                Whether you're a boutique agency, independent retailer, creative studio, or professional service, we build websites that bring foot traffic online and turn browsers into customers.
              </p>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <button
                onClick={() => openCalendly()}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-gray-950 font-heading font-bold inline-flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-kaizen-cyan/50 transition"
              >
                Book a 30-Min Discovery Call
                <ArrowRight size={18} />
              </button>
              <Link
                to="/contact"
                className="px-8 py-3 rounded-lg border-2 border-kaizen-cyan text-kaizen-cyan font-heading font-bold hover:bg-kaizen-cyan/10 transition inline-flex items-center justify-center gap-2"
              >
                Send Us a Message
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why City Centre Businesses Choose Us */}
      <section className="py-20 md:py-32 bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-white">
                Made for City Centre Commerce
              </h2>
              <p className="text-xl text-white/60 max-w-2xl mx-auto">
                A website isn't enough. You need a digital storefront that converts local traffic into customers.
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
                icon: MapPin,
                title: "Local-First Design",
                copy: "We showcase your location, parking, opening hours, and accessibility. We make it easy for nearby customers to find you.",
              },
              {
                icon: Users,
                title: "Foot Traffic to Online",
                copy: "Your site is designed to convert walk-ins into online customers and locals into loyalty. Every page is conversion-focused.",
              },
              {
                icon: TrendingUp,
                title: "City Centre SEO",
                copy: "We optimize for 'near me' searches and Liverpool postcodes. You'll rank for people looking for your type of business right now.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-slate-900/50 rounded-2xl border border-slate-800/50 hover:border-kaizen-cyan/50 transition"
              >
                <div className="mb-6 p-4 w-16 h-16 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 rounded-xl flex items-center justify-center">
                  <item.icon className="text-kaizen-cyan" size={32} />
                </div>
                <h3 className="text-2xl font-heading font-bold mb-4 text-white">
                  {item.title}
                </h3>
                <p className="text-lg text-white/60 leading-relaxed">
                  {item.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Who We Help */}
      <section className="py-20 md:py-32 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-white text-center">
              We Work With City Centre Businesses Like Yours
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
                title: "Independent Retailers",
                copy: "Fashion boutiques, bookshops, vintage stores. We help you tell your story and show why locals should choose you over the high street chains.",
              },
              {
                title: "Hospitality & Bars",
                copy: "Restaurants, cafés, and venues. Showcase your vibe, menu, events, and reservations seamlessly.",
              },
              {
                title: "Creative Agencies & Studios",
                copy: "Design, photography, music, art. A portfolio that drives leads and showcases your best work.",
              },
              {
                title: "Professional Services",
                copy: "Law, accounting, consulting. Build authority, trust, and showcase case studies. Get serious enquiries from serious clients.",
              },
              {
                title: "Wellness & Fitness",
                copy: "Gyms, salons, therapy. Appointment booking, membership info, class schedules—all in one place.",
              },
              {
                title: "Property & Real Estate",
                copy: "Showcase properties with virtual tours, high-res photography, and clear calls to action.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-kaizen-cyan/30 transition"
              >
                <h3 className="text-xl font-heading font-bold mb-3 text-white">
                  {item.title}
                </h3>
                <p className="text-white/60 leading-relaxed">
                  {item.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* The Process */}
      <section className="py-20 md:py-32 bg-slate-950">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-white text-center">
              Our Fast, Transparent Process
            </h2>
          </ScrollReveal>

          <div className="max-w-3xl mx-auto">
            {[
              {
                step: "01",
                title: "Discover Your Market",
                copy: "We meet (virtually or in person) to understand your business, your competitors, and your target customer.",
              },
              {
                step: "02",
                title: "Design Your Conversion Path",
                copy: "We design a site that guides local visitors to action—whether that's booking, buying, or calling.",
              },
              {
                step: "03",
                title: "Build & Optimize for Local SEO",
                copy: "We build fast, modern code and set you up for local search success. You'll rank for 'near me' searches.",
              },
              {
                step: "04",
                title: "Launch & Support",
                copy: "We go live, then provide ongoing support and analytics. Your site is a living tool, not a set-and-forget project.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: index * 0.1 }}
                className="mb-12 last:mb-0 flex gap-8"
              >
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-kaizen-cyan to-kaizen-lime flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-950 font-heading font-bold text-2xl">
                      {item.step}
                    </span>
                  </div>
                  {index < 3 && (
                    <div className="w-1 h-20 bg-gradient-to-b from-kaizen-cyan to-kaizen-lime mt-4"></div>
                  )}
                </div>
                <div className="pt-4 pb-4">
                  <h3 className="text-2xl font-heading font-bold mb-3 text-white">
                    {item.title}
                  </h3>
                  <p className="text-lg text-white/60 leading-relaxed max-w-xl">
                    {item.copy}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-to-r from-kaizen-cyan/20 via-kaizen-lime/10 to-kaizen-cyan/20">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-white">
              Ready to Get Serious About Your Online Presence?
            </h2>
            <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto">
              We've helped dozens of Liverpool City Centre businesses turn their websites into real revenue drivers. Let's talk about what's possible for your business.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button
                onClick={() => openCalendly()}
                className="px-8 py-3 rounded-lg bg-white text-gray-950 font-heading font-bold inline-flex items-center justify-center gap-2 hover:shadow-lg transition"
              >
                Book a Call
                <ArrowRight size={18} />
              </button>
              <Link
                to="/blog"
                className="px-8 py-3 rounded-lg border-2 border-white text-white font-heading font-bold hover:bg-white/10 transition inline-flex items-center justify-center gap-2"
              >
                Read Our Insights
                <ArrowRight size={18} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
