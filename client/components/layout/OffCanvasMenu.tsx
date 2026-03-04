import { useState } from "react";
import { Link } from "react-router-dom";
import KaizenLogo from "@/components/KaizenLogo";
import { cn } from "@/lib/utils";
import { requiresDocumentNavigation } from "@/lib/navigation";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  ChevronDown,
  LifeBuoy,
  Mail,
  MapPin,
  Newspaper,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  getMenuData,
  type DesktopMenuKey,
  type ServiceItem,
} from "./header-menu-data";

interface OffCanvasMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const SECTION_CONFIG: Array<{ key: DesktopMenuKey; label: string }> = [
  { key: "services", label: "Services" },
  { key: "insights", label: "Insights" },
  { key: "case-studies", label: "Case Studies" },
  { key: "about", label: "About" },
];

const ICON_BY_PATTERN: Array<{
  match: RegExp;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { match: /local-seo|liverpool|wirral|chester|warrington|agency/i, icon: MapPin },
  { match: /wordpress|web-design|ecommerce|shop|asset/i, icon: ShoppingBag },
  { match: /project-rescue|rescue|failing|fix/i, icon: LifeBuoy },
  { match: /product-owner|strategy|owner|transformation/i, icon: Briefcase },
  { match: /agile|coaching|community/i, icon: Users },
  { match: /blog|insight|article|learn|documentation/i, icon: BookOpen },
  { match: /case-studies|case-study|results|traffic|conversion/i, icon: TrendingUp },
];

function resolveItemIcon(item: ServiceItem) {
  const haystack = `${item.href} ${item.label} ${item.description}`.toLowerCase();
  const resolved = ICON_BY_PATTERN.find(({ match }) => match.test(haystack));
  return resolved?.icon ?? Sparkles;
}

const OffCanvasMenu: React.FC<OffCanvasMenuProps> = ({ isOpen, onClose }) => {
  const [expandedSection, setExpandedSection] = useState<DesktopMenuKey>("services");

  const toggleSection = (section: DesktopMenuKey) => {
    setExpandedSection((current) => (current === section ? "services" : section));
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[22rem] max-w-[88vw] transform flex-col overflow-hidden border-r border-white/10 bg-[#070c15]/98 shadow-[0_18px_42px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <Link to="/" className="flex items-center gap-2" onClick={onClose}>
            <KaizenLogo className="h-6 w-[104px] text-white" />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {SECTION_CONFIG.map((section) => {
            const isExpanded = expandedSection === section.key;
            const columns = getMenuData(section.key);

            return (
              <section key={section.key} className="rounded-xl border border-white/10 bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="flex w-full items-center justify-between px-3 py-3 text-left text-[15px] font-semibold text-slate-100 transition hover:bg-white/[0.04]"
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={16}
                    className={cn(
                      "text-slate-400 transition-transform duration-200",
                      isExpanded && "rotate-180 text-cyan-300",
                    )}
                  />
                </button>

                {isExpanded && (
                  <div className="space-y-3 border-t border-white/10 px-2 pb-2 pt-2">
                    {columns.map((column) => (
                      <div key={column.title}>
                        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          {column.title}
                        </p>
                        <ul className="space-y-1">
                          {column.items.map((item) => {
                            const ItemIcon = resolveItemIcon(item);
                            const itemClassName = cn(
                              "group flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition hover:border-white/10 hover:bg-white/[0.05]",
                              item.highlight && "border-cyan-400/30 bg-cyan-400/[0.07]",
                            );

                            const content = (
                              <>
                                <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-slate-200 transition group-hover:text-cyan-200">
                                  <ItemIcon className="h-3.5 w-3.5" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-slate-100 group-hover:text-cyan-300">
                                    {item.label}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-slate-400 group-hover:text-slate-300">
                                    {item.description}
                                  </span>
                                </span>
                              </>
                            );

                            return (
                              <li key={item.href}>
                                {requiresDocumentNavigation(item.href) ? (
                                  <a href={item.href} className={itemClassName} onClick={onClose}>
                                    {content}
                                  </a>
                                ) : (
                                  <Link to={item.href} className={itemClassName} onClick={onClose}>
                                    {content}
                                  </Link>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <footer className="space-y-2 border-t border-white/10 bg-[#060a11] px-4 py-4">
          <Link
            to="/performance-scanner"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/55 hover:text-cyan-200"
          >
            Free Speed Test
          </Link>
          <Link
            to="/contact"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(34,211,238,0.35)] transition hover:scale-[1.01]"
          >
            Start Your Project
            <ArrowRight size={14} />
          </Link>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href="/blog"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-300/45 hover:text-cyan-200"
            >
              <Newspaper size={13} />
              Blog
            </a>
            <Link
              to="/contact"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-300/45 hover:text-cyan-200"
            >
              <Mail size={13} />
              Contact
            </Link>
          </div>
        </footer>
      </aside>
    </>
  );
};

export default OffCanvasMenu;
