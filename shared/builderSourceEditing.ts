/** An editable projection of original source; it never contains executable replacements. */
export type SourceField = {
  id: string;
  file: string;
  label: string;
  kind: "text" | "link" | "image";
  value: string;
  line: number;
  elementId?: string;
  attribute?: string;
  registration?: { id: string; blockId: string };
  design?: {
    property: string;
    device: "desktop" | "tablet" | "mobile";
    unit: string;
    min?: number;
    max?: number;
  };
};
export type SourceGroup = {
  id: string;
  file: string;
  label: string;
  items: { id: string; label: string; fieldIds?: string[] }[];
};
export type SourceInspection = {
  root: string;
  route: string;
  files: { file: string; hash: string }[];
  fields: SourceField[];
  groups: SourceGroup[];
  boundaries: string[];
};
export type SourceEdits = {
  inspection: SourceInspection;
  values: Record<string, string>;
  orders: Record<string, string[]>;
  assets?: { fieldId: string; assetId: string; path: string }[];
};

/** Stable names deduplicate applied media. URLs from code never choose a location outside public/. */
export function sourceAssetPath(original: string, name: string, hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash))
    throw new Error("The image checksum is missing.");
  const extension = name
    .toLowerCase()
    .match(/\.(png|jpe?g|webp|avif|gif|svg)$/)?.[1];
  if (!extension)
    throw new Error("Choose a PNG, JPEG, WebP, AVIF, GIF or SVG image.");
  const pathname = original.split(/[?#]/)[0];
  const folder = /^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(pathname)
    ? pathname.slice(1, pathname.lastIndexOf("/") + 1)
    : "images/";
  return `public/${folder}${hash}.${extension}`;
}
export type SourceDraft = {
  schemaVersion: 1;
  version: number;
  root: string;
  route: string;
  edits: SourceEdits | null;
};
