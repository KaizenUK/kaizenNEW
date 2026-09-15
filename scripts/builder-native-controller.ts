/** Recovery authority comes from the service manager's completed stop/start
 * boundary. A changed PID or elapsed time alone never releases an intent. */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { NativeOperationIdentity } from "../shared/builderNativeOperations";

export type NativeControllerIdentity = {
  kind: "systemd";
  unit: string;
  invocationId: string;
};
export type NativeOperationController = {
  identity: NativeControllerIdentity;
  stopped: (
    operation: NativeOperationIdentity,
    previous: NativeControllerIdentity,
  ) => Promise<boolean>;
};
export function isNativeControllerIdentity(
  value: unknown,
): value is NativeControllerIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as NativeControllerIdentity;
  return (
    item.kind === "systemd" &&
    typeof item.unit === "string" &&
    /^[a-zA-Z0-9_-]{1,180}\.service$/.test(item.unit) &&
    typeof item.invocationId === "string" &&
    /^[a-f0-9]{32}$/.test(item.invocationId) &&
    Object.keys(item).sort().join(",") === "invocationId,kind,unit"
  );
}
const exec = promisify(execFile);
const unavailable = () =>
  new Error(
    "Native recovery requires the configured systemd service with complete process cleanup.",
  );

export async function nativeServiceController(): Promise<NativeOperationController> {
  if (process.platform !== "linux") throw unavailable();
  const membership = (await readFile("/proc/self/cgroup", "utf8")).trim();
  const match =
    /^0::(\/system\.slice\/([a-zA-Z0-9_-]{1,180}\.service))\/supervisor$/.exec(
      membership,
    );
  if (!match) throw unavailable();
  const [, group, unit] = match;
  const current = async () => {
    const result = await exec(
      "/usr/bin/systemctl",
      [
        "show",
        unit,
        "--no-pager",
        "--property=ControlGroup,InvocationID,KillMode,SendSIGKILL,ActiveState,SubState",
      ],
      {
        timeout: 10000,
        maxBuffer: 16384,
        env: { PATH: "/usr/bin:/bin", LANG: "C", SYSTEMD_PAGER: "cat" },
      },
    );
    const values = new Map(
      result.stdout
        .trim()
        .split("\n")
        .map((line) => {
          const equal = line.indexOf("=");
          if (equal < 1) throw unavailable();
          return [line.slice(0, equal), line.slice(equal + 1)] as const;
        }),
    );
    const identity: NativeControllerIdentity = {
      kind: "systemd",
      unit,
      invocationId: values.get("InvocationID") || "",
    };
    if (
      values.size !== 6 ||
      values.get("ControlGroup") !== group ||
      values.get("KillMode") !== "control-group" ||
      values.get("SendSIGKILL") !== "yes" ||
      values.get("ActiveState") !== "active" ||
      values.get("SubState") !== "running" ||
      !isNativeControllerIdentity(identity)
    )
      throw unavailable();
    return identity;
  };
  const identity = await current();
  if (identity.invocationId !== process.env.INVOCATION_ID) throw unavailable();
  return {
    identity: Object.freeze(identity),
    async stopped(_operation, previous) {
      if (
        !isNativeControllerIdentity(previous) ||
        previous.unit !== unit ||
        previous.invocationId === identity.invocationId
      )
        return false;
      const observed = await current();
      return observed.invocationId === identity.invocationId;
    },
  };
}
