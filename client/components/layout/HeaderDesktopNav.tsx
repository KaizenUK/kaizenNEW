import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Gauge,
  Globe2,
  LifeBuoy,
  MapPin,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { ChevronDownIcon } from "@/components/icons/CriticalIcons";
import {
  getMenuData,
  type DesktopMenuKey,
  type ServiceColumn,
  type ServiceItem,
} from "./header-menu-data";
import { requiresDocumentNavigation } from "@/lib/navigation";
import AppLink from "@/components/routing/AppLink";

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

export default function HeaderDesktopNav() {
  const [activeMenu, setActiveMenu] = useState<DesktopMenuKey | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    if (activeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [activeMenu]);

  useEffect(() => {
    return () => clearCloseTimeout();
  }, [clearCloseTimeout]);

  const handleMenuEnter = (menu: DesktopMenuKey) => {
    clearCloseTimeout();
    setActiveMenu(menu);
  };

  const handleMenuClick = (menu: DesktopMenuKey) => {
    clearCloseTimeout();
    setActiveMenu((current) => (current === menu ? null : menu));
  };

  const handleMenuLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 180);
  };

  const handlePanelEnter = () => {
    clearCloseTimeout();
  };

  const activeColumns: ServiceColumn[] = activeMenu ? getMenuData(activeMenu) : [];

  const menuTriggers: { key: DesktopMenuKey; label: string }[] = [
    { key: "services", label: "Services" },
    { key: "insights", label: "Insights" },
    { key: "case-studies", label: "Case Studies" },
    { key: "about", label: "About" },
  ];

  return (
    <nav
      ref={navRef}
      className="site-header-nav relative hidden flex-1 items-center lg:flex"
      aria-label="Main navigation"
      onMouseLeave={handleMenuLeave}
      onMouseEnter={clearCloseTimeout}
    >
      <div className="flex items-center gap-1">
        {menuTriggers.map(({ key, label }) => (
          <motion.button
            key={key}
            type="button"
            onMouseEnter={() => handleMenuEnter(key)}
            onFocus={() => handleMenuEnter(key)}
            onClick={() => handleMenuClick(key)}
            whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
            transition={{ duration: 0.2 }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-150 ${
              activeMenu === key
                ? "bg-white/12 text-white"
                : "text-slate-200 hover:bg-white/8 hover:text-white"
            }`}
            aria-expanded={activeMenu === key}
          >
            {label}
            <motion.span
              animate={{ rotate: activeMenu === key ? 180 : 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className={activeMenu === key ? "text-cyan-300" : "text-slate-500"}
            >
              <ChevronDownIcon size={14} />
            </motion.span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {activeMenu && (
          <div
            className="absolute left-0 top-full z-[80] w-[min(1120px,calc(100vw-3rem))] pt-2"
            onMouseEnter={handlePanelEnter}
            onMouseLeave={handleMenuLeave}
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.985 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1019]/96 shadow-[0_30px_80px_rgba(0,0,0,0.58)] backdrop-blur-xl"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_20%,rgba(34,211,238,0.12),transparent_42%),radial-gradient(circle_at_15%_80%,rgba(59,130,246,0.1),transparent_45%)]" />
              <div className="relative p-6">
                <div
                  className={`grid gap-8 ${
                    activeMenu === "services"
                      ? "grid-cols-2"
                      : activeColumns.length > 1
                        ? "grid-cols-2"
                        : "grid-cols-1"
                  }`}
                >
                  {activeColumns.map((column, columnIndex) => (
                    <motion.section
                      key={column.title}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: columnIndex * 0.04 }}
                    >
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-slate-400">
                        {column.title}
                      </h3>
                      <ul className="space-y-2">
                        {column.items.map((item, itemIndex) => {
                          const ItemIcon = resolveItemIcon(item);
                          const itemClassName =
                            "group flex items-start gap-3 rounded-xl border border-transparent px-3 py-3 transition hover:border-white/10 hover:bg-white/[0.05]";

                          const content = (
                            <>
                              <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-200 transition-all duration-300 group-hover:scale-[1.03] group-hover:border-cyan-400/40 group-hover:text-cyan-200">
                                <ItemIcon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="flex items-center gap-2 text-sm font-semibold text-slate-100 group-hover:text-cyan-300">
                                  {item.label}
                                  <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-400 group-hover:text-slate-300">
                                  {item.description}
                                </span>
                              </span>
                            </>
                          );

                          return (
                            <motion.li
                              key={item.href}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: 0.2,
                                delay: columnIndex * 0.04 + itemIndex * 0.03,
                              }}
                            >
                              {requiresDocumentNavigation(item.href) ? (
                                <a
                                  href={item.href}
                                  className={itemClassName}
                                  onClick={() => setActiveMenu(null)}
                                >
                                  {content}
                                </a>
                              ) : (
                                <AppLink
                                  href={item.href}
                                  className={itemClassName}
                                  onClick={() => setActiveMenu(null)}
                                >
                                  {content}
                                </AppLink>
                              )}
                            </motion.li>
                          );
                        })}
                      </ul>
                    </motion.section>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.08 }}
                  className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4"
                >
                  <a
                    href="/performance-scanner"
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/55 hover:text-cyan-200"
                    onClick={() => setActiveMenu(null)}
                  >
                    <Gauge className="h-4 w-4" />
                    Free Speed Test
                  </a>
                  <AppLink
                    href="/contact"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(34,211,238,0.35)] transition hover:scale-[1.02]"
                    onClick={() => setActiveMenu(null)}
                  >
                    Start Your Project
                    <ArrowRight className="h-4 w-4" />
                  </AppLink>
                  <AppLink
                    href="/about"
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-transparent px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-300 hover:text-white"
                    onClick={() => setActiveMenu(null)}
                  >
                    <Globe2 className="h-4 w-4" />
                    About Kaizen
                  </AppLink>
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </nav>
  );
}
