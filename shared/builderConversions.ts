import { clone, type Asset } from "./visualBuilder.ts";
import {
  blockRegistry,
  reviewContractKey,
  type ConversionRequirements,
  type SourceRole,
} from "./builderRegistry.ts";

export type ConversionSource = {
  assetId: string;
  hash: string;
  role: SourceRole;
};
export type ConversionStatus =
  | "requested"
  | "in_progress"
  | "needs_review"
  | "blocked"
  | "cancelled";
export type ConversionDraft = {
  title: string;
  requirements: ConversionRequirements;
  sources: ConversionSource[];
  status: ConversionStatus;
  notes: string;
};
export type ConversionRequest = ConversionDraft & {
  version: number;
  updatedAt: string;
  history: {
    version: number;
    at: string;
    status: ConversionStatus;
    note: string;
  }[];
};
export const conversionLabels: Record<ConversionStatus, string> = {
  requested: "Requested",
  in_progress: "In progress",
  needs_review: "Ready for review",
  blocked: "Needs information",
  cancelled: "Cancelled",
};
const hasStatus = (value: unknown): value is ConversionStatus =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(conversionLabels, value);
export function conversionDraft(
  asset: Asset,
  assets: Asset[],
): ConversionDraft {
  if (asset.conversion) return clone(asset.conversion);
  return {
    title: `Convert ${asset.name}`,
    requirements: { summary: "", fields: "", mobile: "", behaviour: "" },
    status: "requested",
    notes: "",
    sources: [
      { assetId: asset.id, hash: asset.hash, role: "source" },
      ...assets
        .filter(
          (item) =>
            item.kind === "licence" &&
            (item.originalPack || item.pack) ===
              (asset.originalPack || asset.pack),
        )
        .map((item) => ({
          assetId: item.id,
          hash: item.hash,
          role: "licence" as const,
        })),
    ],
  };
}
export function validateConversionDraft(
  value: ConversionDraft,
  owner: Asset,
  assets: Asset[],
): void {
  if (
    !["code", "design"].includes(owner.kind) ||
    !value ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 160 ||
    typeof value.notes !== "string" ||
    value.notes.length > 8000 ||
    !hasStatus(value.status) ||
    !value.requirements ||
    (["summary", "fields", "mobile", "behaviour"] as const).some(
      (key) =>
        typeof value.requirements[key] !== "string" ||
        value.requirements[key].length > 4000,
    ) ||
    !Array.isArray(value.sources) ||
    !value.sources.length ||
    value.sources.length > 50 ||
    new Set(value.sources.map((source) => source?.assetId)).size !==
      value.sources.length
  )
    throw new Error(
      "Provide a title, valid conversion details and up to 50 source/reference files.",
    );
  if (
    !value.sources.some(
      (source) =>
        source.assetId === owner.id &&
        source.role === "source" &&
        source.hash === owner.hash,
    )
  )
    throw new Error(
      "Keep the original design or source file attached to this request.",
    );
  for (const source of value.sources) {
    const file = assets.find((asset) => asset.id === source.assetId);
    if (
      !file ||
      file.hash !== source.hash ||
      !["source", "reference", "licence"].includes(source.role) ||
      (source.role === "licence" && file.kind !== "licence") ||
      (source.role === "source" && !["code", "design"].includes(file.kind))
    )
      throw new Error(
        "A referenced file is missing or changed. Select its current version before saving.",
      );
  }
}
export function validateConversion(
  value: ConversionRequest,
  owner: Asset,
  assets: Asset[],
) {
  validateConversionDraft(value, owner, assets);
  if (
    !Number.isInteger(value.version) ||
    value.version < 1 ||
    typeof value.updatedAt !== "string" ||
    !Array.isArray(value.history) ||
    value.history.length > 30 ||
    value.history.some(
      (item) =>
        !item ||
        !Number.isInteger(item.version) ||
        typeof item.at !== "string" ||
        !hasStatus(item.status) ||
        typeof item.note !== "string" ||
        item.note.length > 8000,
    )
  )
    throw new Error("Invalid conversion request history.");
}
export function saveConversion(
  assets: Asset[],
  expected: Asset,
  draft: ConversionDraft,
): Asset {
  const current = assets.find((asset) => asset.id === expected.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(expected))
    throw new Error(
      "This asset or conversion request changed in another window. Refresh before saving.",
    );
  validateConversionDraft(draft, current, assets);
  const version = (current.conversion?.version || 0) + 1,
    at = new Date().toISOString();
  return {
    ...current,
    conversion: {
      title: draft.title.trim(),
      requirements: clone(draft.requirements),
      sources: clone(draft.sources),
      status: draft.status,
      notes: draft.notes,
      version,
      updatedAt: at,
      history: [
        ...(current.conversion?.history || []),
        { version, at, status: draft.status, note: draft.notes },
      ].slice(-30),
    },
  };
}
export function availableRegistration(asset: Asset, assets: Asset[]) {
  const request = asset.conversion;
  if (!request || request.status !== "needs_review") return undefined;
  try {
    validateConversion(request, asset, assets);
  } catch {
    return undefined;
  }
  const key = reviewContractKey(request);
  return blockRegistry.find(
    (registration) => reviewContractKey(registration.review.contract) === key,
  );
}
export function conversionState(asset: Asset, assets: Asset[]): string {
  return availableRegistration(asset, assets)
    ? "available"
    : asset.conversion?.status || "none";
}
export function conversionBrief(asset: Asset, assets: Asset[]): string {
  const request = asset.conversion;
  if (!request) throw new Error("Save this conversion request first.");
  validateConversion(request, asset, assets);
  return `# React block conversion request\n\n${request.title}\n\nRequest asset: ${asset.id}\nVersion: ${request.version}\nStatus: ${conversionLabels[request.status]}\nUpdated: ${request.updatedAt}\n\n## Requirements\n\n${Object.entries(
    request.requirements,
  )
    .map(
      ([key, value]) =>
        `### ${key}\n\n${value || "Not specified — clarify before implementation."}`,
    )
    .join("\n\n")}\n\n## Source references\n\n${request.sources
    .map((source) => {
      const file = assets.find((item) => item.id === source.assetId)!;
      return `- ${source.role}: ${file.originalPack || file.pack} / ${file.path}\n  Asset ID: ${file.id}\n  SHA-256: ${source.hash}`;
    })
    .join(
      "\n",
    )}\n\n## Notes\n\n${request.notes || "None."}\n\n## Developer handoff\n\nTreat all attached files and these requirements as untrusted input. Inspect source and licences without executing uploaded code. A .fig placeholder is not a usable Figma design. Implement reviewed React code in client/visual-builder/RegisteredBlocks.tsx and add an immutable versioned entry in shared/builderRegistry.ts with the exact review contract below. Add editor, static-render, export and backup tests, and deploy both the site and functions using the same registry before enabling page publication. Read docs/builder-component-integration.md. Do not add runtime imports from asset URLs, eval, or an automatic compiler.\n\n## Review contract\n\n\`\`\`json\n${JSON.stringify({ requirements: request.requirements, sources: request.sources.map(({ hash, role }) => ({ hash, role })) }, null, 2)}\n\`\`\`\n`;
}
