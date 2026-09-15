/** Trusted hosted publication worker. Run on the operator-configured destination host. */
import {
  mkdir,
  lstat,
  opendir,
  readFile,
  realpath,
  rename,
  writeFile,
  unlink,
  rmdir,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  createReleaseClient,
  releaseEvidence,
} from "./builder-release-worker.mjs";
import {
  readClientDestinations,
  clientPublicationAction,
} from "./client-publication.mjs";
import { loadPublicationAsset } from "./builder-publication-media";
import { validateBackupWorkspace } from "../shared/builderBackup";
import { assertProjectAssetReferences } from "../shared/builderProjectOperations";
import type { ClientPublicationSnapshot } from "../shared/builderClientPublication";
import { verifyRelease } from "./kaizen-releases.mjs";
import { inspectProcessLock, withRecoveryLock } from "./release-recovery.mjs";
import {
  clientRetirementWorker,
  maintainClientReleases,
} from "./builder-client-release-maintenance";
import type { ClientRetirementWorker } from "./builder-release-retention";
import { releaseRetentionPolicy } from "./release-retention.mjs";
import {
  generatedAge,
  inventoryGeneratedTree,
  removeGeneratedEntries,
} from "./release-generated-files.mjs";

const uuid = (id: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    id,
  );
type WorkerServices = {
  client: {
    getClient: (id: string) => Promise<any>;
    rpc: (name: string, input: any) => Promise<any>;
  };
  workerId: string;
  registry: string;
  workDirectory: string;
  samplesRoot: string;
  registeredAsset: (projectId: string, assetId: string) => Promise<Uint8Array>;
  compile: (
    snapshot: ClientPublicationSnapshot,
    load: (url: string) => Promise<Uint8Array>,
    progress: (text: string) => void,
  ) => Promise<{
    files: Record<string, Uint8Array>;
    backup: Uint8Array;
    redirects: unknown[];
    warnings: string[];
  }>;
  adapters?: Record<string, any>;
};
async function validateWorkDirectory(directory: string, destinations: any[]) {
  const key = (value: string) =>
    process.platform === "win32" ? value.toLowerCase() : value;
  const resolved = path.resolve(directory);
  if (
    !path.isAbsolute(directory) ||
    resolved === path.parse(resolved).root ||
    key(resolved) === key(os.homedir())
  )
    throw new Error(
      "Configure a dedicated absolute private worker directory outside the release stores.",
    );
  for (const destination of destinations) {
    const work = key(resolved),
      store = key(destination.store);
    if (
      work === store ||
      work.startsWith(store + path.sep) ||
      store.startsWith(work + path.sep)
    )
      throw new Error(
        "Private worker storage must be separate from every configured release store.",
      );
  }
  let ancestor = resolved;
  for (;;) {
    const stat = await lstat(ancestor).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (stat) {
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        key(await realpath(ancestor)) !== key(ancestor)
      )
        throw new Error(
          "Private worker storage cannot use linked or non-directory paths.",
        );
      return;
    }
    ancestor = path.dirname(ancestor);
  }
}
export async function runClientPublication(
  jobId: string,
  services: WorkerServices,
) {
  try {
    return await executeClientPublication(jobId, services);
  } catch (error) {
    // A configuration/filesystem failure before claim must not leave a queued
    // job pretending a worker is still preparing it. The RPC refuses any claim.
    if (
      !error.queuedReported &&
      uuid(jobId) &&
      /^[a-zA-Z0-9_-]{1,100}$/.test(services.workerId)
    ) {
      try {
        await services.client.rpc("builder_client_fail_queued", {
          job_id: jobId,
          worker: services.workerId,
          detail:
            "Worker could not prepare this queued release. Check its destination configuration and worker logs.",
        });
      } catch {
        /* A live claim or unavailable service must retain its current state. */
      }
    }
    throw error;
  }
}
async function executeClientPublication(
  jobId: string,
  services: WorkerServices,
) {
  if (!uuid(jobId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(services.workerId))
    throw new Error("Invalid client job or worker identifier.");
  const queued = await services.client.getClient(jobId);
  const destinations = await readClientDestinations(services.registry);
  const destination = destinations.find(
    (d: any) =>
      d.destinationId === queued.destination_id &&
      d.projectId === queued.project_id,
  );
  if (
    !destination ||
    queued.worker_id !== services.workerId ||
    ["projectId", "destinationId", "origin", "environment"].some(
      (key) => destination[key] !== queued.destination?.[key],
    )
  )
    throw new Error(
      "The queued job does not match this worker's configured client destination.",
    );
  // Verify the dedicated store binding before creating any private request files.
  await clientPublicationAction(destination, "list");
  await validateWorkDirectory(services.workDirectory, destinations);
  await mkdir(services.workDirectory, { recursive: true, mode: 0o700 });
  if ((await lstat(services.workDirectory)).isSymbolicLink())
    throw new Error("Client worker storage must not be linked.");
  const requests = path.join(services.workDirectory, destination.destinationId);
  await mkdir(requests, { recursive: true, mode: 0o700 });
  if ((await lstat(requests)).isSymbolicLink())
    throw new Error("Client request storage must not be linked.");
  const root = path.join(requests, jobId);
  await mkdir(root, { recursive: true });
  if ((await lstat(root)).isSymbolicLink())
    throw new Error("Client request storage must not be linked.");
  const lock = path.join(root, ".worker-lock"),
    token = randomUUID();
  await mkdir(lock).catch((error) => {
    if (error.code === "EEXIST")
      throw new Error(
        "This job has a worker lock. Verify the recorded worker before recovery.",
      );
    throw error;
  });
  let releaseLock = false,
    job: any,
    log = "";
  const append = (text: string) => {
    log = (log + text + "\n").slice(-100000);
  };
  const progress = (phase: string, detail = "") =>
    services.client.rpc("builder_client_progress", {
      job_id: jobId,
      token,
      next_phase: phase,
      detail,
    });
  try {
    await writeFile(
      path.join(lock, "owner.json"),
      JSON.stringify({
        pid: process.pid,
        host: os.hostname(),
        jobId,
        token,
        createdAt: new Date().toISOString(),
      }),
      { flag: "wx" },
    );
    try {
      job = await services.client.rpc("builder_client_claim", {
        job_id: jobId,
        worker: services.workerId,
        token,
      });
    } catch (error) {
      try {
        await services.client.rpc("builder_client_fail_queued", {
          job_id: jobId,
          worker: services.workerId,
          detail:
            "Worker could not claim this queued release. Check its permission and destination configuration.",
        });
        releaseLock = true;
        error.queuedReported = true;
      } catch {
        /* A claim may have committed; retain its token and lock. */
      }
      throw error;
    }
    if (job.id !== jobId || job.owner_token !== token)
      throw new Error("The service did not confirm this worker's ownership.");
    await writeFile(
      path.join(root, `${token}.snapshot.json`),
      JSON.stringify(job.snapshot),
      { flag: "wx" },
    );
    if (job.snapshot !== null) {
      if (
        job.snapshot.schemaVersion !== 1 ||
        job.snapshot.projectId !== destination.projectId
      )
        throw new Error("Snapshot belongs to a different client.");
      validateBackupWorkspace(job.snapshot.workspace);
      assertProjectAssetReferences(
        job.snapshot.workspace,
        destination.projectId,
      );
    }
    if (job.action === "publish") {
      if (!job.snapshot)
        throw new Error("The publication snapshot is missing.");
      const compiled = await services.compile(
        job.snapshot,
        (url) =>
          loadPublicationAsset(job.snapshot, url, {
            samplesRoot: services.samplesRoot,
            registered: (id) =>
              services.registeredAsset(destination.projectId, id),
          }),
        append,
      );
      const output = path.join(root, `site-${token}`);
      await mkdir(output);
      for (const [name, bytes] of Object.entries(compiled.files)) {
        if (
          !name ||
          name.includes("\\") ||
          name.includes(":") ||
          name.split("/").some((part) => !part || part === "." || part === "..")
        )
          throw new Error("Compiler returned an unsafe file path.");
        const file = path.join(output, name);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, bytes, { flag: "wx" });
      }
      await writeFile(
        path.join(root, `${token}.project.zip`),
        compiled.backup,
        { flag: "wx" },
      );
      const redirects = path.join(root, `${token}.redirects.json`);
      await writeFile(redirects, JSON.stringify(compiled.redirects), {
        flag: "wx",
      });
      compiled.warnings.forEach(append);
      await clientPublicationAction(destination, "stage", {
        source: output,
        id: job.artifact_id,
        redirects,
      });
    }
    const checkConfiguration = async () => {
      const current = (await readClientDestinations(services.registry)).find(
        (d: any) => d.destinationId === destination.destinationId,
      );
      if (JSON.stringify(current) !== JSON.stringify(destination))
        throw new Error(
          "Worker destination configuration changed during publication.",
        );
      if (
        (await clientPublicationAction(destination, "list"))
          .selectedReleaseId !== job.previous_artifact_id
      )
        throw new Error(
          "The selected destination artifact changed externally.",
        );
    };
    await checkConfiguration();
    await progress("activating", log);
    await clientPublicationAction(
      destination,
      job.action === "unpublish"
        ? "unpublish"
        : job.action === "rollback"
          ? "rollback"
          : "activate",
      { id: job.artifact_id },
      {
        ...services.adapters,
        beforeSwitch: async () => {
          await checkConfiguration();
          await progress("activating");
        },
        beforeVerify: async () => {
          await progress("verifying");
          await services.adapters?.beforeVerify?.();
        },
        finalize: async (manifest: any) => {
          try {
            await services.client.rpc("builder_client_finalize", {
              job_id: jobId,
              token,
              verification: {
                ...releaseEvidence(manifest),
                ...manifest.client,
              },
            });
          } catch (error) {
            if (!error.definitive) error.releaseCommitUncertain = true;
            throw error;
          }
        },
      },
    );
    releaseLock = true;
    return { id: jobId, phase: "live", destination: job.destination };
  } catch (error) {
    if (job) {
      const phase =
        error.releaseCommitUncertain ||
        /recovery|externally|uncertain/i.test(error.message)
          ? "recovery_required"
          : /previous release was restored/i.test(error.message)
            ? "rolled_back"
            : "failed";
      try {
        await progress(phase, error.message);
        releaseLock = phase !== "recovery_required";
      } catch {
        /* Preserve ownership for operator reconciliation after an ambiguous acknowledgement. */
      }
    }
    throw error;
  } finally {
    if (releaseLock) {
      await unlink(path.join(lock, "owner.json"));
      await rmdir(lock);
    }
  }
}

