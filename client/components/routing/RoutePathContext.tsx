import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const RoutePathContext = createContext<string | null>(null);

function normalizePath(pathname: string): string {
  const raw = String(pathname || "/").trim();
  if (!raw) return "/";
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  if (withLeadingSlash !== "/" && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

export function RoutePathProvider({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return (
    <RoutePathContext.Provider value={normalizePath(path)}>
      {children}
    </RoutePathContext.Provider>
  );
}

export function useRoutePath(fallbackPath = "/"): string {
  const contextPath = useContext(RoutePathContext);
  if (contextPath) return contextPath;

  if (typeof window !== "undefined") {
    return normalizePath(window.location.pathname);
  }

  return normalizePath(fallbackPath);
}
