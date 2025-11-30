import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  buildLocalBusinessSchema,
  getPageMeta,
  SITE_NAME,
  SITE_URL,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo";
import { generateBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import OffCanvasMenu from "@/components/layout/OffCanvasMenu";

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
  const [theme, setTheme] = useState<ThemeMode>(() => getPreferredTheme());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const normalizedPath =
    location.pathname !== "/" && location.pathname.endsWith("/")
      ? location.pathname.slice(0, -1)
      : location.pathname;
  const meta = getPageMeta(normalizedPath);
  const canonicalUrlBase =
    normalizedPath === "/" ? SITE_URL : `${SITE_URL}${normalizedPath}`;
  const canonicalUrl = canonicalUrlBase.split("?")[0];
  const keywords = meta.keywords?.join(", ");
  const robotsValue = meta.noIndex ? "noindex, nofollow" : "index, follow";

  // Only render global description/keywords for primary site pages (home, services, company pages, blog index, legal pages)
  const isAdminRoute = normalizedPath.startsWith("/admin");
  const shouldRenderDescription = !isAdminRoute;

  const structuredData = buildLocalBusinessSchema(meta.description);
  const breadcrumbSchema = generateBreadcrumbSchema(normalizedPath);
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
        <link rel="preload" as="image" href={DEFAULT_OG_IMAGE} fetchpriority="high" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
        {breadcrumbSchema && (
          <script type="application/ld+json">
            {JSON.stringify(breadcrumbSchema)}
          </script>
        )}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            name: "Kaizen",
            image: "https://kaizenweb.co.uk/assets/logo.png",
            url: "https://kaizenweb.co.uk",
            telephone: "",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Liverpool",
              addressRegion: "Merseyside",
              addressCountry: "UK",
            },
            geo: {
              "@type": "GeoCoordinates",
              latitude: "53.4084",
              longitude: "-2.9916",
            },
            areaServed: [
              {
                "@type": "City",
                name: "Liverpool",
              },
              {
                "@type": "City",
                name: "Wirral",
              },
              {
                "@type": "City",
                name: "Merseyside",
              },
              {
                "@type": "City",
                name: "Chester",
              },
            ],
            priceRange: "£££",
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "Kaizen",
            url: "https://kaizenweb.co.uk",
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
              areaServed: ["Liverpool", "Wirral", "Merseyside", "Chester"],
            },
            sameAs: ["https://www.linkedin.com/company/kaizen-web"],
          })}
        </script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
        <Header
          theme={theme}
          onThemeChange={toggleTheme}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuChange={setMobileMenuOpen}
        />

        {/* Main Content */}
        <main className="flex-grow">{children}</main>

        <Footer theme={theme} />
      </div>

      <OffCanvasMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        theme={theme}
        onThemeChange={toggleTheme}
      />
    </>
  );
};

export default Layout;
