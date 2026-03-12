import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Instagram,
  Linkedin,
  Sparkles,
} from "lucide-react";
import KaizenLogo from "@/components/KaizenLogo";
import { MenuIcon, XIcon } from "@/components/icons/CriticalIcons";
import AppLink from "@/components/routing/AppLink";
import {
  dropdownTriggers,
  getDesktopMenu,
  type DesktopMenuKey,
  type MenuLink,
  type MenuSocialLink,
} from "./header-menu-data";

interface HeaderProps {
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
}

const directLinks = [{ href: "/case-studies", label: "Case Studies" }];

const panelMotion = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
};

const contentVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 24 : -24,
    y: -12,
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -16 : 16,
    y: 8,
  }),
};

const contentTransition = {
  duration: 0.18,
  ease: [0.16, 1, 0.3, 1] as const,
};

const panelLayoutTransition = {
  type: "spring" as const,
  stiffness: 320,
  damping: 32,
};

function getMenuIndex(key: DesktopMenuKey | null): number {
  if (!key) return -1;
  return dropdownTriggers.findIndex((item) => item.key === key);
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href);
}

function SocialIcon({ icon }: { icon: MenuSocialLink["icon"] }) {
  if (icon === "linkedin") {
    return <Linkedin className="h-4 w-4" />;
  }

  return <Instagram className="h-4 w-4" />;
}

