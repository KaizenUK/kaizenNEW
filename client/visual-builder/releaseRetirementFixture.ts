/** Shared disposable retirement fixtures. No test runner imports: a killed
 * child process uses the same file-backed service double as its recoverer. */
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  activateRelease,
  bindClientStore,
  initialiseStore,
  stageRelease,
} from "../../scripts/kaizen-releases.mjs";
import { clientDestinationConfiguration } from "../../scripts/builder-client-release-maintenance";

export const retirementAdapters = {
  validateConfig: async () => {},
  reload: async () => {},
  checkLive: async () => {},
};
type Hook = (
  action: string,
  input: any,
  normal: () => Promise<any>,
) => Promise<any>;

/** A durable double of the service-role retirement RPCs. Rows are keyed by
 * scope and artifact; `protect` marks references the real SQL would find. */
export function retirementDatabase(
  file: string,
  now: number,
  stores: Record<string, string>,
) {
  const load = async () =>
    JSON.parse(await readFile(file, "utf8").catch(() => '{"rows":{}}'));
  const save = async (value: any) => {
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value));
    await rename(temporary, file);
  };
  const database = {
    hook: undefined as Hook | undefined,
    protected: new Set<string>(),
    async row(scope: string, artifact: string) {
      return (await load()).rows[`${scope}/${artifact}`];
    },
    async rpc(name: string, input: any) {
      const action = name.replace("builder_release_retention_", "");
      const normal = async () => {
        const value = await load(),
          key = `${input.release_scope}/${input.artifact}`;
        let row = value.rows[key];
        if (action === "observe") {
          if (database.protected.has(key))
            return { phase: "protected", artifact_id: input.artifact };
          row ??= value.rows[key] = {
            project_id: input.target,
            scope: input.release_scope,
            artifact_id: input.artifact,
            worker_id: input.worker,
            store_fingerprint: input.fingerprint,
            manifest_sha256: input.manifest,
            bytes: input.stored_bytes,
            phase: "pending",
            owner_token: null,
            attempt_generation: 0,
            eligible_at: new Date(now - 86400000).toISOString(),
          };
        } else {
          if (!row) throw new Error("missing observation");
          if (action === "cancel" && row.attempt_generation > input.generation)
            return {
              ...row,
              phase: "cancelled",
              cancelled_token: input.token,
              cancelled_generation: input.generation,
            };
          if (row.attempt_generation !== input.generation)
            throw new Error("attempt cancelled");
          if (row.owner_token && row.owner_token !== input.token)
            throw new Error("different owner");
          if (
            (action === "cancel" && !row.owner_token) ||
            (action === "claim" &&
              !row.owner_token &&
              database.protected.has(key))
          ) {
            if (action === "claim") return { ...row };
            row.attempt_generation++;
            await save(value);
            return {
              ...row,
              phase: "cancelled",
              cancelled_token: input.token,
              cancelled_generation: input.generation,
            };
          }
          if (action === "claim" && !row.owner_token) {
            row.phase = "removing";
            row.owner_token = input.token;
          }
          if (action === "finish") {
            if (
              JSON.stringify(input.proof) !==
              JSON.stringify({
                artifactId: input.artifact,
                storeFingerprint: input.fingerprint,
                manifestSha256: input.manifest,
                artifactAbsent: true,
              })
            )
              throw new Error("invalid absence proof");
            const present = await lstat(
              path.join(
                stores[input.release_scope],
                "releases",
                input.artifact,
              ),
            ).catch(() => null);
            if (present) throw new Error("release files are still present");
            row.phase = "removed";
          }
        }
        await save(value);
        return { ...row };
      };
      return database.hook ? database.hook(action, input, normal) : normal();
    },
  };
  return database;
}

/** A real bound client store: c0 initialised, c3 selected, c0 as its rollback
 * baseline, and one shared immutable asset. */
export async function retirementClientStore(
  root: string,
  identity: {
    projectId?: string;
    destinationId?: string;
    origin?: string;
  } = {},
  count = 4,
) {
  const client = {
    projectId: identity.projectId ?? randomUUID(),
    destinationId: identity.destinationId ?? randomUUID(),
    environment: "production",
    origin: identity.origin ?? "https://client-retention.fixture.example",
  };
  const name = client.destinationId.slice(0, 8),
    store = path.join(root, `store-${name}`),
    source = path.join(root, `source-${name}`);
  await mkdir(path.join(source, "assets"), { recursive: true });
  await writeFile(path.join(source, "assets/shared.css"), "body{color:navy}");
  await bindClientStore({ store, client });
  for (let n = 0; n < count; n++) {
    await writeFile(path.join(source, "index.html"), `<h1>Client c${n}</h1>`);
    await stageRelease({ source, store, client, id: `c${n}` });
  }
  await initialiseStore({ store, id: "c0" });
  await activateRelease(
    { store, id: `c${count - 1}`, origin: client.origin },
    retirementAdapters,
  );
  return {
    store,
    source,
    client,
    scope: `client:${client.destinationId}`,
    destination: { ...client, label: "Retention client", store },
  };
}

/** A process-identity double for coordinator ordering cases. The actual
 * /proc-backed identity has its own test. */
export function fakeClientWorker(
  destination: Parameters<typeof clientDestinationConfiguration>[0],
  workerId: string,
  { stopped = true, startTime = 1 } = {},
) {
  let retained = false;
  return {
    identity: {
      kind: "client" as const,
      workerId,
      configuration: clientDestinationConfiguration(destination),
      projectId: destination.projectId,
      processId: process.pid,
      host: os.hostname(),
      bootId: "0f0e0d0c-0b0a-4908-8706-050403020100",
      startTime,
    },
    stopped: async () => stopped,
    retain: () => {
      retained = true;
    },
    get retained() {
      return retained;
    },
  };
}
