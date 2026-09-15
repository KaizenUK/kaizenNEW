export type PrivacyRequest = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  name: string;
  email: string;
  kind: "export" | "erasure";
  details: string;
  status: "open" | "in_review" | "fulfilled" | "declined" | "cancelled";
  version: number;
  requestedAt: string;
  response: string;
  updatedAt: string;
  needsOperator: boolean;
};
export type PrivacyPage = {
  items: PrivacyRequest[];
  nextCursor: string | null;
};
export type PrivacyState = {
  projects: { id: string; name: string }[];
  mine: PrivacyPage;
  reviews: PrivacyPage;
};
export const privacyStatus = {
  open: "Received",
  in_review: "Being reviewed",
  fulfilled: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
} as const;
const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );
const text = (value: unknown) => typeof value === "string";
export function isPrivacyPage(value: unknown): value is PrivacyPage {
  if (!value || typeof value !== "object") return false;
  const page = value as PrivacyPage;
  return (
    (page.nextCursor === null || uuid(page.nextCursor)) &&
    Array.isArray(page.items) &&
    page.items.length <= 50 &&
    page.items.every(
      (item) =>
        item &&
        uuid(item.id) &&
        (item.projectId === null || text(item.projectId)) &&
        (item.projectName === null || text(item.projectName)) &&
        text(item.name) &&
        text(item.email) &&
        ["export", "erasure"].includes(item.kind) &&
        text(item.details) &&
        Object.prototype.hasOwnProperty.call(privacyStatus, item.status) &&
        Number.isSafeInteger(item.version) &&
        item.version > 0 &&
        text(item.requestedAt) &&
        Number.isFinite(Date.parse(item.requestedAt)) &&
        text(item.response) &&
        text(item.updatedAt) &&
        Number.isFinite(Date.parse(item.updatedAt)) &&
        typeof item.needsOperator === "boolean",
    )
  );
}
export function isPrivacyState(value: unknown): value is PrivacyState {
  if (!value || typeof value !== "object") return false;
  const state = value as PrivacyState;
  return (
    Array.isArray(state.projects) &&
    state.projects.every(
      (project) => project && text(project.id) && text(project.name),
    ) &&
    isPrivacyPage(state.mine) &&
    isPrivacyPage(state.reviews)
  );
}
