import { createRoot } from "react-dom/client";
import App from "./App";

// Suppress findDOMNode deprecation warning from react-quill and other libraries
const originalWarning = console.warn;
console.warn = (...args: any[]) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("findDOMNode is deprecated")
  ) {
    return;
  }
  originalWarning.apply(console, args);
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(<App />);
