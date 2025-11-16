import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
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
  const location = useLocation();
  const normalizedPath =
    location.pathname !== "/" && location.pathname.endsWith("/")
      ? location.pathname.slice(0, -1)
      : location.pathname;
  const meta = getPageMeta(normalizedPath);
  const canonicalUrl =
    normalizedPath === "/" ? SITE_URL : `${SITE_URL}${normalizedPath}`;
  const keywords = meta.keywords?.join(", ");
  const robotsValue = meta.noIndex ? "noindex, nofollow" : "index, follow";
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

  // Scroll to top on route change
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const ThemeToggleButton = ({ showLabel = false }: { showLabel?: boolean }) => (
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
      <Helmet prioritizeSeoTags>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        {keywords && <meta name="keywords" content={keywords} />}
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
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />
        <meta
          property="og:image:alt"
          content="Kaizen Web - Liverpool web design agency"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:site" content="@kaizenweblpool" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur transition-colors">
        <nav className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-80 transition flex-shrink-0"
          >
            {/* Light mode logo */}
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F19f6366118ef41298050443945090b5f?format=webp&width=800"
              alt="Kaizen Web"
              className="h-28 w-auto block dark:hidden"
            />
            {/* Dark mode logo (attached asset) */}
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
              className="px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50"
            >
              Home
            </Link>

            {/* Services Mega Menu */}
            <div
              className="relative"
              onMouseEnter={() => setServicesOpen(true)}
              onMouseLeave={() => setServicesOpen(false)}
            >
              <button className="px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50 flex items-center gap-1">
                Services
                <ChevronDown
                  size={16}
                  className={`transition ${servicesOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Mega Menu Panel */}
              {servicesOpen && (
                <div className="absolute left-0 top-full mt-0 w-screen border-t border-border bg-card shadow-lg transition-colors">
                  <div className="container mx-auto px-4 py-8">
                    <div className="grid grid-cols-3 gap-8">
                      {/* Web Services */}
                      <div>
                        <p className="text-xs font-mono text-kaizen-text-dark/50 font-bold mb-4 tracking-widest">
                          WEB & DESIGN
                        </p>

                        <div className="mb-6">
                          <Link
                            to="/services/web-design"
                            className="block font-heading font-bold text-lg mb-2 hover:text-kaizen-cyan transition"
                          >
                            Web Design
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70 ml-0">
                            <li>Fast, modern websites</li>
                            <li>Mobile-first design</li>
                            <li>SEO-ready structure</li>
                          </ul>
                        </div>

                        <div>
                          <Link
                            to="/services/local-seo"
                            className="block font-heading font-bold text-lg mb-2 hover:text-kaizen-cyan transition"
                          >
                            Local SEO
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70">
                            <li>Google Business Profile</li>
                            <li>Local search ranking</li>
                            <li>Review strategy</li>
                          </ul>
                        </div>
                      </div>

                      {/* E-commerce & Transformation */}
                      <div>
                        <p className="text-xs font-mono text-kaizen-text-dark/50 font-bold mb-4 tracking-widest">
                          OPERATIONS
                        </p>

                        <div className="mb-6">
                          <Link
                            to="/services/ecommerce"
                            className="block font-heading font-bold text-lg mb-2 hover:text-kaizen-cyan transition"
                          >
                            E-commerce
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70">
                            <li>Online stores</li>
                            <li>Payment integration</li>
                            <li>Conversion optimized</li>
                          </ul>
                        </div>

                        <div>
                          <Link
                            to="/services/digital-transformation"
                            className="block font-heading font-bold text-lg mb-2 hover:text-kaizen-cyan transition"
                          >
                            Digital Transformation
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70">
                            <li>Workflow automation</li>
                            <li>Process optimization</li>
                            <li>Back-office systems</li>
                          </ul>
                        </div>
                      </div>

                      {/* Team & Product */}
                      <div>
                        <p className="text-xs font-mono text-kaizen-text-dark/50 font-bold mb-4 tracking-widest">
                          TEAMS & PRODUCT
                        </p>

                        <div className="mb-6">
                          <Link
                            to="/agile-coaching"
                            className="block font-heading font-bold text-lg mb-2 hover:text-kaizen-cyan transition"
                          >
                            Agile Coaching
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70">
                            <li>Team training</li>
                            <li>Sprint coaching</li>
                            <li>Process review</li>
                          </ul>
                        </div>

                        <div>
                          <Link
                            to="/contract-product-owner"
                            className="block font-heading font-bold text-lg mb-2 hover:text-kaizen-cyan transition"
                          >
                            Contract Product Owner
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70">
                            <li>Strategic roadmap</li>
                            <li>Hands-on leadership</li>
                            <li>High-stakes delivery</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link
              to="/about"
              className="px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50"
            >
              About
            </Link>

            <Link
              to="/pledge"
              className="px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50"
            >
              Our Pledge
            </Link>

            <Link
              to="/case-studies"
              className="px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50"
            >
              Case Studies
            </Link>

            <Link
              to="/blog"
              className="px-3 py-2 text-lg font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50"
            >
              Blog
            </Link>

          </div>

          {/* CTA, Theme Toggle, and Mobile Button */}
          <div className="flex items-center gap-4">
            {/* Desktop theme toggle */}
            <div className="hidden md:block">
              <ThemeToggleButton />
            </div>
            <div className="md:hidden">
              <ThemeToggleButton />
            </div>
            <Link
              to="/contact"
              className="hidden sm:inline-block px-6 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-white font-heading font-medium text-lg hover:opacity-90 transition"
            >
              Get a Quote
            </Link>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card transition-colors">
            <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
              <Link
                to="/"
                className="text-lg font-heading font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <button
                onClick={() => setServicesOpen(!servicesOpen)}
                className="text-left text-lg font-heading font-medium hover:text-kaizen-cyan transition flex items-center gap-2"
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
                    to="/services/web-design"
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
                className="text-lg font-heading font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/case-studies"
                className="text-lg font-heading font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Case Studies
              </Link>
              <Link
                to="/blog"
                className="text-lg font-heading font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Blog
              </Link>
              <Link
                to="/contact"
                className="px-6 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-white font-heading font-medium text-sm hover:opacity-90 transition w-full text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get a Quote
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">{children}</main>

      {/* Footer */}
      <footer className="bg-kaizen-dark text-kaizen-text-light border-t border-kaizen-text-dark/10">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
            {/* Brand */}
            <div>
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F6ca2caa53229445d9a63b2ab64bfede4?format=webp&width=800"
                alt="Kaizen Web"
                className="h-16 w-auto mb-4"
              />
              <p className="text-sm text-kaizen-text-light/80">
                Web design and digital transformation for Liverpool businesses.
              </p>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-heading font-bold text-sm mb-4">Services</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/services"
                    className="hover:text-kaizen-cyan transition"
                  >
                    All Services
                  </Link>
                </li>
                <li>
                  <Link
                    to="/services/web-design"
                    className="hover:text-kaizen-cyan transition"
                  >
                    Web Design
                  </Link>
                </li>
                <li>
                  <Link
                    to="/services/local-seo"
                    className="hover:text-kaizen-cyan transition"
                  >
                    Local SEO
                  </Link>
                </li>
                <li>
                  <Link
                    to="/agile-coaching"
                    className="hover:text-kaizen-cyan transition"
                  >
                    Agile Coaching
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-heading font-bold text-sm mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/about"
                    className="hover:text-kaizen-cyan transition"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    to="/case-studies"
                    className="hover:text-kaizen-cyan transition"
                  >
                    Case Studies
                  </Link>
                </li>
                <li>
                  <Link
                    to="/blog"
                    className="hover:text-kaizen-cyan transition"
                  >
                    Journal
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="hover:text-kaizen-cyan transition"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-heading font-bold text-sm mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/privacy-policy"
                    className="hover:text-kaizen-cyan transition"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/gdpr-policy"
                    className="hover:text-kaizen-cyan transition"
                  >
                    GDPR Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-heading font-bold text-sm mb-4">
                Get in Touch
              </h4>
              <p className="text-sm text-kaizen-text-light/80 mb-2">
                Liverpool, UK
              </p>
              <Link
                to="/contact"
                className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-medium text-sm hover:opacity-90 transition"
              >
                Request a Quote
              </Link>
            </div>
          </div>

          <div className="border-t border-kaizen-text-dark/10 pt-8">
            <p className="text-sm text-kaizen-text-light/60 text-center">
              © {new Date().getFullYear()} Kaizen Web. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
};

export default Layout;
