import { Link, useLocation } from "react-router-dom";
import KaizenLogo from "@/components/KaizenLogo";
import {
  Menu,
  X,
  ChevronDown,
  ShoppingBag,
  MapPin,
  LifeBuoy,
  Briefcase,
  Users,
  FileCode2,
  Zap,
  Info,
  ShieldCheck,
  Mail,
  BookOpen,
  PoundSterling,
  Lightbulb,
  AlertCircle,
  Rocket,
  TrendingUp,
  Grid,
  ArrowRight,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HeaderProps {
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
}

type DesktopMenuKey = "services" | "insights" | "case-studies" | "about" | null;

interface ServiceItem {
  label: string;
  href: string;
  description: string;
  icon: JSX.Element;
  highlight?: boolean;
}

interface ServiceColumn {
  title: string;
  items: ServiceItem[];
}

const Header: React.FC<HeaderProps> = ({
  mobileMenuOpen,
  onMobileMenuChange,
}) => {
  const [activeMenu, setActiveMenu] = useState<DesktopMenuKey>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [buttonPosition, setButtonPosition] = useState(0);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<DesktopMenuKey, HTMLButtonElement | null>>({
    services: null,
    insights: null,
    "case-studies": null,
    about: null,
  });
  const location = useLocation();

  // Clear timeout helper
  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    setActiveMenu(null);
    setHoveredColumn(null);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
        setHoveredColumn(null);
      }
    };

    if (activeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [activeMenu]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearCloseTimeout();
  }, [clearCloseTimeout]);

  const servicesMenu: ServiceColumn[] = [
    {
      title: "Web & Growth",
      items: [
        {
          label: "High-Performance Local Websites",
          href: "/services/local-seo",
          description: "Local rankings powered by Core Web Vitals.",
          icon: <MapPin className="w-4 h-4" />,
        },
        {
          label: "WordPress Web Design",
          href: "/services/wordpress-web-design",
          description: "Custom, high-performance WordPress builds.",
          icon: <FileCode2 className="w-4 h-4" />,
        },
        {
          label: "E-commerce Development",
          href: "/services/ecommerce",
          description: "Shopify and custom stores that convert.",
          icon: <ShoppingBag className="w-4 h-4" />,
        },
      ],
    },
    {
      title: "Product & Strategy",
      items: [
        {
          label: "Project Rescue",
          href: "/project-rescue",
          description: "Fix broken web projects fast.",
          icon: <LifeBuoy className="w-4 h-4" />,
          highlight: true,
        },
        {
          label: "Contract Product Owner",
          href: "/contract-product-owner",
          description: "Hands-on product leadership.",
          icon: <Briefcase className="w-4 h-4" />,
        },
        {
          label: "Agile Coaching",
          href: "/agile-coaching",
          description: "Turn chaos into predictable delivery.",
          icon: <Users className="w-4 h-4" />,
        },
        {
          label: "Digital Transformation",
          href: "/services/digital-transformation",
          description: "Automate work and connect systems.",
          icon: <Zap className="w-4 h-4" />,
        },
      ],
    },
  ];

  const insightsMenu: ServiceColumn[] = [
    {
      title: "Latest Articles",
      items: [
        {
          label: "Web Design Costs in Liverpool 2025",
          href: "/blog/how-much-does-a-website-cost-in-liverpool-in-2025",
          description: "Transparent pricing breakdown.",
          icon: <PoundSterling className="w-4 h-4" />,
        },
        {
          label: "How to Choose a Web Agency",
          href: "/blog/choose-web-design-agency-liverpool",
          description: "Red flags and what matters.",
          icon: <Lightbulb className="w-4 h-4" />,
        },
        {
          label: "Website Mistakes to Avoid",
          href: "/blog/website-mistakes-liverpool",
          description: "Errors that kill conversions.",
          icon: <AlertCircle className="w-4 h-4" />,
        },
        {
          label: "All Articles",
          href: "/blog",
          description: "Browse our full archive.",
          icon: <BookOpen className="w-4 h-4" />,
        },
      ],
    },
  ];

  const caseStudiesMenu: ServiceColumn[] = [
    {
      title: "Client Results",
      items: [
        {
          label: "Sweep Stakes Casino",
          href: "/case-studies/high-five-games",
          description: "+180% conversion uplift.",
          icon: <Rocket className="w-4 h-4" />,
        },
        {
          label: "Independent Retailer",
          href: "/case-studies/independent-retailer",
          description: "+250% organic traffic.",
          icon: <TrendingUp className="w-4 h-4" />,
        },
        {
          label: "All Case Studies",
          href: "/case-studies",
          description: "See more success stories.",
          icon: <Grid className="w-4 h-4" />,
        },
      ],
    },
  ];

  const aboutMenu: ServiceColumn[] = [
    {
      title: "About",
      items: [
        {
          label: "About Kaizen",
          href: "/about",
          description: "What we do and how we work.",
          icon: <Info className="w-4 h-4" />,
        },
        {
          label: "Our Pledge",
          href: "/pledge",
          description: "No jargon. Transparent partnership.",
          icon: <ShieldCheck className="w-4 h-4" />,
        },
        {
          label: "Contact",
          href: "/contact",
          description: "Say hello or request an audit.",
          icon: <Mail className="w-4 h-4" />,
        },
      ],
    },
  ];

  const getMenuData = (menu: DesktopMenuKey) => {
    if (menu === "insights") return insightsMenu;
    if (menu === "case-studies") return caseStudiesMenu;
    if (menu === "about") return aboutMenu;
    return servicesMenu;
  };

  const handleMenuEnter = (menu: DesktopMenuKey) => {
    clearCloseTimeout();
    setActiveMenu(menu);

    // Calculate button position for dropdown alignment
    const button = buttonRefs.current[menu];
    if (button && navRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const relativeLeft = buttonRect.left - navRect.left;
      setButtonPosition(relativeLeft);
    }
  };

  const handleMenuLeave = () => {
    // Small delay before closing to allow moving between triggers and panel
    closeTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
      setHoveredColumn(null);
    }, 100);
  };

  const handlePanelEnter = () => {
    clearCloseTimeout();
  };

  const handlePanelLeave = () => {
    handleMenuLeave();
  };

  // Stripe-style fold animation
  const panelVariants = {
    hidden: {
      opacity: 0,
      y: -10,
      scaleY: 0.95,
      transformOrigin: "top",
    },
    visible: {
      opacity: 1,
      y: 0,
      scaleY: 1,
      transformOrigin: "top",
      transition: {
        duration: 0.25,
        ease: [0.16, 1, 0.3, 1],
      },
    },
    exit: {
      opacity: 0,
      y: -5,
      scaleY: 0.98,
      transformOrigin: "top",
      transition: {
        duration: 0.15,
        ease: [0.4, 0, 1, 1],
      },
    },
  };

  // Content fade for switching between menus
  const contentVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.15, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.1, ease: "easeIn" },
    },
  };

  const menuTriggers: { key: DesktopMenuKey; label: string }[] = [
    { key: "services", label: "Services" },
    { key: "insights", label: "Insights" },
    { key: "case-studies", label: "Case Studies" },
    { key: "about", label: "About" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition flex-shrink-0 mr-8"
          >
            <KaizenLogo className="h-7 w-[120px] text-black" />
          </Link>

          {/* Desktop Navigation - positioned right after logo */}
          <nav
            ref={navRef}
            className="relative hidden lg:flex items-center flex-1"
            aria-label="Main navigation"
            onMouseLeave={handleMenuLeave}
          >
            {/* Menu Triggers */}
            <div className="flex items-center">
              {menuTriggers.map(({ key, label }) => (
                <button
                  key={key}
                  ref={(el) => {
                    if (el) buttonRefs.current[key] = el;
                  }}
                  type="button"
                  onMouseEnter={() => handleMenuEnter(key)}
                  className={`flex items-center gap-1 px-4 py-3 text-[15px] font-medium transition-colors duration-150 ${
                    activeMenu === key
                      ? "text-gray-500"
                      : "text-black hover:text-gray-500"
                  }`}
                  aria-expanded={activeMenu === key}
                >
                  {label}
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${
                      activeMenu === key ? "rotate-180" : ""
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Dropdown Panel Container - Stripe-style fold animation */}
            <AnimatePresence>
              {activeMenu && (
                <motion.div
                  variants={panelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onMouseEnter={handlePanelEnter}
                  onMouseLeave={handlePanelLeave}
                  className="absolute top-full bg-white rounded-xl border border-gray-200 shadow-2xl shadow-gray-200/50 overflow-hidden"
                  style={{
                    left: `${buttonPosition}px`,
                    minWidth: activeMenu === "services" ? "560px" : "320px",
                  }}
                >
                  {/* Animated content switching */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeMenu}
                      variants={contentVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="p-6"
                    >
                      <div
                        className={`grid gap-8 ${
                          activeMenu === "services"
                            ? "grid-cols-2"
                            : "grid-cols-1"
                        }`}
                      >
                        {getMenuData(activeMenu).map((column) => (
                          <div
                            key={column.title}
                            onMouseEnter={() => setHoveredColumn(column.title)}
                            onMouseLeave={() => setHoveredColumn(null)}
                          >
                            {/* Column Header with animated underline */}
                            <div className="relative mb-4">
                              <h3 className="text-sm font-semibold text-cyan-600 hover:text-black transition-colors duration-150 cursor-default">
                                {column.title}
                              </h3>
                              {/* Animated underline */}
                              <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-200 mt-2">
                                <motion.div
                                  className="h-full bg-cyan-500"
                                  initial={{ width: 0 }}
                                  animate={{
                                    width:
                                      hoveredColumn === column.title
                                        ? "100%"
                                        : 0,
                                  }}
                                  transition={{
                                    duration: 0.3,
                                    ease: [0.16, 1, 0.3, 1],
                                  }}
                                />
                              </div>
                            </div>

                            {/* Menu Items */}
                            <ul className="space-y-0.5">
                              {column.items.map((item) => (
                                <li key={item.href}>
                                  <Link
                                    to={item.href}
                                    className="group flex flex-col gap-0.5 rounded-lg px-3 py-2.5 -mx-3 hover:bg-gray-50 transition-colors duration-150"
                                    onClick={() => {
                                      setActiveMenu(null);
                                      setHoveredColumn(null);
                                    }}
                                    onMouseEnter={() =>
                                      setHoveredColumn(column.title)
                                    }
                                  >
                                    <span className="text-sm font-medium flex items-center gap-1.5 text-gray-900 group-hover:text-cyan-600 transition-colors duration-150">
                                      {item.label}
                                      <ArrowRight
                                        size={12}
                                        className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                                      />
                                    </span>
                                    <span className="text-xs text-gray-500 group-hover:text-gray-600 transition-colors duration-150">
                                      {item.description}
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>

          {/* Right Actions - pushed to the right */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Free Speed Test */}
            <Link
              to="/performance-scanner"
              className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
            >
              <Zap size={16} />
              Free Speed Test
            </Link>

            {/* Start Your Project - Primary CTA */}
            <Link
              to="/contact"
              className="hidden sm:flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Your Project
              <ArrowRight size={14} />
            </Link>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              onClick={() => onMobileMenuChange(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
