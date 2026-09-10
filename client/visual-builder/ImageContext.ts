import { createContext } from "react";
import type { AssetImage } from "../../shared/visualBuilder";
// Only the editor supplies a live index. Published and exported markup uses frozen block metadata.
export const ImageContext = createContext<ReadonlyMap<string, AssetImage>>(
  new Map(),
);
