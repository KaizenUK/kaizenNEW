/** Current hosted checkout observation; saved editing drafts are scoped to the caller. */
export type WebsiteStatus = {
  state: "saved" | "staging" | "live";
  head: string;
  draftRoutes: string[];
  detail: string;
  checkedAt: string;
};

export function readWebsiteStatus(value: unknown): WebsiteStatus | undefined {
  if (!value || typeof value !== "object") return;
  const status = value as WebsiteStatus;
  if (
    !["saved", "staging", "live"].includes(status.state) ||
    typeof status.head !== "string" ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(status.head) ||
    typeof status.detail !== "string" ||
    status.detail.length > 1000 ||
    typeof status.checkedAt !== "string" ||
    !Number.isFinite(Date.parse(status.checkedAt)) ||
    !Array.isArray(status.draftRoutes) ||
    status.draftRoutes.length > 10000 ||
    status.draftRoutes.some(
      (route) => typeof route !== "string" || route.length > 500,
    )
  )
    return;
  return status;
}
