import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import ReactGA from "react-ga4";

const GA_ID = "G-64FS0N0FR2";
// Defer GA initialization to reduce main thread blocking during page load
const GA_INIT_DELAY_MS = 3000;

export function RouteChangeTracker() {
  const location = useLocation();
  const [initialized, setInitialized] = useState(false);
  const isAdminRoute = location.pathname.startsWith("/admin");
  const pendingPageview = useRef<string | null>(null);

  useEffect(() => {
    if (initialized || process.env.NODE_ENV !== "production" || isAdminRoute) {
      return;
    }

    // Store the initial pageview to send after initialization
    pendingPageview.current = location.pathname + location.search;

    // Defer GA initialization to avoid blocking main thread during initial load
    const timer = setTimeout(() => {
      ReactGA.initialize(GA_ID);
      setInitialized(true);
    }, GA_INIT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [initialized, isAdminRoute, location.pathname, location.search]);

  useEffect(() => {
    if (!initialized || isAdminRoute) {
      return;
    }

    ReactGA.send({
      hitType: "pageview",
      page: location.pathname + location.search,
      title: document.title,
    });
  }, [initialized, isAdminRoute, location]);

  return null;
}
