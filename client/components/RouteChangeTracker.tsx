import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const GA_ID = "G-64FS0N0FR2";
// Defer GA initialization to reduce main thread blocking during page load
const GA_INIT_DELAY_MS = 3000;

export function RouteChangeTracker() {
  const location = useLocation();
  const [initialized, setInitialized] = useState(false);
  const [gaClient, setGaClient] = useState<{
    send: (payload: { hitType: "pageview"; page: string; title: string }) => void;
  } | null>(null);

  useEffect(() => {
    if (initialized || process.env.NODE_ENV !== "production") {
      return;
    }

    // Defer GA initialization to avoid blocking main thread during initial load
    const timer = setTimeout(() => {
      import("react-ga4")
        .then(({ default: ReactGA }) => {
          ReactGA.initialize(GA_ID);
          setGaClient(ReactGA);
          setInitialized(true);
        })
        .catch(() => {
          // Non-blocking: analytics is optional
        });
    }, GA_INIT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [initialized, location.pathname, location.search]);

  useEffect(() => {
    if (!initialized || !gaClient) {
      return;
    }

    gaClient.send({
      hitType: "pageview",
      page: location.pathname + location.search,
      title: document.title,
    });
  }, [gaClient, initialized, location]);

  return null;
}
