import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  buildLocalBusinessSchema,
  getPageMeta,
  SITE_NAME,
  SITE_URL,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

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
        {shouldRenderDescription && (
          <meta name="twitter:description" content={meta.description} />
        )}
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
        <Header theme={theme} onThemeChange={toggleTheme} />

        {/* Main Content */}
        <main className="flex-grow">{children}</main>

        <Footer theme={theme} />
      </div>
    </>
  );
};

export default Layout;
