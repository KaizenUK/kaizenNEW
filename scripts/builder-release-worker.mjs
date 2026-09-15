import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { config as loadEnv } from "dotenv";
import {
  withNativeRelease,
  assertNativeRelease,
} from "./builder-native-release-guard.mjs";
import {
  RepositoryOutputAccounting,
  assertRepositoryOutputTarget,
  reconcileRepositoryOutput,
} from "./builder-repository-output.mjs";
import {
  activateRelease,
  stageRelease,
  verifyRelease,
  checkLive,
  listReleases,
} from "./kaizen-releases.mjs";

const uuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value || "",
  );
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function createReleaseClient({ url, key, fetcher = fetch }) {
  const endpoint = new URL(url);
  if (
    !key ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/" ||
    endpoint.search ||
    endpoint.hash ||
    !(
      endpoint.protocol === "https:" ||
      (endpoint.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(endpoint.hostname))
    )
  )
    throw new Error(
      "Configure the server-only builder release URL and service credential.",
    );
  async function request(route, body) {
    let failure;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetcher(new URL(`/rest/v1/${route}`, endpoint), {
          method: body === undefined ? "GET" : "POST",
          redirect: "error",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          // Never print request bodies, URLs, tokens or arbitrary proxy response text.
          const payload = await response.json().catch(() => ({}));
          const error = new Error(
            response.status < 500 &&
              ["P0001", "P0409", "P0429"].includes(payload.code) &&
              typeof payload.message === "string"
              ? payload.message.slice(0, 2000)
              : `Release service returned HTTP ${response.status}${/^[A-Z0-9]{5,10}$/.test(payload.code || "") ? ` (${payload.code})` : ""}. Check the worker configuration and service logs.`,
          );
          error.definitive = response.status >= 400 && response.status < 500;
          error.code = /^[A-Z0-9]{5,10}$/.test(payload.code || "")
            ? payload.code
            : undefined;
          throw error;
        }
        return await response.json();
      } catch (error) {
        if (error.definitive) throw error;
        failure = new Error(
          "Release service could not confirm the operation. Keep this release pending and inspect the worker before retrying.",
        );
        if (attempt < 2) await pause(250 * (attempt + 1));
      }
    }
    throw failure;
  }
  return {
    rpc: (name, body) => {
      if (!/^builder_[a-z_]+$/.test(name))
        throw new Error("Invalid release operation");
      return request(`rpc/${name}`, body);
    },
    async get(id) {
      if (!uuid(id)) throw new Error("Invalid release request ID");
      const rows = await request(`builder_releases?id=eq.${id}&select=*`);
      if (!Array.isArray(rows) || rows.length !== 1)
        throw new Error("Release request was not found.");
      return rows[0];
    },
    async getClient(id) {
      if (!uuid(id)) throw new Error("Invalid client release request ID");
      const rows = await request(`builder_client_jobs?id=eq.${id}&select=*`);
      if (!Array.isArray(rows) || rows.length !== 1)
        throw new Error("Client release request was not found.");
      return rows[0];
    },
    async queuedClients(worker) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(worker))
        throw new Error("Invalid client worker identifier");
      return request(
        `builder_client_jobs?worker_id=eq.${worker}&phase=eq.queued&select=id&order=created_at.asc&limit=20`,
      );
    },
  };
}
export function releaseEvidence(manifest) {
  return {
    artifactId: manifest.id,
    manifestSha256: createHash("sha256")
      .update(JSON.stringify(manifest))
      .digest("hex"),
    checkedResponses:
      manifest.checks.length + (manifest.redirectChecks?.length || 0) + 1,
  };
}

