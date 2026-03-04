import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "@/lib/helmet";
import { CalendlyProvider } from "@/context/CalendlyContext";
import ManagedPageRenderer from "@/components/sanity/ManagedPageRenderer";
import type { ManagedPageData } from "@shared/pageBuilder";
import "../global.css";

type ManagedRoutePageProps = {
  path: string;
  page: ManagedPageData;
};

export default function ManagedRoutePage({ path, page }: ManagedRoutePageProps) {
  const isServer = typeof window === "undefined";

  const content = (
    <HelmetProvider>
      <CalendlyProvider>
        <ManagedPageRenderer page={page} routePath={path} />
      </CalendlyProvider>
    </HelmetProvider>
  );

  if (isServer) {
    return <MemoryRouter initialEntries={[path]}>{content}</MemoryRouter>;
  }

  return <BrowserRouter>{content}</BrowserRouter>;
}
