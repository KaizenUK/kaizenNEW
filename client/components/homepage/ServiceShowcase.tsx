import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, LifeBuoy, MapPin } from 'lucide-react';

/**
 * Enhanced Service Showcase
 * Combines ServicePillars + CoreServiceVerticals
 * Features: Framer Motion, React Spring, GSAP magnetic cursor, Lottie (placeholder)
 */
export const ServiceShowcase: React.FC = () => {
  const pillars = [
    {
      title: 'High-Speed Websites',
      description:
        'Lean React/modern builds that load fast, rank better, and convert more visitors.',
      icon: <Zap className="w-5 h-5" />,
      href: '/services/local-seo',
      accent: 'from-cyan-300/25 to-transparent',
    },
    {
      title: 'Project Rescue',
      description:
        'When a build is late, over budget, or stuck: we stabilise delivery and ship.',
      icon: <LifeBuoy className="w-5 h-5" />,
      href: '/project-rescue',
      accent: 'from-lime-300/25 to-transparent',
    },
    {
      title: 'Google Visibility',
      description:
        'Local intent + technical SEO fundamentals, backed by performance and clean architecture.',
      icon: <MapPin className="w-5 h-5" />,
      href: '/services/local-seo',
      accent: 'from-amber-200/25 to-transparent',
    },
  ];

  return (
    <>
      {/* Service Pillars Section */}
      <section className="py-20 md:py-28 bg-gray-950 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0_0,rgba(56,189,248,0.14),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(34,197,94,0.12),transparent_60%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            className="max-w-3xl mx-auto text-center mb-12"
          >
            <p className="text-xs font-mono tracking-[0.25em] text-cyan-300 uppercase mb-4">
              What We Actually Do
            </p>
            <h2 className="text-3xl md:text-4xl font-heading font-black mb-4">
              Speed, control, and visibility.
            </h2>
            <p className="text-white/75 text-lg">
              Three pillars that keep your site fast, profitable, and
              independent.
            </p>
          </motion.div>

          {/* Pillars Grid with Magnetic Effect */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pillars.map((pill, index) => (
                <motion.div
                  key={pill.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: index * 0.08 }}
                  className="h-full"
                >
                  <Link
                    to={pill.href}
                    className="group block h-full glass-card rounded-3xl p-7 flex flex-col"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <motion.span
                        className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/10 text-cyan-200"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        {pill.icon}
                      </motion.span>
                      <h3 className="text-xl font-heading font-bold">
                        {pill.title}
                      </h3>
                    </div>
                    <p className="text-white/75 leading-relaxed flex-1">
                      {pill.description}
                    </p>
                    <div className="mt-6 inline-flex items-center gap-2 text-cyan-200 font-heading font-semibold group-hover:gap-3 transition-all">
                      Learn more
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      >
                        <ArrowRight size={18} />
                      </motion.div>
                    </div>
                  </Link>
                </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Service Verticals Section */}
      <section className="py-20 md:py-28 bg-slate-950 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.18),transparent_55%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            className="max-w-4xl mx-auto text-center mb-14"
          >
            <p className="text-xs font-mono tracking-[0.25em] text-cyan-300 mb-4 uppercase">
              What We Do
            </p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">
              Two key ways we help Wirral businesses
            </h2>
            <p className="text-sm md:text-base text-slate-300 max-w-2xl mx-auto">
              High-performance websites for Wirral businesses, and technical
              consulting for companies with failing software projects.
            </p>
          </motion.div>

          {/* Service Cards with Spring Animations */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-stretch"
          >
            {/* Wirral Web Design Card */}
            <ServiceCard
              color="cyan"
              label="Vertical One"
              title="Wirral Web Design"
              description="High-performance web design for SMEs that want speed and conversions. We build lean sites that turn search traffic into leads and keep improving over time."
              features={[
                'Local-first SEO built around real search intent',
                'Performance-led builds (Core Web Vitals in mind)',
                'Clear pricing for brochure, ecommerce & web apps',
              ]}
              ctaText="Get a Performance Audit"
              ctaHref="/contact"
            />

            {/* Project Rescue Card */}
            <ServiceCard
              color="lime"
              label="Vertical Two"
              title="Project Rescue & Consulting"
              description="When your software project is late, over budget, or spiralling out of control: we stabilise delivery, fix the architecture, and ship. Technical rescue for failing projects."
              features={[
                'Rapid triage and project stabilisation',
                'Architect-level delivery expertise',
                'Honest timelines and clear accountability',
              ]}
              ctaText="Start a Rescue Chat"
              ctaHref="/project-rescue"
            />
          </motion.div>
        </div>
      </section>
    </>
  );
};

/**
 * Individual Service Card with Spring Animations
 */
interface ServiceCardProps {
  color: 'cyan' | 'lime';
  label: string;
  title: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  color,
  label,
  title,
  description,
  features,
  ctaText,
  ctaHref,
}) => {
  const borderColor = color === 'cyan' ? 'cyan-400/40' : 'lime-400/40';
  const accentColor = color === 'cyan' ? 'cyan-400' : 'lime-400';
  const textColor = color === 'cyan' ? 'cyan-300' : 'lime-300';

  return (
    <motion.div
      initial={{ opacity: 0, x: color === 'cyan' ? -24 : 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 140, damping: 18 }}
      className={`relative rounded-3xl border border-${borderColor} bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden shadow-[0_24px_70px_rgba(8,47,73,0.9)]`}
    >
      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 bg-[radial-gradient(circle_at_10%_0,rgba(56,189,248,0.3),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(45,212,191,0.3),transparent_55%)]`}
      />

      <div className="relative p-8 md:p-10 flex flex-col h-full">
        <p className={`text-xs font-mono tracking-[0.25em] text-${textColor} mb-4 uppercase`}>
          {label}
        </p>
        <h3 className="text-3xl md:text-4xl font-heading font-bold mb-4">
          {title}
        </h3>
        <p className="text-sm md:text-base text-slate-200 mb-6 max-w-md">
          {description}
        </p>

        {/* Features List */}
        <ul className="space-y-2 text-sm md:text-base text-slate-200/90 mb-8">
          {features.map((feature, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-2"
            >
              <span className={`h-1.5 w-6 rounded-full bg-${accentColor}`} />
              {feature}
            </motion.li>
          ))}
        </ul>

        {/* CTA Button */}
        <div className="mt-auto">
          <Link
            to={ctaHref}
            className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${
              color === 'cyan'
                ? 'from-cyan-300 to-cyan-200'
                : 'from-lime-300 to-lime-200'
            } text-slate-950 px-5 py-2.5 text-sm font-heading font-semibold shadow-lg hover:shadow-${accentColor}/60 hover:-translate-y-0.5 transition-all`}
          >
            {ctaText}
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};
