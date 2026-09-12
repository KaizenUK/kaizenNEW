import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdtemp, mkdir, writeFile, lstat } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { spawn, execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { captureClientPublication } from "../../shared/builderClientPublication";
import { newDocument, starterBlocks } from "./starters";
import { savePage } from "../../shared/visualBuilder";
import { projectAssetUrl } from "../../shared/builderProjectOperations";
import {
  runClientPublication,
  recoverClientPublication,
} from "../../scripts/builder-client-worker";
import { compileClientPublication } from "./compileClientPublication";
import { clientPublicationAction as hostedPublicationAction } from "../../supabase/functions/_shared/clientPublication";
import {
  bindClientStore,
  stageRelease,
  initialiseStore,
  listReleases,
  checkLive,
  verifyRelease,
} from "../../scripts/kaizen-releases.mjs";
let db: PGlite;
const owner = randomUUID(),
  editor = randomUUID(),
  stranger = randomUUID();
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    insert into auth.users(id) values('${owner}'),('${editor}'),('${stranger}');`);
  for (const file of [
    "202609100001_visual_builder.sql",
    "202609100002_builder_site_design.sql",
    "202609100008_builder_releases.sql",
    "202609110001_builder_projects.sql",
    "202609110002_builder_client_publications.sql",
    "202609110003_builder_client_recovery.sql",
    "202609110004_builder_client_history.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function as<T>(
  actor: string | null,
  action: () => Promise<T>,
  role = actor ? "authenticated" : "service_role",
): Promise<T> {
  await db.query(
    "select set_config('request.jwt.claims',$1,false),set_config('request.jwt.claim.role','',false)",
    [JSON.stringify({ role, ...(actor ? { sub: actor } : {}) })],
  );
  await db.exec(`set role ${role}`);
  try {
    return await action();
  } finally {
    await db.exec("reset role");
  }
}
async function rpc(name: string, values: unknown[]) {
  return (
    await db.query<{ value: any }>(
      `select ${name}(${values.map((_, i) => `$${i + 1}`).join(",")}) as value`,
      values,
    )
  ).rows[0].value;
}
async function fixture() {
  const projectId = await as(owner, () =>
    rpc("builder_create_project", ["Hosted publication fixture"]),
  );
  const destinationId = randomUUID(),
    origin = `https://${destinationId}.example`;
  await db.query(
    "insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id) values($1,$2,'production',$3,'Client production','fixture-worker','initial')",
    [destinationId, projectId, origin],
  );
  const workspace = {
    pages: [
      savePage(
        [],
        newDocument("Reviewed page", "about", false),
        randomUUID(),
        0,
      ),
    ],
    assets: [],
    saved: [],
  };
  await as(null, () =>
    rpc("builder_commit_project_workspace", [
      projectId,
      owner,
      0,
      JSON.stringify(workspace),
    ]),
  );
  await as(owner, () =>
    rpc("builder_set_project_member", [projectId, editor, "editor", false]),
  );
  return { projectId, destinationId, origin, workspace };
}
async function review(
  f: Awaited<ReturnType<typeof fixture>>,
  action = "publish",
  actor = owner,
  rollback: string | null = null,
) {
  return as(null, () =>
    rpc("builder_client_review", [
      randomUUID(),
      f.projectId,
      actor,
      f.destinationId,
      1,
      1,
      action,
      action === "publish"
        ? JSON.stringify(captureClientPublication(f.projectId, f.workspace))
        : null,
      rollback,
    ]),
  );
}
async function start(
  f: Awaited<ReturnType<typeof fixture>>,
  r: any,
  actor = owner,
) {
  return as(null, () =>
    rpc("builder_client_start", [f.projectId, actor, r.id]),
  );
}
const evidence = (job: any) => ({
  artifactId: job.artifact_id,
  projectId: job.project_id,
  destinationId: job.destination_id,
  environment: job.destination.environment,
  origin: job.destination.origin,
  manifestSha256: "a".repeat(64),
});
async function finish(job: any) {
  const token = randomUUID();
  await as(null, () =>
    rpc("builder_client_claim", [job.id, "fixture-worker", token]),
  );
  await as(null, () =>
    rpc("builder_client_progress", [
      job.id,
      token,
      "activating",
      "Starting activation",
    ]),
  );
  await as(null, () =>
    rpc("builder_client_progress", [
      job.id,
      token,
      "verifying",
      "Checking served files",
    ]),
  );
  return as(null, () =>
    rpc("builder_client_finalize", [
      job.id,
      token,
      JSON.stringify(evidence(job)),
    ]),
  );
}

