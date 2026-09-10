import { createContext } from "react";
import type { ContentCatalogue } from "../../shared/visualBuilder";
export type ContentState = {
  catalogue?: ContentCatalogue;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  load?: () => Promise<ContentCatalogue>;
};
export const ContentContext = createContext<ContentState>({
  status: "idle",
  error: "",
});