/** One worker owns build -> file activation -> verified database promotion. Adapters exercise the real protocol in tests. */
export async function runBuilderRelease(options, adapters = {}) {
  if (options.native)
    return withNativeRelease(
      options,
      options.billing?.projectId || "kaizen",
      (input) => runBuilderRelease(input, adapters),
    );
  const { client, store, origin, artifactId, commit = "", build } = options;
  if (options.billing) {
    assertRepositoryOutputTarget(options.billing);
    if (
      options.billing.projectId !== "kaizen" ||
      options.billing.channel !== "production"
    )
      throw new Error(
        "The original website coordinator requires its fixed production billing destination.",
      );
  }
  const stage = adapters.stage || stageRelease,
    activate = adapters.activate || activateRelease;
  const verify = adapters.verify || verifyRelease,
    health = adapters.health || checkLive,
    list = adapters.list || listReleases;
  const id = options.requestId || randomUUID(),
    owner = options.ownerId || randomUUID();
  if (!uuid(id) || !uuid(owner))
    throw new Error("Invalid release request or worker ID");
  if (!options.requestId)
    await client.rpc("builder_queue_deployment", { request_id: id });
  const queued = await client.get(id);
  const artifact = queued.rollback_of ? queued.artifact_id : artifactId;
  let claimed;
  try {
    claimed = await client.rpc("builder_claim_release", {
      request_id: id,
      owner_id: owner,
      artifact,
    });
  } catch (error) {
    try {
      // The transactional failure operation refuses to cancel a concurrent/in-flight successful claim.
      await client.rpc("builder_fail_queued_release", {
        request_id: id,
        detail:
          "The worker could not claim this release. Inspect the deployment configuration and publication baseline before publishing again.",
      });
    } catch {
      /* An uncertain or already claimed request keeps its ownership. */
    }
    throw error;
  }
  if (claimed.status !== "building")
    throw new Error(
      "This release is already in progress or complete. Inspect its status before restarting.",
    );
  let accounting;
  const advance = (phase, proof = null, detail = null) =>
    client.rpc("builder_advance_release", {
      request_id: id,
      owner_id: owner,
      phase,
      proof,
      detail,
    });
  let attemptedSwitch = false;
  try {
    if (options.sourceRoot)
      await options.nativeFiles?.assertRepository(options.sourceRoot);
    accounting = options.billing
      ? new RepositoryOutputAccounting(client, {
          ...options.billing,
          id,
          artifactId: artifact,
          commit: claimed.rollback_of
            ? (await verify(store, artifact)).commit
            : commit,
          sourceRoot: options.sourceRoot,
          recovery:
            Boolean(claimed.rollback_of) ||
            claimed.request?.action === "unpublish",
        })
      : undefined;
    await accounting?.prepareSource();
    if (!claimed.rollback_of) {
      const directory = path.join(store, "requests");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const snapshotFile = path.join(directory, `${id}.json`);
      options.nativeFiles?.assertBytes(
        Buffer.from(JSON.stringify(claimed.snapshot)),
        "snapshot.json",
      );
      // Exclusive creation catches accidental job re-use rather than replacing an uncertain build input.
      await writeFile(snapshotFile, JSON.stringify(claimed.snapshot), {
        flag: "wx",
        mode: 0o600,
      });
      await build(snapshotFile);
      if (options.sourceRoot)
        await options.nativeFiles?.assertRepository(options.sourceRoot);
      await options.nativeFiles?.assertTree(options.source);
      await stage({ store, id: artifact, source: options.source, commit });
    }
    const hooks = {
      async beforePrepare(manifest, old) {
        await assertNativeRelease(options, manifest);
        await assertNativeRelease(options, old);
      },
      async beforeSwitch(manifest, old) {
        if (claimed.previous_release_id) {
          const previous = await client.get(claimed.previous_release_id);
          if (old.id !== previous.artifact_id)
            throw new Error(
              "The serving artifact does not match the database release. Reconcile it before deploying.",
            );
        }
        await accounting?.begin(manifest);
        await advance("activating");
        attemptedSwitch = true;
      },
      async beforeVerify() {
        await advance("verifying");
      },
      async finalize(manifest) {
        try {
          await advance("live", releaseEvidence(manifest));
        } catch (error) {
          // Read back a possibly committed response before deciding whether file rollback is safe.
          let current;
          try {
            current = await client.get(id);
          } catch {
            const uncertain = new Error(
              "The new artifact is verified, but the publication acknowledgement is uncertain. Keep the release pending and reconcile its worker transaction.",
            );
            uncertain.releaseCommitUncertain = true;
            throw uncertain;
          }
          if (current.status !== "live" || current.artifact_id !== artifact)
            throw error;
        }
        await accounting?.live();
      },
    };
    await activate({ store, id: artifact, origin }, hooks);
    return { id, artifactId: artifact, status: "live" };
  } catch (error) {
    try {
      const current = await client.get(id);
      if (current.status === "live") {
        // File journaling may have failed after the DB commit; verify the committed serving artifact.
        await health(origin, await verify(store, artifact));
        await accounting?.live();
        return { id, artifactId: artifact, status: "live" };
      }
      if (current.status === "building" && !attemptedSwitch) {
        await accounting?.failed();
        await advance(
          "failed",
          null,
          "The build or release preparation failed. Inspect the deployment logs, correct the error and publish again.",
        );
      } else if (
        ["activating", "verifying", "recovery_required"].includes(
          current.status,
        )
      ) {
        const selected = (await list(store)).selectedReleaseId;
        const previous = claimed.previous_release_id
          ? await client.get(claimed.previous_release_id)
          : null;
        if (
          selected &&
          selected !== artifact &&
          (!previous || previous.artifact_id === selected)
        ) {
          const old = await verify(store, selected);
          await health(origin, old);
          await accounting?.failed();
          await advance(
            "rolled_back",
            releaseEvidence(old),
            "Deployment failed. The previous release was restored and verified; inspect the deployment logs before publishing again.",
          );
        } else if (current.status !== "recovery_required") {
          await advance(
            "recovery_required",
            null,
            "The serving release could not be reconciled. Inspect the worker transaction and public release marker before another deployment.",
          );
        }
      }
    } catch {
      // Preserve pending ownership when the service or observed baseline cannot be reached.
      // Never turn uncertain activation into a successful or safely rolled-back status.
    }
    throw error;
  }
}

