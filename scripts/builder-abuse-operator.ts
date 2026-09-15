/** Private operator review of abuse reports and publication suspensions. Run
 * on a trusted host with the service-role configuration; never from a browser.
 * No command deletes a website, draft, file, billing or recovery record. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReleaseClient } from "./builder-release-worker.mjs";

const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const usage = () =>
  new Error(
    [
      "Use one of:",
      "  list [--status open|dismissed|actioned]",
      '  dismiss <report> --operator <name> --outcome "<why>"',
      '  suspend <project> --operator <name> --reason "<why>" [--report <report>]',
      '  takedown <project> --operator <name> --reason "<why>" [--report <report>]',
      '  restore <project> --operator <name> --reason "<why>"',
    ].join("\n"),
  );

export function abuseOperatorCommand(args: string[]) {
  const [command, ...rest] = args,
    positional: string[] = [],
    options: Record<string, string> = {};
  for (let index = 0; index < rest.length; index++) {
    const item = rest[index];
    if (!item.startsWith("--")) {
      positional.push(item);
      continue;
    }
    const key = item.slice(2),
      value = rest[++index];
    if (
      !["operator", "reason", "report", "outcome", "status"].includes(key) ||
      value === undefined ||
      key in options
    )
      throw usage();
    options[key] = value;
  }
  const operator = () => {
    if (!/^[a-zA-Z0-9_.@-]{1,100}$/.test(options.operator || "")) throw usage();
    return options.operator;
  };
  const words = (key: "reason" | "outcome") => {
    const value = (options[key] || "").trim();
    if (!value || value.length > 1000) throw usage();
    return value;
  };
  const one = () => {
    if (positional.length !== 1 || !uuid.test(positional[0])) throw usage();
    return positional[0];
  };
  switch (command) {
    case "list":
      if (
        positional.length ||
        Object.keys(options).some((key) => key !== "status") ||
        (options.status &&
          !["open", "dismissed", "actioned"].includes(options.status))
      )
        throw usage();
      return {
        rpc: "builder_operator_reports",
        input: { report_status: options.status || "open" },
      };
    case "dismiss":
      return {
        rpc: "builder_operator_dismiss_report",
        input: {
          report: one(),
          operator: operator(),
          outcome: words("outcome"),
        },
      };
    case "suspend":
    case "takedown":
      if (options.report !== undefined && !uuid.test(options.report))
        throw usage();
      return {
        rpc: "builder_operator_suspend",
        input: {
          target: one(),
          report: options.report ?? null,
          operator: operator(),
          reason: words("reason"),
          takedown: command === "takedown",
        },
      };
    case "restore":
      return {
        rpc: "builder_operator_restore",
        input: { target: one(), operator: operator(), reason: words("reason") },
      };
    default:
      throw usage();
  }
}

export async function runAbuseOperator(
  args: string[],
  client: {
    rpc: (name: string, input: Record<string, unknown>) => Promise<any>;
  },
) {
  const { rpc, input } = abuseOperatorCommand(args);
  return client.rpc(rpc, input);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  runAbuseOperator(
    process.argv.slice(2),
    createReleaseClient({
      url: process.env.SUPABASE_URL || "",
      key: process.env.BUILDER_RELEASE_SERVICE_ROLE_KEY || "",
    }),
  )
    .then((result) =>
      process.stdout.write(JSON.stringify(result, null, 2) + "\n"),
    )
    .catch((error) => {
      process.stderr.write(error.message + "\n");
      process.exitCode = 1;
    });
