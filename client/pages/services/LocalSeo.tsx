import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, MapPin, FileText, Star } from "lucide-react";
import { useCalendly } from "@/context/CalendlyContext";

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

const letterVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Animated H1 component with staggered letter reveal
const AnimatedH1 = ({ text }: { text: string }) => {
  return (
    <motion.h1
      className="text-5xl md:text-6xl lg:text-6xl font-heading font-bold mb-8 leading-tight"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {text.split(" ").map((word, wordIndex) => (
        <motion.span key={wordIndex} className="inline-block mr-4">
          {word.split("").map((char, charIndex) => (
            <motion.span
              key={charIndex}
              variants={letterVariants}
              initial="hidden"
              animate="visible"
              transition={{
                delay: (wordIndex * word.length + charIndex) * 0.05,
                duration: 0.4,
              }}
            >
              {char}
            </motion.span>
          ))}
        </motion.span>
      ))}
    </motion.h1>
  );
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
  openContact = false,
  openCalendly: openCalendlyProp = false,
}: {
  text: string;
  onClick?: () => void;
  secondary?: boolean;
  openContact?: boolean;
  openCalendly?: boolean;
}) => {
  const { openCalendly } = useCalendly();
  const navigate = useNavigate();

  const handleClick = () => {
    if (openCalendlyProp) {
      openCalendly();
    } else if (openContact) {
      navigate("/contact");
    }
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`px-8 py-3 rounded-full font-heading font-bold inline-flex items-center justify-center gap-2 transition ${
        secondary
          ? "border-2 border-kaizen-cyan text-kaizen-cyan hover:bg-kaizen-cyan/10"
          : "bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark hover:opacity-90"
      }`}
    >
      {text}
      <ArrowRight size={18} />
    </button>
  );
};