it("enforces project and publish permissions, private worker ownership and read isolation using JSON JWT claims", async () => {
  const f = await fixture();
  await expect(review(f, "publish", editor)).rejects.toThrow(
    "publish permission",
  );
  await expect(review(f, "publish", stranger)).rejects.toThrow(
    "publish permission",
  );
  const job = await start(f, await review(f));
  await as(stranger, async () => {
    expect(
      (
        await db.query(
          "select id from builder_client_destinations where project_id=$1",
          [f.projectId],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select id,snapshot from builder_client_jobs where project_id=$1",
          [f.projectId],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select id from builder_client_reviews where project_id=$1",
          [f.projectId],
        )
      ).rows,
    ).toEqual([]);
  });
  await as(owner, async () => {
    expect(
      (
        await db.query("select id from builder_client_jobs where id=$1", [
          job.id,
        ])
      ).rows,
    ).toHaveLength(1);
    await expect(
      db.query("select owner_token from builder_client_jobs where id=$1", [
        job.id,
      ]),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query(
        "select worker_id from builder_client_destinations where id=$1",
        [f.destinationId],
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      rpc("builder_client_claim", [job.id, "fixture-worker", randomUUID()]),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query(
        "update builder_client_destinations set origin='https://other.example' where id=$1",
        [f.destinationId],
      ),
    ).rejects.toThrow("permission denied");
  });
});

it("provisions only a verified client destination through the service role and refuses reassignment", async () => {
  const projectId = await as(owner, () =>
      rpc("builder_create_project", ["Provisioning fixture"]),
    ),
    destinationId = randomUUID(),
    origin = `https://${destinationId}.example`;
  const proof = {
    projectId,
    destinationId,
    origin,
    environment: "production",
    artifactId: "initial",
    manifestSha256: "b".repeat(64),
  };
  const args = [
    projectId,
    destinationId,
    "production",
    origin,
    "Provisioned client",
    "fixture-worker",
    "initial",
    JSON.stringify(proof),
  ];
  await expect(
    as(owner, () => rpc("builder_client_provision", args)),
  ).rejects.toThrow("permission denied");
  await expect(
    as(null, () =>
      rpc("builder_client_provision", [...args.slice(0, -1), "{}"]),
    ),
  ).rejects.toThrow("baseline evidence");
  expect(
    await as(null, () => rpc("builder_client_provision", args)),
  ).toMatchObject({ projectId, destinationId, origin });
  expect(
    await as(null, () => rpc("builder_client_provision", args)),
  ).toMatchObject({ projectId, destinationId, origin });
  await expect(
    as(null, () =>
      rpc("builder_client_provision", [
        ...args.slice(0, 5),
        "different-worker",
        ...args.slice(6),
      ]),
    ),
  ).rejects.toThrow("Existing destination differs");
});

it("claims exactly one worker and advances only the verified baseline while preserving newer workspace data", async () => {
  const f = await fixture(),
    r = await review(f),
    job = await start(f, r),
    token = randomUUID();
  expect((await start(f, r)).id).toBe(job.id);
  await expect(start(f, await review(f))).rejects.toThrow("pending release");
  await expect(
    as(null, () =>
      rpc("builder_client_claim", [job.id, "wrong-worker", token]),
    ),
  ).rejects.toThrow("does not own");
  await as(null, () =>
    rpc("builder_client_claim", [job.id, "fixture-worker", token]),
  );
  await expect(
    as(null, () =>
      rpc("builder_client_claim", [job.id, "fixture-worker", randomUUID()]),
    ),
  ).rejects.toThrow("already claimed");
  await expect(
    as(null, () =>
      rpc("builder_client_finalize", [
        job.id,
        token,
        JSON.stringify(evidence(job)),
      ]),
    ),
  ).rejects.toThrow("Verify the served");
  const newer = structuredClone(f.workspace);
  newer.pages[0].draft.title = "Newer saved draft";
  await as(null, () =>
    rpc("builder_commit_project_workspace", [
      f.projectId,
      owner,
      1,
      JSON.stringify(newer),
    ]),
  );
  await as(null, () =>
    rpc("builder_client_progress", [job.id, token, "activating", ""]),
  );
  await as(null, () =>
    rpc("builder_client_progress", [job.id, token, "verifying", ""]),
  );
  await expect(
    as(null, () =>
      rpc("builder_client_finalize", [
        job.id,
        token,
        JSON.stringify({ ...evidence(job), destinationId: randomUUID() }),
      ]),
    ),
  ).rejects.toThrow("Invalid served-output evidence");
  await as(null, () =>
    rpc("builder_client_finalize", [
      job.id,
      token,
      JSON.stringify(evidence(job)),
    ]),
  );
  expect(
    (
      await as(null, () =>
        rpc("builder_client_finalize", [
          job.id,
          token,
          JSON.stringify(evidence(job)),
        ]),
      )
    ).phase,
  ).toBe("live");
  expect(
    (
      await db.query<any>(
        "select active_job_id from builder_client_destinations where id=$1",
        [f.destinationId],
      )
    ).rows[0].active_job_id,
  ).toBe(job.id);
  expect(
    (
      await db.query<any>(
        "select payload from builder_project_workspaces where project_id=$1",
        [f.projectId],
      )
    ).rows[0].payload,
  ).toEqual(newer);
  expect(
    (
      await db.query<any>(
        "select snapshot from builder_client_jobs where id=$1",
        [job.id],
      )
    ).rows[0].snapshot.workspace.pages[0].draft.title,
  ).toBe("Reviewed page");
});

it("rejects stale reviews after workspace, destination or expiry changes", async () => {
  for (const change of ["workspace", "destination", "expiry"]) {
    const f = await fixture(),
      r = await review(f);
    if (change === "workspace")
      await as(null, () =>
        rpc("builder_commit_project_workspace", [
          f.projectId,
          owner,
          1,
          JSON.stringify(f.workspace),
        ]),
      );
    if (change === "destination")
      await db.query(
        "update builder_client_destinations set label='New reviewed label' where id=$1",
        [f.destinationId],
      );
    if (change === "expiry")
      await db.query(
        "update builder_client_reviews set expires_at=now()-interval '1 second' where id=$1",
        [r.id],
      );
    await expect(start(f, r)).rejects.toThrow(/changed|expired/);
  }
});

it("rechecks revocation before activation and finalization, while allowing the owner worker to report failure", async () => {
  for (const point of ["activation", "finalization"]) {
    const f = await fixture();
    await as(owner, () =>
      rpc("builder_set_project_member", [f.projectId, editor, "editor", true]),
    );
    const job = await start(f, await review(f, "publish", editor), editor),
      token = randomUUID();
    await as(null, () =>
      rpc("builder_client_claim", [job.id, "fixture-worker", token]),
    );
    if (point === "finalization")
      await as(null, () =>
        rpc("builder_client_progress", [job.id, token, "verifying", ""]),
      );
    await as(owner, () =>
      rpc("builder_set_project_member", [f.projectId, editor, "editor", false]),
    );
    await expect(
      as(null, () =>
        point === "activation"
          ? rpc("builder_client_progress", [job.id, token, "activating", ""])
          : rpc("builder_client_finalize", [
              job.id,
              token,
              JSON.stringify(evidence(job)),
            ]),
      ),
    ).rejects.toThrow("revoked");
    await as(null, () =>
      rpc("builder_client_progress", [
        job.id,
        token,
        "failed",
        "Permission revoked",
      ]),
    );
    expect(
      (
        await db.query<any>(
          "select active_job_id from builder_client_destinations where id=$1",
          [f.destinationId],
        )
      ).rows[0].active_job_id,
    ).toBeNull();
  }
});

it("uses retained destination snapshots for rollback and an empty baseline for unpublication", async () => {
  const f = await fixture(),
    original = await finish(await start(f, await review(f)));
  const other = await fixture();
  await expect(review(other, "rollback", owner, original.id)).rejects.toThrow(
    "retained verified",
  );
  const unpublished = await finish(
    await start(f, await review(f, "unpublish")),
  );
  expect(unpublished.snapshot).toBeNull();
  const restored = await finish(
    await start(f, await review(f, "rollback", owner, original.id)),
  );
  expect(restored.snapshot).toEqual(original.snapshot);
  expect(restored.artifact_id).toBe(original.artifact_id);
  expect(
    (
      await db.query<any>(
        "select payload from builder_project_workspaces where project_id=$1",
        [f.projectId],
      )
    ).rows[0].payload,
  ).toEqual(f.workspace);
});

async function workerFixture(f: Awaited<ReturnType<typeof fixture>>) {
  const root = await mkdtemp(
      path.join(os.tmpdir(), "kaizen-hosted-worker-test-"),
    ),
    store = path.join(root, "store"),
    source = path.join(root, "initial");
  const identity = {
    projectId: f.projectId,
    destinationId: f.destinationId,
    environment: "production",
    origin: f.origin,
  };
  await mkdir(source);
  await writeFile(
    path.join(source, "index.html"),
    "<!doctype html><h1>Initial</h1>",
  );
  await bindClientStore({ store, client: identity });
  await stageRelease({ store, client: identity, source, id: "initial" });
  await initialiseStore({ store, id: "initial" });
  const registry = path.join(root, "destinations.json");
  await writeFile(
    registry,
    JSON.stringify({
      schemaVersion: 1,
      destinations: [{ ...identity, label: "Client production", store }],
    }),
  );
  const client = {
    getClient: (id: string) =>
      as(
        null,
        async () =>
          (
            await db.query<any>(
              "select * from builder_client_jobs where id=$1",
              [id],
            )
          ).rows[0],
      ),
    rpc: async (name: string, input: Record<string, unknown>) => {
      try {
        const entries = Object.entries(input);
        return await as(
          null,
          async () =>
            (
              await db.query<{ value: any }>(
                `select ${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")}) as value`,
                entries.map(([, value]) =>
                  value && typeof value === "object"
                    ? JSON.stringify(value)
                    : value,
                ),
              )
            ).rows[0].value,
        );
      } catch (error) {
        error.definitive = true;
        throw error;
      }
    },
  };
  return {
    root,
    store,
    client,
    registry,
    workDirectory: path.join(root, "private-work"),
    workerId: "fixture-worker",
    samplesRoot: path.resolve("public/builder-samples"),
    compile: compileClientPublication,
    registeredAsset: async () => {
      throw new Error("Unexpected asset fetch");
    },
    adapters: {
      validateConfig: async () => {},
      reload: async () => {},
      checkLive: async () => {},
    },
  };
}

it("pages release history without gaps across equal timestamps and concurrent inserts, preserving current jobs and RLS", async () => {
  const f = await fixture(),
    live = await finish(await start(f, await review(f)));
  const pending = await start(f, await review(f));
  await db.query(
    "update builder_client_jobs set created_at='2000-01-01T00:00:00Z' where id=$1",
    [live.id],
  );
  await db.query(
    "update builder_client_jobs set created_at='2001-01-01T00:00:00Z' where id=$1",
    [pending.id],
  );
  await db.query(
    `insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,previous_artifact_id,artifact_id,phase,created_at)
    select gen_random_uuid(),project_id,destination_id,destination,destination_version,worker_id,requested_by,action,previous_artifact_id,artifact_id,'failed','2026-01-01T00:00:00.123456Z' from builder_client_jobs cross join generate_series(1,123) where id=$1`,
    [live.id],
  );
  const history = (
    before: string | null = null,
    actor = owner,
    target = f.projectId,
  ) => as(actor, () => rpc("builder_client_history", [target, before]));
  const first = await history();
  expect(first.rows).toHaveLength(51);
  const publicPage = await hostedPublicationAction({
    user: {
      rpc: async (_name, input) => ({
        data: await history(input.before_job),
        error: null,
      }),
    },
    service: {},
    projectId: f.projectId,
    actor: owner,
    input: { action: "client-release-list" },
  });
  if (!("jobs" in publicPage))
    throw new Error("Expected a release history page");
  expect(publicPage.jobs).toHaveLength(50);
  expect(publicPage.nextCursor).toBe(first.rows[49].id);
  expect(publicPage.currentJobs.find((job) => job.id === live.id)?.active).toBe(
    true,
  );
  expect(
    publicPage.currentJobs.find((job) => job.id === pending.id)?.active,
  ).toBe(false);
  expect(first.currentRows.map((row) => row.id).sort()).toEqual(
    [live.id, pending.id].sort(),
  );
  expect(first.rows.some((row) => [live.id, pending.id].includes(row.id))).toBe(
    false,
  );
  expect(JSON.stringify(first)).not.toMatch(
    /owner_token|worker_id|snapshot|recovery_evidence/,
  );
  // A newer row cannot shift a keyset page boundary.
  await db.query(
    `insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,previous_artifact_id,artifact_id,phase,created_at)
    select gen_random_uuid(),project_id,destination_id,destination,destination_version,worker_id,requested_by,action,previous_artifact_id,artifact_id,'failed','2027-01-01T00:00:00Z' from builder_client_jobs where id=$1`,
    [live.id],
  );
  const seen = first.rows.slice(0, 50).map((row) => row.id);
  let page = first;
  while (page.rows.length > 50) {
    page = await history(page.rows[49].id);
    seen.push(...page.rows.slice(0, 50).map((row) => row.id));
  }
  expect(seen).toHaveLength(125);
  expect(new Set(seen).size).toBe(125);
  expect(seen.slice(-2)).toEqual([pending.id, live.id]);
  expect((await history(null, editor)).rows).toHaveLength(51);
  await expect(history(null, stranger)).rejects.toThrow(
    "Project access required",
  );
  const other = await fixture(),
    otherJob = await start(other, await review(other));
  await expect(history(otherJob.id)).rejects.toThrow(
    "Invalid release history cursor",
  );
  await expect(history(live.id, owner, other.projectId)).rejects.toThrow(
    "Invalid release history cursor",
  );
});

// Fault injection preserves real SQL claims/files; Nginx adapters here are doubles.
async function uncertainWorker(commit: boolean, publishingActor = owner) {
  const f = await fixture();
  if (publishingActor !== owner)
    await as(owner, () =>
      rpc("builder_set_project_member", [
        f.projectId,
        publishingActor,
        "editor",
        true,
      ]),
    );
  const job = await start(
      f,
      await review(f, "publish", publishingActor),
      publishingActor,
    ),
    worker = await workerFixture(f);
  await expect(
    runClientPublication(job.id, {
      ...worker,
      client: {
        ...worker.client,
        rpc: async (name, input) => {
          if (name !== "builder_client_finalize")
            return worker.client.rpc(name, input);
          if (commit) await worker.client.rpc(name, input);
          throw new Error("Injected lost finalization acknowledgement");
        },
      },
    }),
  ).rejects.toThrow("lost finalization acknowledgement");
  const lock = path.join(
    worker.workDirectory,
    f.destinationId,
    job.id,
    ".worker-lock",
  );
  return { f, job, worker, lock };
}
async function stoppedOwner(lock: string) {
  const child = spawn(process.execPath, ["-e", "process.exit(0)"], {
    windowsHide: true,
  });
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => resolve());
  });
  const file = path.join(lock, "owner.json"),
    metadata = JSON.parse(await readFile(file, "utf8"));
  await writeFile(
    file,
    JSON.stringify({ ...metadata, pid: child.pid, host: os.hostname() }),
  );
}

