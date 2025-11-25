import { Link, useLocation } from "react-router-dom";
import {
  X,
  Sun,
  Moon,
  ChevronDown,
  Monitor,
  ShoppingBag,
  MapPin,
  Map,
  LifeBuoy,
  Briefcase,
  Users,
  BookOpen,
  FileText,
  FileCode2,
  Wrench,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useCalendly } from "@/context/CalendlyContext";
import { cn } from "@/lib/utils";

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

interface InsightItem {
  label: string;
  href: string;
  description?: string;
  icon: JSX.Element;
}

const OffCanvasMenu: React.FC<OffCanvasMenuProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const { openCalendly } = useCalendly();

  const servicesMenu: ServiceColumn[] = [
    {
      title: "Web & Growth",
      items: [
        {
          label: "Web Design Liverpool",
          href: "/services/web-design-liverpool",
          description:
            "Fast, conversion-focused sites for Liverpool businesses.",
          icon: <MapPin className="w-4 h-4" />,
        },
        {
          label: "Web Design Wirral",
          href: "/web-design-wirral",
          description:
            "Web design for Heswall, West Kirby, and Birkenhead.",
          icon: <Map className="w-4 h-4" />,
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
        {
          label: "Liverpool City Centre",
          href: "/web-design-liverpool-city-centre",
          description:
            "Web design for Liverpool city centre businesses.",
          icon: <MapPin className="w-4 h-4" />,
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

  const insightsMenu: InsightItem[] = [
    {
      label: "The Price Guide",
      description: "How much a serious website really costs in Liverpool.",
      href: "/blog/how-much-does-a-website-cost-in-liverpool-in-2025",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: "The Selection Guide",
      description: "How to choose a web agency without the fluff.",
      href: "/blog/choose-web-design-agency-liverpool",
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      label: "The Fixer Guide",
      description: "Five website mistakes that quietly kill sales.",
      href: "/blog/website-mistakes-liverpool",
      icon: <Wrench className="w-4 h-4" />,
    },
    {
      label: "View All Articles",
      href: "/blog",
      icon: <BookOpen className="w-4 h-4" />,
    },
  ];

  const topLevelLinks = [
    { label: "Our Pledge", href: "/pledge" },
    { label: "Case Studies", href: "/case-studies" },
    { label: "About", href: "/about" },
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
                {insightsMenu.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="block px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition"
                    onClick={onClose}
                  >
                    <div className="font-semibold">{item.label}</div>
                    {item.description && (
                      <div className="text-xs text-white/50 mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </Link>
                ))}
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
              openCalendly();
              onClose();
            }}
            className="w-full px-4 py-3 rounded-full text-sm font-medium text-gray-950 bg-gradient-to-r from-cyan-400 to-lime-400 hover:shadow-lg transition"
          >
            Book a 15 Minute Call
          </button>
        </div>
      </div>
    </>
  );
};

export default OffCanvasMenu;
