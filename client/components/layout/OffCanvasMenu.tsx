import { Link } from "react-router-dom";
import {
  X,
  Sun,
  Moon,
  ChevronDown,
  MapPin,
  LifeBuoy,
  Briefcase,
  Users,
  FileCode2,
  Zap,
  ShoppingBag,
  BookOpen,
  Award,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { openCrisp } from "@/lib/crisp-utils";

interface OffCanvasMenuProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  onThemeChange: () => void;
}

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

const OffCanvasMenu: React.FC<OffCanvasMenuProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const servicesMenu: ServiceColumn[] = [
    {
      title: "Web & Growth",
      items: [
        {
          label: "High-Performance Local Websites",
          href: "/services/local-seo",
          description: "Local rankings powered by Core Web Vitals and local intent.",
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

  const insightsMenu: ServiceColumn[] = [
    {
      title: "Latest Articles",
      items: [
        {
          label: "Web Design Costs in Liverpool 2025",
          href: "/blog/how-much-does-a-website-cost-in-liverpool-in-2025",
          description: "Transparent pricing and what you actually get.",
          icon: <BookOpen className="w-4 h-4" />,
        },
        {
          label: "How to Choose a Web Agency",
          href: "/blog/choose-web-design-agency-liverpool",
          description: "Red flags, questions to ask, and what matters.",
          icon: <BookOpen className="w-4 h-4" />,
        },
        {
          label: "Website Mistakes to Avoid",
          href: "/blog/website-mistakes-liverpool",
          description: "Common errors that kill conversions.",
          icon: <BookOpen className="w-4 h-4" />,
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
          label: "High Five Games",
          href: "/case-studies/high-five-games",
          description: "Dual-currency gaming platform: +180% conversion uplift.",
          icon: <Award className="w-4 h-4" />,
        },
        {
          label: "Independent Retailer",
          href: "/case-studies/independent-retailer",
          description: "Local business rebuild: +250% organic traffic.",
          icon: <Award className="w-4 h-4" />,
        },
        {
          label: "All Case Studies",
          href: "/case-studies",
          description: "See more client success stories.",
          icon: <Award className="w-4 h-4" />,
        },
      ],
    },
  ];

  const topLevelLinks = [
    { label: "Project Rescue", href: "/project-rescue" },
  ];

  const toggleSection = (section: string) => {
    setExpandedSection((current) => (current === section ? null : section));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-md transition-opacity duration-200",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 w-80 max-w-[85vw] bg-gray-950 border-r border-white/10 flex flex-col overflow-hidden transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2" onClick={onClose}>
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F03f6c5dd481449d297c430cab962412e?format=webp&width=800"
              alt="Kaizen Web"
              className="h-8 w-auto"
              style={{
                filter: theme === "dark" ? "brightness(0) invert(1)" : "none",
              }}
            />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {/* Services Accordion */}
          <div>
            <button
              onClick={() => toggleSection("services")}
              className="w-full text-left px-3 py-3 text-base font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-lg transition flex items-center justify-between"
            >
              <span>Services</span>
              <ChevronDown
                size={18}
                className={cn(
                  "transition-transform duration-200",
                  expandedSection === "services" && "rotate-180",
                )}
              />
            </button>
            {expandedSection === "services" && (
              <div className="mt-1 space-y-0.5">
                {servicesMenu.map((column) => (
                  <div key={column.title}>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 py-2 mb-1">
                      {column.title}
                    </p>
                    {column.items.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "block px-3 py-2 text-sm font-medium rounded-lg hover:bg-white/5 transition",
                          item.highlight
                            ? "text-cyan-300 hover:text-cyan-200"
                            : "text-white/80 hover:text-white",
                        )}
                        onClick={onClose}
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
              onClick={() => toggleSection("insights")}
              className="w-full text-left px-3 py-3 text-base font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-lg transition flex items-center justify-between"
            >
              <span>Insights</span>
              <ChevronDown
                size={18}
                className={cn(
                  "transition-transform duration-200",
                  expandedSection === "insights" && "rotate-180",
                )}
              />
            </button>
            {expandedSection === "insights" && (
              <div className="mt-1 space-y-0.5">
                {insightsMenu.map((column) => (
                  <div key={column.title}>
                    {column.items.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="block px-3 py-2 text-sm font-medium rounded-lg text-white/80 hover:text-white hover:bg-white/5 transition"
                        onClick={onClose}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Case Studies Accordion */}
          <div>
            <button
              onClick={() => toggleSection("case-studies")}
              className="w-full text-left px-3 py-3 text-base font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-lg transition flex items-center justify-between"
            >
              <span>Case Studies</span>
              <ChevronDown
                size={18}
                className={cn(
                  "transition-transform duration-200",
                  expandedSection === "case-studies" && "rotate-180",
                )}
              />
            </button>
            {expandedSection === "case-studies" && (
              <div className="mt-1 space-y-0.5">
                {caseStudiesMenu.map((column) => (
                  <div key={column.title}>
                    {column.items.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="block px-3 py-2 text-sm font-medium rounded-lg text-white/80 hover:text-white hover:bg-white/5 transition"
                        onClick={onClose}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* About Accordion */}
          <div>
            <button
              onClick={() => toggleSection("about")}
              className="w-full text-left px-3 py-3 text-base font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-lg transition flex items-center justify-between"
            >
              <span>About</span>
              <ChevronDown
                size={18}
                className={cn(
                  "transition-transform duration-200",
                  expandedSection === "about" && "rotate-180",
                )}
              />
            </button>
            {expandedSection === "about" && (
              <div className="mt-1 space-y-0.5">
                <Link
                  to="/about"
                  className="block px-3 py-2 text-sm font-medium rounded-lg text-white/80 hover:text-white hover:bg-white/5 transition"
                  onClick={onClose}
                >
                  About Kaizen
                </Link>
                <Link
                  to="/pledge"
                  className="block px-3 py-2 text-sm font-medium rounded-lg text-white/80 hover:text-white hover:bg-white/5 transition"
                  onClick={onClose}
                >
                  Our Pledge
                </Link>
                <Link
                  to="/contact"
                  className="block px-3 py-2 text-sm font-medium rounded-lg text-white/80 hover:text-white hover:bg-white/5 transition"
                  onClick={onClose}
                >
                  Contact
                </Link>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-white/10" />

          {/* Top-Level Links */}
          {topLevelLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="block px-3 py-3 text-base font-medium text-white/90 hover:text-white hover:bg-white/5 rounded-lg transition"
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 space-y-3">
          <button
            onClick={() => {
              onThemeChange();
              onClose();
            }}
            className="w-full px-3 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition flex items-center justify-center gap-2"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={() => {
              openCrisp();
              onClose();
            }}
            className="w-full px-4 py-3 rounded-full text-sm font-medium text-gray-950 bg-gradient-to-r from-green-400 to-emerald-500 hover:shadow-lg transition flex items-center justify-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-green-200 animate-pulse" />
            Start a Chat
          </button>
        </div>
      </div>
    </>
  );
};

export default OffCanvasMenu;