it("refuses live, foreign-host and mismatched original worker recovery ownership", async () => {
  const { job, worker, lock } = await uncertainWorker(false);
  await expect(recoverClientPublication(job.id, worker)).rejects.toThrow(
    "still running",
  );
  const file = path.join(lock, "owner.json"),
    metadata = JSON.parse(await readFile(file, "utf8"));
  await writeFile(
    file,
    JSON.stringify({ ...metadata, host: "unrelated-host" }),
  );
  await expect(recoverClientPublication(job.id, worker)).rejects.toThrow(
    "cannot be proven stopped",
  );
  await stoppedOwner(lock);
  await writeFile(
    file,
    JSON.stringify({
      ...JSON.parse(await readFile(file, "utf8")),
      token: randomUUID(),
    }),
  );
  await expect(recoverClientPublication(job.id, worker)).rejects.toThrow(
    "does not match",
  );
  expect((await worker.client.getClient(job.id)).phase).toBe(
    "recovery_required",
  );
  expect((await listReleases(worker.store)).selectedReleaseId).toBe(job.id);
});

it("reconciles a stopped uncommitted candidate after verifying it and preserves newer drafts", async () => {
  const { f, job, worker, lock } = await uncertainWorker(false);
  const newer = structuredClone(f.workspace);
  newer.pages[0].draft.title = "Keep this newer draft through recovery";
  await as(null, () =>
    rpc("builder_commit_project_workspace", [
      f.projectId,
      owner,
      1,
      JSON.stringify(newer),
    ]),
  );
  await stoppedOwner(lock);
  let verified = false;
  expect(
    await recoverClientPublication(job.id, {
      ...worker,
      adapters: {
        ...worker.adapters,
        checkLive: async (_origin, manifest) => {
          expect(manifest.id).toBe(job.id);
          verified = true;
        },
      },
    }),
  ).toMatchObject({ phase: "live" });
  expect(verified).toBe(true);
  expect(
    (
      await db.query<any>(
        "select payload from builder_project_workspaces where project_id=$1",
        [f.projectId],
      )
    ).rows[0].payload,
  ).toEqual(newer);
  expect(
    (await worker.client.getClient(job.id)).recovery_evidence.artifactId,
  ).toBe(job.id);
  await expect(lstat(lock)).rejects.toMatchObject({ code: "ENOENT" });
});

