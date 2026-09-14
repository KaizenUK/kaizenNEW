import { validProjectId } from "../../../shared/builderProjects.ts";

export const privacyActions = new Set([
  "legal-state",
  "legal-accept",
  "privacy-state",
  "privacy-list",
  "privacy-request",
  "privacy-update",
]);
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );
const note = (value: unknown, max: number): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= max &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
export class PrivacyRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
type Service = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: any;
    error: { code?: string } | null;
  }>;
};

/** Actor is supplied exclusively by the JWT-verifying account handler. The
 * operator's null-actor fallback is never available through this HTTP path. */
export async function runPrivacyAction(
  service: Service,
  actor: string,
  input: Record<string, any>,
) {
  async function rpc(name: string, args: Record<string, unknown>) {
    const result = await service.rpc(name, args);
    if (result.error) {
      const code = result.error.code;
      if (code === "42501")
        throw new PrivacyRequestError(
          403,
          "Your access to this request is unavailable. Refresh; website responses require a current owner.",
        );
      if (["40001", "40P01"].includes(code || ""))
        throw new PrivacyRequestError(
          409,
          "The documents or request changed. Refresh and review the current details before trying again.",
        );
      if (code === "P0429")
        throw new PrivacyRequestError(
          429,
          "Too many requests. Contact privacy@kaizenweb.co.uk if you need help.",
        );
      if (code === "22023")
        throw new PrivacyRequestError(
          400,
          "Check the request type, details and response before trying again.",
        );
      throw new PrivacyRequestError(
        503,
        "The request could not be confirmed. Refresh to check its status before trying again.",
      );
    }
    return result.data;
  }
  async function state() {
    const [projects, mine, reviews] = await Promise.all([
      rpc("builder_privacy_projects", { actor }),
      rpc("builder_privacy_list", { actor, inbox: false, before_id: null }),
      rpc("builder_privacy_list", { actor, inbox: true, before_id: null }),
    ]);
    return { projects, mine, reviews };
  }
  if (input.action === "legal-state")
    return { legal: await rpc("builder_legal_state", { actor }) };
  if (input.action === "legal-accept") {
    if (
      input.confirmed !== true ||
      typeof input.version !== "string" ||
      !/^\d{4}-\d{2}-\d{2}(?:\.\d+)?$/.test(input.version) ||
      ![input.termsHash, input.privacyHash].every(
        (hash) => typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash),
      )
    )
      throw new PrivacyRequestError(
        400,
        "Read the current terms and privacy notice, then confirm your choice.",
      );
    return {
      legal: await rpc("builder_legal_accept", {
        actor,
        expected_version: input.version,
        terms_hash: input.termsHash,
        privacy_hash: input.privacyHash,
        confirmed: true,
      }),
    };
  }
  if (input.action === "privacy-state") return { state: await state() };
  if (input.action === "privacy-list") {
    if (
      !["mine", "reviews"].includes(input.scope) ||
      (input.beforeId != null && !uuid(input.beforeId))
    )
      throw new PrivacyRequestError(400, "Choose a current page of requests.");
    return {
      page: await rpc("builder_privacy_list", {
        actor,
        inbox: input.scope === "reviews",
        before_id: input.beforeId ?? null,
      }),
    };
  }
  if (input.action === "privacy-request") {
    if (
      !uuid(input.requestId) ||
      (input.projectId !== null && !validProjectId(input.projectId)) ||
      !["export", "erasure"].includes(input.kind) ||
      !note(input.details, 1000)
    )
      throw new PrivacyRequestError(
        400,
        "Choose the account or website, a request type, and add up to 1000 characters of detail.",
      );
    const requestId = await rpc("builder_privacy_request", {
      actor,
      target: input.projectId,
      request_kind: input.kind,
      request_details: input.details,
      request_id: input.requestId,
    });
    return { outcome: "requested", requestId, state: await state() };
  }
  if (input.action === "privacy-update") {
    if (
      !uuid(input.requestId) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      !["cancelled", "in_review", "fulfilled", "declined"].includes(
        input.status,
      ) ||
      (input.status !== "cancelled" && !note(input.response, 2000)) ||
      (["fulfilled", "declined"].includes(input.status) &&
        input.handled !== true)
    )
      throw new PrivacyRequestError(
        400,
        "Review this request and record the response. Confirm secure delivery before marking it handled.",
      );
    await rpc("builder_privacy_update", {
      actor,
      request_id: input.requestId,
      expected_version: input.version,
      next_status: input.status,
      owner_response: input.status === "cancelled" ? "" : input.response,
    });
    return { outcome: "updated", state: await state() };
  }
  throw new PrivacyRequestError(400, "Choose a legal or personal-data action.");
}
