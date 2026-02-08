import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { CalendlyProvider, useCalendly } from "@/context/CalendlyContext";
import { RouteChangeTracker } from "@/components/RouteChangeTracker";

// Eager load Home page for fast First Paint
// All other pages are lazy-loaded for better initial load performance
import Index from "./pages/Index";
const OtherRoutes = lazy(() => import("./OtherRoutes"));
const CalendlyModal = lazy(() =>
  import("@/components/CalendlyModal").then((m) => ({
    default: m.CalendlyModal,
  })),
);
const CookieBanner = lazy(() =>
  import("@/components/CookieBanner").then((m) => ({
    default: m.CookieBanner,
  })),
);

// Fallback component for lazy-loaded routes
const PageLoader = () => (
  <div className="site-shell min-h-screen flex flex-col bg-background text-foreground">
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kaizen-cyan"></div>
    </div>
  </div>
);

function ModalsAndBanner() {
  const { isCalendlyOpen, closeCalendly } = useCalendly();
  const [shouldLoadCookieBanner, setShouldLoadCookieBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadCookieBanner = () => setShouldLoadCookieBanner(true);
    let idleId: number | null = null;
    const win = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(() => loadCookieBanner());
      return () => {
        if (idleId !== null && typeof win.cancelIdleCallback === "function") {
          win.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(loadCookieBanner, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <>
      {isCalendlyOpen ? (
        <Suspense fallback={null}>
          <CalendlyModal isOpen={isCalendlyOpen} onClose={closeCalendly} />
        </Suspense>
      ) : null}
      {shouldLoadCookieBanner ? (
        <Suspense fallback={null}>
          <CookieBanner />
        </Suspense>
      ) : null}
    </>
  );
}

function AppContent() {
  // Force light mode across the entire site
  // Dark backgrounds are handled explicitly per-section, not via dark mode toggle
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
    // Clear any stored dark theme preference to prevent future issues
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("kaizen-theme");
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (typeof document === "undefined") return;

    const cleanupBuilderAttrs = () => {
      const root = document.documentElement;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

      // eslint-disable-next-line no-constant-condition
      while (walker.nextNode()) {
        const el = walker.currentNode as HTMLElement;
        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          if (attr.name.startsWith("data-builder-")) {
            el.removeAttribute(attr.name);
          }
        }
      }
    };

    let idleId: number | null = null;
    const win = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(() => cleanupBuilderAttrs());
      return () => {
        if (idleId !== null && typeof win.cancelIdleCallback === "function") {
          win.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(cleanupBuilderAttrs, 300);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <>
      <ModalsAndBanner />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<OtherRoutes />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <CalendlyProvider>
        <RouteChangeTracker />
        <AppContent />
      </CalendlyProvider>
    </BrowserRouter>
  );
}
