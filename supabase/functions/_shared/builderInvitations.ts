import { checkFunctionLimit } from "./functionLimits.ts";
import { validProjectId } from "../../../shared/builderProjects.ts";

type Result<T> = { data: T; error: { code?: string; status?: number } | null };
type User = { id: string; email?: string };
type Service = {
  auth: {
    getUser(token: string): PromiseLike<Result<{ user: User | null }>>;
    admin: {
      inviteUserByEmail(
        email: string,
        options: {
          redirectTo: string;
          data: { builder_password_set: false };
        },
      ): PromiseLike<Result<{ user: User | null }>>;
    };
  };
  rpc(name: string, input: Record<string, unknown>): PromiseLike<Result<any>>;
};
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );
const emailAddress = (value: unknown) => {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 &&
    /^[^\s<>@\u0000-\u001f\u007f]+@[^\s<>@\u0000-\u001f\u007f]+\.[^\s<>@\u0000-\u001f\u007f]+$/.test(
      email,
    )
    ? email
    : null;
};
class InvitationError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
function databaseError(code?: string): never {
  if (code === "42501")
    throw new InvitationError(
      403,
      "Only a current project owner can manage invitations.",
    );
  if (code === "40001")
    throw new InvitationError(
      409,
      "Project access or the account changed. Refresh this list before trying again.",
    );
  if (code === "P0429")
    throw new InvitationError(
      429,
      "This project's invitation limit has been reached. Try again later.",
    );
  if (code === "22023")
    throw new InvitationError(
      400,
      "Check the email address and project access.",
    );
  throw new InvitationError(
    503,
    "Invitations are unavailable. Try again later.",
  );
}

/** The only email action is an explicit authenticated owner request. Auth owns
 * invitation links; neither links nor service credentials enter the response. */
