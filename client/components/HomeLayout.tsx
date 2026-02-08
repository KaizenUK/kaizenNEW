import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
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

const upsertMeta = (attr: "name" | "property", key: string, content: string) => {
  const selector = `meta[${attr}="${key}"]`;
  let meta = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
};

const upsertCanonical = (href: string) => {
  let canonical = document.head.querySelector(
    'link[rel="canonical"]',
  ) as HTMLLinkElement | null;

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }

  canonical.setAttribute("href", href);
};

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
    if (typeof document === "undefined") return;

    document.title = HOME_TITLE;
    upsertMeta("name", "description", HOME_DESCRIPTION);
    upsertMeta("name", "robots", "index, follow");
    upsertMeta("name", "googlebot", "index, follow");
    upsertCanonical(HOME_URL);

    upsertMeta("property", "og:locale", "en_GB");
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "Kaizen Web");
    upsertMeta("property", "og:title", HOME_TITLE);
    upsertMeta("property", "og:description", HOME_DESCRIPTION);
    upsertMeta("property", "og:url", HOME_URL);
    upsertMeta("property", "og:image", HOME_OG_IMAGE);
    upsertMeta("property", "og:image:alt", "Kaizen Web - Liverpool web design agency");

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", HOME_TITLE);
    upsertMeta("name", "twitter:description", HOME_DESCRIPTION);
    upsertMeta("name", "twitter:image", HOME_OG_IMAGE);
    upsertMeta("name", "twitter:site", "@kaizenweblpool");
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