export default function LocalSeo() {
  const { openCalendly: openCalendlyFromContext } = useCalendly();

  return (
    <Layout>
      {/* Section 1: Hero */}
      <section className="min-h-screen bg-kaizen-dark text-kaizen-text-light flex items-center py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl">
              <AnimatedH1 text="Fast Websites for Liverpool Businesses" />

              <motion.div
                className="space-y-6 mb-12 text-xl text-kaizen-text-light/80 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                <p>
                  SEO isn't everything. If your website is slow, confusing, or
                  hard to use, it doesn't matter how well it ranks. People will
                  just click back to your competitor.
                </p>
                <p>
                  We build fast, professional websites first—then we make sure
                  they show up on Google. Speed + rankings = more customers.
                </p>
              </motion.div>

              <motion.div
                className="flex flex-col sm:flex-row gap-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                <CTAButton text="Get in Touch" openContact />
                <Link
                  to="/contact"
                  className="px-8 py-3 rounded-full border-2 border-kaizen-text-light/30 text-kaizen-text-light font-heading font-bold hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
                >
                  Get a Free Local Audit
                  <ArrowUpRight size={18} />
                </Link>
              </motion.div>
            </div>

            {/* Google Search Hero Image on the right */}
            <motion.div
              className="hidden md:flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              <div className="w-full h-96 rounded-2xl border border-kaizen-cyan/30 overflow-hidden">
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F2bcd66303b6e425ab616ce3ad62975b8?format=webp&width=800"
                  alt="Google search results for local business"
                  width="800"
                  height="600"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2: The "Why" */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-12 text-kaizen-dark">
              Why Speed Matters More Than SEO
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl">
            <ScrollReveal delay={1}>
              <div className="space-y-6">
                <p className="text-xl text-kaizen-text-dark/70 leading-relaxed">
                  Most local SEO packages fail because they try to fix rankings
                  without fixing the website. Google rewards sites that are
                  fast, clear, and actually helpful. That's where most
                  template-based sites fall down.
                </p>
                <p className="text-xl text-kaizen-text-dark/70 leading-relaxed">
                  We build sites people want to use—then we make sure Google can
                  find them. Fast sites that get you found and keep customers on
                  the page.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={2}>
              <div className="space-y-6 p-8 bg-kaizen-light rounded-2xl border border-kaizen-light">
                <div>
                  <h3 className="text-sm font-bold text-kaizen-cyan uppercase tracking-wide mb-3">
                    Why fast sites rank better
                  </h3>
                  <ul className="space-y-3 text-lg text-kaizen-text-dark/70">
                    <li>
                      <strong>Built for speed:</strong> No bloated plugins or
                      mystery code slowing you down.
                    </li>
                    <li>
                      <strong>Clean and clear:</strong> Easy for Google to read
                      and understand what you do.
                    </li>
                    <li>
                      <strong>Reliable:</strong> No random crashes or slow days
                      that cost you customers.
                    </li>
                    <li>
                      <strong>More conversions:</strong> Fast sites keep people
                      on the page, which means more enquiries.
                    </li>
                  </ul>
                </div>
                <div className="border-t border-kaizen-light pt-6">
                  <h3 className="text-sm font-bold text-kaizen-cyan uppercase tracking-wide mb-3">
                    What you get
                  </h3>
                  <p className="text-lg text-kaizen-text-dark/70">
                    A site that loads fast and works properly—then we optimise
                    your Google Business Profile to get you into the Map Pack.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Section 3: What We Do */}
      <section className="py-20 md:py-32 bg-kaizen-light">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark text-center">
              Get Found on Google
            </h2>
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
                title: "Google Business Profile",
                copy: 'We set up your profile properly so you show up in the top 3 results when people search for "near me" or "in Liverpool".',
              },
              {
                icon: FileText,
                title: "Location Pages",
                copy: 'We create pages for specific areas like Wirral, South Liverpool, or City Centre—so you can be found wherever your customers are searching.',
              },
              {
                icon: Star,
                title: "Reviews & Trust",
                copy: "We help you gather more 5-star reviews and clean up your online listings, so Google knows you're the real deal.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="p-8 bg-white rounded-2xl border border-kaizen-light hover:border-kaizen-cyan transition"
              >
                <div className="mb-6 p-4 w-16 h-16 bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 rounded-xl flex items-center justify-center">
                  <item.icon
                    className="text-kaizen-cyan"
                    size={32}
                  />
                </div>
                <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark">
                  {item.title}
                </h3>
                <p className="text-lg text-kaizen-text-dark/70 leading-relaxed">
                  {item.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 4: Real Proof */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-12 text-kaizen-dark text-center">
              Real Results: From Invisible to Fully Booked
            </h2>
          </ScrollReveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto items-center"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-kaizen-cyan uppercase tracking-wide mb-3">
                  Client: Helen Moore Hairdressing
                </h3>
                <p className="text-xs font-medium text-kaizen-text-dark/60 uppercase tracking-wide mb-6">
                  Boutique Salon – Wallasey Village, Wirral
                </p>
              </div>

              <div>
                <h4 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark">
                  The Problem
                </h4>
                <p className="text-lg text-kaizen-text-dark/70 leading-relaxed">
                  A top-rated salon with a loyal local following, but completely
                  invisible online. No website, no Google presence. Relying
                  entirely on phone calls and word-of-mouth.
                </p>
              </div>

              <div>
                <h4 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark">
                  The Fix
                </h4>
                <p className="text-lg text-kaizen-text-dark/70 leading-relaxed">
                  We built a local-first website and optimised her Google
                  Business Profile for terms like "Hairdresser Wallasey" and
                  "Salon Wirral".
                </p>
              </div>

              <div>
                <h4 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark">
                  The Result
                </h4>
                <p className="text-lg text-kaizen-text-dark/70 leading-relaxed mb-6">
                  She now ranks <strong>#1</strong> for her key local terms and
                  fills her calendar via online bookings from new local clients.
                </p>
                <a
                  href="https://helenmoorehairdressing.co.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-kaizen-cyan font-medium flex items-center gap-2 hover:gap-3 transition"
                >
                  View Live Site
                  <ArrowUpRight size={16} />
                </a>
              </div>
            </div>

            <div className="bg-gradient-to-br from-kaizen-cyan/20 to-kaizen-lime/20 rounded-2xl border border-kaizen-cyan/30 p-8 h-96 flex items-center justify-center">
              <div className="text-center">
                <Star size={64} className="text-kaizen-cyan/40 mb-4 mx-auto" />
                <p className="text-kaizen-text-dark/60 font-heading font-bold text-xl">
                  #1 Local Rankings
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Section 5: Our Process */}
      <section className="py-20 md:py-32 bg-kaizen-dark text-kaizen-text-light">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-text-light text-center">
              How We Improve Your Rankings
            </h2>
          </ScrollReveal>

          <div className="max-w-3xl mx-auto">
            {[
              {
                step: "01",
                title: "Audit",
                copy: "We review your current presence. Are your address details consistent? Is your Google Profile verified? Who is outranking you and why?",
              },
              {
                step: "02",
                title: "Optimise",
                copy: "We fix the technical errors. We update your categories, write local-focused descriptions, and ensure your name, address, and phone number (NAP) match everywhere.",
              },
              {
                step: "03",
                title: "Content & Authority",
                copy: "We create content that signals to Google that you are the local authority in your field, helping you rank for a wider range of keywords.",
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
                    <span className="text-kaizen-dark font-heading font-bold text-2xl">
                      {item.step}
                    </span>
                  </div>
                  {index < 2 && (
                    <div className="w-1 h-20 bg-gradient-to-b from-kaizen-cyan to-kaizen-lime mt-4"></div>
                  )}
                </div>
                <div className="pt-4 pb-4">
                  <h3 className="text-2xl font-heading font-bold mb-3 text-kaizen-text-light">
                    {item.title}
                  </h3>
                  <p className="text-lg text-kaizen-text-light/80 leading-relaxed max-w-xl">
                    {item.copy}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6: Internal Links */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-16 text-kaizen-dark text-center">
              More Than Just SEO
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
                title: "Web Design",
                copy: "Traffic is useless if your site is slow. See how we build fast websites that turn visitors into customers.",
                link: "/web-design-liverpool",
              },
              {
                title: "Agile Coaching",
                copy: "We use an organised process to get results faster. We can also help your team work more efficiently.",
                link: "/agile-coaching",
              },
            ].map((card, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Link
                  to={card.link}
                  className="p-8 bg-kaizen-light rounded-2xl border border-kaizen-light hover:border-kaizen-cyan transition group block h-full"
                >
                  <h3 className="text-2xl font-heading font-bold mb-4 text-kaizen-dark group-hover:text-kaizen-cyan transition">
                    {card.title}
                  </h3>
                  <p className="text-lg text-kaizen-text-dark/70 leading-relaxed mb-6">
                    {card.copy}
                  </p>
                  <div className="text-kaizen-cyan font-medium flex items-center gap-2 hover:gap-3 transition">
                    Explore <ArrowUpRight size={16} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 7: Final CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark text-kaizen-text-light">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-8 text-kaizen-text-light">
              Stop Being Invisible in Liverpool.
            </h2>
            <p className="text-xl text-kaizen-text-light/80 mb-12 max-w-2xl mx-auto leading-relaxed">
              Let's get your business on the map. Chat with us now or book a
              call.
            </p>
          </ScrollReveal>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <CTAButton text="Get in Touch" openContact />
            <button
              onClick={openCalendlyFromContext}
              className="px-8 py-3 rounded-full border-2 border-kaizen-text-light/30 text-kaizen-text-light font-heading font-bold hover:border-kaizen-cyan transition inline-flex items-center justify-center gap-2"
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
