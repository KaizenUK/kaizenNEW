import { useEffect } from "react";

/** Debounce delay before reloading after content mutations (ms). */
const REFRESH_DEBOUNCE_MS = 1200;
const SCROLL_KEY = "__kaizen_preview_scroll";

export default function VisualEditingClient() {
  useEffect(() => {
    const isInIframe =
      typeof window !== "undefined" && window !== window.parent;
    const isPreviewPage =
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/preview/");
    const hasStudioSessionCookie =
      typeof document !== "undefined" &&
      document.cookie.includes("kaizen_studio_auth=1");
    if (!isInIframe && !isPreviewPage && !hasStudioSessionCookie) return;

    // Restore scroll position after preview reload (only in iframe)
    if (isInIframe) {
      try {
        const saved = sessionStorage.getItem(SCROLL_KEY);
        if (saved) {
          const y = Number(saved);
          sessionStorage.removeItem(SCROLL_KEY);
          // Wait for the full page (images etc.) to load, then restore scroll.
          // Use the 'load' event if available, otherwise a generous timeout.
          const restore = () => {
            requestAnimationFrame(() => setTimeout(() => window.scrollTo(0, y), 80));
          };
          if (document.readyState === "complete") {
            restore();
          } else {
            window.addEventListener("load", restore, { once: true });
          }
        }
      } catch {
        // sessionStorage unavailable
      }
    }

    let cleanup: (() => void) | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /** Smooth reload: save scroll, brief fade-out, then reload. */
    function smoothReload() {
      // Save scroll position before reload
      try {
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
      } catch {
        // sessionStorage unavailable
      }
      document.body.style.transition = "opacity 0.15s ease-out";
      document.body.style.opacity = "0.4";
      setTimeout(() => window.location.reload(), 160);
    }

    import("@sanity/visual-editing")
      .then(({ enableVisualEditing }) => {
        cleanup = enableVisualEditing({
          refresh: (payload) => {
            if (payload.source === "mutation" || payload.source === "manual") {
              // Debounce: wait for edits to settle before reloading
              if (debounceTimer) clearTimeout(debounceTimer);
              debounceTimer = setTimeout(smoothReload, REFRESH_DEBOUNCE_MS);
            }
            return false;
          },
          history: {
            subscribe: (navigate) => {
              const onPopState = () => {
                navigate({
                  type: "push",
                  url: `${window.location.pathname}${window.location.search}`,
                });
              };

              window.addEventListener("popstate", onPopState);
              return () => window.removeEventListener("popstate", onPopState);
            },
            update: (update) => {
              switch (update.type) {
                case "push":
                  window.history.pushState(null, "", update.url);
                  break;
                case "replace":
                  window.history.replaceState(null, "", update.url);
                  break;
                case "pop":
                  window.history.back();
                  break;
                default:
                  break;
              }
            },
          },
        });
      })
      .catch((error) => {
        console.error("[VisualEditing] Failed to initialize", error);
      });
    return () => {
      cleanup?.();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);
  return null;
}
