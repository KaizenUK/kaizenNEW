import { Link, useLocation } from "react-router-dom";
import { Menu, X, Sun, Moon, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";

interface HeaderProps {
  theme: "light" | "dark";
  onThemeChange: () => void;
}

type MenuType = "services" | "insights" | null;

const Header: React.FC<HeaderProps> = ({ theme, onThemeChange }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMobileSection, setExpandedMobileSection] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<MenuType>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { openCalendly } = useCalendly();
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [location.pathname]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const servicesMenu = [
    {
      title: "Web & Growth",
      items: [
        { label: "High-Performance Web Design", href: "/services/web-design-liverpool" },
        { label: "City Centre Specialist", href: "/web-design-liverpool-city-centre" },
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
    { label: "The Price Guide", description: "How Much Does a Website Cost?", href: "/blog/how-much-does-a-website-cost-in-liverpool-in-2025" },
    { label: "The Selection Guide", description: "How to Choose an Agency", href: "/blog/choose-web-design-agency-liverpool" },
    { label: "The Fixer Guide", description: "5 Website Mistakes", href: "/blog/website-mistakes-liverpool" },
    { label: "View All Articles", href: "/blog" },
  ];

  const topLevelLinks = [
    { label: "Our Pledge", href: "/pledge" },
    { label: "Case Studies", href: "/case-studies" },
    { label: "About", href: "/about" },
  ];

  const toggleMobileSection = (section: string) => {
    setExpandedMobileSection(expandedMobileSection === section ? null : section);
  };

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
          <div className="flex items-center justify-between px-6 py-3">
            {/* Logo - Fixed Visibility */}
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

            {/* Desktop Navigation - Hidden on Mobile */}
            <div className="hidden lg:flex items-center gap-8">
              <LayoutGroup>
                {/* Services Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <motion.button
                    onClick={() => setActiveDropdown(activeDropdown === "services" ? null : "services")}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition rounded-full hover:bg-white/5"
                  >
                    Services
                    <ChevronDown size={16} className={`transition ${activeDropdown === "services" ? "rotate-180" : ""}`} />
                  </motion.button>

                  {/* Magnetic Menu Container */}
                  <AnimatePresence mode="wait">
                    {activeDropdown && (
                      <motion.div
                        key={activeDropdown}
                        layoutId="dropdown-container"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 mt-2 w-screen max-w-2xl rounded-2xl border border-white/10 bg-gray-950/95 shadow-2xl p-8"
                        style={{
                          backdropFilter: "blur(20px)",
                        }}
                      >
                        <div className="grid grid-cols-2 gap-12">
                          {(activeDropdown === "services" ? servicesMenu : null) && servicesMenu.map((column) => (
                            <div key={column.title}>
                              <h3 className="text-base font-semibold text-white/90 mb-6">
                                {column.title}
                              </h3>
                              <ul className="space-y-4">
                                {column.items.map((item) => (
                                  <li key={item.href}>
                                    <Link
                                      to={item.href}
                                      className={`block text-sm transition group ${
                                        item.highlight
                                          ? "text-cyan-400 hover:text-cyan-300 font-medium"
                                          : "text-white/70 hover:text-white"
                                      }`}
                                      onClick={() => setActiveDropdown(null)}
                                    >
                                      <span className="inline-block mr-2 group-hover:translate-x-1 transition">→</span>
                                      {item.label}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Insights Dropdown */}
                <div className="relative">
                  <motion.button
                    onClick={() => setActiveDropdown(activeDropdown === "insights" ? null : "insights")}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition rounded-full hover:bg-white/5"
                  >
                    Insights
                    <ChevronDown size={16} className={`transition ${activeDropdown === "insights" ? "rotate-180" : ""}`} />
                  </motion.button>

                  {/* Magnetic Menu Container */}
                  <AnimatePresence mode="wait">
                    {activeDropdown === "insights" && (
                      <motion.div
                        layoutId="dropdown-container"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full right-0 mt-2 w-96 rounded-2xl border border-white/10 bg-gray-950/95 shadow-2xl p-6"
                        style={{
                          backdropFilter: "blur(20px)",
                        }}
                      >
                        <ul className="space-y-4">
                          {insightsMenu.map((item) => (
                            <li key={item.href}>
                              <Link
                                to={item.href}
                                className="block text-sm transition group"
                                onClick={() => setActiveDropdown(null)}
                              >
                                <span className="inline-block mr-2 group-hover:translate-x-1 transition text-white/70">→</span>
                                <span className="font-semibold text-white/90 group-hover:text-white">
                                  {item.label}
                                </span>
                                {item.description && (
                                  <div className="text-xs text-gray-400 mt-1 ml-6">{item.description}</div>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </LayoutGroup>

              {/* Top-Level Links */}
              {topLevelLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition rounded-full hover:bg-white/5"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Side: Theme Toggle & CTA & Mobile Menu */}
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
                className="lg:hidden border-t border-white/10 bg-gray-950/40 backdrop-blur-md"
              >
                <div className="px-6 py-4 space-y-2">
                  {/* Services Accordion */}
                  <div>
                    <button
                      onClick={() => toggleMobileSection("services")}
                      className="w-full text-left px-4 py-3 text-sm font-medium text-white/80 rounded-lg hover:bg-white/5 hover:text-white transition flex items-center justify-between"
                    >
                      Services
                      <ChevronDown size={16} className={`transition ${expandedMobileSection === "services" ? "rotate-180" : ""}`} />
                    </button>
                    {expandedMobileSection === "services" && (
                      <div className="ml-4 space-y-2 mt-2 border-l border-white/10 pl-4">
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
                      </div>
                    )}
                  </div>

                  {/* Insights Accordion */}
                  <div>
                    <button
                      onClick={() => toggleMobileSection("insights")}
                      className="w-full text-left px-4 py-3 text-sm font-medium text-white/80 rounded-lg hover:bg-white/5 hover:text-white transition flex items-center justify-between"
                    >
                      Insights
                      <ChevronDown size={16} className={`transition ${expandedMobileSection === "insights" ? "rotate-180" : ""}`} />
                    </button>
                    {expandedMobileSection === "insights" && (
                      <div className="ml-4 space-y-2 mt-2 border-l border-white/10 pl-4">
                        {insightsMenu.map((item) => (
                          <Link
                            key={item.href}
                            to={item.href}
                            className="block px-4 py-2 text-sm font-medium text-white/80 rounded-lg hover:bg-white/5 hover:text-white transition"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.label}
                            {item.description && (
                              <div className="text-xs text-gray-400 mt-1">{item.description}</div>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top-Level Links */}
                  {topLevelLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      className="block px-4 py-3 text-sm font-medium text-white/80 rounded-lg hover:bg-white/5 hover:text-white transition"
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
                      className="w-full px-4 py-3 text-sm font-medium text-white/80 rounded-lg hover:bg-white/5 hover:text-white transition flex items-center justify-center gap-2"
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
    </>
  );
};

export default Header;
