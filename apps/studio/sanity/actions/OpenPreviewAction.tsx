import { EyeOpenIcon } from "@sanity/icons";
import type { DocumentActionComponent, SanityDocument } from "sanity";

const EDITOR_API_ORIGIN = (
  import.meta.env.VITE_EDITOR_API_ORIGIN || "http://127.0.0.1:54321/functions/v1"
).replace(/\/+$/, "");

function resolvePreviewUrl(
  type: string,
  id: string,
  draft: SanityDocument | null,
  published: SanityDocument | null,
): string | null {
  const slugObj =
    (draft?.slug as { current?: string } | undefined) ??
    (published?.slug as { current?: string } | undefined);
  const slug = slugObj?.current?.trim();
  const cleanId = id.replace(/^drafts\./, "");

  if (type === "post" && slug) {
    const previewPath = `/preview-blog/${encodeURIComponent(slug)}?id=${encodeURIComponent(cleanId)}`;
    return `${EDITOR_API_ORIGIN}/draft?path=${encodeURIComponent(previewPath)}`;
  }
  return null;
}

export const OpenPreviewAction: DocumentActionComponent =
  function OpenPreviewAction({ id, type, draft, published, onComplete }) {
    const previewUrl = resolvePreviewUrl(type, id, draft, published);

    if (!previewUrl) return null;

    return {
      label: "Preview",
      icon: EyeOpenIcon,
      tone: "positive" as const,
      onHandle: () => {
        window.open(previewUrl, "_blank", "noopener,noreferrer");
        onComplete();
      },
    };
  };
