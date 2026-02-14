import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "@/lib/helmet";
import App from "./App";
import "./global.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
);
