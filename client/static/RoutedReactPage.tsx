import { HelmetProvider } from "@/lib/helmet";
import { CalendlyProvider } from "@/context/CalendlyContext";
import { RoutePathProvider } from "@/components/routing/RoutePathContext";
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
