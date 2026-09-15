import type {
  SourceField,
  SourceGroup,
} from "../../shared/builderSourceEditing";

/* Plain names for what a piece of source content is, so the outline reads like a page rather than a DOM. */

const words = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase();
const capitalise = (value: string) =>
  value ? value[0].toUpperCase() + value.slice(1) : value;

const TEXT_TAGS =
  /^(p|span|li|blockquote|strong|em|small|b|i|u|td|th|dd|dt|figcaption|label|div|section|article|summary|legend|caption|q|cite|mark|sub|sup|time|address|main|header|footer|nav|aside|pre|code)$/i;

const ATTRIBUTE_LABELS: Record<string, string> = {
  alt: "Image description",
  title: "Tooltip text",
  placeholder: "Placeholder text",
  "aria-label": "Hint text",
  href: "Link address",
  src: "Image",
  srcset: "Image sizes",
  poster: "Video poster",
};

export function fieldKindLabel(field: SourceField): string {
  const [tag, attributePart] = field.label.split(" · ");
  const attribute = (field.attribute || attributePart || "").toLowerCase();
  if (attribute && ATTRIBUTE_LABELS[attribute])
    return ATTRIBUTE_LABELS[attribute];
  if (field.kind === "image") return "Image";
  if (field.kind === "link") return "Link address";
  const label = tag.trim();
  if (/^h[1-6]$/i.test(label)) return "Heading";
  if (/^a$/i.test(label)) return "Link text";
  if (/^(button|cta)$/i.test(label)) return "Button";
  if (/^title$/i.test(label)) return "Title";
  if (TEXT_TAGS.test(label)) return "Text";
  return capitalise(words(label));
}

/** Where the piece lives in the code, for the people who need it. */
export const fieldSourceLabel = (field: SourceField) =>
  `${field.label} · line ${field.line}`;

const CONTAINER_TITLES: Record<string, string> = {
  body: "Page sections",
  main: "Main sections",
  header: "Header items",
  footer: "Footer items",
  nav: "Navigation links",
  ul: "List items",
  ol: "List items",
  aside: "Sidebar items",
};

export function groupTitle(group: SourceGroup): string {
  const name = group.label.replace(/ sections$/i, "").toLowerCase();
  if (CONTAINER_TITLES[name]) return CONTAINER_TITLES[name];
  const first = group.items[0]?.label?.trim();
  const preview = first
    ? `“${first.length > 28 ? `${first.slice(0, 27)}…` : first}”`
    : "";
  return preview ? `Section starting ${preview}` : "Section items";
}
