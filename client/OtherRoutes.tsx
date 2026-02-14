import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ManagedPageRenderer from "@/components/sanity/ManagedPageRenderer";
import type { ManagedPageData } from "@shared/pageBuilder";

import NotFound from "./pages/NotFound";
import LocalSeo from "./pages/services/LocalSeo";
import DigitalTransformation from "./pages/services/DigitalTransformation";
import Ecommerce from "./pages/services/Ecommerce";
import WordPressWebDesign from "./pages/services/WordPressWebDesign";
import WebDesignWirral from "./pages/services/WebDesignWirral";
import WebDesignLiverpool from "./pages/services/WebDesignLiverpool";
import WebDesignChester from "./pages/services/WebDesignChester";
import WebDesignWarrington from "./pages/services/WebDesignWarrington";
import ContractProductOwner from "./pages/ContractProductOwner";
import ProjectRescue from "./pages/ProjectRescue";
import CaseStudies from "./pages/CaseStudies";
import Contact from "./pages/Contact";
import Services from "./pages/Services";
import About from "./pages/About";
import Pledge from "./pages/Pledge";
import AgileCoaching from "./pages/AgileCoaching";
import AsCollectionsCase from "./pages/caseStudies/AsCollections";
import HelenMooreHairdressingCase from "./pages/caseStudies/HelenMooreHairdressing";
import IndependentRetailerCase from "./pages/caseStudies/IndependentRetailer";
import KaizenRebuildCase from "./pages/caseStudies/KaizenRebuild";
import HighFiveGamesCase from "./pages/caseStudies/HighFiveGames";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import GDPRPolicy from "./pages/GDPRPolicy";
import ThankYou from "./pages/ThankYou";
import PerformanceScanner from "./pages/PerformanceScanner";

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
    return <ManagedPageRenderer page={managedPage} routePath={currentPath} />;
  }

  return (
    <Routes>
      <Route path="/services" element={<Services />} />
      <Route path="/web-design-liverpool" element={<WebDesignLiverpool />} />
      <Route path="/web-design-chester" element={<WebDesignChester />} />
      <Route path="/web-design-warrington" element={<WebDesignWarrington />} />
      <Route
        path="/services/web-design-liverpool"
        element={<Navigate to="/web-design-liverpool" replace />}
      />
      <Route
        path="/web-design-liverpool-city-centre"
        element={<Navigate to="/web-design-liverpool" replace />}
      />
      <Route path="/services/local-seo" element={<LocalSeo />} />
      <Route path="/digital-transformation" element={<DigitalTransformation />} />
      <Route
        path="/services/digital-transformation"
        element={<Navigate to="/digital-transformation" replace />}
      />
      <Route path="/services/ecommerce" element={<Ecommerce />} />
      <Route
        path="/services/wordpress-web-design"
        element={<WordPressWebDesign />}
      />
      <Route path="/web-design-wirral" element={<WebDesignWirral />} />
      <Route path="/contract-product-owner" element={<ContractProductOwner />} />
      <Route path="/project-rescue" element={<ProjectRescue />} />
      <Route path="/about" element={<About />} />
      <Route path="/pledge" element={<Pledge />} />
      <Route path="/agile-coaching" element={<AgileCoaching />} />
      <Route
        path="/product-owner"
        element={<Navigate to="/contract-product-owner" replace />}
      />
      <Route path="/case-studies" element={<CaseStudies />} />
      <Route path="/case-studies/as-collections" element={<AsCollectionsCase />} />
      <Route
        path="/case-studies/helen-moore-hairdressing"
        element={<HelenMooreHairdressingCase />}
      />
      <Route
        path="/case-studies/independent-retailer"
        element={<IndependentRetailerCase />}
      />
      <Route path="/case-studies/kaizen-rebuild" element={<KaizenRebuildCase />} />
      <Route
        path="/case-studies/high-five-games"
        element={<HighFiveGamesCase />}
      />
      <Route path="/blog/*" element={<ServerRouteHandoff />} />
      <Route path="/studio/*" element={<ServerRouteHandoff />} />
      <Route path="/insights/*" element={<ServerRouteHandoff />} />
      <Route path="/blogdetail/*" element={<ServerRouteHandoff />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/thank-you" element={<ThankYou />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/cookie-policy" element={<CookiePolicy />} />
      <Route path="/gdpr-policy" element={<GDPRPolicy />} />
      <Route path="/performance-scanner" element={<PerformanceScanner />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
