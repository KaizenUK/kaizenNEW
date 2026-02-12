import type { DocumentActionComponent } from "sanity";

const PREVIEWABLE_TYPES = new Set(["post", "page", "staticPage"]);

function getSlug(doc: Record<string, unknown> | null): string {
  if (!doc) return "";
  const slug = doc.slug;
  if (typeof slug === "object" && slug !== null && "current" in slug) {
    return String((slug as { current?: string }).current ?? "").trim();
  }
  return "";
}

function getDocId(props: unknown, doc: Record<string, unknown> | null): string {
  const propsId =
    props && typeof props === "object" && "id" in props
      ? String((props as { id?: unknown }).id ?? "")
      : "";
  const docId = doc ? String((doc as { _id?: unknown })._id ?? "") : "";
  return (propsId || docId).replace(/^drafts\./, "").trim();
}

/** Opens the draft preview route in a new tab. */
export const previewAction: DocumentActionComponent = (props) => {
  if (!PREVIEWABLE_TYPES.has(props.type)) return null;

  const doc = (props as any).draft || (props as any).published;
  const slug = getSlug(doc);
  const docId = getDocId(props, doc);
  const normalizedSlug = slug.replace(/^\/+/, "").trim();

  let previewPath = "";
  if (props.type === "post") {
    if (!normalizedSlug) return null;
    previewPath = `/preview/blog/${encodeURIComponent(normalizedSlug)}${docId ? `?id=${encodeURIComponent(docId)}` : ""}`;
  } else if (props.type === "page") {
    if (!normalizedSlug) return null;
    previewPath = `/${encodeURIComponent(normalizedSlug)}`;
  } else {
    const routePath = slug.trim();
    if (routePath === "/") {
      previewPath = "/";
    } else if (routePath.startsWith("/")) {
      previewPath = routePath;
    } else if (normalizedSlug) {
      previewPath = `/${normalizedSlug}`;
    } else {
      return null;
    }
  }

  const previewUrl = `/api/draft?path=${encodeURIComponent(previewPath)}`;

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
