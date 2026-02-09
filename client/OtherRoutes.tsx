import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

const NotFound = lazy(() => import("./pages/NotFound"));
const LocalSeo = lazy(() => import("./pages/services/LocalSeo"));
const DigitalTransformation = lazy(
  () => import("./pages/services/DigitalTransformation"),
);
const Ecommerce = lazy(() => import("./pages/services/Ecommerce"));
const WordPressWebDesign = lazy(
  () => import("./pages/services/WordPressWebDesign"),
);
const WebDesignWirral = lazy(() => import("./pages/services/WebDesignWirral"));
const WebDesignLiverpool = lazy(
  () => import("./pages/services/WebDesignLiverpool"),
);
const WebDesignChester = lazy(
  () => import("./pages/services/WebDesignChester"),
);
const WebDesignWarrington = lazy(
  () => import("./pages/services/WebDesignWarrington"),
);
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
const HighFiveGamesCase = lazy(
  () => import("./pages/caseStudies/HighFiveGames"),
);
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const GDPRPolicy = lazy(() => import("./pages/GDPRPolicy"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
const PerformanceScanner = lazy(() => import("./pages/PerformanceScanner"));

export default function OtherRoutes() {
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
      <Route
        path="/digital-transformation"
        element={<DigitalTransformation />}
      />
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
      <Route
        path="/contract-product-owner"
        element={<ContractProductOwner />}
      />
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
      <Route
        path="/case-studies/kaizen-rebuild"
        element={<KaizenRebuildCase />}
      />
      <Route
        path="/case-studies/high-five-games"
        element={<HighFiveGamesCase />}
      />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogDetail />} />
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
