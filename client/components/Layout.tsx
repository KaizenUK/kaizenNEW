import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, Moon, Sun, Linkedin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { useCalendly } from "@/context/CalendlyContext";
import {
  buildLocalBusinessSchema,
  getPageMeta,
  SITE_NAME,
  SITE_URL,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo";

interface LayoutProps {
  children: React.ReactNode;
}

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "kaizen-theme";

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getPreferredTheme());
  const [textIsDark, setTextIsDark] = useState(true);
  const { openCalendly } = useCalendly();
  const location = useLocation();
  const servicesMenuRef = useRef<HTMLDivElement>(null);
  const detectionZoneRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const normalizedPath =
    location.pathname !== "/" && location.pathname.endsWith("/")
      ? location.pathname.slice(0, -1)
      : location.pathname;
  const meta = getPageMeta(normalizedPath);
  const canonicalUrl =
    normalizedPath === "/" ? SITE_URL : `${SITE_URL}${normalizedPath}`;
  const keywords = meta.keywords?.join(", ");
  const robotsValue = meta.noIndex ? "noindex, nofollow" : "index, follow";

  // Only render global description/keywords for primary site pages (home, services, company pages, blog index, legal pages)
  const shouldRenderDescription =
    normalizedPath === "/" ||
    normalizedPath === "/about" ||
    normalizedPath === "/pledge" ||
    normalizedPath === "/case-studies" ||
    normalizedPath === "/contact" ||
    normalizedPath === "/blog" ||
    normalizedPath === "/privacy-policy" ||
    normalizedPath === "/cookie-policy" ||
    normalizedPath.startsWith("/services") ||
    normalizedPath.startsWith("/case-studies");

  const structuredData = buildLocalBusinessSchema(meta.description);
  const ogImage = meta.image ?? DEFAULT_OG_IMAGE;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.dataset.theme = theme;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        servicesMenuRef.current &&
        !servicesMenuRef.current.contains(event.target as Node)
      ) {
        setServicesOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const openServicesMenu = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    setServicesOpen(true);
  };

  const closeServicesMenu = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    setServicesOpen(false);
  };

  const scheduleCloseServicesMenu = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setServicesOpen(false);
    }, 120);
  };

  // Detect background color beneath header to adjust text color
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const detectBackgroundColor = () => {
      if (!detectionZoneRef.current) return;

      // Get the element at the position below the header
      const headerHeight = 80; // approximate header height
      const elementBelow = document.elementFromPoint(
        window.innerWidth / 2,
        headerHeight + 10,
      );

      if (elementBelow) {
        const computedStyle = window.getComputedStyle(elementBelow);
        const bgColor = computedStyle.backgroundColor;

        // Check if background is light or dark
        // Light backgrounds: white, light gray, light colors
        // Dark backgrounds: dark navy, dark gray, dark colors
        const isLightBackground =
          bgColor === "rgba(0, 0, 0, 0)" || // transparent
          bgColor.includes("rgb(255") || // white or near-white
          bgColor.includes("rgb(248") || // kaizen-light
          bgColor.includes("rgb(241") || // light grays
          bgColor.includes("rgb(242") || // light grays
          bgColor.includes("rgb(243") || // light grays
          bgColor.includes("rgb(244") || // light grays
          bgColor.includes("rgb(245") || // light grays
          bgColor.includes("rgb(246") || // light grays
          bgColor.includes("rgb(247"); // light grays

        setTextIsDark(isLightBackground);
      }
    };

    detectBackgroundColor();
    window.addEventListener("scroll", detectBackgroundColor, { passive: true });
    window.addEventListener("resize", detectBackgroundColor, { passive: true });

    return () => {
      window.removeEventListener("scroll", detectBackgroundColor);
      window.removeEventListener("resize", detectBackgroundColor);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const ThemeToggleButton = ({
    showLabel = false,
  }: {
    showLabel?: boolean;
  }) => (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={theme === "dark"}
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full border border-kaizen-light/70 bg-kaizen-light/60 px-4 py-2 text-sm font-heading font-medium text-kaizen-text-dark transition hover:border-kaizen-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kaizen-cyan dark:bg-kaizen-dark/40 dark:text-kaizen-text-light md:px-3 md:py-2"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      {showLabel && (
        <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      )}
    </button>
  );

  return (
    <>
      <Helmet key={`seo-${normalizedPath}`} prioritizeSeoTags>
        <title>{meta.title}</title>
        {shouldRenderDescription && (
          <meta name="description" content={meta.description} />
        )}
        {shouldRenderDescription && keywords && (
          <meta name="keywords" content={keywords} />
        )}
        <meta name="robots" content={robotsValue} />
        <meta name="googlebot" content={robotsValue} />
        <meta name="author" content={SITE_NAME} />
        <meta name="publisher" content={SITE_NAME} />
        <meta name="geo.region" content="GB-LIV" />
        <meta name="geo.placename" content="Liverpool" />
        <meta name="geo.position" content="53.4084;-2.9916" />
        <meta name="ICBM" content="53.4084, -2.9916" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:locale" content="en_GB" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={meta.title} />
        {shouldRenderDescription && (
          <meta property="og:description" content={meta.description} />
        )}
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />
        <meta
          property="og:image:alt"
          content="Kaizen Web - Liverpool web design agency"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:site" content="@kaizenweblpool" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "Kaizen",
            url: "https://www.kaizenweb.co.uk",
            logo: "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F19f6366118ef41298050443945090b5f?format=webp&width=800",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Liverpool",
              addressRegion: "Merseyside",
              addressCountry: "GB",
            },
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "Customer Support",
              email: "hello@kaizenweb.co.uk",
              areaServed: ["Liverpool", "Wirral"],
            },
            sameAs: ["https://www.linkedin.com/company/kaizen-web"],
          })}
        </script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
        {/* Header - Frosted Glass Effect */}
        <header
          className="sticky top-0 z-40 border-b"
          style={{
            backgroundColor:
              theme === "light"
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(15, 23, 42, 0.05)",
            backdropFilter: "blur(10px)",
            borderBottomColor:
              theme === "light"
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(255, 255, 255, 0.1)",
          }}
        >
          <nav className="container mx-auto px-4 py-3 flex items-center justify-between relative">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition flex-shrink-0"
            >
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F19f6366118ef41298050443945090b5f?format=webp&width=800"
                alt="Kaizen Web"
                className="h-28 w-auto block dark:hidden"
              />
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F715c7d8a24dc4f2ca2fb16b61ba3dd19?format=webp&width=800"
                alt="Kaizen Web - dark"
                className="h-28 w-auto hidden dark:block"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className={`px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50 dark:hover:bg-white/5 ${
                  textIsDark
                    ? "text-kaizen-dark dark:text-white"
                    : "text-white dark:text-white"
                }`}
              >
                Home
              </Link>

              {/* Services Mega Menu - Relative Container */}
              <div
                className="relative"
                ref={servicesMenuRef}
                onPointerEnter={openServicesMenu}
                onPointerLeave={scheduleCloseServicesMenu}
                onFocusCapture={openServicesMenu}
                onBlurCapture={(event) => {
                  const nextFocus = event.relatedTarget as Node | null;

                  if (
                    servicesMenuRef.current &&
                    (!nextFocus || !servicesMenuRef.current.contains(nextFocus))
                  ) {
                    scheduleCloseServicesMenu();
                  }
                }}
              >
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={servicesOpen}
                  aria-controls="services-menu"
                  onClick={() => setServicesOpen((prev) => !prev)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      closeServicesMenu();
                    }

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      openServicesMenu();
                      const firstLink =
                        servicesMenuRef.current?.querySelector<HTMLAnchorElement>(
                          "#services-menu a",
                        );
                      firstLink?.focus();
                    }
                  }}
                  className={`px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50 dark:hover:bg-white/5 flex items-center gap-1 ${
                    textIsDark
                      ? "text-kaizen-dark dark:text-white"
                      : "text-white dark:text-white"
                  }`}
                >
                  Services
                  <ChevronDown
                    size={16}
                    className={`transition ${servicesOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Mega Menu Panel */}
                <AnimatePresence>
                  {servicesOpen && (
                    <motion.div
                      id="services-menu"
                      role="menu"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-0 z-50 min-w-max bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-kaizen-light/20 dark:border-white/10 overflow-hidden"
                      style={{
                        backdropFilter: "blur(10px)",
                      }}
                    >
                      <div className="p-8 min-w-[600px]">
                        <div className="grid grid-cols-2 gap-12">
                          {/* Column 1: Web & SEO */}
                          <div>
                            <p className="text-xs font-mono text-kaizen-text-dark/60 dark:text-white/60 font-bold mb-6 tracking-widest">
                              WEB & SEO
                            </p>

                            <div className="space-y-6">
                              <Link
                                to="/services/web-design-liverpool"
                                role="menuitem"
                                className="block font-heading font-bold text-base text-kaizen-dark dark:text-white hover:text-kaizen-cyan dark:hover:text-kaizen-cyan transition"
                              >
                                Web Design Liverpool
                              </Link>

                              <Link
                                to="/services/wordpress-web-design"
                                role="menuitem"
                                className="block font-heading font-bold text-base text-kaizen-dark dark:text-white hover:text-kaizen-cyan dark:hover:text-kaizen-cyan transition"
                              >
                                WordPress Design
                              </Link>

                              <Link
                                to="/services/ecommerce"
                                role="menuitem"
                                className="block font-heading font-bold text-base text-kaizen-dark dark:text-white hover:text-kaizen-cyan dark:hover:text-kaizen-cyan transition"
                              >
                                E-commerce Development
                              </Link>

                              <Link
                                to="/services/local-seo"
                                role="menuitem"
                                className="block font-heading font-bold text-base text-kaizen-dark dark:text-white hover:text-kaizen-cyan dark:hover:text-kaizen-cyan transition"
                              >
                                Local SEO
                              </Link>
                            </div>
                          </div>

                          {/* Column 2: Agile & Transformation */}
                          <div>
                            <p className="text-xs font-mono text-kaizen-text-dark/60 dark:text-white/60 font-bold mb-6 tracking-widest">
                              AGILE & TRANSFORMATION
                            </p>

                            <div className="space-y-6">
                              <Link
                                to="/services/digital-transformation"
                                role="menuitem"
                                className="block font-heading font-bold text-base text-kaizen-dark dark:text-white hover:text-kaizen-cyan dark:hover:text-kaizen-cyan transition"
                              >
                                Digital Transformation
                              </Link>

                              <Link
                                to="/agile-coaching"
                                role="menuitem"
                                className="block font-heading font-bold text-base text-kaizen-dark dark:text-white hover:text-kaizen-cyan dark:hover:text-kaizen-cyan transition"
                              >
                                Agile Coaching
                              </Link>

                              <Link
                                to="/contract-product-owner"
                                role="menuitem"
                                className="block font-heading font-bold text-base text-kaizen-dark dark:text-white hover:text-kaizen-cyan dark:hover:text-kaizen-cyan transition flex items-center gap-2"
                              >
                                Contract Product Owner
                                <span className="inline-block px-2 py-1 bg-kaizen-cyan/20 text-kaizen-cyan text-xs font-bold rounded">
                                  Founder-Led
                                </span>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link
                to="/about"
                className={`px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50 dark:hover:bg-white/5 ${
                  textIsDark
                    ? "text-kaizen-dark dark:text-white"
                    : "text-white dark:text-white"
                }`}
              >
                About
              </Link>

              <Link
                to="/pledge"
                className={`px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50 dark:hover:bg-white/5 ${
                  textIsDark
                    ? "text-kaizen-dark dark:text-white"
                    : "text-white dark:text-white"
                }`}
              >
                Our Pledge
              </Link>

              <Link
                to="/case-studies"
                className={`px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50 dark:hover:bg-white/5 ${
                  textIsDark
                    ? "text-kaizen-dark dark:text-white"
                    : "text-white dark:text-white"
                }`}
              >
                Case Studies
              </Link>

              <Link
                to="/blog"
                className={`px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50 dark:hover:bg-white/5 ${
                  textIsDark
                    ? "text-kaizen-dark dark:text-white"
                    : "text-white dark:text-white"
                }`}
              >
                Blog
              </Link>
            </div>

            {/* CTA, Theme Toggle, and Mobile Button */}
            <div className="flex items-center gap-4">
              <div className="hidden md:block">
                <ThemeToggleButton />
              </div>
              <div className="md:hidden">
                <ThemeToggleButton />
              </div>

              {/* Animated CTA Button */}
              <motion.button
                onClick={openCalendly}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                whileHover={{ scale: 1.05 }}
                className="hidden sm:inline-block px-6 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold text-lg relative overflow-hidden group transition"
              >
                <span className="relative z-10">Book a 15-Min Call</span>
                <div className="absolute inset-0 bg-gradient-to-r from-kaizen-lime to-kaizen-cyan opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </motion.button>

              {/* Mobile Menu Button */}
              <button
                className={`md:hidden font-heading font-bold transition ${
                  textIsDark
                    ? "text-kaizen-dark dark:text-white"
                    : "text-white dark:text-white"
                }`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </nav>

          {/* Detection zone for background color */}
          <div
            ref={detectionZoneRef}
            className="absolute pointer-events-none"
          />

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-kaizen-light/20 dark:border-white/10 bg-kaizen-light/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="container mx-auto px-4 py-4 space-y-2">
                <Link
                  to="/"
                  className="block px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>

                <button
                  onClick={() => setServicesOpen(!servicesOpen)}
                  className="w-full text-left px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light flex items-center gap-2"
                >
                  Services
                  <ChevronDown
                    size={16}
                    className={`transition ${servicesOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {servicesOpen && (
                  <div className="ml-4 space-y-2 border-l border-kaizen-light pl-4">
                    <Link
                      to="/services/web-design-liverpool"
                      className="block text-lg text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setServicesOpen(false);
                      }}
                    >
                      Web Design
                    </Link>
                    <Link
                      to="/services/local-seo"
                      className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setServicesOpen(false);
                      }}
                    >
                      Local SEO
                    </Link>
                    <Link
                      to="/services/ecommerce"
                      className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setServicesOpen(false);
                      }}
                    >
                      E-commerce
                    </Link>
                    <Link
                      to="/services/digital-transformation"
                      className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setServicesOpen(false);
                      }}
                    >
                      Digital Transformation
                    </Link>
                    <Link
                      to="/agile-coaching"
                      className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setServicesOpen(false);
                      }}
                    >
                      Agile Coaching
                    </Link>
                    <Link
                      to="/contract-product-owner"
                      className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setServicesOpen(false);
                      }}
                    >
                      Contract Product Owner
                    </Link>
                  </div>
                )}

                <Link
                  to="/about"
                  className="block px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About
                </Link>

                <Link
                  to="/pledge"
                  className="block px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Our Pledge
                </Link>

                <Link
                  to="/case-studies"
                  className="block px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Case Studies
                </Link>

                <Link
                  to="/blog"
                  className="block px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Blog
                </Link>

                <button
                  onClick={() => {
                    openCalendly();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full mt-4 px-6 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold text-lg hover:opacity-90 transition"
                >
                  Book a 15-Min Call
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-grow">{children}</main>

        {/* Footer */}
        <footer className="bg-kaizen-dark text-kaizen-text-light border-t border-kaizen-text-dark/10">
          <div className="container mx-auto px-4 py-16">
            {/* 3-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
              {/* Column 1: Brand & USP */}
              <div>
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F6ca2caa53229445d9a63b2ab64bfede4?format=webp&width=800"
                  alt="Kaizen Web"
                  className="h-32 w-auto mb-6"
                />
                <p className="text-lg text-kaizen-text-light/80 mb-6 leading-relaxed">
                  A Liverpool web design & digital transformation agency. We're
                  an expert-led team built on transparency, performance, and
                  real-world results.
                </p>
                <div className="flex gap-4">
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-kaizen-text-light/60 hover:text-kaizen-cyan transition"
                    aria-label="LinkedIn"
                  >
                    <Linkedin size={20} />
                  </a>
                </div>
              </div>

              {/* Column 2: Company Navigation */}
              <div>
                <h4 className="font-heading font-bold text-lg mb-6">Company</h4>
                <ul className="space-y-3">
                  <li>
                    <Link
                      to="/about"
                      className="text-kaizen-text-light/80 hover:text-kaizen-cyan transition"
                    >
                      About
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pledge"
                      className="text-kaizen-text-light/80 hover:text-kaizen-cyan transition"
                    >
                      Our "No-BS" Pledge
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/case-studies"
                      className="text-kaizen-text-light/80 hover:text-kaizen-cyan transition"
                    >
                      Case Studies
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/blog"
                      className="text-kaizen-text-light/80 hover:text-kaizen-cyan transition"
                    >
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/contact"
                      className="text-kaizen-text-light/80 hover:text-kaizen-cyan transition"
                    >
                      Contact
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Column 3: Services */}
              <div>
                <h4 className="font-heading font-bold text-lg mb-6">
                  Services
                </h4>
                <ul className="space-y-3">
                  <li>
                    <Link
                      to="/services/web-design-liverpool"
                      className="text-kaizen-text-light/80 hover:text-kaizen-cyan transition"
                    >
                      Web Design Liverpool
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/services/local-seo"
                      className="text-kaizen-text-light/80 hover:text-kaizen-cyan transition"
                    >
                      Local SEO
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/services/ecommerce"
                      className="text-kaizen-text-light/80 hover:text-kaizen-cyan transition"
                    >
                      E-commerce
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/agile-coaching"
                      className="text-kaizen-text-light/80 hover:text-kaizen-cyan transition"
                    >
                      Agile Coaching
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/contract-product-owner"
                      className="text-kaizen-text-light/80 hover:text-kaizen-cyan transition"
                    >
                      Contract Product Owner
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Sub-Footer */}
            <div className="border-t border-kaizen-text-dark/10 pt-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <p className="text-sm text-kaizen-text-light/60">
                  © {new Date().getFullYear()} Kaizen Web. All rights reserved.
                </p>
                <p className="text-sm text-kaizen-text-light/60">
                  Liverpool & Wirral, UK
                </p>
                <div className="flex gap-6">
                  <Link
                    to="/privacy-policy"
                    className="text-sm text-kaizen-text-light/60 hover:text-kaizen-cyan transition"
                  >
                    Privacy Policy
                  </Link>
                  <span className="text-kaizen-text-light/30">|</span>
                  <Link
                    to="/cookie-policy"
                    className="text-sm text-kaizen-text-light/60 hover:text-kaizen-cyan transition"
                  >
                    Cookie Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Layout;
