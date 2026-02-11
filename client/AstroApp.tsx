import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import { CalendlyProvider, useCalendly } from "@/context/CalendlyContext";
import { isReactSnapPrerender } from "@/lib/prerender";
import Index from "./pages/Index";
import "./global.css";

const OtherRoutes = lazy(() => import("./OtherRoutes"));
const RouteChangeTracker = lazy(() =>
  import("@/components/RouteChangeTracker").then((m) => ({
    default: m.RouteChangeTracker,
  })),
);
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
    if (isReactSnapPrerender()) return;

    const loadCookieBanner = () => setShouldLoadCookieBanner(true);
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
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("kaizen-theme");
    }
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

function RoutedApp({ url }: { url: string }) {
  const [shouldLoadRouteTracker, setShouldLoadRouteTracker] = useState(false);
  const isServer = typeof window === "undefined";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isReactSnapPrerender()) return;
    const timeoutId = window.setTimeout(() => setShouldLoadRouteTracker(true), 1500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const app = (
    <CalendlyProvider>
      {shouldLoadRouteTracker ? (
        <Suspense fallback={null}>
          <RouteChangeTracker />
        </Suspense>
      ) : null}
      <AppContent />
    </CalendlyProvider>
  );

  if (isServer) {
    return <MemoryRouter initialEntries={[url]}>{app}</MemoryRouter>;
  }

  return <BrowserRouter>{app}</BrowserRouter>;
}

export default function AstroApp({ url = "/" }: { url?: string }) {
  return <RoutedApp url={url} />;
}
