import { Link, useLocation } from "react-router-dom";
import { Linkedin, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";

interface FooterProps {
  theme: "light" | "dark";
}

const Footer: React.FC<FooterProps> = ({ theme }) => {
  const location = useLocation();
  const { openCalendly } = useCalendly();
  const [liverpooolTime, setLiverpooolTime] = useState("");

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

  // Determine dynamic CTA based on route
  const getDynamicCTA = () => {
    const path = location.pathname;

    if (path.includes("web-design")) {
      return {
        heading: "Ready to build your high-performance site?",
        buttonText: "Start your Web Build",
        onClick: openCalendly,
      };
    }
    if (path.includes("agile") || path.includes("coaching")) {
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
    return {
      heading: "Have a project in mind?",
      buttonText: "Book a Discovery Call",
      onClick: openCalendly,
    };
  };

  const cta = getDynamicCTA();

  const techStack = [
    { name: "React", color: "text-blue-400" },
    { name: "Vite", color: "text-purple-400" },
    { name: "Builder.io", color: "text-cyan-400" },
    { name: "WordPress", color: "text-blue-500" },
    { name: "Shopify", color: "text-green-400" },
  ];

  const services = [
    { label: "Web Design", href: "/services/web-design-liverpool" },
    { label: "Project Rescue", href: "/project-rescue" },
    { label: "Agile Coaching", href: "/services/agile-coaching" },
    { label: "Contract PO", href: "/services/contract-product-owner" },
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
    <footer className="relative bg-gray-950 text-white overflow-hidden">
      {/* Mega "KAIZEN" Watermark */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5">
        <div
          className="absolute text-gray-100 font-bold whitespace-nowrap"
          style={{
            fontSize: "300px",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "200%",
            textAlign: "center",
          }}
        >
          KAIZEN
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16">
        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {/* Block A: Dynamic CTA (spans 2 cols on md, 2 cols on lg) */}
          <motion.div
            className="col-span-1 md:col-span-2 lg:col-span-2 p-8 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm"
            whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-6 leading-tight">
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
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm flex flex-col justify-center"
            whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
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
              Accepting new projects for Q1 2026
            </p>
          </motion.div>

          {/* Block C: Tech Stack */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm"
            whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
              Powered by modern tech
            </p>
            <div className="flex flex-wrap gap-3">
              {techStack.map((tech) => (
                <span key={tech.name} className="text-sm text-white/50">
                  {tech.name}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Block D: Context & Love */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm"
            whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <p className="text-sm font-medium mb-3">Made with ❤️ in Liverpool, UK</p>
            <p className="text-xs text-white/60">
              Local time: <span className="font-mono">{liverpooolTime} GMT</span>
            </p>
          </motion.div>

          {/* Block E: Services Links */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm"
            whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <h3 className="font-bold text-sm mb-4">Services</h3>
            <ul className="space-y-2">
              {services.slice(0, 3).map((service) => (
                <li key={service.href}>
                  <Link
                    to={service.href}
                    className="text-sm text-white/60 hover:text-white transition inline-flex items-center group"
                  >
                    {service.label}
                    <span className="inline-block ml-1 transform group-hover:translate-x-1 transition">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Block F: Company Links */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm"
            whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <h3 className="font-bold text-sm mb-4">Company</h3>
            <ul className="space-y-2">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-white/60 hover:text-white transition inline-flex items-center group"
                  >
                    {link.label}
                    <span className="inline-block ml-1 transform group-hover:translate-x-1 transition">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Block G: Socials & Contact */}
          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm"
            whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <h3 className="font-bold text-sm mb-4">Connect</h3>
            <div className="flex gap-4">
              <a
                href="https://linkedin.com/company/kaizen-web"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-cyan-400 transition"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
            </div>
            <p className="text-xs text-white/40 mt-4">
              hello@kaizenweb.co.uk
            </p>
          </motion.div>
        </div>

        {/* Legal Footer */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} Kaizen Web. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy-policy" className="hover:text-white/60 transition">
              Privacy Policy
            </Link>
            <span>|</span>
            <Link to="/cookie-policy" className="hover:text-white/60 transition">
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
