import {
  clone,
  validateDocument,
  type Block,
  type PageDocument,
} from "./visualBuilder.ts";
export const previewDurations = [1, 24, 168] as const;
export type PreviewDuration = (typeof previewDurations)[number];
export type PreviewSummary = {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
  expiresAt: string;
};
export type PrivatePreview = PreviewSummary & { document: PageDocument };
export const isPreviewId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validatePreviewDocument(document: PageDocument): PageDocument {
  validateDocument(document);
  if (document.site)
    throw new Error("Resolve shared content before saving a preview.");
  function check(blocks: Block[]) {
    for (const block of blocks) {
      if (
        block.type === "Shared" ||
        block.props.contentBinding ||
        (block.type === "ContentList" && !Array.isArray(block.props.records))
      )
        throw new Error(
          "Load and resolve shared/CMS content before saving a preview.",
        );
      check(block.props.children || []);
    }
  }
  check(document.data.content);
  return clone(document);
}
export function createPrivatePreview(
  id: string,
  document: PageDocument,
  hours: PreviewDuration,
  now = Date.now(),
): PrivatePreview {
  if (
    !isPreviewId(id) ||
    !previewDurations.includes(hours) ||
    !Number.isFinite(now)
  )
    throw new Error("Choose a valid preview duration and ID.");
  const snapshot = validatePreviewDocument(document);
  return {
    id,
    title: snapshot.title,
    slug: snapshot.slug,
    document: snapshot,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + hours * 3_600_000).toISOString(),
  };
}
export function previewSummary({
  document: _document,
  ...summary
}: PrivatePreview): PreviewSummary {
  return summary;
}
export function previewLink(origin: string, id: string): string {
  if (!isPreviewId(id)) throw new Error("Invalid preview ID.");
  const url = new URL("/builder/", origin);
  url.searchParams.set("preview", id);
  return url.href;
}
