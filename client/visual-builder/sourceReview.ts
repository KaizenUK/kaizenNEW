import type {
  SourceEdits,
  SourceField,
} from "../../shared/builderSourceEditing";

export type SourceReviewChange = {
  id: string;
  label: string;
  before: string[];
  after: string[];
  ordered?: boolean;
  shared: boolean;
};

const designLabels: Record<string, string> = {
  padding: "Inner spacing",
  margin: "Outer spacing",
  gap: "Gap",
  columns: "Columns",
  fontSize: "Text size",
  maxWidth: "Maximum width",
  minHeight: "Minimum height",
  radius: "Corner radius",
  borderWidth: "Border width",
  lineHeight: "Line height",
  fontWeight: "Text weight",
  letterSpacing: "Letter spacing",
  color: "Text colour",
  background: "Background colour",
  borderColor: "Border colour",
};
export function sourceFieldLabel(field: SourceField) {
  if (field.design) {
    const device = { desktop: "Desktop", tablet: "Tablet", mobile: "Phone" }[
      field.design.device
    ];
    return `${designLabels[field.design.property] || "Design value"} · ${device}`;
  }
  if (field.kind === "link") return "Link address";
  if (field.kind === "image")
    return /srcset/i.test(field.attribute || "")
      ? "Responsive images"
      : "Image";
  if (/\balt\b/.test(field.label)) return "Image description";
  if (/\bh[1-6]\b|heading|headline/i.test(field.label)) return "Heading";
  if (/\btitle\b/i.test(field.label)) return "Title";
  if (/\bbutton\b|buttonText|ctaText/i.test(field.label)) return "Button text";
  return "Text";
}

export function clientSourceError(message: string) {
  if (message === "Save the latest editing draft before reviewing it.")
    return "Your newer edits are kept. Wait for Saved, then review your changes again.";
  if (/edits changed (while|after)/i.test(message))
    return "Your edits changed after this review started. Close it and review your changes again.";
  if (
    /source changed|files changed|selection changed|metadata changed/i.test(
      message,
    )
  )
    return "The website changed since you opened it. Your edits are kept. Reopen the page before reviewing again.";
  if (/earlier commit/i.test(message))
    return "Finish saving your earlier changes before applying new edits. Your new edits are kept.";
  if (/image/i.test(message))
    return "A replacement image could not be prepared. Choose it again from Assets, then review your changes.";
  if (/session|sign in|reconnect|not connected/i.test(message))
    return "Reconnect to the website, then try again. Keep this window open to retain your edits.";
  return "Your changes could not be applied or saved. Keep this window open or download your edits, then ask the website owner for help.";
}

function imageName(value: string) {
  const name = value.split(/[?#]/)[0].split(/[\\/]/).pop();
  return name && !value.startsWith("data:") ? name : "Current image";
}

/** Captured alongside the prepared plan; source paths are never presentation labels. */
export function sourceReviewChanges(
  edits: SourceEdits,
  assets: { id: string; name: string }[],
): SourceReviewChange[] {
  const { inspection, values, orders } = edits;
  const changes: SourceReviewChange[] = [];
  for (const field of inspection.fields) {
    const value = values[field.id];
    if (value === undefined || value === field.value) continue;
    const replacement = edits.assets?.find(
      (asset) =>
        asset.fieldId === field.id ||
        (field.kind === "image" &&
          field.elementId &&
          /srcset/i.test(field.attribute || "") &&
          inspection.fields.some(
            (other) =>
              other.id === asset.fieldId &&
              other.elementId === field.elementId &&
              values[other.id] === value,
          )),
    );
    const format = (text: string) =>
      field.kind === "image"
        ? imageName(text)
        : field.design?.unit
          ? `${text} ${field.design.unit}`
          : text;
    changes.push({
      id: field.id,
      label: sourceFieldLabel(field),
      before: [format(field.value)],
      after: [
        replacement
          ? assets.find((asset) => asset.id === replacement.assetId)?.name ||
            "Replacement image"
          : format(value),
      ],
      shared: field.file !== inspection.route,
    });
  }
  for (const group of inspection.groups) {
    const order = orders[group.id];
    if (
      !order ||
      JSON.stringify(order) ===
        JSON.stringify(group.items.map((item) => item.id))
    )
      continue;
    const label = (id: string, after: boolean) => {
      const item = group.items.find((item) => item.id === id);
      const field = inspection.fields.find(
        (field) =>
          item?.fieldIds?.includes(field.id) &&
          field.kind === "text" &&
          !field.design &&
          field.value.trim(),
      );
      const words =
        field && (after ? (values[field.id] ?? field.value) : field.value);
      return (
        words ||
        `Section ${group.items.findIndex((item) => item.id === id) + 1}`
      );
    };
    changes.push({
      id: group.id,
      label: "Section order",
      ordered: true,
      before: group.items.map((item) => label(item.id, false)),
      after: order.map((id) => label(id, true)),
      shared: group.file !== inspection.route,
    });
  }
  return changes;
}
