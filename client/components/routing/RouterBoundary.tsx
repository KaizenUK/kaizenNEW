import type { ReactNode } from "react";
import { MemoryRouter, useInRouterContext } from "react-router-dom";

interface RouterBoundaryProps {
  children: ReactNode;
  initialPath?: string;
}

function resolveInitialPath(explicitPath?: string): string {
  if (explicitPath) return explicitPath;
  if (typeof window !== "undefined" && window.location.pathname) {
    return window.location.pathname;
  }
  return "/";
}

export default function RouterBoundary({
  children,
  initialPath,
}: RouterBoundaryProps) {
  const inRouter = useInRouterContext();

  if (inRouter) {
    return <>{children}</>;
  }

  return (
    <MemoryRouter initialEntries={[resolveInitialPath(initialPath)]}>
      {children}
    </MemoryRouter>
  );
}
