import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  getMenuData,
  type DesktopMenuKey,
  type ServiceColumn,
} from "./header-menu-data";
import { requiresDocumentNavigation } from "@/lib/navigation";
import AppLink from "@/components/routing/AppLink";

/** Sumsub-style nav: floating container, plain text triggers, mega-menu with promo card */
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
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
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
    }, 200);
  };

  const handlePanelEnter = () => clearCloseTimeout();

  const activeColumns: ServiceColumn[] = activeMenu
    ? getMenuData(activeMenu)
    : [];

  // Sumsub pattern: multiple dropdown menus — plain text, no chevrons
  const dropdownTriggers: { key: DesktopMenuKey; label: string }[] = [
    { key: "services", label: "Services" },
    { key: "insights", label: "Resources" },
    { key: "about", label: "Company" },
  ];

  // Direct links (no dropdown)
  const directLinks: { href: string; label: string }[] = [
    { href: "/case-studies", label: "Case Studies" },
  ];

  // Promo card config per menu
  const promoCards: Partial<
    Record<
      DesktopMenuKey,
      { title: string; description: string; href: string; cta: string }
    >
  > = {
    services: {
      title: "Not sure where to start?",
      description:
        "Run our free performance audit and get a clear picture of what needs fixing.",
      href: "/performance-scanner",
      cta: "Free Site Audit",
    },
    insights: {
      title: "Latest from the blog",
      description:
        "Practical guides on web performance, design, and digital strategy.",
      href: "/blog",
      cta: "Read the Blog",
    },
    about: {
      title: "Let's talk",
      description:
        "Whether you need a new site or help rescuing an existing one, we're here.",
      href: "/contact",
      cta: "Get in Touch",
    },
  };

  const promo = activeMenu ? promoCards[activeMenu] : null;

  return (
    <nav
      ref={navRef}
      className="relative hidden items-center lg:flex"
      aria-label="Main navigation"
      onMouseLeave={handleMenuLeave}
      onMouseEnter={clearCloseTimeout}
    >
      {/* Nav triggers — plain text, no chevrons (Sumsub style) */}
      <div className="flex items-center gap-0.5">
        {dropdownTriggers.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onMouseEnter={() => handleMenuEnter(key)}
            onFocus={() => handleMenuEnter(key)}
            onClick={() => handleMenuClick(key)}
            className={`px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
              activeMenu === key
                ? "text-white"
                : "text-slate-400 hover:text-white"
            }`}
            aria-expanded={activeMenu === key}
          >
            {label}
          </button>
        ))}

        {directLinks.map(({ href, label }) => (
          <AppLink
            key={href}
            href={href}
            className="px-3 py-1.5 text-[13px] font-medium text-slate-400 transition-colors duration-150 hover:text-white"
          >
            {label}
          </AppLink>
        ))}
      </div>

      {/* Mega-menu dropdown — anchored below the floating container */}
      <AnimatePresence>
        {activeMenu && (
          <div
            className="fixed left-0 right-0 top-[76px] z-50"
            onMouseEnter={handlePanelEnter}
            onMouseLeave={handleMenuLeave}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 top-[76px] bg-black/30"
              onClick={() => setActiveMenu(null)}
            />

            {/* Panel — rounded to match floating container */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative mx-auto max-w-[1440px] px-4 lg:px-6"
            >
              <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0a0f1a] shadow-[0_32px_80px_rgba(0,0,0,0.5)]">
                <div className="flex">
                  {/* Left — Promo card (Sumsub has a video here, we use a gradient card) */}
                  {promo && (
                    <div className="hidden w-72 shrink-0 border-r border-white/6 bg-linear-to-br from-[#0f172a] to-[#0a1628] p-6 lg:flex lg:flex-col lg:justify-between">
                      <div>
                        <h3 className="mb-2 text-[15px] font-semibold text-white">
                          {promo.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-slate-400">
                          {promo.description}
                        </p>
                      </div>
                      <AppLink
                        href={promo.href}
                        onClick={() => setActiveMenu(null)}
                        className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-[#06b6d4] transition hover:text-white"
                      >
                        {promo.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </AppLink>
                    </div>
                  )}

                  {/* Right — Text-only link columns */}
                  <div className="flex-1 p-6">
                    <div
                      className={`grid gap-8 ${
                        activeColumns.length >= 3
                          ? "grid-cols-3"
                          : activeColumns.length === 2
                            ? "grid-cols-2"
                            : "grid-cols-1 max-w-sm"
                      }`}
                    >
                      {activeColumns.map((column) => (
                        <div key={column.title}>
                          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                            {column.title}
                          </h3>
                          <ul className="space-y-0.5">
                            {column.items.map((item) => {
                              const cls =
                                "block rounded-lg px-2 py-1.5 text-[14px] font-medium text-slate-300 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white";

                              return (
                                <li key={item.href}>
                                  {requiresDocumentNavigation(item.href) ? (
                                    <a
                                      href={item.href}
                                      className={cls}
                                      onClick={() => setActiveMenu(null)}
                                    >
                                      {item.label}
                                    </a>
                                  ) : (
                                    <AppLink
                                      href={item.href}
                                      className={cls}
                                      onClick={() => setActiveMenu(null)}
                                    >
                                      {item.label}
                                    </AppLink>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </nav>
  );
}