it("restores the previous artifact after publish revocation, without approving the uncommitted candidate", async () => {
  const { f, job, worker, lock } = await uncertainWorker(false, editor);
  await stoppedOwner(lock);
  await as(owner, () =>
    rpc("builder_set_project_member", [f.projectId, editor, "editor", false]),
  );
  await expect(recoverClientPublication(job.id, worker)).rejects.toThrow(
    "Restore the previous artifact",
  );
  expect((await listReleases(worker.store)).selectedReleaseId).toBe(job.id);
  await writeFile(
    path.join(worker.store, "releases", job.id, "site", "index.html"),
    "Corrupt interrupted candidate",
  );
  expect(await recoverClientPublication(job.id, worker, true)).toMatchObject({
    phase: "rolled_back",
  });
  expect((await listReleases(worker.store)).selectedReleaseId).toBe("initial");
  expect(
    (
      await db.query<any>(
        "select active_artifact_id,active_job_id from builder_client_destinations where id=$1",
        [f.destinationId],
      )
    ).rows[0],
  ).toEqual({ active_artifact_id: "initial", active_job_id: null });
});

it("reconciles an already committed publication after revocation and lost recovery acknowledgement", async () => {
  const { f, job, worker, lock } = await uncertainWorker(true, editor);
  await stoppedOwner(lock);
  await as(owner, () =>
    rpc("builder_set_project_member", [f.projectId, editor, "editor", false]),
  );
  await expect(recoverClientPublication(job.id, worker, true)).rejects.toThrow(
    "was committed",
  );
  await expect(
    recoverClientPublication(job.id, {
      ...worker,
      client: {
        ...worker.client,
        rpc: async (name, input) => {
          const result = await worker.client.rpc(name, input);
          if (name === "builder_client_recovery_finalize")
            throw new Error("Lost recovery acknowledgement");
          return result;
        },
      },
    }),
  ).rejects.toThrow("Lost recovery acknowledgement");
  expect((await worker.client.getClient(job.id)).phase).toBe("live");
  expect((await lstat(lock)).isDirectory()).toBe(true);
  expect(await recoverClientPublication(job.id, worker)).toMatchObject({
    phase: "live",
  });
  expect((await listReleases(worker.store)).selectedReleaseId).toBe(job.id);
  await expect(lstat(lock)).rejects.toMatchObject({ code: "ENOENT" });
});

