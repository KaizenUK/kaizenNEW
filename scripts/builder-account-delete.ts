import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );
type Command = { action: "list" } | { action: "delete"; request: string };
type Service = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: any; error: unknown }>;
  auth: {
    admin: {
      deleteUser(
        id: string,
        softDelete: boolean,
      ): PromiseLike<{ error: unknown }>;
    };
  };
};
export function accountDeletionCommand(args: string[]): Command {
  if (args.length === 1 && args[0] === "--list") return { action: "list" };
  if (
    args.length === 4 &&
    args[0] === "--delete" &&
    uuid(args[1]) &&
    args[2] === "--confirm" &&
    args[3] === args[1]
  )
    return { action: "delete", request: args[1] };
  throw new Error(
    "Use --list to review requests, or --delete <request-id> --confirm <same-request-id> for one reviewed request.",
  );
}

/** Operator-only fallback for accounts with no websites. The database refuses
 * this override whenever website-owner approval is available or required. */
export async function runAccountDeletion(command: Command, service: Service) {
  let processing = false;
  try {
    if (command.action === "list") {
      const result = await service.rpc("builder_account_orphan_requests", {});
      if (result.error || !Array.isArray(result.data)) throw new Error();
      return result.data.map((row: any) => {
        if (
          !uuid(row.request_id) ||
          !uuid(row.user_id) ||
          !["pending", "processing"].includes(row.status) ||
          typeof row.requested_at !== "string"
        )
          throw new Error();
        return {
          requestId: row.request_id,
          accountId: row.user_id,
          status: row.status,
          requestedAt: row.requested_at,
        };
      });
    }
    if (!uuid(command.request)) throw new Error();
    const prepared = await service.rpc("builder_account_deletion_prepare", {
      actor: null,
      request: command.request,
      target: null,
    });
    if (prepared.error) throw new Error();
    if (prepared.data?.status === "completed")
      return { requestId: command.request, status: "completed" };
    if (prepared.data?.status !== "processing" || !uuid(prepared.data.userId))
      throw new Error();
    processing = true;
    const removed = await service.auth.admin.deleteUser(
      prepared.data.userId,
      true,
    );
    if (removed.error) throw new Error();
    const complete = await service.rpc("builder_account_deletion_complete", {
      request: command.request,
    });
    if (complete.error) throw new Error();
    return { requestId: command.request, status: "completed" };
  } catch {
    throw new Error(
      processing
        ? "Deletion has started, but account removal is not confirmed. Review --list and explicitly retry this same request. Website access stays closed."
        : "The account request could not be confirmed. Review --list and its current owner requirements before trying again.",
    );
  }
}

async function cli() {
  const command = accountDeletionCommand(process.argv.slice(2));
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.BUILDER_ACCOUNT_SERVICE_ROLE_KEY || "";
  let origin: URL;
  try {
    origin = new URL(url);
  } catch {
    throw new Error(
      "Configure SUPABASE_URL as the Auth project's HTTPS origin.",
    );
  }
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    !key
  )
    throw new Error(
      "Configure SUPABASE_URL and the private BUILDER_ACCOUNT_SERVICE_ROLE_KEY on the operator host.",
    );
  const service = createClient(origin.origin, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const result = await runAccountDeletion(command, service);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  cli().catch((error) => {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  });
}
