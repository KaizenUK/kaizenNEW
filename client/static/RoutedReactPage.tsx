import { HelmetProvider } from "@/lib/helmet";
import { CalendlyProvider } from "@/context/CalendlyContext";
import { RoutePathProvider } from "@/components/routing/RoutePathContext";
import WebDesignLiverpoolPage from "@/pages/services/WebDesignLiverpool";
import WebDesignChesterPage from "@/pages/services/WebDesignChester";
import WebDesignWarringtonPage from "@/pages/services/WebDesignWarrington";
import WebDesignWirralPage from "@/pages/services/WebDesignWirral";
import LocalSeoPage from "@/pages/services/LocalSeo";
import EcommercePage from "@/pages/services/Ecommerce";
import WordPressWebDesignPage from "@/pages/services/WordPressWebDesign";
import DigitalTransformationPage from "@/pages/services/DigitalTransformation";
import AsCollectionsPage from "@/pages/caseStudies/AsCollections";
import HelenMooreHairdressingPage from "@/pages/caseStudies/HelenMooreHairdressing";
import IndependentRetailerPage from "@/pages/caseStudies/IndependentRetailer";
import KaizenRebuildPage from "@/pages/caseStudies/KaizenRebuild";
import HighFiveGamesPage from "@/pages/caseStudies/HighFiveGames";
import "../global.css";

type RoutedReactPageProps = {
  path: string;
};

const PAGE_COMPONENTS_BY_PATH: Record<string, React.ComponentType> = {
  "/web-design-liverpool": WebDesignLiverpoolPage,
  "/web-design-chester": WebDesignChesterPage,
  "/web-design-warrington": WebDesignWarringtonPage,
  "/web-design-wirral": WebDesignWirralPage,
  "/services/local-seo": LocalSeoPage,
  "/services/ecommerce": EcommercePage,
  "/services/wordpress-web-design": WordPressWebDesignPage,
  "/digital-transformation": DigitalTransformationPage,
  "/case-studies/as-collections": AsCollectionsPage,
  "/case-studies/helen-moore-hairdressing": HelenMooreHairdressingPage,
  "/case-studies/independent-retailer": IndependentRetailerPage,
  "/case-studies/kaizen-rebuild": KaizenRebuildPage,
  "/case-studies/high-five-games": HighFiveGamesPage,
};

export default function RoutedReactPage({ path }: RoutedReactPageProps) {
  const PageComponent = PAGE_COMPONENTS_BY_PATH[path];

  if (!PageComponent) {
    throw new Error(`No routed React page registered for path: ${path}`);
  }

  return (
    <RoutePathProvider path={path}>
      <HelmetProvider>
        <CalendlyProvider>
          <PageComponent />
        </CalendlyProvider>
      </HelmetProvider>
    </RoutePathProvider>
  );
}
