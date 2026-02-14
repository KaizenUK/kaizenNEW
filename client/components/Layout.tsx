import { Suspense, lazy, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "@/lib/helmet";
import {
  buildLocalBusinessSchema,
  getPageMeta,
  SITE_NAME,
  SITE_URL,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo";
import { generateBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import Header from "@/components/layout/Header";
import { isReactSnapPrerender } from "@/lib/prerender";

const Footer = lazy(() => import("@/components/layout/Footer"));
const OffCanvasMenu = lazy(() => import("@/components/layout/OffCanvasMenu"));

interface LayoutProps {
  children: React.ReactNode;
  metaOverride?: {
    title?: string;
    description?: string;
    canonicalUrl?: string;
    image?: string;
    noIndex?: boolean;
  };
}

const Layout: React.FC<LayoutProps> = ({ children, metaOverride }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasOpenedMobileMenu, setHasOpenedMobileMenu] = useState(false);
  const [shouldRenderFooter, setShouldRenderFooter] = useState(false);
  const location = useLocation();

  const normalizedPath =
    location.pathname !== "/" && location.pathname.endsWith("/")
      ? location.pathname.slice(0, -1)
      : location.pathname;
  const meta = getPageMeta(normalizedPath);
  const canonicalUrlBase =
    normalizedPath === "/" ? SITE_URL : `${SITE_URL}${normalizedPath}`;
  const canonicalUrl = (metaOverride?.canonicalUrl || canonicalUrlBase).split(
    "?",
  )[0];
  const keywords = meta.keywords?.join(", ");
  const robotsValue =
    metaOverride?.noIndex || meta.noIndex
      ? "noindex, nofollow"
      : "index, follow";

  const breadcrumbSchema = generateBreadcrumbSchema(normalizedPath);
  const effectiveTitle = metaOverride?.title || meta.title;
  const effectiveDescription = metaOverride?.description || meta.description;
  const ogImage = metaOverride?.image || meta.image || DEFAULT_OG_IMAGE;

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    setHasOpenedMobileMenu(true);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isReactSnapPrerender()) return;

    const loadFooter = () => setShouldRenderFooter(true);
    let idleId: number | null = null;
    const win = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(() => loadFooter());
      return () => {
        if (idleId !== null && typeof win.cancelIdleCallback === "function") {
          win.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(loadFooter, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <>
      <Helmet key={`seo-${normalizedPath}`} prioritizeSeoTags>
        <title>{effectiveTitle}</title>
        <meta name="description" content={effectiveDescription} />
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
        <meta property="og:title" content={effectiveTitle} />
        <meta property="og:description" content={effectiveDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />
        <meta
          property="og:image:alt"
          content="Kaizen Web - Liverpool web design agency"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={effectiveTitle} />
        <meta name="twitter:description" content={effectiveDescription} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:site" content="@kaizenweblpool" />
        <script type="application/ld+json">
          {JSON.stringify(
            buildLocalBusinessSchema(effectiveDescription || meta.description),
          )}
        </script>
        {breadcrumbSchema && (
          <script type="application/ld+json">
            {JSON.stringify(breadcrumbSchema)}
          </script>
        )}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "@id": "https://kaizenweb.co.uk/#organization",
            name: "Kaizen Web",
            alternateName: "Kaizen",
            url: "https://kaizenweb.co.uk",
            logo: {
              "@type": "ImageObject",
              url: "https://kaizenweb.co.uk/logo.svg",
              width: 500,
              height: 150,
            },
            image: ogImage,
            description:
              "Fast web design for Wirral and Liverpool businesses. Custom websites from £2k with 2-4 week turnaround.",
            priceRange: "££",
            telephone: "+44 151 808 1100",
            email: "hello@kaizenweb.co.uk",
            address: {
              "@type": "PostalAddress",
              streetAddress: "44 Simpson Street",
              addressLocality: "Liverpool",
              addressRegion: "Merseyside",
              postalCode: "L1 0AX",
              addressCountry: "GB",
            },
            geo: {
              "@type": "GeoCoordinates",
              latitude: 53.4084,
              longitude: -2.9916,
            },
            areaServed: [
              {
                "@type": "City",
                name: "Wirral",
              },
              {
                "@type": "City",
                name: "Liverpool",
              },
              {
                "@type": "City",
                name: "Chester",
              },
              {
                "@type": "AdministrativeArea",
                name: "Merseyside",
              },
            ],
            openingHoursSpecification: [
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: [
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                ],
                opens: "09:00",
                closes: "18:00",
              },
            ],
            sameAs: [
              "https://www.linkedin.com/company/kaizen-web",
              "https://www.instagram.com/kaizenwebliverpool",
              "https://twitter.com/kaizenweblpool",
            ],
            foundingDate: "2020",
          })}
        </script>
      </Helmet>

      <div className="site-shell min-h-screen flex flex-col bg-background text-foreground transition-colors">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuChange={setMobileMenuOpen}
        />

        {/* Main Content */}
        <main className="flex-grow">{children}</main>

        {shouldRenderFooter ? (
          <Suspense
            fallback={<div className="min-h-[420px]" aria-hidden="true" />}
          >
            <Footer />
          </Suspense>
        ) : (
          <div className="min-h-[420px]" aria-hidden="true" />
        )}
      </div>

      {mobileMenuOpen || hasOpenedMobileMenu ? (
        <Suspense fallback={null}>
          <OffCanvasMenu
            isOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
};

export default Layout;
