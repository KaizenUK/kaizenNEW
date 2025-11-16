import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useEffect } from "react";
import { CalendlyProvider, useCalendly } from "@/context/CalendlyContext";
import { CalendlyModal } from "@/components/CalendlyModal";
import { CookieBanner } from "@/components/CookieBanner";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import WebDesign from "./pages/services/WebDesign";
import LocalSeo from "./pages/services/LocalSeo";
import DigitalTransformation from "./pages/services/DigitalTransformation";
import Ecommerce from "./pages/services/Ecommerce";
import WordPressWebDesign from "./pages/services/WordPressWebDesign";
import ContractProductOwner from "./pages/ContractProductOwner";
import CaseStudies from "./pages/CaseStudies";
import Blog from "./pages/Blog";
import BlogDetail from "./pages/BlogDetail";
import Contact from "./pages/Contact";
import BlogAdmin from "./pages/BlogAdmin";
import Services from "./pages/Services";
import About from "./pages/About";
import Pledge from "./pages/Pledge";
import AgileCoaching from "./pages/AgileCoaching";
import ProductOwner from "./pages/ProductOwner";
import AsCollectionsCase from "./pages/caseStudies/AsCollections";
import HelenMooreHairdressingCase from "./pages/caseStudies/HelenMooreHairdressing";
import IndependentRetailerCase from "./pages/caseStudies/IndependentRetailer";
import TeamTransformation from "./pages/TeamTransformation";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import GDPRPolicy from "./pages/GDPRPolicy";
import AdminGuard from "@/components/AdminGuard";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboardWrapper from "@/components/AdminDashboardWrapper";
import BlogPostsList from "./pages/admin/BlogPostsList";
import BlogPostCreate from "./pages/admin/BlogPostCreate";
import BlogPostDetail from "./pages/admin/BlogPostDetail";

const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const { isCalendlyOpen, closeCalendly } = useCalendly();

  // Suppress react-quill findDOMNode deprecation warning
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;

    const isFindDOMNodeWarning = (args: any[]) => {
      // Check all args for the pattern
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
        // Hide Crisp on admin routes
        (window as any).$crisp.push(["do", "chat:hide"]);
      } else {
        // Show Crisp on public routes
        (window as any).$crisp.push(["do", "chat:show"]);
      }
    }
  }, [isAdminRoute]);

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

  return (
    <>
      {/* Only show CrispChatButton on non-admin routes */}
      {/* When CrispChatButton is added, uncomment the line below: */}
      {/* {!isAdminRoute && <CrispChatButton />} */}

      {!isAdminRoute && <CalendlyModal isOpen={isCalendlyOpen} onClose={closeCalendly} />}

      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Index />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/web-design-liverpool" element={<WebDesign />} />
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
          path="/contract-product-owner"
          element={<ContractProductOwner />}
        />
        <Route path="/about" element={<About />} />
        <Route path="/pledge" element={<Pledge />} />
        <Route path="/agile-coaching" element={<AgileCoaching />} />
        <Route path="/product-owner" element={<ProductOwner />} />
        <Route path="/team-transformation" element={<TeamTransformation />} />
        <Route path="/case-studies" element={<CaseStudies />} />
        <Route path="/case-studies/as-collections" element={<AsCollectionsCase />} />
        <Route path="/case-studies/helen-moore-hairdressing" element={<HelenMooreHairdressingCase />} />
        <Route path="/case-studies/independent-retailer" element={<IndependentRetailerCase />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogDetail />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/gdpr-policy" element={<GDPRPolicy />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminDashboardWrapper />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/blog-posts"
          element={
            <AdminGuard>
              <BlogPostsList />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/blog-posts/new"
          element={
            <AdminGuard>
              <BlogPostCreate />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/blog-posts/:slug"
          element={
            <AdminGuard>
              <BlogPostDetail />
            </AdminGuard>
          }
        />

        {/* Catch-all */}
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <CalendlyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </CalendlyProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