it("keeps recovery ownership when served verification fails and rejects unrelated evidence", async () => {
  const { f, job, worker, lock } = await uncertainWorker(false);
  await stoppedOwner(lock);
  await expect(
    recoverClientPublication(job.id, {
      ...worker,
      adapters: {
        ...worker.adapters,
        checkLive: async () => {
          throw new Error("CSS response mismatch");
        },
      },
    }),
  ).rejects.toThrow("CSS response mismatch");
  const current = await worker.client.getClient(job.id);
  expect(current.phase).toBe("recovery_required");
  expect((await lstat(lock)).isDirectory()).toBe(true);
  await expect(
    as(owner, () =>
      rpc("builder_client_recovery_begin", [
        job.id,
        "fixture-worker",
        current.owner_token,
        job.id,
      ]),
    ),
  ).rejects.toThrow("permission denied");
  await expect(
    as(null, () =>
      rpc("builder_client_recovery_finalize", [
        job.id,
        "fixture-worker",
        current.owner_token,
        JSON.stringify({ ...evidence(job), destinationId: randomUUID() }),
      ]),
    ),
  ).rejects.toThrow("Verified recovery evidence required");
  await db.query(
    "update builder_client_destinations set enabled=false where id=$1",
    [f.destinationId],
  );
  await expect(
    as(null, () =>
      rpc("builder_client_recovery_finalize", [
        job.id,
        "fixture-worker",
        current.owner_token,
        JSON.stringify(evidence(job)),
      ]),
    ),
  ).rejects.toThrow("destination changed");
  expect(await recoverClientPublication(job.id, worker, true)).toMatchObject({
    phase: "rolled_back",
  });
}, 15000);