export async function runRepositoryRelease(options, adapters = {}) {
  if (options.native)
    return withNativeRelease(options, options.billing?.projectId, (input) =>
      runRepositoryRelease(input, adapters),
    );
  const {
    client,
    store,
    origin,
    artifactId,
    commit,
    source,
    sourceRoot,
    build,
    billing,
  } = options;
  if (!billing)
    throw new Error("Configure website output accounting before deploying.");
  const accounting = new RepositoryOutputAccounting(client, {
    ...billing,
    id: options.requestId || randomUUID(),
    artifactId,
    commit,
    sourceRoot,
  });
  const stage = adapters.stage || stageRelease,
    activate = adapters.activate || activateRelease;
  const verify = adapters.verify || verifyRelease,
    list = adapters.list || listReleases,
    health = adapters.health || checkLive;
  try {
    if (sourceRoot) await options.nativeFiles?.assertRepository(sourceRoot);
    await accounting.prepareSource();
    await build(undefined);
    if (sourceRoot) await options.nativeFiles?.assertRepository(sourceRoot);
    await options.nativeFiles?.assertTree(source);
    await stage({ store, id: artifactId, source, commit });
    await activate(
      { store, id: artifactId, origin },
      {
        async beforePrepare(manifest, old) {
          await assertNativeRelease(options, manifest);
          await assertNativeRelease(options, old);
        },
        beforeSwitch: (manifest) => accounting.begin(manifest),
        finalize: () => accounting.live(),
      },
    );
    return { artifactId, status: "live" };
  } catch (error) {
    try {
      const selected = (await list(store)).selectedReleaseId;
      if (selected && selected !== artifactId) {
        await health(origin, await verify(store, selected));
        await accounting.failed();
      }
    } catch {
      /* Keep uncertain usage reserved until actual recovery. */
    }
    throw error;
  }
}

export async function reconcileBuilderRelease(options, adapters = {}) {
  if (options.native)
    return withNativeRelease(options, options.projectId, (input) =>
      reconcileBuilderRelease(input, adapters),
    );
  const { client, requestId, projectId, channel, artifactId, store } = options;
  if (!uuid(requestId) || projectId !== "kaizen" || channel !== "production")
    throw new Error(
      "Configure the original website's exact publication request before recovery.",
    );
  const recoveryOwner = randomUUID();
  return reconcileRepositoryOutput(
    {
      ...options,
      async beforeReserve(manifest) {
        // This runs inside the stopped-process filesystem recovery lock. Read
        // ownership only now, and atomically replace it before any file switch.
        const item = await client.get(requestId);
        if (!uuid(item.worker_id) || !item.artifact_id)
          throw new Error(
            "This publication has no claimed worker artifact to recover.",
          );
        let baseline;
        if (item.previous_release_id)
          baseline = (await client.get(item.previous_release_id)).artifact_id;
        else {
          const transactions = (await (adapters.list || listReleases)(store))
            .transactions;
          const candidates = new Set(
            transactions
              .filter(
                (entry) =>
                  entry.releaseId === item.artifact_id &&
                  entry.previousReleaseId,
              )
              .map((entry) => entry.previousReleaseId),
          );
          if (candidates.size !== 1)
            throw new Error(
              "The first publication's retained activation journal must identify its previous artifact before recovery.",
            );
          baseline = [...candidates][0];
        }
        const begun = await client.rpc("builder_release_recovery_begin", {
          request_id: requestId,
          expected_owner: item.worker_id,
          recovery_owner: recoveryOwner,
          selected_artifact: artifactId,
          desired_artifact: manifest.id,
          baseline_artifact: baseline,
        });
        if (
          begun?.worker_id !== recoveryOwner ||
          begun?.recovery_artifact !== manifest.id
        )
          throw new Error(
            "Publication recovery ownership could not be confirmed.",
          );
      },
      async finalize(manifest, usage) {
        const result = await client.rpc("builder_release_recovery_finish", {
          request_id: requestId,
          recovery_owner: recoveryOwner,
          proof: releaseEvidence(manifest),
          usage_id: usage.request_id,
          source_commit: usage.source_commit,
          sample: usage.sample,
        });
        if (
          result?.id !== requestId ||
          result?.artifactId !== manifest.id ||
          result?.usageId !== usage.request_id ||
          !["live", "rolled_back"].includes(result?.status)
        )
          throw new Error(
            "The verified publication and usage acknowledgement remain uncertain. Reconcile the same request again.",
          );
      },
    },
    adapters,
  );
}

