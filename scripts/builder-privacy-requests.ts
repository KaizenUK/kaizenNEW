import path from "node:path";
import { fileURLToPath } from "node:url";
import { lstat, readFile, realpath } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { isPrivacyPage } from "../shared/builderPrivacy";

const uuid = (value: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );
export type PrivacyCommand =
  | { action: "list"; before: string | null }
  | {
      action: "respond";
      requestId: string;
      version: number;
      status: "in_review" | "fulfilled" | "declined";
      responseFile: string;
    };
export function privacyCommand(args: string[]): PrivacyCommand {
  if (
    args[0] === "--list" &&
    (args.length === 1 ||
      (args.length === 3 && args[1] === "--before" && uuid(args[2])))
  )
    return { action: "list", before: args[2] || null };
  if (
    args.length === 10 &&
    args[0] === "--respond" &&
    uuid(args[1]) &&
    args[2] === "--version" &&
    /^[1-9][0-9]{0,8}$/.test(args[3]) &&
    args[4] === "--status" &&
    ["in_review", "fulfilled", "declined"].includes(args[5]) &&
    args[6] === "--response-file" &&
    path.isAbsolute(args[7]) &&
    args[8] === "--confirm" &&
    args[9] === args[1]
  )
    return {
      action: "respond",
      requestId: args[1],
      version: Number(args[3]),
      status: args[5] as "in_review" | "fulfilled" | "declined",
      responseFile: args[7],
    };
  throw new Error(
    "Use --list [--before <request-id>], or --respond <request-id> --version <current-version> --status in_review|fulfilled|declined --response-file <private-file> --confirm <same-request-id>. Record a completed/declined response only after verifying the requester and delivering it securely.",
  );
}
type Service = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: any; error: unknown }>;
};
export async function runPrivacyOperator(
  command: PrivacyCommand,
  service: Service,
) {
  try {
    if (command.action === "list") {
      const result = await service.rpc("builder_privacy_list", {
        actor: null,
        inbox: true,
        before_id: command.before,
      });
      if (result.error || !isPrivacyPage(result.data)) throw new Error();
      return result.data;
    }
    const info = await lstat(command.responseFile);
    if (
      !info.isFile() ||
      info.mode & 0o077 ||
      info.size > 8192 ||
      (await realpath(command.responseFile)) !== command.responseFile
    )
      throw new Error();
    const response = (await readFile(command.responseFile, "utf8")).trim();
    if (
      !response ||
      response.length > 2000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(response)
    )
      throw new Error();
    const result = await service.rpc("builder_privacy_update", {
      actor: null,
      request_id: command.requestId,
      expected_version: command.version,
      next_status: command.status,
      owner_response: response,
    });
    if (result.error) throw new Error();
    return {
      requestId: command.requestId,
      status: command.status,
      responseRecorded: true,
    };
  } catch {
    throw new Error(
      "The privacy request could not be confirmed. Review the current operator queue, version and private response file before trying again. A website with a current owner must be handled by that owner.",
    );
  }
}
async function cli() {
  const command = privacyCommand(process.argv.slice(2));
  const key = process.env.BUILDER_ACCOUNT_SERVICE_ROLE_KEY || "";
  let origin: URL;
  try {
    origin = new URL(process.env.SUPABASE_URL || "");
  } catch {
    throw new Error(
      "Configure the private operator account service credentials.",
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
      "Configure the private operator account service credentials.",
    );
  const service = createClient(origin.origin, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  process.stdout.write(
    JSON.stringify(await runPrivacyOperator(command, service), null, 2) + "\n",
  );
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
