import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import ReactGA from "react-ga4";

const GA_ID = "G-64FS0N0FR2";

export function RouteChangeTracker() {
  const location = useLocation();
  const [initialized, setInitialized] = useState(false);
  const isAdminRoute = location.pathname.startsWith("/admin");

  useEffect(() => {
    if (
      initialized ||
      process.env.NODE_ENV !== "production" ||
      isAdminRoute
    ) {
      return;
    }

    ReactGA.initialize(GA_ID);
    setInitialized(true);
  }, [initialized, isAdminRoute]);

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