export function loadReleaseEnvironment() {
  if (process.env.BUILDER_RELEASE_ENV_FILE) {
    if (!path.isAbsolute(process.env.BUILDER_RELEASE_ENV_FILE))
      throw new Error(
        "The private release environment file must use an absolute path.",
      );
    const loaded = loadEnv({
      path: process.env.BUILDER_RELEASE_ENV_FILE,
      quiet: true,
    });
    if (loaded.error)
      throw new Error(
        "The private release environment file could not be loaded.",
      );
  }
  loadEnv({ path: path.resolve(".env"), quiet: true });
  return process.env;
}

export async function runReleaseWorker(env, argv = [], adapters = {}) {
  if (
    argv.length > 1 ||
    argv.some((arg) => !["--reconcile", "--reconcile-usage"].includes(arg))
  )
    throw new Error(
      "Use the installed native worker for deployment maintenance.",
    );
  if (
    (env.BUILDER_NATIVE_WORKER_ID || env.BUILDER_NATIVE_CONFIGURATION) &&
    !adapters.native &&
    !adapters.nativeFiles
  )
    throw new Error(
      "Use the installed native release worker for this deployment.",
    );
  const store = env.KAIZEN_RELEASE_STORE,
    origin = `https://${env.KAIZEN_PUBLIC_DOMAIN}`;
  if (!store || !path.isAbsolute(store))
    throw new Error("Set the absolute release store directory");
  const build =
    adapters.build ||
    ((snapshotFile) =>
      new Promise((resolve, reject) => {
        const child = spawn("corepack", ["pnpm", "run", "build"], {
          stdio: "inherit",
          windowsHide: true,
          env: { ...env, BUILDER_RELEASE_SNAPSHOT_FILE: snapshotFile || "" },
        });
        child.once("error", reject);
        child.once("exit", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`Static build failed with exit code ${code}.`)),
        );
      }));
  const client =
    adapters.client ||
    createReleaseClient({
      url: env.VITE_SUPABASE_URL || "",
      key: env.BUILDER_RELEASE_SERVICE_ROLE_KEY,
    });
  const billing = {
    projectId: env.BUILDER_RELEASE_PROJECT_ID || "",
    channel:
      env.KAIZEN_DEPLOY_BRANCH === "stage"
        ? "staging"
        : env.KAIZEN_DEPLOY_BRANCH === "main"
          ? "production"
          : "",
  };
  assertRepositoryOutputTarget(billing);
  if (argv.includes("--reconcile") || argv.includes("--reconcile-usage")) {
    const recover =
      env.VITE_BUILDER_CLOUD === "1"
        ? reconcileBuilderRelease
        : reconcileRepositoryOutput;
    const result = await recover({
      native: adapters.native,
      nativeFiles: adapters.nativeFiles,
      client,
      ...billing,
      requestId: env.KAIZEN_BUILDER_REQUEST_ID,
      store,
      origin,
      artifactId: env.KAIZEN_RELEASE_ID,
      restoreId: env.KAIZEN_RESTORE_RELEASE_ID || undefined,
      sourceRoot: process.cwd(),
    });
    console.log(JSON.stringify(result));
    return;
  }
  if (env.VITE_BUILDER_CLOUD !== "1") {
    if (env.KAIZEN_BUILDER_REQUEST_ID)
      throw new Error(
        "This deployment is not configured for the cloud builder workspace.",
      );
    const result = await runRepositoryRelease({
      native: adapters.native,
      nativeFiles: adapters.nativeFiles,
      client,
      store,
      origin,
      artifactId: env.KAIZEN_RELEASE_ID,
      commit: env.KAIZEN_DEPLOY_SHA,
      source: path.resolve("dist"),
      sourceRoot: process.cwd(),
      build,
      billing,
    });
    console.log(JSON.stringify(result));
    return;
  }
  const result = await runBuilderRelease({
    native: adapters.native,
    nativeFiles: adapters.nativeFiles,
    client,
    store,
    origin,
    artifactId: env.KAIZEN_RELEASE_ID,
    commit: env.KAIZEN_DEPLOY_SHA,
    requestId: env.KAIZEN_BUILDER_REQUEST_ID || undefined,
    source: path.resolve("dist"),
    sourceRoot: process.cwd(),
    billing,
    build,
  });
  console.log(JSON.stringify(result));
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  Promise.resolve()
    .then(() => {
      const env = loadReleaseEnvironment();
      return runReleaseWorker(env, process.argv.slice(2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
