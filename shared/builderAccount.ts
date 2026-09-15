export function accountName(value: unknown): string | null {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 200 &&
    !/[<>\u0000-\u001f\u007f]/.test(value)
    ? value.trim()
    : null;
}
export function accountEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return email.length <= 254 &&
    /^[^\s<>@\u0000-\u001f\u007f]+@[^\s<>@\u0000-\u001f\u007f]+\.[^\s<>@\u0000-\u001f\u007f]+$/.test(
      email,
    )
    ? email
    : null;
}
export const ACCOUNT_SETUP_MESSAGE =
  "Your account needs a name and valid email before saving to the website. Open Account to complete your own details, then try saving again.";

export type AccountDeletionState = {
  request: null | {
    id: string;
    status: "pending" | "processing" | "completed";
    requestedAt: string;
    accessChanged: boolean;
    needsOperator: boolean;
    projects: {
      id: string;
      name: string;
      approved: boolean;
      lastOwner: boolean;
    }[];
  };
  reviews: {
    id: string;
    projectId: string;
    projectName: string;
    name: string;
    email: string;
    status: "pending" | "processing";
    requestedAt: string;
    approved: boolean;
  }[];
};

export function isAccountDeletionState(
  value: unknown,
): value is AccountDeletionState {
  if (!value || typeof value !== "object") return false;
  const state = value as AccountDeletionState;
  const text = (value: unknown) => typeof value === "string";
  const request = state.request;
  return (
    (request === null ||
      Boolean(
        request &&
        text(request.id) &&
        ["pending", "processing", "completed"].includes(request.status) &&
        text(request.requestedAt) &&
        typeof request.accessChanged === "boolean" &&
        typeof request.needsOperator === "boolean" &&
        Array.isArray(request.projects) &&
        request.projects.every(
          (project) =>
            project &&
            text(project.id) &&
            text(project.name) &&
            typeof project.approved === "boolean" &&
            typeof project.lastOwner === "boolean",
        ),
      )) &&
    Array.isArray(state.reviews) &&
    state.reviews.every(
      (review) =>
        review &&
        text(review.id) &&
        text(review.projectId) &&
        text(review.projectName) &&
        text(review.name) &&
        text(review.email) &&
        text(review.requestedAt) &&
        ["pending", "processing"].includes(review.status) &&
        typeof review.approved === "boolean",
    )
  );
}
