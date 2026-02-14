import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import { CalendlyProvider, useCalendly } from "@/context/CalendlyContext";
import { HelmetProvider } from "@/lib/helmet";
import { isReactSnapPrerender } from "@/lib/prerender";
import type { ManagedPageData } from "@shared/pageBuilder";
import Index from "./pages/Index";
import OtherRoutes from "./OtherRoutes";
import ManagedPageRenderer from "@/components/sanity/ManagedPageRenderer";
import "./global.css";

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

function AppContent({
  managedPage,
  managedPath,
}: {
  managedPage?: ManagedPageData | null;
  managedPath: string;
}) {
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
      <Routes>
        <Route
          path="/"
          element={
            managedPage && managedPath === "/" ? (
              <ManagedPageRenderer page={managedPage} routePath="/" />
            ) : (
              <Index />
            )
          }
        />
        <Route
          path="*"
          element={
            <OtherRoutes managedPage={managedPage} managedPath={managedPath} />
          }
        />
      </Routes>
    </>
  );
}

function RoutedApp({
  url,
  managedPage,
  managedPath,
}: {
  url: string;
  managedPage?: ManagedPageData | null;
  managedPath: string;
}) {
  const [shouldLoadRouteTracker, setShouldLoadRouteTracker] = useState(false);
  const isServer = typeof window === "undefined";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isReactSnapPrerender()) return;
    const timeoutId = window.setTimeout(
      () => setShouldLoadRouteTracker(true),
      1500,
    );
    return () => window.clearTimeout(timeoutId);
  }, []);

  const app = (
    <HelmetProvider>
      <CalendlyProvider>
        {shouldLoadRouteTracker ? (
          <Suspense fallback={null}>
            <RouteChangeTracker />
          </Suspense>
        ) : null}
        <AppContent managedPage={managedPage} managedPath={managedPath} />
      </CalendlyProvider>
    </HelmetProvider>
  );

  if (isServer) {
    return <MemoryRouter initialEntries={[url]}>{app}</MemoryRouter>;
  }

  return <BrowserRouter>{app}</BrowserRouter>;
}

export default function AstroApp({
  url = "/",
  managedPage = null,
  managedPath = "/",
}: {
  url?: string;
  managedPage?: ManagedPageData | null;
  managedPath?: string;
}) {
  return (
    <RoutedApp url={url} managedPage={managedPage} managedPath={managedPath} />
  );
}
