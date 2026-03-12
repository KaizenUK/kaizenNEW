import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import KaizenLogo from "@/components/KaizenLogo";
import { MenuIcon, XIcon } from "@/components/icons/CriticalIcons";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import {
  getMenuData,
  type DesktopMenuKey,
  type ServiceColumn,
} from "./header-menu-data";
import { requiresDocumentNavigation } from "@/lib/navigation";
import AppLink from "@/components/routing/AppLink";

interface HeaderProps {
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
}

const promoCards: Partial<
  Record<
    DesktopMenuKey,
    {
      title: string;
      description: string;
      href: string;
      image: string;
    }
  >
> = {
  services: {
    title: "Built for speed and conversion.",
    description:
      "From custom WordPress to ecommerce delivery, we build sites that move real business metrics.",
    href: "/services/ecommerce",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F85912ce9f05a4f7cb336598a47962b01?format=webp&width=1200",
  },
  pages: {
    title: "Explore the full Kaizen site.",
    description:
      "Browse service pages, local landing pages, and the routes driving the current public site.",
    href: "/services",
    image: DEFAULT_OG_IMAGE,
  },
  insights: {
    title: "Practical notes, not filler.",
    description:
      "Read the articles shaping our delivery decisions across performance, product, and growth.",
    href: "/blog",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F2bcd66303b6e425ab616ce3ad62975b8?format=webp&width=1200",
  },
  about: {
    title: "A small team with a sharp brief.",
    description:
      "See how we work, what we value, and the standard we hold ourselves to on every build.",
    href: "/about",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fa18f81c064614dceb4a9d1fcb2c9f64b?format=webp&width=1200",
  },
};

const dropdownTriggers: Array<{ key: DesktopMenuKey; label: string }> = [
  { key: "services", label: "Services" },
  { key: "pages", label: "Pages" },
  { key: "insights", label: "Resources" },
  { key: "about", label: "Company" },
];

const directLinks = [{ href: "/case-studies", label: "Case Studies" }];

const panelMotion = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
};

