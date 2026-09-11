// Only the isolated PGlite/Nginx acceptance fixture uses this loopback bridge.
// Terminate this process after real Nginx reload to leave genuine ownership files.
import { readFile } from "node:fs/promises";
import { writeSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  createClientCompiler,
  runClientPublication,
} from "../../scripts/builder-client-worker";

const config = JSON.parse(await readFile(process.argv[2], "utf8"));
if (
  !path.basename(config.root).startsWith("kaizen-hosted-worker-test-") ||
  new URL(config.bridge).hostname !== "127.0.0.1"
)
  throw new Error("Use only the isolated hosted-worker fixture.");
if (new URL(config.loopbackOrigin).hostname !== "127.0.0.1")
  throw new Error("Fixture transport must use loopback.");
const fetchActual = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  return fetchActual(
    url.origin === config.registeredOrigin
      ? config.loopbackOrigin + url.pathname + url.search
      : input,
    init,
  );
};
const request = async (operation: string, input: any) => {
  const response = await fetch(config.bridge, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.bridgeToken}`,
    },
    body: JSON.stringify({ operation, input }),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error), { definitive: true });
  return result;
};
const run = promisify(execFile),
  compiler = await createClientCompiler();
const nginx = (args: string[]) =>
  run(
    config.binary,
    [
      "-p",
      config.prefix.replaceAll("\\", "/") + "/",
      "-c",
      "nginx.conf",
      ...args,
    ],
    { cwd: config.prefix, windowsHide: true, timeout: 15000 },
  );
try {
  await runClientPublication(config.jobId, {
    client: {
      getClient: (id) => request("get", id),
      rpc: (name, input) => request(name, input),
    },
    workerId: "fixture-worker",
    registry: config.registry,
    workDirectory: config.workDirectory,
    samplesRoot: path.resolve("public/builder-samples"),
    compile: compiler.compile,
    registeredAsset: async () => {
      throw new Error("Unexpected asset fetch");
    },
    adapters: {
      validateConfig: () => nginx(["-t"]),
      reload: () => nginx(["-s", "reload"]),
      beforeVerify: async () => {
        writeSync(1, "INTERRUPTING_HOSTED_WORKER_AFTER_NGINX_RELOAD\n");
        process.kill(process.pid, "SIGKILL");
      },
    },
  });
  throw new Error("The interruption point was not reached.");
} finally {
  await compiler.close();
}