it("refuses to reconcile a historical release once another release becomes live", async () => {
  const { f, job, worker, lock } = await uncertainWorker(true);
  await stoppedOwner(lock);
  await runClientPublication((await start(f, await review(f))).id, worker);
  await expect(recoverClientPublication(job.id, worker)).rejects.toThrow(
    "unrelated to this job",
  );
  const current = await worker.client.getClient(job.id);
  await expect(
    as(null, () =>
      rpc("builder_client_recovery_begin", [
        job.id,
        "fixture-worker",
        current.owner_token,
        job.id,
      ]),
    ),
  ).rejects.toThrow(/baseline changed|historical/);
});

it("runs the trusted worker through the real database protocol, bundles private media and preserves a concurrent draft save", async () => {
  const f = await fixture(),
    bytes = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="purple"/></svg>',
    );
  const id = randomUUID();
  const asset = {
    id,
    name: "Client logo",
    path: "logo.svg",
    pack: "Client",
    mime: "image/svg+xml",
    kind: "icon",
    hash: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length,
    url: projectAssetUrl(f.projectId, id),
    tags: [],
    favourite: false,
    createdAt: new Date().toISOString(),
  };
  const picture = starterBlocks.Image();
  picture.props.src = asset.url;
  (f.workspace.assets as any[]).push(asset);
  f.workspace.pages[0].draft.data.content = [picture];
  await db.query(
    "update builder_project_workspaces set payload=$1 where project_id=$2",
    [JSON.stringify(f.workspace), f.projectId],
  );
  const job = await start(f, await review(f)),
    worker = await workerFixture(f),
    newer = structuredClone(f.workspace);
  newer.pages[0].draft.title = "Saved during worker compilation";
  const requested: string[] = [];
  await runClientPublication(job.id, {
    ...worker,
    registeredAsset: async (project, assetId) => {
      requested.push(`${project}/${assetId}`);
      return bytes;
    },
    compile: async (...args) => {
      await as(null, () =>
        rpc("builder_commit_project_workspace", [
          f.projectId,
          owner,
          1,
          JSON.stringify(newer),
        ]),
      );
      return compileClientPublication(...args);
    },
  });
  expect(requested).toContain(`${f.projectId}/${id}`);
  const finished = await worker.client.getClient(job.id);
  expect(finished.phase).toBe("live");
  expect(finished.evidence).toMatchObject({
    projectId: f.projectId,
    destinationId: f.destinationId,
    artifactId: job.id,
  });
  expect((await listReleases(worker.store)).selectedReleaseId).toBe(job.id);
  expect(
    await readFile(
      path.join(
        worker.store,
        "releases",
        job.id,
        "site",
        "about",
        "index.html",
      ),
      "utf8",
    ),
  ).toContain("assets/");
  expect(
    (
      await db.query<any>(
        "select payload from builder_project_workspaces where project_id=$1",
        [f.projectId],
      )
    ).rows[0].payload,
  ).toEqual(newer);
  await expect(
    lstat(
      path.join(worker.workDirectory, f.destinationId, job.id, ".worker-lock"),
    ),
  ).rejects.toMatchObject({ code: "ENOENT" });
});

