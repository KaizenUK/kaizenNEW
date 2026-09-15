export type RepositoryBillingState = {
  attempt: number;
  phase: "reserved" | "sent" | "live" | "failed";
};
export type RepositoryBillingIdentity = {
  projectId: string;
  reviewId: string;
  binding: string;
  commit: string;
  base: string;
  stagingArtifact: string;
};
export type RepositoryBillingInput = RepositoryBillingIdentity & {
  action: "repository-reserve" | "repository-settle";
  attempt: number;
  outcome?: "sent" | "live" | "failed";
};
export type RepositoryUsageChannel =
  | "source"
  | "preview"
  | "staging"
  | "production";
export type RepositoryUsageSample = {
  bytes: number;
  revision: string;
  pages?: number;
};
export type RepositoryUsageState = {
  version: number;
  measurements: Partial<Record<RepositoryUsageChannel, RepositoryUsageSample>>;
};
export type RepositoryUsageInput = {
  action: "repository-usage-read" | "repository-usage-write";
  projectId: string;
  version?: number;
  channel?: RepositoryUsageChannel;
  sample?: RepositoryUsageSample;
  operation?: "observe" | "reserve" | "publish";
};
export function isRepositoryUsageSample(
  channel: string,
  value: unknown,
): value is RepositoryUsageSample {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    ["source", "preview", "staging", "production"].includes(channel) &&
    Object.keys(item).every((key) =>
      ["bytes", "revision", "pages"].includes(key),
    ) &&
    Number.isSafeInteger(item.bytes) &&
    (item.bytes as number) >= 0 &&
    (item.bytes as number) <= 1099511627776 &&
    typeof item.revision === "string" &&
    /^([a-f0-9]{40}|[a-f0-9]{64})$/.test(item.revision) &&
    (channel === "source"
      ? !("pages" in item)
      : Number.isSafeInteger(item.pages) &&
        (item.pages as number) >= 0 &&
        (item.pages as number) <= 100000)
  );
}
export function isRepositoryUsageState(
  value: unknown,
): value is RepositoryUsageState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(item.version) &&
    (item.version as number) >= 0 &&
    !!item.measurements &&
    typeof item.measurements === "object" &&
    !Array.isArray(item.measurements) &&
    Object.entries(item.measurements).every(([channel, sample]) =>
      isRepositoryUsageSample(channel, sample),
    )
  );
}
export function isRepositoryBillingState(
  value: unknown,
): value is RepositoryBillingState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(item.attempt) &&
    (item.attempt as number) > 0 &&
    ["reserved", "sent", "live", "failed"].includes(String(item.phase))
  );
}
