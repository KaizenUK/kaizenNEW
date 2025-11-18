import { Link, useLocation } from "react-router-dom";
import { Menu, X, Sun, Moon, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";

interface HeaderProps {
  theme: "light" | "dark";
  onThemeChange: () => void;
}

type DesktopMenuKey = "services" | "insights" | null;

const Header: React.FC<HeaderProps> = ({ theme, onThemeChange }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMobileSection, setExpandedMobileSection] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<DesktopMenuKey>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const { openCalendly } = useCalendly();
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
    setIsMenuOpen(false);
    setActiveMenu(null);
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setActiveMenu(null);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isMenuOpen]);

  const servicesMenu = [
    {
      title: "Web & Growth",
      items: [
        { label: "High-Performance Web Design", href: "/services/web-design-liverpool" },
        { label: "E-commerce Development", href: "/services/ecommerce" },
        { label: "Local SEO", href: "/services/local-seo" },
      ],
    },
    {
      title: "Product & Strategy",
      items: [
        { label: "Project Rescue", href: "/project-rescue", highlight: true },
        { label: "Contract Product Owner", href: "/contract-product-owner" },
        { label: "Agile Coaching", href: "/agile-coaching" },
      ],
    },
  ];

  const insightsMenu = [
    {
      label: "The Price Guide",
      description: "How Much Does a Website Cost?",
      href: "/blog/how-much-does-a-website-cost-in-liverpool-in-2025",
    },
    {
      label: "The Selection Guide",
      description: "How to Choose an Agency",
      href: "/blog/choose-web-design-agency-liverpool",
    },
    {
      label: "The Fixer Guide",
      description: "5 Website Mistakes",
      href: "/blog/website-mistakes-liverpool",
    },
    {
      label: "View All Articles",
      href: "/blog",
    },
  ];

  const topLevelLinks = [
    { label: "Our Pledge", href: "/pledge" },
    { label: "Case Studies", href: "/case-studies" },
    { label: "About", href: "/about" },
  ];

  const openMenu = (menu: DesktopMenuKey) => {
    if (!menu) {
      setIsMenuOpen(false);
      setActiveMenu(null);
      return;
    }
    setActiveMenu(menu);
    setIsMenuOpen(true);
  };

  const handleTriggerClick = (menu: DesktopMenuKey) => {
    if (activeMenu === menu && isMenuOpen) {
      setIsMenuOpen(false);
      setActiveMenu(null);
      return;
    }
    openMenu(menu);
  };

  const cancelCloseMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleCloseMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsMenuOpen(false);
      setActiveMenu(null);
    }, 130);
  };

  const toggleMobileSection = (section: string) => {
    setExpandedMobileSection((current) => (current === section ? null : section));
  };

  return (
    <header className="sticky top-4 z-50 w-full px-4">
      <nav
        className="max-w-7xl mx-auto rounded-full bg-gray-950/80 border-t border-white/10"
        style={{
          backdropFilter: "blur(12px)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-80 transition flex-shrink-0"
          >
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F03f6c5dd481449d297c430cab962412e?format=webp&width=800"
              alt="Kaizen Web"
              className="h-12 w-auto"
              style={{
                filter: theme === "dark" ? "brightness(0) invert(1)" : "none",
              }}
            />
          </Link>

          {/* Desktop Navigation */}
          <div
            ref={navRef}
            className="relative hidden lg:flex items-center gap-1"
            onMouseEnter={cancelCloseMenu}
            onMouseLeave={scheduleCloseMenu}
          >
            {/* Services Trigger */}
            <button
              type="button"
              onMouseEnter={() => openMenu("services")}
              onFocus={() => openMenu("services")}
              onClick={() => handleTriggerClick("services")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-full transition"
              aria-expanded={isMenuOpen && activeMenu === "services"}
            >
              Services
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${
                  isMenuOpen && activeMenu === "services" ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Insights Trigger */}
            <button
              type="button"
              onMouseEnter={() => openMenu("insights")}
              onFocus={() => openMenu("insights")}
              onClick={() => handleTriggerClick("insights")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-full transition"
              aria-expanded={isMenuOpen && activeMenu === "insights"}
            >
              Insights
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${
                  isMenuOpen && activeMenu === "insights" ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Top-Level Links */}
            {topLevelLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-full transition"
              >
                {link.label}
              </Link>
            ))}

            {/* Shared Dropdown Panel */}
            <AnimatePresence mode="wait">
              {isMenuOpen && activeMenu && (
                <motion.div
                  key={activeMenu}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-2xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl w-[min(560px,calc(100vw-3rem))] px-8 py-6"
                >
                  {activeMenu === "services" && (
                    <div className="grid grid-cols-2 gap-12">
                      {servicesMenu.map((column) => (
                        <div key={column.title}>
                          <h3 className="text-base font-semibold text-white mb-4">
                            {column.title}
                          </h3>
                          <ul className="space-y-3">
                            {column.items.map((item) => (
                              <li key={item.href}>
                                <Link
                                  to={item.href}
                                  className={`block text-sm transition ${
                                    item.highlight
                                      ? "text-cyan-400 hover:text-cyan-300"
                                      : "text-white/70 hover:text-white"
                                  }`}
                                  onClick={() => {
                                    setIsMenuOpen(false);
                                    setActiveMenu(null);
                                  }}
                                >
                                  {item.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeMenu === "insights" && (
                    <div className="space-y-4">
                      {insightsMenu.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          className="block text-left"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setActiveMenu(null);
                          }}
                        >
                          <div className="text-base font-semibold text-white">
                            {item.label}
                          </div>
                          {item.description && (
                            <div className="text-sm text-gray-400 mt-1">
                              {item.description}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <motion.button
              onClick={onThemeChange}
              whileHover={{ scale: 1.05 }}
              className="hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </motion.button>

            {/* CTA Button */}
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
              transition={{ duration: 0.2 }}
              className="lg:hidden border-t border-white/10 bg-gray-950/40 backdrop-blur-md"
            >
              <div className="px-6 py-4 space-y-2">
                {/* Services Accordion */}
                <div>
                  <button
                    onClick={() => toggleMobileSection("services")}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition flex items-center justify-between"
                  >
                    Services
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${
                        expandedMobileSection === "services" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {expandedMobileSection === "services" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="ml-4 space-y-2 mt-2 border-l border-white/10 pl-4 overflow-hidden"
                    >
                      {servicesMenu.map((column) => (
                        <div key={column.title}>
                          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                            {column.title}
                          </p>
                          {column.items.map((item) => (
                            <Link
                              key={item.href}
                              to={item.href}
                              className={`block px-4 py-2 text-sm font-medium rounded-lg hover:bg-white/5 transition ${
                                item.highlight
                                  ? "text-cyan-400 hover:text-cyan-300"
                                  : "text-white/80 hover:text-white"
                              }`}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Insights Accordion */}
                <div>
                  <button
                    onClick={() => toggleMobileSection("insights")}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition flex items-center justify-between"
                  >
                    Insights
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${
                        expandedMobileSection === "insights" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {expandedMobileSection === "insights" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="ml-4 space-y-2 mt-2 border-l border-white/10 pl-4 overflow-hidden"
                    >
                      {insightsMenu.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          className="block px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <div className="font-semibold">{item.label}</div>
                          {item.description && (
                            <div className="text-xs text-white/50 mt-1">{item.description}</div>
                          )}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Top-Level Links */}
                {topLevelLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="block px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}

                {/* Mobile CTA */}
                <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
                  <button
                    onClick={() => {
                      onThemeChange();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </button>
                  <button
                    onClick={() => {
                      openCalendly();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full px-6 py-3 rounded-full text-sm font-medium text-gray-950 bg-gradient-to-r from-cyan-400 to-lime-400 hover:shadow-lg transition"
                  >
                    Book a Call
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
};

export default Header;
