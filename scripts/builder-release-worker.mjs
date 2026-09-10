import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { config as loadEnv } from "dotenv";
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
              payload.code === "P0001" &&
              typeof payload.message === "string"
              ? payload.message.slice(0, 2000)
              : `Release service returned HTTP ${response.status}. Check the worker configuration and service logs.`,
          );
          error.definitive = response.status >= 400 && response.status < 500;
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
  const { client, store, origin, artifactId, commit = "", build } = options;
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
    if (!claimed.rollback_of) {
      const directory = path.join(store, "requests");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const snapshotFile = path.join(directory, `${id}.json`);
      // Exclusive creation catches accidental job re-use rather than replacing an uncertain build input.
      await writeFile(snapshotFile, JSON.stringify(claimed.snapshot), {
        flag: "wx",
        mode: 0o600,
      });
      await build(snapshotFile);
      await stage({ store, id: artifact, source: options.source, commit });
    }
    const hooks = {
      async beforeSwitch(manifest, old) {
        if (claimed.previous_release_id) {
          const previous = await client.get(claimed.previous_release_id);
          if (old.id !== previous.artifact_id)
            throw new Error(
              "The serving artifact does not match the database release. Reconcile it before deploying.",
            );
        }
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
          if (current.status === "live" && current.artifact_id === artifact)
            return;
          throw error;
        }
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
        return { id, artifactId: artifact, status: "live" };
      }
      if (current.status === "building" && !attemptedSwitch) {
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

async function cli() {
  loadEnv({ path: path.resolve(".env"), quiet: true });
  const env = process.env;
  const store = env.KAIZEN_RELEASE_STORE,
    origin = `https://${env.KAIZEN_PUBLIC_DOMAIN}`;
  if (!store || !path.isAbsolute(store))
    throw new Error("Set the absolute release store directory");
  const build = (snapshotFile) =>
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
    });
  if (env.VITE_BUILDER_CLOUD !== "1") {
    if (env.KAIZEN_BUILDER_REQUEST_ID)
      throw new Error(
        "This deployment is not configured for the cloud builder workspace.",
      );
    await build(undefined);
    await stageRelease({
      store,
      id: env.KAIZEN_RELEASE_ID,
      source: path.resolve("dist"),
      commit: env.KAIZEN_DEPLOY_SHA,
    });
    await activateRelease({ store, id: env.KAIZEN_RELEASE_ID, origin });
    return;
  }
  const client = createReleaseClient({
    url: env.VITE_SUPABASE_URL || "",
    key: env.BUILDER_RELEASE_SERVICE_ROLE_KEY,
  });
  const result = await runBuilderRelease({
    client,
    store,
    origin,
    artifactId: env.KAIZEN_RELEASE_ID,
    commit: env.KAIZEN_DEPLOY_SHA,
    requestId: env.KAIZEN_BUILDER_REQUEST_ID || undefined,
    source: path.resolve("dist"),
    build,
  });
  console.log(JSON.stringify(result));
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  cli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
