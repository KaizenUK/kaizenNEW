/** An editable projection of original source; it never contains executable replacements. */
export type SourceField = {
  id: string;
  file: string;
  label: string;
  kind: "text" | "link" | "image";
  value: string;
  line: number;
};
export type SourceGroup = {
  id: string;
  file: string;
  label: string;
  items: { id: string; label: string }[];
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
};