function MenuAnchor({
  item,
  className,
  onClick,
  children,
}: {
  item: MenuLink;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const isExternal = item.external || isExternalHref(item.href);

  return (
    <AppLink
      href={item.href}
      onClick={onClick}
      className={className}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer" : undefined}
    >
      {children}
    </AppLink>
  );
}

const Header: React.FC<HeaderProps> = ({
  mobileMenuOpen,
  onMobileMenuChange,
}) => {
  const [activeMenu, setActiveMenu] = useState<DesktopMenuKey | null>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
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

  const setMenuWithDirection = (menu: DesktopMenuKey) => {
    const nextIndex = getMenuIndex(menu);
    const currentIndex = getMenuIndex(activeMenu);

    if (currentIndex !== -1 && nextIndex !== -1 && currentIndex !== nextIndex) {
      setTransitionDirection(nextIndex > currentIndex ? 1 : -1);
    } else if (!activeMenu) {
      setTransitionDirection(1);
    }

    setActiveMenu(menu);
  };

  const handleMenuEnter = (menu: DesktopMenuKey) => {
    clearCloseTimeout();
    setMenuWithDirection(menu);
  };

  const handleMenuClick = (menu: DesktopMenuKey) => {
    clearCloseTimeout();
    if (activeMenu === menu) {
      setActiveMenu(null);
      return;
    }
    setMenuWithDirection(menu);
  };

  const handleMenuLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 180);
  };

  const handlePanelEnter = () => clearCloseTimeout();

  const activeMenuData = activeMenu ? getDesktopMenu(activeMenu) : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-[6px] w-full max-w-[1904px] px-2 sm:px-3">
        <div ref={rootRef} className="relative">
          <div
            className="relative z-[60] flex h-16 items-center justify-between rounded-[22px] border border-black/10 bg-white px-4 pl-6 pr-4 shadow-[0_8px_24px_rgba(4,29,47,0.08)]"
            onMouseEnter={clearCloseTimeout}
            onMouseLeave={handleMenuLeave}
          >
            <AppLink
              href="/"
              aria-label="Kaizen home"
              className="flex shrink-0 items-center"
            >
              <KaizenLogo className="h-7 w-[128px] text-[#001133]" />
            </AppLink>

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

                {directLinks.map(({ href, label }) => (
                  <AppLink
                    key={href}
                    href={href}
                    onMouseEnter={() => setActiveMenu(null)}
                    className={`relative z-[1] flex items-center rounded-lg px-7 py-2 text-[16px] font-medium leading-[1.4] text-[#16181d] transition-all duration-200 ${
                      activeMenu ? "opacity-50 hover:opacity-100" : "opacity-100"
                    }`}
                  >
                    {label}
                  </AppLink>
                ))}
              </div>
            </nav>

            <div className="ml-auto flex items-center gap-2 pr-1">
              <AppLink
                href="/performance-scanner"
                className="hidden items-center gap-2 rounded-xl border border-[#c5d4f1] bg-[#f4f7fe] px-4 py-2 text-[15px] font-medium leading-[1.4] text-[#133a86] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:border-[#1764ff] hover:bg-white hover:text-[#1764ff] lg:inline-flex"
              >
                <Sparkles className="h-4 w-4" />
                Free Audit
              </AppLink>

              <AppLink
                href="/contact"
                className="hidden items-center gap-2 rounded-xl bg-[#1764ff] px-4 py-2 text-[16px] font-medium leading-[1.4] text-white transition-colors duration-200 hover:bg-[#0f53df] sm:inline-flex"
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
            {activeMenu && activeMenuData ? (
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
                  className="fixed left-0 right-0 top-[56px] z-50 hidden pt-3 before:absolute before:-top-3 before:left-0 before:right-0 before:h-5 before:content-[''] lg:block"
                  onMouseEnter={handlePanelEnter}
                  onMouseLeave={handleMenuLeave}
                >
                  <div className="mx-auto w-full max-w-[1904px] px-2 sm:px-3">
                    <div className="flex w-full items-start">
                      <motion.div
                        layout
                        transition={panelLayoutTransition}
                        className="w-full overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-[0_16px_40px_rgba(4,29,47,0.18)]"
                      >
                        <AnimatePresence mode="wait" initial={false} custom={transitionDirection}>
                          <motion.div
                            key={activeMenu}
                            custom={transitionDirection}
                            variants={contentVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={contentTransition}
                            className="flex w-full items-stretch"
                          >
                            <AppLink
                              href={activeMenuData.promo.href}
                              onClick={() => setActiveMenu(null)}
                              className="group flex w-[30%] min-w-[24rem] max-w-[29rem] shrink-0 flex-col border-r border-black/10 px-8 py-8"
                            >
                              <div className="overflow-hidden rounded-[18px] bg-[#edf2fb]">
                                {activeMenuData.promo.media.type === "video" ? (
                                  <video
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    poster={activeMenuData.promo.media.poster}
                                    className="aspect-[16/10] h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                                  >
                                    <source
                                      src={activeMenuData.promo.media.src}
                                      type="video/mp4"
                                    />
                                  </video>
                                ) : (
                                  <img
                                    src={activeMenuData.promo.media.src}
                                    alt={activeMenuData.promo.media.alt}
                                    className="aspect-[16/10] h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                )}
                              </div>

                              <div className="mt-5 space-y-2">
                                <h3 className="text-[28px] font-semibold leading-[1.08] text-[#16181d] transition-opacity duration-200 group-hover:opacity-80">
                                  {activeMenuData.promo.title}
                                </h3>
                                <p className="max-w-[34ch] text-[15px] leading-6 text-[#5a6475] transition-opacity duration-200 group-hover:opacity-80">
                                  {activeMenuData.promo.description}
                                </p>
                              </div>

                              <div className="mt-auto inline-flex items-center gap-2 pt-5 text-[15px] font-medium text-[#1764ff] transition-colors duration-200 group-hover:text-[#0f53df]">
                                {activeMenuData.promo.ctaLabel || "Explore"}
                                <ArrowRight className="h-4 w-4" />
                              </div>
                            </AppLink>

                            <div className="flex flex-1 min-w-0 items-stretch justify-between">
                              <div className="flex-none px-10 py-8">
                                <div
                                  className="grid gap-x-12 gap-y-8"
                                  style={{
                                    gridTemplateColumns: `repeat(${activeMenuData.primaryColumns.length}, minmax(220px, 252px))`,
                                  }}
                                >
                                  {activeMenuData.primaryColumns.map((column) => (
                                    <div key={column.title || column.items[0]?.href} className="min-w-0">
                                      {column.title ? (
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d7788]">
                                          {column.title}
                                        </p>
                                      ) : null}

                                      <ul className="mt-3 flex flex-col">
                                        {column.items.map((item) => (
                                          <li key={item.href}>
                                            <MenuAnchor
                                              item={item}
                                              onClick={() => setActiveMenu(null)}
                                              className="group inline-flex items-start py-[6px] text-[#16181d] transition-colors duration-200 hover:text-[#1764ff]"
                                            >
                                              <span className="mt-[11px] h-[6px] w-0 shrink-0 rounded-full bg-[#84cc16] transition-all duration-200 group-hover:mr-3 group-hover:w-5" />
                                              <span className="inline-flex items-center gap-2 text-[18px] font-medium leading-[1.5]">
                                                <span>{item.label}</span>
                                                {item.badge ? (
                                                  <span className="rounded-sm bg-[#e5f3cf] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#355413]">
                                                    {item.badge}
                                                  </span>
                                                ) : null}
                                                {(item.external || isExternalHref(item.href)) ? (
                                                  <ArrowUpRight className="h-4 w-4 text-[#73809a]" />
                                                ) : null}
                                              </span>
                                            </MenuAnchor>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="w-[240px] shrink-0 border-l border-black/10 px-8 py-8 xl:w-[272px] xl:px-9">
                                {activeMenuData.utilitySections?.length ? (
                                  <div className="space-y-7">
                                    {activeMenuData.utilitySections.map((section) => (
                                      <div key={section.title || section.items?.[0]?.href || section.socials?.[0]?.href}>
                                        {section.title ? (
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d7788]">
                                            {section.title}
                                          </p>
                                        ) : null}

                                        {section.items?.length ? (
                                          <ul className="mt-3 space-y-2">
                                            {section.items.map((item) => (
                                              <li key={item.href}>
                                                <MenuAnchor
                                                  item={item}
                                                  onClick={() => setActiveMenu(null)}
                                                  className="group inline-flex items-center gap-2 py-[3px] text-[15px] leading-7 text-[#3a4458] transition-colors duration-200 hover:text-[#1764ff]"
                                                >
                                                  <span>{item.label}</span>
                                                  {item.badge ? (
                                                    <span className="rounded-sm bg-[#e5f3cf] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#355413]">
                                                      {item.badge}
                                                    </span>
                                                  ) : null}
                                                  {(item.external || isExternalHref(item.href)) ? (
                                                    <ArrowUpRight className="h-4 w-4 text-[#73809a] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                                  ) : null}
                                                </MenuAnchor>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : null}

                                        {section.socials?.length ? (
                                          <div className="mt-3 flex flex-wrap gap-2">
                                            {section.socials.map((social) => (
                                              <AppLink
                                                key={social.href}
                                                href={social.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f5fa] text-[#33415d] transition-all duration-200 hover:bg-[#1764ff] hover:text-white"
                                                aria-label={social.label}
                                              >
                                                <SocialIcon icon={social.icon} />
                                              </AppLink>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Header;