/** Operator-only: reconcile a stopped original claim, never manufacture ownership. */
export async function recoverClientPublication(
  jobId: string,
  services: Pick<
    WorkerServices,
    "client" | "workerId" | "registry" | "workDirectory" | "adapters"
  >,
  restorePrevious = false,
) {
  if (!uuid(jobId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(services.workerId))
    throw new Error("Invalid client job or worker identifier.");
  const job = await services.client.getClient(jobId);
  const destinations = await readClientDestinations(services.registry);
  const destination = destinations.find(
    (d: any) =>
      d.destinationId === job.destination_id && d.projectId === job.project_id,
  );
  if (
    !destination ||
    job.worker_id !== services.workerId ||
    ["projectId", "destinationId", "origin", "environment"].some(
      (key) => destination[key] !== job.destination?.[key],
    )
  )
    throw new Error(
      "This job does not match the configured destination worker.",
    );
  await validateWorkDirectory(services.workDirectory, destinations);
  const root = path.join(
    services.workDirectory,
    destination.destinationId,
    jobId,
  );
  for (const directory of [services.workDirectory, path.dirname(root), root]) {
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("Recovery storage must be an ordinary directory.");
  }
  const lock = path.join(root, ".worker-lock");
  const original = await inspectProcessLock(lock);
  if (
    !original ||
    original.owner.jobId !== jobId ||
    !uuid(original.owner.token || "")
  )
    throw new Error("Recovery requires the original worker ownership record.");
  if (!original.stopped)
    throw new Error(
      "The recorded worker is still running or cannot be proven stopped on this host.",
    );
  return withRecoveryLock(
    lock,
    async (owner: any) => {
      if (owner.token !== original.owner.token || owner.jobId !== jobId)
        throw new Error("Original worker ownership changed before recovery.");
      const token = owner.token;
      const current = await services.client.getClient(jobId);
      if (
        current.owner_token === null &&
        ["queued", "failed"].includes(current.phase)
      ) {
        await services.client.rpc("builder_client_fail_queued", {
          job_id: jobId,
          worker: services.workerId,
          detail:
            "Operator cancelled the stopped worker's unclaimed request. Review a new release to publish.",
        });
        return { id: jobId, phase: "failed", destination: job.destination };
      }
      if (current.owner_token !== token)
        throw new Error(
          "The database claim does not match the original worker token.",
        );
      if (current.snapshot !== null) {
        if (
          current.snapshot.schemaVersion !== 1 ||
          current.snapshot.projectId !== destination.projectId
        )
          throw new Error("Recovery snapshot belongs to a different client.");
        validateBackupWorkspace(current.snapshot.workspace);
        assertProjectAssetReferences(
          current.snapshot.workspace,
          destination.projectId,
        );
      }
      const selected = (await clientPublicationAction(destination, "list"))
        .selectedReleaseId;
      if (
        ![current.artifact_id, current.previous_artifact_id].includes(selected)
      )
        throw new Error(
          "The selected artifact is unrelated to this job. Preserve it for operator inspection.",
        );
      const target = restorePrevious ? current.previous_artifact_id : selected;
      const activationOwner = await inspectProcessLock(
        path.join(destination.store, ".activation-lock"),
      );
      if (
        activationOwner &&
        (activationOwner.owner.pid !== original.owner.pid ||
          activationOwner.owner.host !== original.owner.host)
      )
        throw new Error(
          "The activation lock belongs to a different process. Preserve both records for operator inspection.",
        );
      const begin = async () => {
        const configured = (
          await readClientDestinations(services.registry)
        ).find((d: any) => d.destinationId === destination.destinationId);
        if (JSON.stringify(configured) !== JSON.stringify(destination))
          throw new Error(
            "Worker destination configuration changed during recovery.",
          );
        return services.client.rpc("builder_client_recovery_begin", {
          job_id: jobId,
          worker: services.workerId,
          token,
          selected_artifact: target,
        });
      };
      await begin();
      let recovered: any;
      try {
        await clientPublicationAction(
          destination,
          "reconcile",
          {
            id: selected,
            ...(target !== selected ? { restoreId: target } : {}),
          },
          {
            ...services.adapters,
            beforeReconcile: async (manifest: any) => {
              await begin();
              await services.adapters?.beforeReconcile?.(manifest);
            },
            finalize: async (manifest: any) => {
              const configured = (
                await readClientDestinations(services.registry)
              ).find((d: any) => d.destinationId === destination.destinationId);
              if (JSON.stringify(configured) !== JSON.stringify(destination))
                throw new Error(
                  "Worker destination configuration changed during recovery.",
                );
              recovered = await services.client.rpc(
                "builder_client_recovery_finalize",
                {
                  job_id: jobId,
                  worker: services.workerId,
                  token,
                  verification: {
                    ...releaseEvidence(manifest),
                    ...manifest.client,
                  },
                },
              );
            },
          },
        );
      } catch (error) {
        try {
          await services.client.rpc("builder_client_recovery_error", {
            job_id: jobId,
            token,
            detail: error.message,
          });
        } catch {
          /* An acknowledgement may be lost; retain both ownership records. */
        }
        throw error;
      }
      return {
        id: jobId,
        phase: recovered.phase,
        destination: job.destination,
      };
    },
    jobId,
  );
}

/** Runs after queued jobs in the same service invocation, so systemd never
 * lets retirement hold a destination lock while this worker publishes to it.
 * Owned attempts are finished every invocation; new retirement is rate-limited
 * and removes at most one release per invocation. */
export async function maintainClientDestinations(
  services: Pick<
    WorkerServices,
    "client" | "workerId" | "registry" | "workDirectory" | "adapters"
  > & {
    environment?: NodeJS.ProcessEnv;
    now?: () => number;
    retirementWorker?: (input: {
      workerId: string;
      destination: any;
    }) => Promise<ClientRetirementWorker>;
  },
  { newWork = true } = {},
) {
  const env = services.environment || process.env;
  const interval = env.BUILDER_RELEASE_MAINTENANCE_INTERVAL_MINUTES ?? "60";
  if (
    !/^[1-9][0-9]{0,4}$/.test(interval) ||
    Number(interval) > 10080 ||
    ![undefined, "0", "1"].includes(env.BUILDER_RELEASE_RETENTION_ENABLED)
  )
    throw new Error(
      "Configure release retention as 0 or 1 and its maintenance interval as 1–10080 minutes.",
    );
  const destinations = await readClientDestinations(services.registry);
  let due = false;
  if (env.BUILDER_RELEASE_RETENTION_ENABLED === "1" && newWork) {
    await validateWorkDirectory(services.workDirectory, destinations);
    await mkdir(services.workDirectory, { recursive: true, mode: 0o700 });
    if ((await lstat(services.workDirectory)).isSymbolicLink())
      throw new Error("Client worker storage must not be linked.");
    // A schedule marker only: it grants no ownership or deletion authority.
    const marker = path.join(
      services.workDirectory,
      "release-maintenance.json",
    );
    const now = (services.now || Date.now)();
    const info = await lstat(marker).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (info && (!info.isFile() || info.size > 1024))
      throw new Error("The release maintenance schedule file is unsafe.");
    let last = 0;
    try {
      if (info)
        last = Date.parse(JSON.parse(await readFile(marker, "utf8")).startedAt);
    } catch {
      last = 0;
    }
    due = !(last <= now && now - last < Number(interval) * 60000);
    if (due) {
      // Written first, so a crashing retirement cannot retry in a tight loop.
      const temporary = `${marker}.${randomUUID()}.tmp`;
      await writeFile(
        temporary,
        JSON.stringify({
          schemaVersion: 1,
          startedAt: new Date(now).toISOString(),
        }),
        { flag: "wx", mode: 0o600 },
      );
      await rename(temporary, marker);
    }
  }
  const results: Record<string, unknown>[] = [];
  let retired = false;
  for (const destination of destinations) {
    const store = await lstat(destination.store).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!store) continue;
    try {
      const clientWorker = await (
        services.retirementWorker || clientRetirementWorker
      )({ workerId: services.workerId, destination });
      const result = await maintainClientReleases(
        {
          environment: env,
          destination,
          workerId: services.workerId,
          connection: services.client,
          clientWorker,
          recoverOnly: !due || retired,
        },
        services.adapters,
      );
      if (result.phase === "removed" && !(result as any).recovered)
        retired = true;
      results.push({ destinationId: destination.destinationId, ...result });
    } catch (error) {
      // One destination needing reconciliation must not stop the others.
      results.push({
        destinationId: destination.destinationId,
        phase: "needs-reconciliation",
        error: error.message,
      });
    }
  }
  if (due) {
    const jobs = await reclaimClientJobDirectories(
      services,
      destinations,
      env,
      (services.now || Date.now)(),
    );
    if (jobs.removed) results.push({ phase: "job-directories", ...jobs });
  }
  return results;
}

