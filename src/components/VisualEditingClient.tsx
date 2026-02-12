import { useEffect } from "react";

export default function VisualEditingClient() {
  useEffect(() => {
    // Only activate inside the Presentation tool iframe or when
    // explicitly in a preview context (not during normal browsing).
    const isInIframe = typeof window !== "undefined" && window !== window.parent;
    const isPreviewPage = typeof window !== "undefined" && window.location.pathname.startsWith("/preview/");
    if (!isInIframe && !isPreviewPage) return;

    let cleanup: (() => void) | undefined;
    import("@sanity/visual-editing").then(({ enableVisualEditing }) => {
      cleanup = enableVisualEditing();
    });
    return () => cleanup?.();
  }, []);
  return null;
}
