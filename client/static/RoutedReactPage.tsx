import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "@/lib/helmet";
import { CalendlyProvider } from "@/context/CalendlyContext";
import IndexPage from "@/pages/Index";
import WebDesignLiverpoolPage from "@/pages/services/WebDesignLiverpool";
import WebDesignChesterPage from "@/pages/services/WebDesignChester";
import WebDesignWarringtonPage from "@/pages/services/WebDesignWarrington";
import WebDesignWirralPage from "@/pages/services/WebDesignWirral";
import LocalSeoPage from "@/pages/services/LocalSeo";
import EcommercePage from "@/pages/services/Ecommerce";
import WordPressWebDesignPage from "@/pages/services/WordPressWebDesign";
import DigitalTransformationPage from "@/pages/services/DigitalTransformation";
import AboutPage from "@/pages/About";
import PledgePage from "@/pages/Pledge";
import ContractProductOwnerPage from "@/pages/ContractProductOwner";
import ProjectRescuePage from "@/pages/ProjectRescue";
import AgileCoachingPage from "@/pages/AgileCoaching";
import AsCollectionsPage from "@/pages/caseStudies/AsCollections";
import HelenMooreHairdressingPage from "@/pages/caseStudies/HelenMooreHairdressing";
import IndependentRetailerPage from "@/pages/caseStudies/IndependentRetailer";
import KaizenRebuildPage from "@/pages/caseStudies/KaizenRebuild";
import HighFiveGamesPage from "@/pages/caseStudies/HighFiveGames";
import ContactPage from "@/pages/Contact";
import PerformanceScannerPage from "@/pages/PerformanceScanner";
import "../global.css";

type RoutedReactPageProps = {
  path: string;
};

const PAGE_COMPONENTS_BY_PATH: Record<string, React.ComponentType> = {
  "/": IndexPage,
  "/web-design-liverpool": WebDesignLiverpoolPage,
  "/web-design-chester": WebDesignChesterPage,
  "/web-design-warrington": WebDesignWarringtonPage,
  "/web-design-wirral": WebDesignWirralPage,
  "/services/local-seo": LocalSeoPage,
  "/services/ecommerce": EcommercePage,
  "/services/wordpress-web-design": WordPressWebDesignPage,
  "/digital-transformation": DigitalTransformationPage,
  "/about": AboutPage,
  "/pledge": PledgePage,
  "/contract-product-owner": ContractProductOwnerPage,
  "/project-rescue": ProjectRescuePage,
  "/agile-coaching": AgileCoachingPage,
  "/case-studies/as-collections": AsCollectionsPage,
  "/case-studies/helen-moore-hairdressing": HelenMooreHairdressingPage,
  "/case-studies/independent-retailer": IndependentRetailerPage,
  "/case-studies/kaizen-rebuild": KaizenRebuildPage,
  "/case-studies/high-five-games": HighFiveGamesPage,
  "/contact": ContactPage,
  "/performance-scanner": PerformanceScannerPage,
};

export default function RoutedReactPage({ path }: RoutedReactPageProps) {
  const isServer = typeof window === "undefined";
  const PageComponent = PAGE_COMPONENTS_BY_PATH[path];

  if (!PageComponent) {
    throw new Error(`No routed React page registered for path: ${path}`);
  }

  const content = (
    <HelmetProvider>
      <CalendlyProvider>
        <PageComponent />
      </CalendlyProvider>
    </HelmetProvider>
  );

  if (isServer) {
    return <MemoryRouter initialEntries={[path]}>{content}</MemoryRouter>;
  }

  return <BrowserRouter>{content}</BrowserRouter>;
}