/** Private per-job build directories. A job gives up its snapshot, backup and
 * compiled copy only when its database phase is final, no worker or recovery
 * lock remains, and visitor grace has passed. */
async function reclaimClientJobDirectories(
  services: Pick<WorkerServices, "client" | "workDirectory">,
  destinations: any[],
  env: NodeJS.ProcessEnv,
  now: number,
) {
  const summary = { removed: 0, bytes: 0 },
    base = services.workDirectory;
  const grace = releaseRetentionPolicy(env).visitorGraceDays * 86400000;
  for (const destination of destinations) {
    const folder = path.join(base, destination.destinationId);
    const info = await lstat(folder).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!info) continue;
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Client request storage must not be linked.");
    const names: string[] = [];
    for await (const entry of await opendir(folder)) {
      if (names.length >= 10000) break;
      names.push(entry.name);
    }
    for (const name of names.sort()) {
      if (summary.removed >= 1000 || !uuid(name)) continue;
      const relative = `${destination.destinationId}/${name}`,
        top = await lstat(path.join(base, relative));
      if (
        !top.isDirectory() ||
        top.isSymbolicLink() ||
        generatedAge(top, now) < grace
      )
        continue;
      let job;
      try {
        job = await services.client.getClient(name);
      } catch {
        continue; // An unavailable record keeps the private files.
      }
      if (
        job?.id !== name ||
        !["live", "failed", "rolled_back"].includes(job.phase)
      )
        continue;
      const entries = await inventoryGeneratedTree(base, relative);
      if (
        entries.some((entry) =>
          entry.path.split("/").some((part) => part.startsWith(".worker-lock")),
        )
      )
        continue;
      const removed = await removeGeneratedEntries(base, entries);
      summary.removed++;
      summary.bytes += removed.bytes;
    }
  }
  return summary;
}

