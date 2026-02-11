import type { DocumentActionComponent } from "sanity";

const PREVIEWABLE_TYPES = new Set(["post", "page"]);

function getSlug(doc: Record<string, unknown> | null): string {
  if (!doc) return "";
  const slug = doc.slug;
  if (typeof slug === "object" && slug !== null && "current" in slug) {
    return String((slug as { current?: string }).current ?? "").trim();
  }
  return "";
}

/** Opens the draft preview route in a new tab. */
export const previewAction: DocumentActionComponent = (props) => {
  if (!PREVIEWABLE_TYPES.has(props.type)) return null;

  const doc = (props as any).draft || (props as any).published;
  const slug = getSlug(doc);

  if (!slug) return null;

  const previewUrl =
    props.type === "post" ? `/preview/blog/${slug}` : `/preview/${slug}`;

  return {
    label: "Preview",
    title: "Open a live preview of this draft in a new tab",
    onHandle: () => {
      window.open(previewUrl, "_blank");
      props.onComplete();
    },
  };
};

previewAction.displayName = "PreviewAction";

/** Wraps the built-in Discard Changes action to surface it as a visible button. */
export function createDiscardAction(
  builtInDiscard: DocumentActionComponent,
): DocumentActionComponent {
  const DiscardAction: DocumentActionComponent = (props) => {
    const original = builtInDiscard(props);
    if (!original) return null;

    return {
      ...original,
      label: "Discard",
      title: "Discard all unpublished changes",
    };
  };

  DiscardAction.action = builtInDiscard.action;
  DiscardAction.displayName = "DiscardAction";
  return DiscardAction;
}
