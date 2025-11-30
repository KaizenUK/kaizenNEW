import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Suspense, lazy, useEffect } from "react";
import { CalendlyProvider, useCalendly } from "@/context/CalendlyContext";
import { CalendlyModal } from "@/components/CalendlyModal";
import { CookieBanner } from "@/components/CookieBanner";
import { RouteChangeTracker } from "@/components/RouteChangeTracker";
import Layout from "./components/Layout";

// Eager load Home page for fast First Paint
// All other pages are lazy-loaded for better initial load performance
import Index from "./pages/Index";
const NotFound = lazy(() => import("./pages/NotFound"));
const WebDesign = lazy(() => import("./pages/services/WebDesign"));
const LocalSeo = lazy(() => import("./pages/services/LocalSeo"));
const DigitalTransformation = lazy(
  () => import("./pages/services/DigitalTransformation"),
);
const Ecommerce = lazy(() => import("./pages/services/Ecommerce"));
const WordPressWebDesign = lazy(
  () => import("./pages/services/WordPressWebDesign"),
);
const CityCentre = lazy(() => import("./pages/services/CityCentre"));
const WebDesignWirral = lazy(() => import("./pages/services/WebDesignWirral"));
const ContractProductOwner = lazy(() => import("./pages/ContractProductOwner"));
const ProjectRescue = lazy(() => import("./pages/ProjectRescue"));
const CaseStudies = lazy(() => import("./pages/CaseStudies"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogDetail = lazy(() => import("./pages/BlogDetail"));
const Contact = lazy(() => import("./pages/Contact"));
const Services = lazy(() => import("./pages/Services"));
const About = lazy(() => import("./pages/About"));
const Pledge = lazy(() => import("./pages/Pledge"));
const AgileCoaching = lazy(() => import("./pages/AgileCoaching"));
const ProductOwner = lazy(() => import("./pages/ProductOwner"));
const AsCollectionsCase = lazy(
  () => import("./pages/caseStudies/AsCollections"),
);
const HelenMooreHairdressingCase = lazy(
  () => import("./pages/caseStudies/HelenMooreHairdressing"),
);
const IndependentRetailerCase = lazy(
  () => import("./pages/caseStudies/IndependentRetailer"),
);
const KaizenRebuildCase = lazy(
  () => import("./pages/caseStudies/KaizenRebuild"),
);
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const GDPRPolicy = lazy(() => import("./pages/GDPRPolicy"));
const ThankYou = lazy(() => import("./pages/ThankYou"));

// Admin components remain in the repo but are intentionally not wired into
// the public routing table to avoid exposing an admin surface by default.
// They can be re-enabled locally if needed.
// import AdminLogin from "./pages/admin/AdminLogin";
// import AdminDashboardWrapper from "./components/AdminDashboardWrapper";
// import AdminGuard from "./components/AdminGuard";
// import BlogPostsList from "./pages/admin/BlogPostsList";
// import BlogPostCreate from "./pages/admin/BlogPostCreate";
// import BlogPostDetail from "./pages/admin/BlogPostDetail";

// Fallback component for lazy-loaded routes
const PageLoader = () => (
  <Layout>
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kaizen-cyan"></div>
    </div>
  </Layout>
);

const queryClient = new QueryClient();

function ModalsAndBanner() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const { isCalendlyOpen, closeCalendly } = useCalendly();

  return (
    <>
      {!isAdminRoute && (
        <CalendlyModal isOpen={isCalendlyOpen} onClose={closeCalendly} />
      )}
      {!isAdminRoute && <CookieBanner />}
    </>
  );
}

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  // Suppress react-quill findDOMNode deprecation warning
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;

    const isFindDOMNodeWarning = (args: any[]) => {
      const fullMessage = args.map((arg) => String(arg)).join(" ");
      return (
        fullMessage.includes("findDOMNode") &&
        fullMessage.includes("deprecated")
      );
    };

    console.error = (...args: any[]) => {
      if (isFindDOMNodeWarning(args)) {
        return;
      }
      originalError(...args);
    };

    console.warn = (...args: any[]) => {
      if (isFindDOMNodeWarning(args)) {
        return;
      }
      originalWarn(...args);
    };

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  // Hide/show Crisp widget based on route
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).$crisp) {
      if (isAdminRoute) {
        (window as any).$crisp.push(["do", "chat:hide"]);
      } else {
        (window as any).$crisp.push(["do", "chat:show"]);
      }
    }
  }, [isAdminRoute]);

  // Apply theme based on stored preference for public routes
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isAdminRoute) {
      document.documentElement.classList.remove("dark");
      document.documentElement.dataset.theme = "light";
      return;
    }

    const storedTheme =
      typeof window !== "undefined"
        ? window.localStorage.getItem("kaizen-theme")
        : null;
    if (storedTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.dataset.theme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.dataset.theme = "light";
    }
  }, [isAdminRoute]);

  // Optional: in production, strip any data-builder-* attributes from the
  // rendered DOM to make it harder to infer underlying tooling.
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (typeof document === "undefined") return;

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
  }, [isAdminRoute]);

  return (
    <>
      <ModalsAndBanner />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/services" element={<Services />} />
          <Route
            path="/services/web-design-liverpool"
            element={<WebDesign />}
          />
          <Route path="/services/local-seo" element={<LocalSeo />} />
          <Route
            path="/services/digital-transformation"
            element={<DigitalTransformation />}
          />
          <Route path="/services/ecommerce" element={<Ecommerce />} />
          <Route
            path="/services/wordpress-web-design"
            element={<WordPressWebDesign />}
          />
          <Route
            path="/web-design-liverpool-city-centre"
            element={<CityCentre />}
          />
          <Route path="/web-design-wirral" element={<WebDesignWirral />} />
          <Route
            path="/contract-product-owner"
            element={<ContractProductOwner />}
          />
          <Route path="/project-rescue" element={<ProjectRescue />} />
          <Route path="/about" element={<About />} />
          <Route path="/pledge" element={<Pledge />} />
          <Route path="/agile-coaching" element={<AgileCoaching />} />
          <Route path="/product-owner" element={<ProductOwner />} />
          <Route path="/case-studies" element={<CaseStudies />} />
          <Route
            path="/case-studies/as-collections"
            element={<AsCollectionsCase />}
          />
          <Route
            path="/case-studies/helen-moore-hairdressing"
            element={<HelenMooreHairdressingCase />}
          />
          <Route
            path="/case-studies/independent-retailer"
            element={<IndependentRetailerCase />}
          />
          <Route
            path="/case-studies/kaizen-rebuild"
            element={<KaizenRebuildCase />}
          />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogDetail />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/gdpr-policy" element={<GDPRPolicy />} />

          {/* Catch-all - ADD ALL CUSTOM ROUTES ABOVE THIS */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <CalendlyProvider>
              <RouteChangeTracker />
              <AppContent />
              <Toaster />
              <Sonner />
            </CalendlyProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </TooltipProvider>
    </HelmetProvider>
  );
}
