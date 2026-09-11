import { createContext } from "react";

// Rendering-only projection. Independent exports use the identity default.
export type MediaProjection = <T>(value: T) => T;
export const MediaContext = createContext<MediaProjection>((value) => value);
