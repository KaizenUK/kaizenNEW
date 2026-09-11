// Fault injector for the isolated browser fixture only. It terminates its own
// process after a real Nginx reload, leaving genuine publisher/engine locks.
import path from "node:path";
import { readFile } from "node:fs/promises";
import { writeSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LocalProjects } from "../../scripts/builder-projects";
import { ClientPublisher } from "../../scripts/builder-client-publisher";
const [projectId, destinationId, rollbackOf, binary, mode] =
  process.argv.slice(2);
if (mode !== undefined && mode !== "--recover")
  throw new Error("Unsupported fault mode.");
const root = path.resolve("test-results/builder-browser-workspace");
const projects = new LocalProjects(root),
  project = await projects.require(projectId, true);
if (project.name !== "Published client fixture")
  throw new Error(
    "Only the dedicated publication browser fixture can be interrupted.",
  );
const prefix = path
    .resolve("test-results/builder-client-nginx")
    .replace(/\\/g, "/"),
  run = promisify(execFile);
const nginx = (args: string[]) =>
  run(binary, ["-p", prefix + "/", "-c", "nginx.conf", ...args], {
    windowsHide: true,
    timeout: 15000,
  });
const publisher = new ClientPublisher({
  directory: (id) => projects.directory(id),
  require: (id) => projects.require(id, true),
  workspace: async (id) =>
    JSON.parse(
      await readFile(
        path.join(projects.directory(id), "workspace.json"),
        "utf8",
      ),
    ),
  registry: () => path.resolve("test-results/builder-client-destinations.json"),
  samplesRoot: path.resolve("public/builder-samples"),
  compile: async () => {
    throw new Error("Rollback must reuse its retained artifact.");
  },
  adapters: () => ({
    validateConfig: () => nginx(["-t"]),
    reload: async () => {
      await nginx(["-s", "reload"]);
      if (mode === "--recover") {
        writeSync(1, "INTERRUPTING_RECOVERY_AFTER_NGINX_RELOAD\n");
        process.kill(process.pid, "SIGKILL");
      }
    },
    beforeVerify: async () => {
      writeSync(1, "INTERRUPTING_AFTER_NGINX_RELOAD\n");
      process.kill(process.pid, "SIGKILL");
    },
  }),
});
if (mode === "--recover") {
  await publisher.recover(projectId, rollbackOf);
  throw new Error("Recovery interruption point was not reached.");
}
const review = await publisher.review(
  projectId,
  destinationId,
  "rollback",
  rollbackOf,
);
const job = await publisher.start(projectId, review.id);
// Keep the helper alive until the actual fault point, or fail loudly if it was not reached.
for (;;) {
  const status = (await publisher.jobs(projectId)).find(
    (value) => value.id === job.id,
  )!;
  if (
    ["live", "failed", "rolled_back", "recovery_required"].includes(
      status.phase,
    )
  )
    throw new Error(
      `The interruption point was not reached: ${JSON.stringify(status)}`,
    );
  await new Promise((resolve) => setTimeout(resolve, 50));
}
