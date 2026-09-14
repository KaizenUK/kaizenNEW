import { checkFunctionLimit } from "./functionLimits.ts";
import { validProjectId } from "../../../shared/builderProjects.ts";
type Result<T> = { data: T; error: { code?: string; status?: number } | null };
type Service = {
  auth: {
    getUser(
      token: string,
    ): PromiseLike<Result<{ user: { id: string } | null }>>;
    admin: {
      deleteUser(
        id: string,
        softDelete: boolean,
      ): PromiseLike<{ error: unknown }>;
    };
  };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<Result<any>>;
};
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );
class AccountRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
function databaseError(code?: string): never {
  if (code === "42501")
    throw new AccountRequestError(
      403,
      "This account request needs the account holder or another current project owner.",
    );
  if (code === "40001" || code === "40P01")
    throw new AccountRequestError(
      409,
      "The request or project access changed. Refresh before trying again; a changed project list needs a new request.",
    );
  if (code === "P0409")
    throw new AccountRequestError(
      409,
      "Keep another owner for every website before deleting this account.",
    );
  throw new AccountRequestError(
    503,
    "Account requests are unavailable. Refresh before trying again.",
  );
}
export function createAccountHandler(options: {
  service: Service;
  headers(request: Request): Headers;
  originAllowed(request: Request): boolean;
}) {
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
    const json = (status: number, value: unknown) =>
      new Response(JSON.stringify(value), { status, headers });
    if (!options.originAllowed(request))
      return json(403, { error: "Forbidden origin." });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return json(405, { error: "Use an account action." });
    const token = /^Bearer ([^\s]+)$/i.exec(
      request.headers.get("Authorization") || "",
    )?.[1];
    if (!token || token.length > 8192)
      return json(401, { error: "Sign in to manage your account." });
    const globalLimit = await checkFunctionLimit(
      options.service,
      "builder-account",
      headers,
    );
    if (globalLimit) return globalLimit;
    let processing = false;
    try {
      const auth = await options.service.auth.getUser(token);
      const actor = auth.data.user?.id;
      if (auth.error || !uuid(actor))
        return json(401, { error: "Your sign-in expired. Sign in again." });
      const userLimit = await checkFunctionLimit(
        options.service,
        "builder-account",
        headers,
        actor,
      );
      if (userLimit) return userLimit;
      if (
        !/^application\/json(?:\s*;|$)/i.test(
          request.headers.get("Content-Type") || "",
        ) ||
        request.headers.has("Content-Encoding")
      )
        return json(415, { error: "Send a JSON account action." });
      const reader = request.body?.getReader();
      if (!reader) return json(400, { error: "Choose an account action." });
      const chunks: Uint8Array[] = [];
      let length = 0;
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > 4096) {
          await reader.cancel();
          return json(413, { error: "Account request is too large." });
        }
        chunks.push(chunk.value);
      }
      let input: any;
      try {
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        input = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        );
      } catch {
        return json(400, { error: "Send a valid account action." });
      }
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        !["state", "request", "cancel", "confirm", "finish"].includes(
          input.action,
        )
      )
        return json(400, { error: "Choose an account action." });
      async function rpc(name: string, args: Record<string, unknown>) {
        const result = await options.service.rpc(name, args);
        if (result.error) databaseError(result.error.code);
        return result.data;
      }
      let outcome = "unchanged";
      if (input.action === "request") {
        if (input.confirmation !== "DELETE MY ACCOUNT")
          return json(400, {
            error: "Confirm that you want to request account deletion.",
          });
        await rpc("builder_account_deletion_request", { actor });
        outcome = "requested";
      } else if (input.action !== "state") {
        if (!uuid(input.requestId))
          return json(400, {
            error: "Refresh and choose a current account request.",
          });
        if (input.action === "cancel") {
          await rpc("builder_account_deletion_cancel", {
            actor,
            request: input.requestId,
          });
          outcome = "cancelled";
        } else {
          if (input.confirmation !== "CONFIRM DELETION")
            return json(400, {
              error: "Confirm this account deletion before continuing.",
            });
          if (input.action === "confirm" && !validProjectId(input.projectId))
            return json(400, {
              error:
                "Choose the project whose owner is confirming this request.",
            });
          const prepared = await rpc("builder_account_deletion_prepare", {
            actor,
            request: input.requestId,
            target: input.action === "confirm" ? input.projectId : null,
          });
          if (prepared?.status === "pending") outcome = "awaiting-owners";
          else if (prepared?.status === "completed") outcome = "deleted";
          else if (prepared?.status === "processing" && uuid(prepared.userId)) {
            processing = true;
            const removed = await options.service.auth.admin.deleteUser(
              prepared.userId,
              true,
            );
            if (removed.error) throw new Error("Account removal not confirmed");
            // This transaction checks Auth's deleted_at, not the HTTP response.
            await rpc("builder_account_deletion_complete", {
              request: input.requestId,
            });
            processing = false;
            outcome = "deleted";
          } else throw new Error("Unexpected account request state");
        }
      }
      return json(200, {
        outcome,
        state: await rpc("builder_account_deletion_state", { actor }),
      });
    } catch (error) {
      if (processing)
        return json(503, {
          error:
            "Account deletion has started and project access has ended, but removal is not confirmed. Refresh and choose Finish deletion to check and retry.",
        });
      return json(error instanceof AccountRequestError ? error.status : 503, {
        error:
          error instanceof AccountRequestError
            ? error.message
            : "The account request could not be confirmed. Refresh before trying again.",
      });
    }
  };
}
