import React, { useCallback, useRef, useState } from "react";
import { ContentContext, type ContentState } from "./ContentContext";
import { storage } from "./storage";
import type { ContentCatalogue } from "../../shared/visualBuilder";

export default function ContentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ContentState>({
    status: "idle",
    error: "",
  });
  const pending = useRef<Promise<ContentCatalogue> | undefined>(undefined);
  const load = useCallback(() => {
    if (pending.current) return pending.current;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    pending.current = storage
      .loadContent()
      .then((catalogue) => {
        setState({ catalogue, status: "ready", error: "" });
        return catalogue;
      })
      .catch((error) => {
        setState((current) => ({
          ...current,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Content could not be loaded.",
        }));
        throw error;
      })
      .finally(() => {
        pending.current = undefined;
      });
    return pending.current;
  }, []);
  return (
    <ContentContext.Provider value={{ ...state, load }}>
      {children}
    </ContentContext.Provider>
  );
}
