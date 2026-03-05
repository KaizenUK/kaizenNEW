import type React from "react";
import { HelmetProvider } from "@/lib/helmet";
import { CalendlyProvider } from "@/context/CalendlyContext";
import { RoutePathProvider } from "@/components/routing/RoutePathContext";
import IndexPage from "@/pages/Index";
import "../global.css";

type DirectReactPageProps = {
  path: string;
};

const DIRECT_PAGE_COMPONENTS_BY_PATH: Record<string, React.ComponentType> = {
  "/": IndexPage,
};

export default function DirectReactPage({ path }: DirectReactPageProps) {
  const PageComponent = DIRECT_PAGE_COMPONENTS_BY_PATH[path];

  if (!PageComponent) {
    throw new Error(`No direct React page registered for path: ${path}`);
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
