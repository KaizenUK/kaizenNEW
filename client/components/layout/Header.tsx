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
  const [panelLeft, setPanelLeft] = useState<number | null>(null);

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
          description:
            "Local rankings powered by Core Web Vitals and local intent.",
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
          description: "Shopify and custom stores that actually sell.",
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
          description: "Fix broken web projects and get shipping again.",
          icon: <LifeBuoy className="w-4 h-4" />,
          highlight: true,
        },
        {
          label: "Contract Product Owner",
          href: "/contract-product-owner",
          description: "Hands-on product leadership without the hiring risk.",
          icon: <Briefcase className="w-4 h-4" />,
        },
        {
          label: "Agile Coaching",
          href: "/agile-coaching",
          description: "Turn chaos into a predictable delivery process.",
          icon: <Users className="w-4 h-4" />,
        },
        {
          label: "Digital Transformation",
          href: "/services/digital-transformation",
          description:
            "Automate manual work and connect your systems across the business.",
          icon: <Zap className="w-4 h-4" />,
        },
      ],
    },
  ];

  const topLevelLinks: Array<{ label: string; href: string }> = [];

  const insightsMenu: ServiceColumn[] = [
    {
      title: "Latest Articles",
      items: [
        {
          label: "Web Design Costs in Liverpool 2025",
          href: "/blog/how-much-does-a-website-cost-in-liverpool-in-2025",
          description: "Transparent pricing and what you actually get.",
          icon: <PoundSterling className="w-4 h-4" />,
        },
        {
          label: "How to Choose a Web Agency",
          href: "/blog/choose-web-design-agency-liverpool",
          description: "Red flags, questions to ask, and what matters.",
          icon: <Lightbulb className="w-4 h-4" />,
        },
        {
          label: "Website Mistakes to Avoid",
          href: "/blog/website-mistakes-liverpool",
          description: "Common errors that kill conversions.",
          icon: <AlertCircle className="w-4 h-4" />,
        },
        {
          label: "All Articles",
          href: "/blog",
          description: "Browse our full archive of insights.",
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
          description:
            "Dual-currency gaming platform: +180% conversion uplift.",
          icon: <Rocket className="w-4 h-4" />,
        },
        {
          label: "Independent Retailer",
          href: "/case-studies/independent-retailer",
          description: "Local business rebuild: +250% organic traffic.",
          icon: <TrendingUp className="w-4 h-4" />,
        },
        {
          label: "All Case Studies",
          href: "/case-studies",
          description: "See more client success stories.",
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
          description:
            "What we do, how we work, and why performance comes first.",
          icon: <Info className="w-4 h-4" />,
        },
        {
          label: "Our Pledge",
          href: "/pledge",
          description: "No jargon. No black box. A transparent partnership.",
          icon: <ShieldCheck className="w-4 h-4" />,
        },
        {
          label: "Contact",
          href: "/contact",
          description: "Say hello, ask a question, or request an audit.",
          icon: <Mail className="w-4 h-4" />,
        },
      ],
    },
  ];

  const getTriggerEl = (menu: DesktopMenuKey) => {
    if (menu === "services") return servicesTriggerRef.current;
    if (menu === "insights") return insightsTriggerRef.current;
    if (menu === "case-studies") return caseStudiesTriggerRef.current;
    if (menu === "about") return aboutTriggerRef.current;
    return null;
  };

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

    const nav = navRef.current;
    const triggerEl = getTriggerEl(menu);

    if (nav && triggerEl) {
      const navRect = nav.getBoundingClientRect();
      const triggerRect = triggerEl.getBoundingClientRect();
      const centerX = triggerRect.left + triggerRect.width / 2 - navRect.left;
      setPanelLeft(centerX);
    } else {
      setPanelLeft(null);
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
    // menu remains open while moving between trigger and panel
  };

  const scheduleCloseMenu = () => {
    // rely on click outside or route change to close the menu
  };

  const panelVariants = {
    enter: { opacity: 0, y: -8 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  return (
    <header className="sticky top-4 z-50 w-full px-4 h-20">
      <div
        className="max-w-7xl mx-auto rounded-full bg-gray-950/80 border-t border-white/10 backdrop-blur-xl h-full"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-3 h-full">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-90 transition flex-shrink-0"
          >
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F03f6c5dd481449d297c430cab962412e?format=webp&width=800"
              alt="Kaizen Web"
              width="200"
              height="64"
              className="h-16 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav
            ref={navRef}
            className="relative hidden lg:flex items-center gap-1"
            onMouseEnter={cancelCloseMenu}
            onMouseLeave={scheduleCloseMenu}
            aria-label="Main navigation"
          >
            {/* Services Trigger */}
            <button
              ref={servicesTriggerRef}
              type="button"
              onMouseEnter={() => openMenu("services")}
              onFocus={() => openMenu("services")}
              onClick={() => handleTriggerClick("services")}
              className="flex items-center gap-2 px-4 py-2 text-base font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-full transition"
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
              ref={insightsTriggerRef}
              type="button"
              onMouseEnter={() => openMenu("insights")}
              onFocus={() => openMenu("insights")}
              onClick={() => handleTriggerClick("insights")}
              className="flex items-center gap-2 px-4 py-2 text-base font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-full transition"
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

            {/* Case Studies Trigger */}
            <button
              ref={caseStudiesTriggerRef}
              type="button"
              onMouseEnter={() => openMenu("case-studies")}
              onFocus={() => openMenu("case-studies")}
              onClick={() => handleTriggerClick("case-studies")}
              className="flex items-center gap-2 px-4 py-2 text-base font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-full transition"
              aria-expanded={isMenuOpen && activeMenu === "case-studies"}
            >
              Case Studies
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${
                  isMenuOpen && activeMenu === "case-studies"
                    ? "rotate-180"
                    : ""
                }`}
              />
            </button>

            {/* Top-Level Links */}
            {topLevelLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="px-4 py-2 text-base font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-full transition"
              >
                {link.label}
              </Link>
            ))}

            {/* About Trigger */}
            <button
              ref={aboutTriggerRef}
              type="button"
              onMouseEnter={() => openMenu("about")}
              onFocus={() => openMenu("about")}
              onClick={() => handleTriggerClick("about")}
              className="flex items-center gap-2 px-4 py-2 text-base font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-full transition"
              aria-expanded={isMenuOpen && activeMenu === "about"}
            >
              About
              <ChevronDown
                size={16}
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
                    duration: 0.22,
                    ease: [0.16, 1, 0.3, 1] as const,
                  }}
                  className={`absolute top-full mt-2 rounded-2xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl px-8 py-6 ${
                    activeMenu === "about" ||
                    activeMenu === "insights" ||
                    activeMenu === "case-studies"
                      ? "w-[min(520px,calc(100vw-3rem))]"
                      : "w-[min(720px,calc(100vw-3rem))]"
                  }`}
                  style={{
                    left: panelLeft ?? "50%",
                    transform: "translateX(-50%)",
                  }}
                >
                  <div
                    className={`grid gap-6 ${
                      activeMenu === "about" ||
                      activeMenu === "insights" ||
                      activeMenu === "case-studies"
                        ? "grid-cols-1"
                        : "grid-cols-2"
                    }`}
                  >
                    {getMenuData(activeMenu).map((column) => (
                      <div key={column.title}>
                        <h3 className="text-lg font-semibold text-white mb-4">
                          {column.title}
                        </h3>
                        <ul className="space-y-2">
                          {column.items.map((item) => (
                            <li key={item.href}>
                              <Link
                                to={item.href}
                                className="block rounded-xl px-3 py-2 hover:bg-white/5 transition"
                                onClick={() => {
                                  setIsMenuOpen(false);
                                  setActiveMenu(null);
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-cyan-300">
                                    {item.icon}
                                  </span>
                                  <div>
                                    <div
                                      className={`text-base font-semibold ${
                                        item.highlight
                                          ? "text-cyan-300"
                                          : "text-white"
                                      }`}
                                    >
                                      {item.label}
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">
                                      {item.description}
                                    </p>
                                  </div>
                                </div>
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
          <div className="flex items-center gap-4">
            {/* Free Speed Test Button */}
            <Link
              to="/performance-scanner"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition border border-emerald-500/30"
            >
              <Zap size={16} />
              Free Speed Test
            </Link>

            {/* Start a Chat Button */}
            <motion.div
              className="hidden sm:block relative group"
              whileHover={{ scale: 1.05 }}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-300 via-orange-500 to-rose-500 rounded-full opacity-40 group-hover:opacity-70 blur transition duration-300" />
              <button
                onClick={() => openCrisp()}
                className="relative flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium text-gray-950 bg-gradient-to-r from-amber-300 via-orange-500 to-rose-500 backdrop-blur-xl hover:shadow-2xl hover:shadow-orange-500/50 transition"
              >
                <span className="w-2 h-2 rounded-full bg-amber-100 animate-pulse" />
                Start a Chat
              </button>
            </motion.div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden text-white/80 hover:text-white transition"
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
