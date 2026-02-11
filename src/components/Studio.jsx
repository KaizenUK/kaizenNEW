import { Studio as SanityStudio } from "sanity";
import { useEffect, useState } from "react";
import config from "../../sanity.config";
import "../../sanity/studio.css";

const META_PANEL_STORAGE_KEY = "kaizen_studio_meta_panel_open";

export default function Studio() {
  const [metaPanelOpen, setMetaPanelOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(META_PANEL_STORAGE_KEY);
      if (saved === "1") setMetaPanelOpen(true);
    } catch {
      // Ignore storage errors in hardened browser contexts.
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("studio-meta-open", metaPanelOpen);
    try {
      window.localStorage.setItem(
        META_PANEL_STORAGE_KEY,
        metaPanelOpen ? "1" : "0",
      );
    } catch {
      // Ignore storage errors in hardened browser contexts.
    }
  }, [metaPanelOpen]);

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <SanityStudio config={config} />
      <button
        type="button"
        className={`studio-meta-toggle${metaPanelOpen ? " studio-meta-toggle--active" : ""}`}
        onClick={() => setMetaPanelOpen((value) => !value)}
        aria-label={metaPanelOpen ? "Hide post settings panel" : "Show post settings panel"}
        title={metaPanelOpen ? "Hide settings panel" : "Show settings panel"}
      >
        {metaPanelOpen ? "Close Panel" : "Post Settings"}
      </button>
    </div>
  );
}
