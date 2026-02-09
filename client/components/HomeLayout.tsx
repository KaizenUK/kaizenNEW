import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Header from "@/components/layout/Header";

const Footer = lazy(() => import("@/components/layout/Footer"));
const OffCanvasMenu = lazy(() => import("@/components/layout/OffCanvasMenu"));

interface HomeLayoutProps {
  children: ReactNode;
}

const HOME_URL = "https://kaizenweb.co.uk";
const HOME_TITLE = "Web Design Liverpool & Wirral | Fast Custom Sites | Kaizen";
const HOME_DESCRIPTION =
  "We build fast websites for Liverpool & Wirral businesses. GBP2k-GBP15k, 2-4 week turnaround. No WordPress bloat. Just speed and leads.";
const HOME_OG_IMAGE =
  "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F094cdc9be84c41ee9db80308cbe5ea73?format=webp&width=1200&height=630";

const HomeLayout = ({ children }: HomeLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasOpenedMobileMenu, setHasOpenedMobileMenu] = useState(false);
  const [shouldRenderFooter, setShouldRenderFooter] = useState(false);
  const location = useLocation();

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
      <Helmet key="seo-home" prioritizeSeoTags>
        <title>{HOME_TITLE}</title>
        <meta name="description" content={HOME_DESCRIPTION} />
        <meta name="robots" content="index, follow" />
        <meta name="googlebot" content="index, follow" />
        <meta name="author" content="Kaizen Web" />
        <meta name="publisher" content="Kaizen Web" />
        <link rel="canonical" href={HOME_URL} />
        <meta property="og:locale" content="en_GB" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kaizen Web" />
        <meta property="og:title" content={HOME_TITLE} />
        <meta property="og:description" content={HOME_DESCRIPTION} />
        <meta property="og:url" content={HOME_URL} />
        <meta property="og:image" content={HOME_OG_IMAGE} />
        <meta
          property="og:image:alt"
          content="Kaizen Web - Liverpool web design agency"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={HOME_TITLE} />
        <meta name="twitter:description" content={HOME_DESCRIPTION} />
        <meta name="twitter:image" content={HOME_OG_IMAGE} />
        <meta name="twitter:site" content="@kaizenweblpool" />
      </Helmet>

      <div className="site-shell min-h-screen flex flex-col bg-background text-foreground transition-colors">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuChange={setMobileMenuOpen}
        />

        <main className="flex-grow">{children}</main>

        {shouldRenderFooter ? (
          <Suspense fallback={<div className="min-h-[420px]" aria-hidden="true" />}>
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

export default HomeLayout;
