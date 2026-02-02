import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Linkedin, Instagram, Circle } from "lucide-react";
import { useCalendly } from "@/context/CalendlyContext";

interface FooterProps {
  theme: "light" | "dark";
}

const getNextQuarter = (): string => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let targetMonth = currentMonth + 3;
  let targetYear = currentYear;

  if (targetMonth > 11) {
    targetMonth -= 12;
    targetYear += 1;
  }

  let quarter: number;
  if (targetMonth < 3) quarter = 1;
  else if (targetMonth < 6) quarter = 2;
  else if (targetMonth < 9) quarter = 3;
  else quarter = 4;

  return `Q${quarter} ${targetYear}`;
};

const Footer: React.FC<FooterProps> = () => {
  const location = useLocation();
  const { openCalendly } = useCalendly();
  const [liverpoolTime, setLiverpoolTime] = useState("");
  const [nextQuarter, setNextQuarter] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const ukTime = now.toLocaleTimeString("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
      });
      setLiverpoolTime(ukTime);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setNextQuarter(getNextQuarter());
  }, []);

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
        heading: "Ready to improve your team?",
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
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

          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-2 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm hover:border-white/10 transition"
            whileHover={{ y: -2 }}
          >
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
              How we build
            </p>
            <ul className="space-y-2 text-sm text-white/60">
              <li>
                AI-augmented delivery with a senior Product Owner in charge.
              </li>
              <li>Core Web Vitals-first builds for real-world speed.</li>
              <li>Headless-ready architecture when your business needs it.</li>
              <li>
                Friendly content tools so your team controls day-to-day edits.
              </li>
            </ul>
          </motion.div>

          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm hover:border-white/10 transition"
            whileHover={{ y: -2 }}
          >
            <p className="text-sm font-medium mb-3 text-white">
              Made in Liverpool, UK
            </p>
            <p className="text-xs text-white/60">
              Local time:{" "}
              <span className="font-mono font-semibold text-white/80">
                {liverpoolTime} GMT
              </span>
            </p>
          </motion.div>

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

          <motion.div
            className="col-span-1 md:col-span-1 lg:col-span-1 p-6 rounded-2xl border border-white/5 bg-gray-900/50 backdrop-blur-sm hover:border-white/10 transition"
            whileHover={{ y: -2 }}
          >
            <h3 className="font-bold text-sm mb-4 text-white">Follow</h3>
            <div className="flex items-center gap-4">
              <a
                href="https://www.linkedin.com/company/kaizen-web"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white transition"
                aria-label="Follow Kaizen Web on LinkedIn"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="https://www.instagram.com/kaizenwebliverpool"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white transition"
                aria-label="Follow Kaizen Web on Instagram"
              >
                <Instagram size={20} />
              </a>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10 pt-6">
          <div className="text-center md:text-left">
            <p className="text-xs text-white/50">
              © {new Date().getFullYear()} Kaizen Web. All rights reserved.
            </p>
            <p className="text-xs text-white/50 mt-1">
              Kaizen Web Ltd t/a Kaizen Ltd (Company No. 17007703)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/50">
            <Link to="/privacy-policy" className="hover:text-white">
              Privacy
            </Link>
            <Link to="/cookie-policy" className="hover:text-white">
              Cookies
            </Link>
            <Link to="/gdpr-policy" className="hover:text-white">
              GDPR
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
