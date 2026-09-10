import { createContext } from "react";
import type { DesignTokens, SiteDesign } from "../../shared/visualBuilder";
export const SiteContext = createContext<SiteDesign | null>(null);
export const ThemeTokensContext = createContext<DesignTokens>({});
