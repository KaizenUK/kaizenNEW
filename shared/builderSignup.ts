import { validProjectId } from "./builderProjects.ts";

export type BuilderAccountStart = {
  created: boolean;
  projectId: string | null;
};
export function isBuilderAccountStart(
  value: unknown,
): value is BuilderAccountStart {
  if (!value || typeof value !== "object") return false;
  const item = value as BuilderAccountStart;
  return (
    typeof item.created === "boolean" &&
    (item.projectId === null ||
      (typeof item.projectId === "string" && validProjectId(item.projectId))) &&
    (!item.created || item.projectId !== null)
  );
}

/** Confirmation returns to one configured route; no arbitrary return URL or
 * authentication fragment is copied into a newly requested email. */
export function signupRedirect(href: string) {
  return new URL("/builder/", new URL(href).origin).href;
}

export const signupNotice =
  "If this address can be registered, a confirmation link has been requested. Check your email, then open the link to continue. If you already have an account, sign in or reset your password.";
export const confirmationNotice =
  "If this address is waiting for confirmation, a new link has been requested. Check your email and use the latest link.";

export function firstProjectRedirect(
  href: string,
  result: BuilderAccountStart,
): string | null {
  const url = new URL(href);
  // Explicit project links retain their normal membership/unavailable handling.
  if (
    validProjectId(url.searchParams.get("project") || "") ||
    !result.projectId ||
    result.projectId === "kaizen"
  )
    return null;
  url.searchParams.set("project", result.projectId);
  return url.href;
}
