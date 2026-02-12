import { useEffect } from "react";

export default function VisualEditingClient() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import("@sanity/visual-editing").then(({ enableVisualEditing }) => {
      cleanup = enableVisualEditing();
    });
    return () => cleanup?.();
  }, []);
  return null;
}
