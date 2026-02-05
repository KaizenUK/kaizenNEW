import { Link, useLocation } from "react-router-dom";
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
  Award,
  PoundSterling,
  Lightbulb,
  AlertCircle,
  Rocket,
  TrendingUp,
  Grid,
  ArrowRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { openCrisp } from "@/lib/crisp-utils";

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navRef = useRef<HTMLDivElement | null>(null);
  const servicesTriggerRef = useRef<HTMLButtonElement | null>(null);
  const insightsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const caseStudiesTriggerRef = useRef<HTMLButtonElement | null>(null);
  const aboutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const location = useLocation();

  useEffect(() => {
    setIsMenuOpen(false);
    setActiveMenu(null);
  }, [location.pathname]);

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

  const panelVariants = {
    enter: { opacity: 0, y: -8 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-90 transition flex-shrink-0"
          >
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F03f6c5dd481449d297c430cab962412e?format=webp&width=200&quality=80"
              alt="Kaizen Web"
              width="200"
              height="64"
              fetchPriority="high"
              loading="eager"
              className="h-12 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav
            ref={navRef}
            className="relative hidden lg:flex items-center gap-1"
            aria-label="Main navigation"
          >
            {/* Services Trigger */}
            <button
              ref={servicesTriggerRef}
              type="button"
              onMouseEnter={() => openMenu("services")}
              onClick={() => handleTriggerClick("services")}
              className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
              aria-expanded={isMenuOpen && activeMenu === "services"}
            >
              Services
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  isMenuOpen && activeMenu === "services" ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Insights Trigger */}
            <button
              ref={insightsTriggerRef}
              type="button"
              onMouseEnter={() => openMenu("insights")}
              onClick={() => handleTriggerClick("insights")}
              className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
              aria-expanded={isMenuOpen && activeMenu === "insights"}
            >
              Insights
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  isMenuOpen && activeMenu === "insights" ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Case Studies Trigger */}
            <button
              ref={caseStudiesTriggerRef}
              type="button"
              onMouseEnter={() => openMenu("case-studies")}
              onClick={() => handleTriggerClick("case-studies")}
              className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
              aria-expanded={isMenuOpen && activeMenu === "case-studies"}
            >
              Case Studies
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  isMenuOpen && activeMenu === "case-studies" ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* About Trigger */}
            <button
              ref={aboutTriggerRef}
              type="button"
              onMouseEnter={() => openMenu("about")}
              onClick={() => handleTriggerClick("about")}
              className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
              aria-expanded={isMenuOpen && activeMenu === "about"}
            >
              About
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  isMenuOpen && activeMenu === "about" ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Panel */}
            <AnimatePresence>
              {isMenuOpen && activeMenu && (
                <motion.div
                  key={activeMenu}
                  variants={panelVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    duration: 0.2,
                    ease: [0.25, 1, 0.5, 1],
                  }}
                  onMouseLeave={() => {
                    setIsMenuOpen(false);
                    setActiveMenu(null);
                  }}
                  className={`absolute left-0 top-full mt-0 bg-white rounded-lg border border-gray-200 shadow-xl px-6 py-5 ${
                    activeMenu === "services"
                      ? "w-[600px]"
                      : "w-[380px]"
                  }`}
                  style={{ minWidth: "320px" }}
                >
                  <div
                    className={`grid gap-8 ${
                      activeMenu === "services" ? "grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    {getMenuData(activeMenu).map((column) => (
                      <div key={column.title}>
                        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
                          {column.title}
                        </h3>
                        <ul className="space-y-1">
                          {column.items.map((item) => (
                            <li key={item.href}>
                              <Link
                                to={item.href}
                                className="group flex flex-col gap-1 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition"
                                onClick={() => {
                                  setIsMenuOpen(false);
                                  setActiveMenu(null);
                                }}
                              >
                                <span
                                  className={`text-sm font-medium flex items-center gap-1 ${
                                    item.highlight
                                      ? "text-cyan-600"
                                      : "text-gray-900"
                                  } group-hover:text-cyan-600 transition-colors`}
                                >
                                  {item.label}
                                  <ArrowRight
                                    size={12}
                                    className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                                  />
                                </span>
                                <span className="text-xs text-gray-500">
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
              )}
            </AnimatePresence>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Free Speed Test */}
            <Link
              to="/performance-scanner"
              className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
            >
              <Zap size={16} />
              Free Speed Test
            </Link>

            {/* Start a Chat - Primary CTA */}
            <button
              onClick={() => openCrisp()}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all"
            >
              Start a Chat
              <ArrowRight size={14} />
            </button>

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