export function createInvitationHandler(options: {
  service: Service;
  redirectOrigin: string;
  headers(request: Request): Headers;
  originAllowed(request: Request): boolean;
}) {
  const destination = new URL(options.redirectOrigin);
  if (
    destination.protocol !== "https:" ||
    destination.username ||
    destination.password ||
    destination.pathname !== "/" ||
    destination.search ||
    destination.hash
  )
    throw new Error("Configure the canonical HTTPS invitation origin.");
  return async (request: Request) => {
    const headers = options.headers(request);
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set(
      "Access-Control-Allow-Headers",
      "content-type, authorization, apikey, x-client-info",
    );
    headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers });
    if (!options.originAllowed(request))
      return json(403, { error: "Forbidden origin." });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return json(405, { error: "Use an invitation action." });
    const authorization = request.headers.get("authorization") || "";
    if (!/^Bearer [^\s]{1,8192}$/i.test(authorization))
      return json(401, { error: "Sign in to manage invitations." });
    const token = authorization.slice(7);
    const globalLimit = await checkFunctionLimit(
      options.service,
      "builder-invite",
      headers,
    );
    if (globalLimit) return globalLimit;
    let emailAttempted = false;
    try {
      const { service } = options;
      async function authenticate() {
        const result = await service.auth.getUser(token);
        if (result.error || !uuid(result.data?.user?.id)) {
          if (result.error?.status && result.error.status >= 500)
            throw new InvitationError(
              503,
              "Sign-in could not be checked. Try again later.",
            );
          throw new InvitationError(
            401,
            "Your sign-in expired. Sign in again.",
          );
        }
        return result.data.user!;
      }
      const actor = await authenticate();
      const userLimit = await checkFunctionLimit(
        options.service,
        "builder-invite",
        headers,
        actor.id,
      );
      if (userLimit) return userLimit;
      if (
        !/^application\/json(?:;|$)/i.test(
          request.headers.get("content-type") || "",
        ) ||
        ![null, "identity"].includes(request.headers.get("content-encoding"))
      )
        throw new InvitationError(415, "Send a JSON invitation request.");
      const reader = request.body?.getReader();
      if (!reader)
        throw new InvitationError(400, "An invitation action is required.");
      let body = "";
      let bytes = 0;
      const decoder = new TextDecoder("utf-8", { fatal: true });
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > 4096) {
          await reader.cancel();
          throw new InvitationError(
            413,
            "The invitation request is too large.",
          );
        }
        try {
          body += decoder.decode(next.value, { stream: true });
        } catch {
          throw new InvitationError(400, "Check the invitation request.");
        }
      }
      let input;
      try {
        input = JSON.parse(body + decoder.decode());
      } catch {
        throw new InvitationError(400, "Check the invitation request.");
      }
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        !["invite", "resend"].includes(input.action) ||
        typeof input.projectId !== "string" ||
        !validProjectId(input.projectId)
      )
        throw new InvitationError(
          400,
          "Choose a project and invitation action.",
        );
      const resend = input.action === "resend";
      const email = resend ? null : emailAddress(input.email);
      if (
        resend
          ? !uuid(input.userId)
          : !email ||
            !["owner", "editor"].includes(input.role) ||
            typeof input.canPublish !== "boolean"
      )
        throw new InvitationError(
          400,
          "Check the email address and project access.",
        );
      const prepared = await service.rpc("builder_prepare_invitation", {
        target: input.projectId,
        actor: actor.id,
        address: email,
        member_id: resend ? input.userId : null,
      });
      if (prepared.error) databaseError(prepared.error.code);
      const record = prepared.data;
      if (
        !record ||
        !emailAddress(record.email) ||
        (record.accountId !== null && !uuid(record.accountId)) ||
        typeof record.confirmed !== "boolean" ||
        typeof record.alreadyMember !== "boolean" ||
        !Number.isSafeInteger(record.version) ||
        record.version < 1 ||
        (resend
          ? record.accountId !== input.userId || !record.alreadyMember
          : record.email !== email) ||
        (!record.accountId && (record.confirmed || record.alreadyMember))
      )
        throw new InvitationError(503, "Project access could not be checked.");
      let accountId = record.accountId;
      if (!record.confirmed) {
        emailAttempted = true;
        const redirect = new URL("/builder/", destination);
        redirect.searchParams.set("password", "setup");
        redirect.searchParams.set("project", input.projectId);
        const invited = await service.auth.admin.inviteUserByEmail(
          record.email,
          {
            redirectTo: redirect.href,
            data: { builder_password_set: false },
          },
        );
        if (invited.error) {
          if (
            invited.error.code === "email_exists" ||
            invited.error.code === "user_already_exists"
          )
            throw new InvitationError(
              409,
              "This account changed while it was being invited. Refresh this list before trying again.",
            );
          if (invited.error.status === 429)
            throw new InvitationError(
              429,
              "The email provider is limiting invitations. Try again later.",
            );
          throw new InvitationError(
            503,
            "The invitation email could not be confirmed. Refresh this list before trying again.",
          );
        }
        const person = invited.data?.user;
        if (
          !uuid(person?.id) ||
          emailAddress(person?.email) !== record.email ||
          (accountId && person!.id !== accountId)
        )
          throw new InvitationError(
            503,
            "The invited account could not be confirmed.",
          );
        accountId = person!.id;
      }
      if ((await authenticate()).id !== actor.id)
        throw new InvitationError(401, "Your account changed. Sign in again.");
      const completed = await service.rpc("builder_complete_invitation", {
        target: input.projectId,
        actor: actor.id,
        address: record.email,
        member_id: accountId,
        expected_access_version: record.version,
        add_member: !record.alreadyMember,
        member_role: resend ? "editor" : input.role,
        publish_permission: resend ? false : input.canPublish,
      });
      if (completed.error) databaseError(completed.error.code);
      if (typeof completed.data !== "boolean")
        throw new InvitationError(
          503,
          "Project access could not be confirmed.",
        );
      return json(200, {
        kind: record.alreadyMember
          ? emailAttempted
            ? "resent"
            : "already-member"
          : emailAttempted
            ? "invited"
            : "added",
        emailRequested: emailAttempted,
      });
    } catch (error) {
      const known = error instanceof InvitationError;
      return json(known ? error.status : 503, {
        error:
          (known
            ? error.message
            : "Invitations are unavailable. Try again later.") +
          (emailAttempted
            ? " An email may already have been sent. Project access has not been confirmed by this request."
            : ""),
      });
    }
  };
}
