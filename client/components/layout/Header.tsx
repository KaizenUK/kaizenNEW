import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";

const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { openCalendly } = useCalendly();
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { label: "Web Design", href: "/services/web-design-liverpool" },
    { label: "Project Rescue", href: "/project-rescue", highlight: true },
    { label: "Agile Coaching", href: "/agile-coaching" },
    { label: "Contract PO", href: "/contract-product-owner" },
    { label: "Our Pledge", href: "/pledge" },
    { label: "Case Studies", href: "/case-studies" },
  ];

  return (
    <>
      <header className="sticky top-4 z-50 w-full px-4">
        <nav
          className="max-w-7xl mx-auto rounded-full bg-gray-950/80 border-t border-white/10"
          style={{
            backdropFilter: "blur(12px)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div className="flex items-center justify-between px-6 py-4">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition flex-shrink-0"
            >
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F03f6c5dd481449d297c430cab962412e?format=webp&width=800"
                alt="Kaizen Web"
                className="h-8 w-auto"
              />
            </Link>

            {/* Desktop Navigation - Hidden on Mobile */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`px-4 py-2 text-sm font-medium transition rounded-full hover:bg-white/5 ${
                    item.highlight
                      ? "text-cyan-400 hover:text-cyan-300"
                      : "text-white/80 hover:text-white"
                  }`}
                  style={{
                    mixBlendMode: "exclusion",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* CTA & Mobile Toggle */}
            <div className="flex items-center gap-4">
              <motion.button
                onClick={openCalendly}
                whileHover={{ scale: 1.05 }}
                className="hidden sm:block px-6 py-2 rounded-full text-sm font-medium text-gray-950 bg-gradient-to-r from-cyan-400 to-lime-400 hover:shadow-lg transition"
              >
                Book a Call
              </motion.button>

              {/* Mobile Menu Button */}
              <button
                className="lg:hidden text-white/80 hover:text-white transition"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="lg:hidden border-t border-white/10 bg-gray-950/40 backdrop-blur-md"
              >
                <div className="px-6 py-4 space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`block px-4 py-3 text-sm font-medium rounded-lg hover:bg-white/5 transition ${
                        item.highlight
                          ? "text-cyan-400 hover:text-cyan-300"
                          : "text-white/80 hover:text-white"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      openCalendly();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full mt-4 px-6 py-3 rounded-full text-sm font-medium text-gray-950 bg-gradient-to-r from-cyan-400 to-lime-400 hover:shadow-lg transition"
                  >
                    Book a Call
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </header>
    </>
  );
};

export default Header;
