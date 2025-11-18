import { Link, useLocation } from "react-router-dom";
import { Linkedin, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";

interface FooterProps {
  theme: "light" | "dark";
}

// Helper function to get the next quarter
const getNextQuarter = (): string => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();

  // Add 3 months
  let targetMonth = currentMonth + 3;
  let targetYear = currentYear;

  if (targetMonth > 11) {
    targetMonth -= 12;
    targetYear += 1;
  }

  // Determine quarter
  let quarter: number;
  if (targetMonth < 3) {
    quarter = 1;
  } else if (targetMonth < 6) {
    quarter = 2;
  } else if (targetMonth < 9) {
    quarter = 3;
  } else {
    quarter = 4;
  }

  return `Q${quarter} ${targetYear}`;
};

const Footer: React.FC<FooterProps> = ({ theme }) => {
  const location = useLocation();
  const { openCalendly } = useCalendly();
  const [liverpooolTime, setLiverpooolTime] = useState("");
  const [nextQuarter, setNextQuarter] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const ukTime = now.toLocaleTimeString("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
      });
      setLiverpooolTime(ukTime);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setNextQuarter(getNextQuarter());
  }, []);

  // Determine dynamic CTA based on route
  const getDynamicCTA = () => {
    const path = location.pathname.toLowerCase();

    if (path.includes("web-design")) {
      return {
        heading: "Ready to build your high-performance site?",
        buttonText: "Start your Web Build",
        onClick: openCalendly,
      };
    }
    if (path.includes("agile-coaching") || path.includes("coaching")) {
      return {
        heading: "Ready to transform your team?",
        buttonText: "Start Coaching",
        onClick: openCalendly,
      };
    }
    if (path.includes("project-rescue")) {
      return {
        heading: "Need to save your project?",
        buttonText: "Rescue My Project",
        onClick: openCalendly,
      };
    }
    if (path.includes("contract-product-owner")) {
      return {
        heading: "Need expert product leadership?",
        buttonText: "Book a PO Consultation",
        onClick: openCalendly,
      };
    }
    return {
      heading: "Have a project in mind?",
      buttonText: "Book a Discovery Call",
      onClick: openCalendly,
    };
  };

  const cta = getDynamicCTA();

  const techStack = [
    { name: "React", url: "https://react.dev", icon: "⚛️" },
    { name: "Vite", url: "https://vitejs.dev", icon: "⚡" },
    { name: "Builder.io", url: "https://builder.io", icon: "🏗️" },
    { name: "WordPress", url: "https://wordpress.org", icon: "📝" },
    { name: "Shopify", url: "https://shopify.com", icon: "🛍️" },
    { name: "Tailwind", url: "https://tailwindcss.com", icon: "🎨" },
    { name: "Framer Motion", url: "https://www.framer.com/motion", icon: "✨" },
  ];

  const services = [
    { label: "Web Design", href: "/services/web-design-liverpool" },
    { label: "Project Rescue", href: "/project-rescue" },
    { label: "Agile Coaching", href: "/agile-coaching" },
    { label: "Contract PO", href: "/contract-product-owner" },
    { label: "Local SEO", href: "/services/local-seo" },
    { label: "E-commerce", href: "/services/ecommerce" },
  ];

  const companyLinks = [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
    { label: "Our Pledge", href: "/pledge" },
  ];

  return (
    <footer className="bg-gray-950 text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {/* Block A: Dynamic CTA (spans 2 cols on md, 2 cols on lg) */}
          <motion.div
            className="col-span-1 md:col-span-2 lg:col-span-2 p-8 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm hover:border-white/10 transition"
            whileHover={{ y: -2 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-6 leading-tight text-white">
              {cta.heading}
            </h2>
            <motion.button
              onClick={cta.onClick}
              whileHover={{ scale: 1.05 }}
              className="px-8 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-lime-400 text-gray-950 font-semibold hover:shadow-lg transition"
            >
              {cta.buttonText}
            </motion.button>
          </motion.div>

          {/* Block B: Live Status */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm hover:border-white/10 transition flex flex-col justify-center"
            whileHover={{ y: -2 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <Circle
                  size={12}
                  className="text-green-400 fill-green-400"
                  style={{
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                  }}
                />
              </div>
              <span className="text-sm font-semibold text-green-400">
                All systems operational
              </span>
            </div>
            <p className="text-sm text-white/60">
              Accepting new projects for {nextQuarter}
            </p>
          </motion.div>

          {/* Block C: Tech Stack */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-2 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm hover:border-white/10 transition"
            whileHover={{ y: -2 }}
          >
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
              Powered by modern tech
            </p>
            <div className="flex flex-wrap gap-4">
              {techStack.map((tech) => (
                <motion.a
                  key={tech.name}
                  href={tech.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white transition grayscale opacity-50 hover:opacity-100 hover:grayscale-0"
                  whileHover={{ scale: 1.05 }}
                  title={`Visit ${tech.name}`}
                >
                  <span className="text-lg">{tech.icon}</span>
                  <span>{tech.name}</span>
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Block D: Context & Love */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm hover:border-white/10 transition"
            whileHover={{ y: -2 }}
          >
            <p className="text-sm font-medium mb-3 text-white">
              Made with ❤️ in Liverpool, UK
            </p>
            <p className="text-xs text-white/60">
              Local time:{" "}
              <span className="font-mono font-semibold text-white/80">
                {liverpooolTime} GMT
              </span>
            </p>
          </motion.div>

          {/* Block E: Services Links */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm hover:border-white/10 transition"
            whileHover={{ y: -2 }}
          >
            <h3 className="font-bold text-sm mb-4 text-white">Services</h3>
            <ul className="space-y-2">
              {services.slice(0, 3).map((service) => (
                <li key={service.href}>
                  <Link
                    to={service.href}
                    className="text-sm text-white/60 hover:text-white transition inline-flex items-center group"
                  >
                    {service.label}
                    <span className="inline-block ml-1 transform group-hover:translate-x-1 transition opacity-0 group-hover:opacity-100">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Block F: Company Links */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm hover:border-white/10 transition"
            whileHover={{ y: -2 }}
          >
            <h3 className="font-bold text-sm mb-4 text-white">Company</h3>
            <ul className="space-y-2">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-white/60 hover:text-white transition inline-flex items-center group"
                  >
                    {link.label}
                    <span className="inline-block ml-1 transform group-hover:translate-x-1 transition opacity-0 group-hover:opacity-100">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Block G: Socials & Contact */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm hover:border-white/10 transition"
            whileHover={{ y: -2 }}
          >
            <h3 className="font-bold text-sm mb-4 text-white">Connect</h3>
            <div className="flex gap-4">
              <motion.a
                href="https://linkedin.com/company/kaizen-web"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-cyan-400 transition"
                aria-label="LinkedIn"
                whileHover={{ scale: 1.2 }}
              >
                <Linkedin size={20} />
              </motion.a>
            </div>
            <p className="text-xs text-white/40 mt-4">hello@kaizenweb.co.uk</p>
          </motion.div>
        </div>

        {/* Legal Footer */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} Kaizen Web. All rights reserved.</p>
          <div className="flex gap-6">
            <Link
              to="/privacy-policy"
              className="hover:text-white/60 transition"
            >
              Privacy Policy
            </Link>
            <span>|</span>
            <Link
              to="/cookie-policy"
              className="hover:text-white/60 transition"
            >
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </footer>
  );
};

export default Footer;