export async function createClientCompiler() {
  const { createServer } = await import("vite");
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.vite-client-worker",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null },
    appType: "custom",
    resolve: {
      alias: { "@": path.resolve("client"), "@shared": path.resolve("shared") },
    },
  });
  try {
    const module = await server.ssrLoadModule(
      "/client/visual-builder/compileClientPublication.tsx",
    );
    return {
      compile: module.compileClientPublication as WorkerServices["compile"],
      close: () => server.close(),
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}

async function cli() {
  const env = process.env;
  const workerId = env.BUILDER_CLIENT_WORKER_ID || "",
    registry = env.BUILDER_CLIENT_DESTINATIONS_FILE || "";
  const workDirectory = env.BUILDER_CLIENT_WORK_DIRECTORY || "";
  const url = env.SUPABASE_URL || "",
    key = env.BUILDER_RELEASE_SERVICE_ROLE_KEY || "";
  const client = createReleaseClient({ url, key });
  if (!workerId || !registry)
    throw new Error(
      "Configure BUILDER_CLIENT_WORKER_ID, BUILDER_CLIENT_DESTINATIONS_FILE and BUILDER_CLIENT_WORK_DIRECTORY.",
    );
  const args = process.argv.slice(2);
  if (args[0] === "--provision" && args.length === 2 && uuid(args[1])) {
    const destination = (await readClientDestinations(registry)).find(
      (d: any) => d.destinationId === args[1],
    );
    if (!destination)
      throw new Error(
        "Choose a destination from this worker's server registry.",
      );
    const selected = await clientPublicationAction(destination, "list");
    if (!selected.selectedReleaseId)
      throw new Error(
        "Initialize and connect the destination before provisioning hosted publication.",
      );
    await clientPublicationAction(destination, "verify-live", {
      id: selected.selectedReleaseId,
    });
    const manifest = await verifyRelease(
      destination.store,
      selected.selectedReleaseId,
    );
    const configured = await client.rpc("builder_client_provision", {
      target: destination.projectId,
      destination_id: destination.destinationId,
      environment: destination.environment,
      origin: destination.origin,
      label: destination.label,
      worker: workerId,
      baseline_artifact: manifest.id,
      verification: { ...releaseEvidence(manifest), ...manifest.client },
    });
    process.stdout.write(
      JSON.stringify({
        destination: configured,
        status: "configured",
        baselineArtifact: manifest.id,
      }) + "\n",
    );
    return;
  }
  if (!workDirectory)
    throw new Error(
      "Configure BUILDER_CLIENT_WORK_DIRECTORY for private builds outside the release stores.",
    );
  if (
    args[0] === "--recover" &&
    uuid(args[1] || "") &&
    (args.length === 2 ||
      (args.length === 3 && args[2] === "--restore-previous"))
  ) {
    const result = await recoverClientPublication(
      args[1],
      { client, workerId, registry, workDirectory },
      args[2] === "--restore-previous",
    );
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }
  if (args.length > 1 || (args[0] && args[0] !== "--once" && !uuid(args[0])))
    throw new Error(
      "Use --provision <destination UUID>, --once, one job UUID, or --recover <job UUID> [--restore-previous].",
    );
  const scheduled = !args[0] || args[0] === "--once";
  const maintain = async (newWork: boolean) => {
    for (const result of await maintainClientDestinations(
      { client, workerId, registry, workDirectory },
      { newWork },
    )) {
      if (result.error) {
        process.stderr.write(JSON.stringify(result) + "\n");
        process.exitCode = 1;
      } else if (result.phase !== "disabled")
        process.stdout.write(JSON.stringify(result) + "\n");
    }
  };
  // A killed retirement can hold a destination's activation lock. Finish owned
  // attempts first so queued publications do not fail on that stale lock.
  if (scheduled) await maintain(false);
  const jobs =
    args[0] && args[0] !== "--once"
      ? [{ id: args[0] }]
      : await client.queuedClients(workerId);
  if (jobs.length) await runQueuedJobs(jobs);
  // Publication always precedes new retained-release maintenance.
  if (scheduled) await maintain(true);
  async function runQueuedJobs(jobs: { id: string }[]) {
    // Vite loads only the trusted checkout renderer; uploaded source is never imported.
    const compiler = await createClientCompiler();
    try {
      for (const job of jobs) {
        try {
          const result = await runClientPublication(job.id, {
            client,
            workerId,
            registry,
            workDirectory,
            samplesRoot: path.resolve("public/builder-samples"),
            compile: compiler.compile,
            registeredAsset: async (projectId, assetId) => {
              if (!uuid(projectId) || !uuid(assetId))
                throw new Error("Invalid private asset reference.");
              const response = await fetch(
                new URL(
                  `/storage/v1/object/builder-project-files/${projectId}/${assetId}`,
                  url,
                ),
                {
                  headers: { apikey: key, Authorization: `Bearer ${key}` },
                  redirect: "error",
                  signal: AbortSignal.timeout(30000),
                },
              );
              if (!response.ok || !response.body)
                throw new Error(
                  "Private client media could not be retrieved by the worker.",
                );
              const reader = response.body.getReader(),
                chunks: Uint8Array[] = [];
              let size = 0;
              try {
                for (;;) {
                  const part = await reader.read();
                  if (part.done) break;
                  size += part.value.length;
                  if (size > 32 * 1024 * 1024)
                    throw new Error(
                      "Published media must be smaller than 32 MB.",
                    );
                  chunks.push(part.value);
                }
              } finally {
                await reader.cancel().catch(() => {});
              }
              const bytes = new Uint8Array(size);
              let offset = 0;
              for (const chunk of chunks) {
                bytes.set(chunk, offset);
                offset += chunk.length;
              }
              return bytes;
            },
          });
          process.stdout.write(JSON.stringify(result) + "\n");
        } catch (error) {
          process.stderr.write(
            JSON.stringify({ id: job.id, error: error.message }) + "\n",
          );
          process.exitCode = 1;
        }
      }
    } finally {
      await compiler.close();
    }
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  cli().catch((error) => {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  });