it("records a worker verification failure and restores the original server selection without advancing the hosted baseline", async () => {
  const f = await fixture(),
    job = await start(f, await review(f)),
    worker = await workerFixture(f);
  await expect(
    runClientPublication(job.id, {
      ...worker,
      adapters: {
        ...worker.adapters,
        checkLive: async (_origin, manifest) => {
          if (manifest.id !== "initial")
            throw new Error("Served client CSS did not match");
        },
      },
    }),
  ).rejects.toThrow("previous release was restored");
  expect((await worker.client.getClient(job.id)).phase).toBe("rolled_back");
  expect((await listReleases(worker.store)).selectedReleaseId).toBe("initial");
  expect(
    (
      await db.query<any>(
        "select active_job_id from builder_client_destinations where id=$1",
        [f.destinationId],
      )
    ).rows[0].active_job_id,
  ).toBeNull();
}, 10000);

it("marks a queued job failed if permission was revoked before its worker claim, without leaving a new worker lock", async () => {
  const f = await fixture();
  await as(owner, () =>
    rpc("builder_set_project_member", [f.projectId, editor, "editor", true]),
  );
  const job = await start(f, await review(f, "publish", editor), editor),
    worker = await workerFixture(f);
  await as(owner, () =>
    rpc("builder_set_project_member", [f.projectId, editor, "editor", false]),
  );
  await expect(runClientPublication(job.id, worker)).rejects.toThrow("revoked");
  expect((await worker.client.getClient(job.id)).phase).toBe("failed");
  await expect(
    lstat(
      path.join(worker.workDirectory, f.destinationId, job.id, ".worker-lock"),
    ),
  ).rejects.toMatchObject({ code: "ENOENT" });
});

it("rejects private work inside another configured client's public store before creating snapshot files", async () => {
  const f = await fixture(),
    worker = await workerFixture(f),
    other = await workerFixture(await fixture());
  const registry = JSON.parse(await readFile(worker.registry, "utf8"));
  registry.destinations.push(
    ...JSON.parse(await readFile(other.registry, "utf8")).destinations,
  );
  await writeFile(worker.registry, JSON.stringify(registry));
  const job = await start(f, await review(f)),
    unsafe = path.join(other.store, "releases", "private-builds");
  await expect(
    runClientPublication(job.id, { ...worker, workDirectory: unsafe }),
  ).rejects.toThrow("separate from every");
  await expect(lstat(unsafe)).rejects.toMatchObject({ code: "ENOENT" });
  expect((await worker.client.getClient(job.id)).owner_token).toBeNull();
});

