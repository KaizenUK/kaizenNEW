import { HelmetProvider } from "@/lib/helmet";
import { CalendlyProvider } from "@/context/CalendlyContext";
import { RoutePathProvider } from "@/components/routing/RoutePathContext";
import ManagedPageRenderer from "@/components/sanity/ManagedPageRenderer";
import type { ManagedPageData } from "@shared/pageBuilder";
import "../global.css";

type ManagedRoutePageProps = {
  path: string;
  page: ManagedPageData;
};

export default function ManagedRoutePage({ path, page }: ManagedRoutePageProps) {
  return (
    <RoutePathProvider path={path}>
      <HelmetProvider>
        <CalendlyProvider>
          <ManagedPageRenderer page={page} routePath={path} />
        </CalendlyProvider>
      </HelmetProvider>
    </RoutePathProvider>
  );
}
