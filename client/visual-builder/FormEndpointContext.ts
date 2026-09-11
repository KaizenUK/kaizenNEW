import { createContext } from "react";
// undefined preserves the configured website/editor behavior; an explicit empty string disables delivery.
export const FormEndpointContext = createContext<string | undefined>(undefined);
