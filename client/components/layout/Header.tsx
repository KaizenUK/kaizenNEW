import { Link, useLocation } from "react-router-dom";
import KaizenLogo from "@/components/KaizenLogo";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  MenuIcon,
  XIcon,
  ZapIcon,
} from "@/components/icons/CriticalIcons";
import { useEffect, useRef, useState, useCallback } from "react";
import type { DesktopMenuKey, ServiceColumn } from "./header-menu-data";

interface HeaderProps {
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
}

type HeaderMenuModule = typeof import("./header-menu-data");

const Header: React.FC<HeaderProps> = ({
  mobileMenuOpen,
  onMobileMenuChange,
}) => {
  const [activeMenu, setActiveMenu] = useState<DesktopMenuKey | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [buttonPosition, setButtonPosition] = useState(0);
  const [menuDataModule, setMenuDataModule] = useState<HeaderMenuModule | null>(
    null,
  );
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuDataPromiseRef = useRef<Promise<HeaderMenuModule> | null>(null);

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

  const loadMenuData = useCallback(() => {
    if (menuDataModule) {
      return Promise.resolve(menuDataModule);
    }

    if (!menuDataPromiseRef.current) {
      menuDataPromiseRef.current = import("./header-menu-data")
        .then((module) => {
          setMenuDataModule(module);
          return module;
        })
        .finally(() => {
          menuDataPromiseRef.current = null;
        });
    }

    return menuDataPromiseRef.current;
  }, [menuDataModule]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const preloadMenus = () => {
      void loadMenuData();
    };

    let idleId: number | null = null;
    const win = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(() => preloadMenus());
      return () => {
        if (idleId !== null && typeof win.cancelIdleCallback === "function") {
          win.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(preloadMenus, 1400);
    return () => window.clearTimeout(timeoutId);
  }, [loadMenuData]);

  const handleMenuEnter = (menu: DesktopMenuKey) => {
    clearCloseTimeout();
    setActiveMenu(menu);
    void loadMenuData();

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

  const activeColumns: ServiceColumn[] =
    activeMenu && menuDataModule ? menuDataModule.getMenuData(activeMenu) : [];

  const menuTriggers: { key: DesktopMenuKey; label: string }[] = [
    { key: "services", label: "Services" },
    { key: "insights", label: "Insights" },
    { key: "case-studies", label: "Case Studies" },
    { key: "about", label: "About" },
  ];

  return (
    <header className="site-header sticky top-0 z-50 w-full bg-white border-b border-gray-100">
      <div className="site-header-wrap max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="site-header-inner flex items-center h-16">
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
            className="site-header-nav relative hidden lg:flex items-center flex-1"
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
                  <ChevronDownIcon
                    size={14}
                    className={`transition-transform duration-200 ${
                      activeMenu === key ? "rotate-180" : ""
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Dropdown Panel Container - Stripe-style fold animation */}
            {activeMenu && (
              <div
                onMouseEnter={handlePanelEnter}
                onMouseLeave={handlePanelLeave}
                className="absolute top-full bg-white rounded-xl border border-gray-200 shadow-2xl shadow-gray-200/50 overflow-hidden transition-[opacity,transform] duration-200 ease-out opacity-100 translate-y-0"
                style={{
                  left: `${buttonPosition}px`,
                  minWidth: activeMenu === "services" ? "560px" : "320px",
                }}
              >
                <div key={activeMenu} className="p-6">
                  {menuDataModule ? (
                    <div
                      className={`grid gap-8 ${
                        activeMenu === "services"
                          ? "grid-cols-2"
                          : "grid-cols-1"
                      }`}
                    >
                      {activeColumns.map((column) => (
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
                            <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-200 mt-2">
                              <div
                                className={`h-full bg-cyan-500 transition-all duration-300 ${
                                  hoveredColumn === column.title
                                    ? "w-full"
                                    : "w-0"
                                }`}
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
                                    <ArrowRightIcon
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
                  ) : (
                    <div className="py-4 px-2 text-sm text-gray-500">
                      Loading menu...
                    </div>
                  )}
                </div>
              </div>
            )}
          </nav>

          {/* Right Actions - pushed to the right */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Free Speed Test */}
            <Link
              to="/performance-scanner"
              className="site-header-speed hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
            >
              <ZapIcon size={16} />
              Free Speed Test
            </Link>

            {/* Start Your Project - Primary CTA */}
            <Link
              to="/contact"
              className="site-header-cta hidden sm:flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Your Project
              <ArrowRightIcon size={14} />
            </Link>

            {/* Mobile Menu Button */}
            <button
              className="site-header-mobile lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              onClick={() => onMobileMenuChange(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