it.runIf(Boolean(process.env.KAIZEN_NGINX_BINARY))(
  "recovers genuinely terminated hosted workers through real Nginx and PostgreSQL without losing newer drafts",
  async () => {
    const f = await fixture(),
      worker = await workerFixture(f),
      run = promisify(execFile);
    const binary = process.env.KAIZEN_NGINX_BINARY!,
      prefix = path.join(worker.root, "nginx");
    await mkdir(path.join(prefix, "logs"), { recursive: true });
    await mkdir(path.join(prefix, "temp"));
    const reservation = createServer();
    await new Promise<void>((resolve) =>
      reservation.listen(0, "127.0.0.1", resolve),
    );
    const port = (reservation.address() as any).port;
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    const origin = `http://127.0.0.1:${port}`,
      forward = (value: string) => value.replace(/\\/g, "/");
    const nginx = (args: string[]) =>
      run(binary, ["-p", forward(prefix) + "/", "-c", "nginx.conf", ...args], {
        cwd: prefix,
        windowsHide: true,
        timeout: 15000,
      });
    await writeFile(
      path.join(prefix, "nginx.conf"),
      `daemon off; master_process on; worker_processes 1; worker_shutdown_timeout 5s; pid logs/nginx.pid; error_log logs/error.log notice; events { worker_connections 128; } http { keepalive_timeout 1s; types { text/html html; text/css css; application/javascript js; application/json json; } access_log off; client_body_temp_path temp/client_body; proxy_temp_path temp/proxy; fastcgi_temp_path temp/fastcgi; uwsgi_temp_path temp/uwsgi; scgi_temp_path temp/scgi; server { listen 127.0.0.1:${port}; server_name localhost; include "${forward(path.join(worker.store, "active.conf"))}"; index index.html; location / { try_files $uri $uri/ =404; } } }`,
    );
    await nginx(["-t"]);
    const server = spawn(
      binary,
      ["-p", forward(prefix) + "/", "-c", "nginx.conf"],
      { cwd: prefix, windowsHide: true, stdio: "ignore" },
    );
    const serverExit = new Promise<void>((resolve, reject) => {
      server.once("exit", () => resolve());
      server.once("error", reject);
    });
    const bridgeToken = randomUUID();
    const allowed = new Set([
      "builder_client_claim",
      "builder_client_progress",
      "builder_client_fail_queued",
      "builder_client_finalize",
    ]);
    const bridge = createServer(async (req, res) => {
      if (
        req.method !== "POST" ||
        req.headers.authorization !== `Bearer ${bridgeToken}`
      ) {
        res.writeHead(403).end();
        return;
      }
      try {
        let text = "";
        for await (const chunk of req) {
          text += chunk;
          if (text.length > 1024 * 1024)
            throw new Error("Fixture request too large");
        }
        const { operation, input } = JSON.parse(text);
        if (operation !== "get" && !allowed.has(operation))
          throw new Error("Fixture operation not allowed");
        const result =
          operation === "get"
            ? await worker.client.getClient(input)
            : await worker.client.rpc(operation, input);
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(result));
      } catch (error) {
        res
          .writeHead(400, { "content-type": "application/json" })
          .end(JSON.stringify({ error: error.message }));
      }
    });
    await new Promise<void>((resolve) =>
      bridge.listen(0, "127.0.0.1", resolve),
    );
    const newer = structuredClone(f.workspace);
    // Route only this fixture's registered HTTPS origin to isolated loopback HTTP.
    // Responses and file hashes come from real Nginx; this does not test TLS/DNS.
    const fetchActual = globalThis.fetch;
    const routedFetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        );
        if (url.origin === f.origin)
          return fetchActual(origin + url.pathname + url.search, init);
        return fetchActual(input, init);
      });
    try {
      const initial = await verifyRelease(worker.store, "initial");
      for (let attempt = 0; ; attempt++) {
        try {
          await checkLive(f.origin, initial);
          break;
        } catch (error) {
          if (attempt >= 30) throw error;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      for (const restore of [false, true]) {
        const job = await start(f, await review(f));
        const config = path.join(worker.root, `${job.id}.fixture.json`);
        await writeFile(
          config,
          JSON.stringify({
            ...worker,
            jobId: job.id,
            binary,
            prefix,
            bridgeToken,
            loopbackOrigin: origin,
            registeredOrigin: f.origin,
            bridge: `http://127.0.0.1:${(bridge.address() as any).port}`,
          }),
        );
        const child = spawn(
          process.execPath,
          [
            "--import",
            "tsx",
            "tests/builder/interrupt-hosted-publication.ts",
            config,
          ],
          {
            cwd: process.cwd(),
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let output = "";
        child.stdout.on("data", (bytes) => {
          output = (output + bytes).slice(-10000);
        });
        child.stderr.on("data", (bytes) => {
          output = (output + bytes).slice(-10000);
        });
        const timeout = setTimeout(() => child.kill("SIGKILL"), 45000);
        await new Promise<void>((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", () => resolve());
        }).finally(() => clearTimeout(timeout));
        expect(output).toContain(
          "INTERRUPTING_HOSTED_WORKER_AFTER_NGINX_RELOAD",
        );
        expect((await worker.client.getClient(job.id)).phase).toBe("verifying");
        expect((await listReleases(worker.store)).selectedReleaseId).toBe(
          job.id,
        );
        newer.pages[0].draft.title = restore
          ? "New draft after second crash"
          : "New draft after first crash";
        // Keep fixture version stable so its next explicit review uses this retained workspace.
        await db.query(
          "update builder_project_workspaces set payload=$1 where project_id=$2",
          [JSON.stringify(newer), f.projectId],
        );
        f.workspace = structuredClone(newer);
        if (restore)
          await db.query(
            "update builder_client_destinations set enabled=false where id=$1",
            [f.destinationId],
          );
        expect(
          await recoverClientPublication(
            job.id,
            {
              ...worker,
              adapters: {
                validateConfig: () => nginx(["-t"]),
                reload: () => nginx(["-s", "reload"]),
                checkLive: (_registeredOrigin, manifest) =>
                  checkLive(f.origin, manifest),
              },
            },
            restore,
          ),
        ).toMatchObject({ phase: restore ? "rolled_back" : "live" });
        const expected = restore ? job.previous_artifact_id : job.id;
        // Nginx acknowledges the reload signal before its new workers accept connections.
        const manifest = await verifyRelease(worker.store, expected);
        await expect
          .poll(
            async () => {
              try {
                await checkLive(f.origin, manifest);
                return "verified";
              } catch (error) {
                return error.message;
              }
            },
            { timeout: 5000 },
          )
          .toBe("verified");
        expect(
          (
            await db.query<any>(
              "select active_artifact_id from builder_client_destinations where id=$1",
              [f.destinationId],
            )
          ).rows[0].active_artifact_id,
        ).toBe(expected);
        expect(
          (
            await db.query<any>(
              "select payload from builder_project_workspaces where project_id=$1",
              [f.projectId],
            )
          ).rows[0].payload,
        ).toEqual(newer);
        await expect(
          lstat(
            path.join(
              worker.workDirectory,
              f.destinationId,
              job.id,
              ".worker-lock",
            ),
          ),
        ).rejects.toMatchObject({ code: "ENOENT" });
        await expect(
          lstat(path.join(worker.store, ".activation-lock")),
        ).rejects.toMatchObject({ code: "ENOENT" });
      }
    } finally {
      routedFetch.mockRestore();
      bridge.closeAllConnections();
      await new Promise<void>((resolve) => bridge.close(() => resolve()));
      await nginx(["-s", "quit"]).catch(() => server.kill("SIGKILL"));
      await serverExit;
    }
  },
  120000,
);