const Header: React.FC<HeaderProps> = ({
  mobileMenuOpen,
  onMobileMenuChange,
}) => {
  const [activeMenu, setActiveMenu] = useState<DesktopMenuKey | null>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const navItemsRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMenu(null);
      }
    };

    if (activeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("keydown", handleEscape);
      };
    }
  }, [activeMenu]);

  useEffect(() => {
    return () => clearCloseTimeout();
  }, [clearCloseTimeout]);

  useLayoutEffect(() => {
    if (!activeMenu || !navItemsRef.current) {
      setPillStyle(null);
      return;
    }

    const trigger = navItemsRef.current.querySelector<HTMLButtonElement>(
      `[data-nav-key="${activeMenu}"]`,
    );
    if (!trigger) {
      setPillStyle(null);
      return;
    }

    const parentRect = navItemsRef.current.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    setPillStyle({
      left: triggerRect.left - parentRect.left,
      width: triggerRect.width,
    });
  }, [activeMenu]);

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

  const handlePanelEnter = () => clearCloseTimeout();

  const activeColumns: ServiceColumn[] = activeMenu
    ? getMenuData(activeMenu)
    : [];
  const promo = activeMenu ? promoCards[activeMenu] : null;
  const isShortMenu = activeColumns.length <= 1;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-[6px] w-full max-w-[1904px] px-2 sm:px-3">
        <div ref={rootRef} className="relative">
          <div
            className="relative z-[60] flex h-16 items-center justify-between rounded-2xl border border-black/10 bg-white px-4 pl-6 pr-4 shadow-[0_8px_24px_rgba(4,29,47,0.08)]"
            onMouseEnter={clearCloseTimeout}
            onMouseLeave={handleMenuLeave}
          >
            <div className="flex shrink-0 items-center gap-4">
              <AppLink
                href="/"
                aria-label="Kaizen home"
                className="flex items-center"
              >
                <KaizenLogo className="h-7 w-[128px] text-[#001133]" />
              </AppLink>
            </div>

            <nav
              className="hidden flex-1 justify-center lg:flex"
              aria-label="Main navigation"
            >
              <div ref={navItemsRef} className="relative flex items-stretch">
                {pillStyle && (
                  <motion.div
                    layoutId="sumsub-nav-pill"
                    className="absolute inset-y-[13px] rounded-lg bg-[#edf1f7]"
                    animate={{ left: pillStyle.left, width: pillStyle.width }}
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  />
                )}

                {dropdownTriggers.map(({ key, label }) => {
                  const isActive = activeMenu === key;
                  const isDimmed = Boolean(activeMenu && !isActive);

                  return (
                    <button
                      key={key}
                      type="button"
                      data-nav-key={key}
                      aria-expanded={isActive}
                      onMouseEnter={() => handleMenuEnter(key)}
                      onFocus={() => handleMenuEnter(key)}
                      onClick={() => handleMenuClick(key)}
                      className={`relative z-[1] flex items-center rounded-lg px-7 py-2 text-[16px] font-medium leading-[1.4] text-[#16181d] transition-all duration-200 ${
                        isDimmed ? "opacity-50" : "opacity-100"
                      }`}
                    >
                      <span>{label}</span>
                    </button>
                  );
                })}

                {directLinks.map(({ href, label }) => {
                  const className = `relative z-[1] flex items-center rounded-lg px-7 py-2 text-[16px] font-medium leading-[1.4] text-[#16181d] transition-all duration-200 ${
                    activeMenu ? "opacity-50 hover:opacity-100" : "opacity-100"
                  }`;

                  return (
                    <AppLink
                      key={href}
                      href={href}
                      onMouseEnter={() => setActiveMenu(null)}
                      className={className}
                    >
                      {label}
                    </AppLink>
                  );
                })}
              </div>
            </nav>

            <div className="ml-auto flex items-center gap-2 pr-1">
              <AppLink
                href="/performance-scanner"
                className="hidden rounded-xl px-3 py-2 text-[16px] font-medium leading-[1.4] text-[#16181d] transition-colors duration-200 hover:text-[#1764ff] lg:inline-flex"
              >
                Page Scanner
              </AppLink>

              <AppLink
                href="/contact"
                className="hidden items-center gap-2 rounded-xl bg-[#1764ff] px-3 py-2 text-[16px] font-medium leading-[1.4] text-white transition-colors duration-200 hover:bg-[#0f53df] sm:inline-flex"
              >
                Start Your Project
                <ArrowRight className="h-4 w-4" />
              </AppLink>

              <button
                type="button"
                className="rounded-lg p-2 text-[#16181d] transition hover:bg-[#edf1f7] lg:hidden"
                onClick={() => onMobileMenuChange(!mobileMenuOpen)}
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {activeMenu && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[5px]"
                  onClick={() => setActiveMenu(null)}
                />

                <motion.div
                  {...panelMotion}
                  className="fixed left-0 right-0 top-[69px] z-50 hidden px-2 before:absolute before:-top-4 before:left-0 before:right-0 before:h-4 before:content-[''] lg:block"
                  onMouseEnter={handlePanelEnter}
                  onMouseLeave={handleMenuLeave}
                >
                  <div className="mx-auto w-full max-w-[1904px] overflow-hidden rounded-b-2xl border border-t-0 border-black/10 bg-white shadow-[0_16px_40px_rgba(4,29,47,0.18)]">
                    <div className={`flex ${isShortMenu ? "min-h-[300px]" : "min-h-[337px]"}`}>
                      {promo && (
                        <AppLink
                          href={promo.href}
                          onClick={() => setActiveMenu(null)}
                          className={`group flex shrink-0 flex-col justify-between border-r border-black/10 ${
                            isShortMenu
                              ? "w-[30%] px-12 py-10"
                              : "w-[28.5%] px-14 py-[52px]"
                          }`}
                        >
                          <div className="space-y-6">
                            <div className="overflow-hidden rounded-lg bg-[#edf1f7]">
                              <img
                                src={promo.image}
                                alt={promo.title}
                                className="aspect-[43/22] h-auto w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                            <div className="space-y-2 text-center">
                              <h3 className="text-[28px] font-semibold leading-[1.12] text-[#16181d] transition-opacity duration-200 group-hover:opacity-70">
                                {promo.title}
                              </h3>
                              <p className="text-sm leading-[1.4] text-[#16181d]/60 transition-opacity duration-200 group-hover:opacity-40">
                                {promo.description}
                              </p>
                            </div>
                          </div>
                          <div className="mt-8 inline-flex items-center justify-center gap-2 text-[15px] font-medium text-[#1764ff] transition-colors duration-200 group-hover:text-[#0f53df]">
                            Explore
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </AppLink>
                      )}

                      <motion.div
                        key={activeMenu}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`flex flex-1 items-stretch ${
                          isShortMenu ? "pl-12" : "pl-16"
                        }`}
                      >
                        {activeColumns.map((column, index) => {
                          const isFeaturedColumn =
                            activeColumns.length > 1 && index === activeColumns.length - 1;
                          const columnClassName = isFeaturedColumn
                            ? isShortMenu
                              ? "min-w-[32%] border-l border-black/10 px-12 py-8"
                              : "min-w-[34%] border-l border-black/10 px-12 py-10"
                            : isShortMenu
                              ? "max-w-[420px] pr-10 py-8"
                              : "flex-1 pr-12 py-10";

                          return (
                            <div
                              key={column.title}
                              className={`flex flex-col ${columnClassName}`}
                            >
                              <h3 className="text-[24px] font-semibold leading-[1.12] text-[#001133] xl:text-[28px]">
                                {column.title}
                              </h3>
                              <ul className={`flex flex-col ${isShortMenu ? "mt-4" : "mt-5"}`}>
                                {column.items.map((item) => {
                                  const linkClassName = `group inline-flex items-start py-[7px] text-[16px] leading-7 text-[#16181d] transition-colors duration-200 hover:text-[#1764ff] ${
                                    isFeaturedColumn ? "text-[20px] leading-[1.45] xl:text-[24px]" : ""
                                  }`;

                                  const content = (
                                    <>
                                      <span className="inline-flex w-0 shrink-0 overflow-hidden text-[26px] leading-none text-[#34ffc2] transition-all duration-200 group-hover:mr-1 group-hover:w-4">
                                        •
                                      </span>
                                      <span className="inline-flex items-center gap-2">
                                        <span>{item.label}</span>
                                        {item.highlight ? (
                                          <span className="rounded-sm bg-[#1bedba] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#001133]">
                                            Key
                                          </span>
                                        ) : null}
                                      </span>
                                    </>
                                  );

                                  return (
                                    <li key={item.href}>
                                      {requiresDocumentNavigation(item.href) ? (
                                        <a
                                          href={item.href}
                                          className={linkClassName}
                                          onClick={() => setActiveMenu(null)}
                                        >
                                          {content}
                                        </a>
                                      ) : (
                                        <AppLink
                                          href={item.href}
                                          className={linkClassName}
                                          onClick={() => setActiveMenu(null)}
                                        >
                                          {content}
                                        </AppLink>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Header;
