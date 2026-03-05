import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import type { ManagedPageData } from "@shared/pageBuilder";

// ── Lazy-loaded route components ──────────────────────────────────
// Each page is split into its own chunk, drastically reducing the
// initial bundle size and build memory footprint.

const ManagedPageRenderer = lazy(
  () => import("@/components/sanity/ManagedPageRenderer"),
);
const NotFound = lazy(() => import("./pages/NotFound"));

// ── Minimal loading shell (matches site background) ───────────────

function RouteLoading() {
  return (
    <div className="site-shell min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center text-gray-600">
        Loading...
      </div>
    </div>
  );
}

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function ServerRouteHandoff() {
  const location = useLocation();

  useEffect(() => {
    const target = `${location.pathname}${location.search}${location.hash}`;
    window.location.replace(target);
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="site-shell min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center text-gray-600">
        Loading page...
      </div>
    </div>
  );
}

export default function OtherRoutes({
  managedPage = null,
  managedPath = "",
}: {
  managedPage?: ManagedPageData | null;
  managedPath?: string;
}) {
  const location = useLocation();
  const currentPath = normalizePath(location.pathname);
  const targetPath = normalizePath(managedPath || managedPage?.routePath || "");

  if (managedPage && targetPath && currentPath === targetPath) {
    return (
      <Suspense fallback={<RouteLoading />}>
        <ManagedPageRenderer page={managedPage} routePath={currentPath} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/services" element={<ServerRouteHandoff />} />
        <Route path="/web-design-liverpool" element={<ServerRouteHandoff />} />
        <Route path="/web-design-chester" element={<ServerRouteHandoff />} />
        <Route path="/web-design-warrington" element={<ServerRouteHandoff />} />
        <Route
          path="/services/web-design-liverpool"
          element={<ServerRouteHandoff />}
        />
        <Route
          path="/web-design-liverpool-city-centre"
          element={<ServerRouteHandoff />}
        />
        <Route path="/services/local-seo" element={<ServerRouteHandoff />} />
        <Route path="/digital-transformation" element={<ServerRouteHandoff />} />
        <Route
          path="/services/digital-transformation"
          element={<ServerRouteHandoff />}
        />
        <Route path="/services/ecommerce" element={<ServerRouteHandoff />} />
        <Route
          path="/services/wordpress-web-design"
          element={<ServerRouteHandoff />}
        />
        <Route path="/web-design-wirral" element={<ServerRouteHandoff />} />
        <Route path="/contract-product-owner" element={<ServerRouteHandoff />} />
        <Route path="/project-rescue" element={<ServerRouteHandoff />} />
        <Route path="/about" element={<ServerRouteHandoff />} />
        <Route path="/pledge" element={<ServerRouteHandoff />} />
        <Route path="/agile-coaching" element={<ServerRouteHandoff />} />
        <Route
          path="/product-owner"
          element={<ServerRouteHandoff />}
        />
        <Route path="/case-studies" element={<ServerRouteHandoff />} />
        <Route
          path="/case-studies/as-collections"
          element={<ServerRouteHandoff />}
        />
        <Route
          path="/case-studies/helen-moore-hairdressing"
          element={<ServerRouteHandoff />}
        />
        <Route
          path="/case-studies/independent-retailer"
          element={<ServerRouteHandoff />}
        />
        <Route
          path="/case-studies/kaizen-rebuild"
          element={<ServerRouteHandoff />}
        />
        <Route
          path="/case-studies/high-five-games"
          element={<ServerRouteHandoff />}
        />
        <Route path="/blog/*" element={<ServerRouteHandoff />} />
        <Route path="/studio/*" element={<ServerRouteHandoff />} />
        <Route path="/insights/*" element={<ServerRouteHandoff />} />
        <Route path="/blogdetail/*" element={<ServerRouteHandoff />} />
        <Route path="/contact" element={<ServerRouteHandoff />} />
        <Route path="/thank-you" element={<ServerRouteHandoff />} />
        <Route path="/privacy-policy" element={<ServerRouteHandoff />} />
        <Route path="/cookie-policy" element={<ServerRouteHandoff />} />
        <Route path="/gdpr-policy" element={<ServerRouteHandoff />} />
        <Route path="/performance-scanner" element={<ServerRouteHandoff />} />
        <Route path="/terms-and-conditions" element={<ServerRouteHandoff />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
