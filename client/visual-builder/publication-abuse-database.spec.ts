import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runClientPublication } from "../../scripts/builder-client-worker";
import {
  bindClientStore,
  initialiseStore,
  listReleases,
  stageRelease,
  verifyRelease,
} from "../../scripts/kaizen-releases.mjs";

let db: PGlite;
const alice = "22222222-2222-4222-8222-222222222222",
  stranger = "33333333-3333-4333-8333-333333333333";
let project: string;
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id));alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create table public.contact_form_submissions(name text,last_name text,email text,phone text,website text,message text,marketing_consent boolean,consent_to_gdpr boolean,source_page text,user_agent text);
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
  const skipped = new Set([
    "202609120003_builder_error_retention.sql",
    "202609140002_builder_function_limit_retention.sql",
    "202609140005_builder_privacy_retention.sql",
    "202609150008_builder_billing_retention.sql",
  ]);
  for (const file of (await readdir("supabase/migrations")).sort()) {
    if (
      !/^\d+_(?:visual_builder|builder_.*)\.sql$/.test(file) ||
      skipped.has(file)
    )
      continue;
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`begin;
    insert into auth.users(id,email,email_confirmed_at) values('${alice}','alice@example.test',now()),('${stranger}','stranger@example.test',now());
    insert into builder_legal_acceptances(user_id,version) select id,'2026-09-14' from auth.users;
    update builder_plans set publishes_per_month=1000,projects=100;`);
  project = await create(alice);
});
afterEach(async () => {
  await db.exec("rollback");
});
async function as(
  role: string,
  actor: string | null,
  sql: string,
  args: unknown[] = [],
) {
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",
    [actor || "", role],
  );
  await db.exec(`set role ${role};savepoint abuse_action`);
  try {
    return (await db.query<any>(sql, args)).rows;
  } catch (error) {
    await db.exec("rollback to savepoint abuse_action");
    throw error;
  } finally {
    await db.exec("release savepoint abuse_action;reset role");
  }
}
async function raw(sql: string, args: unknown[] = []) {
  await db.exec("savepoint abuse_raw");
  try {
    const result = await db.query<any>(sql, args);
    await db.exec("release savepoint abuse_raw");
    return result;
  } catch (error) {
    await db.exec(
      "rollback to savepoint abuse_raw;release savepoint abuse_raw",
    );
    throw error;
  }
}
const create = async (actor: string) =>
  (
    await as(
      "authenticated",
      actor,
      "select builder_create_project('Fixture website') as id",
    )
  )[0].id as string;
const service = async (sql: string, args: unknown[] = []) =>
  (await as("service_role", null, sql, args))[0]?.value;
async function destination(target = project) {
  const id = randomUUID();
  await db.query(
    "insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id) values($1,$2,'production',$3,'Fixture','fixture','baseline') on conflict(project_id,environment) where enabled do nothing",
    [id, target, `https://${id}.example.test`],
  );
  return (
    await db.query<any>(
      "select id,origin from builder_client_destinations where project_id=$1 and environment='production'",
      [target],
    )
  ).rows[0];
}
async function job(phase = "queued", action = "publish", target = project) {
  const id = randomUUID();
  await destination(target);
  return (
    await as(
      "service_role",
      null,
      "insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,snapshot,previous_artifact_id,artifact_id,phase) select $1::uuid,$2,id,builder_client_destination_public(d),version,'fixture',$3,$4,$5::jsonb,active_artifact_id,$1::uuid::text,$6 from builder_client_destinations d where project_id=$2 and environment='production' returning id",
      [
        id,
        target,
        alice,
        action,
        JSON.stringify({ workspace: { pages: [{}], assets: [] } }),
        phase,
      ],
    )
  )[0].id as string;
}
const phase = (id: string, next: string) =>
  as(
    "service_role",
    null,
    "update builder_client_jobs set phase=$2 where id=$1",
    [id, next],
  );
const suspend = (
  target: string,
  takedown = false,
  report: string | null = null,
) =>
  service(
    "select builder_operator_suspend($1,$2,'kaizen-operator','Reported phishing page',$3) as value",
    [target, report, takedown],
  );
const hash = (n: number) => n.toString(16).padStart(64, "0");
const submit = (
  origin: string,
  reporter = hash(1),
  id = randomUUID(),
  details = "This page asks visitors for bank passwords.",
) =>
  service("select builder_submit_abuse_report($1,$2,$3,$4) as value", [
    id,
    hash(Buffer.from(details + origin).length + 7),
    reporter,
    { origin, category: "phishing", details, contact: "reporter@example.test" },
  ]);

it("limits bursts of publications per website and per account while exact retries keep their allowance", async () => {
  const first = await job();
  await phase(first, "live");
  for (let n = 1; n < 30; n++) await phase(await job(), "live");
  await expect(job()).rejects.toThrow(/Too many publications in the last hour/);
  // An exact retry of an already reserved job is never charged or re-limited.
  await db.query("select builder_reserve_publication('client',$1,$2)", [
    first,
    project,
  ]);
  await db.query(
    "update builder_publication_allowances set reserved_at=clock_timestamp()-interval '2 hours' where project_id=$1",
    [project],
  );
  await phase(await job(), "live");

  const other = await create(alice);
  const month = (
    await db.query<any>(
      "select month from builder_billing_months where user_id=$1 limit 1",
      [alice],
    )
  ).rows[0].month;
  for (let n = 0; n < 60; n++)
    await db.query(
      "insert into builder_publication_allowances(kind,job_id,project_id,user_id,month,state) values('client',$1,$2,$3,$4,'consumed')",
      [randomUUID(), other, alice, month],
    );
  await expect(job("queued", "publish", project)).rejects.toThrow(
    /Too many publications in the last hour/,
  );
});

it("pauses publishing and restores for a suspended website, keeps its data and still allows taking it offline", async () => {
  const pending = await job();
  expect(await suspend(project)).toMatchObject({
    projectId: project,
    state: "suspended",
    queuedJobs: [],
  });
  // A queued job cannot be claimed while publishing is paused.
  await expect(phase(pending, "building")).rejects.toThrow(
    /Publishing is paused for this website/,
  );
  await phase(pending, "failed");
  await expect(job()).rejects.toThrow(/Publishing is paused/);
  await expect(job("queued", "rollback")).rejects.toThrow(
    /Publishing is paused/,
  );
  const target = await destination(),
    review = randomUUID();
  await expect(
    raw(
      "insert into builder_client_reviews(id,project_id,destination_id,actor,action,snapshot,workspace_version,destination_version,previous_artifact_id,artifact_id) values($1::uuid,$2,$3,$4,'publish',$5,0,1,'baseline',$6)",
      [review, project, target.id, alice, { workspace: { pages: [] } }, review],
    ),
  ).rejects.toThrow(/Publishing is paused/);
  const offline = await job("queued", "unpublish");
  await phase(offline, "live");

  expect(
    await service("select builder_project_suspension_state($1,$2) as value", [
      project,
      alice,
    ]),
  ).toMatchObject({ state: "suspended" });
  expect(
    await service("select builder_project_suspension_state($1,$2) as value", [
      project,
      stranger,
    ]),
  ).toBeNull();
  expect(
    await service("select builder_project_suspension_summaries($1) as value", [
      alice,
    ]),
  ).toEqual([
    expect.objectContaining({ projectId: project, state: "suspended" }),
  ]);
  await expect(
    raw("delete from builder_projects where id=$1", [project]),
  ).rejects.toThrow();
  expect(
    (
      await db.query<any>(
        "select count(*)::integer as count from builder_project_workspaces where project_id=$1",
        [project],
      )
    ).rows[0].count,
  ).toBe(1);

  expect(
    await service(
      "select builder_operator_restore($1,'kaizen-operator','Review found no problem') as value",
      [project],
    ),
  ).toMatchObject({ restored: true, previousState: "suspended" });
  await phase(await job(), "live");
  expect(
    (
      await db.query<any>(
        "select action from builder_abuse_actions where project_id=$1 order by created_at",
        [project],
      )
    ).rows.map((row) => row.action),
  ).toEqual(["suspend", "restore"]);
  await expect(suspend("kaizen")).rejects.toThrow(/Invalid suspension request/);
  await expect(
    service(
      "select builder_operator_restore($1,'kaizen-operator','Nothing to lift') as value",
      [project],
    ),
  ).rejects.toThrow(/not suspended/);
});

it("takes a reported website offline through the verified unpublication path and keeps review history", async () => {
  await phase(await job(), "live");
  const site = await destination();
  expect(await submit(site.origin.toUpperCase())).toMatchObject({
    status: "received",
  });
  const replayId = randomUUID();
  await submit(site.origin, hash(2), replayId);
  expect(await submit(site.origin, hash(2), replayId)).toMatchObject({
    id: replayId,
  });
  await expect(
    submit(
      site.origin,
      hash(2),
      replayId,
      "A different report about this page.",
    ),
  ).rejects.toThrow(/Report request conflict/);
  for (let n = 0; n < 4; n++) await submit(site.origin, hash(2));
  await expect(submit(site.origin, hash(2))).rejects.toThrow(
    /Report rate limit/,
  );
  await expect(
    submit("https://not-hosted.example.test", hash(3)),
  ).rejects.toThrow(/not hosted by Kaizen/);
  await expect(
    service("select builder_submit_abuse_report($1,$2,$3,$4) as value", [
      randomUUID(),
      hash(9),
      hash(4),
      { origin: site.origin, category: "phishing", details: "short" },
    ]),
  ).rejects.toThrow(/Invalid report/);

  const [report] = await service(
    "select builder_operator_reports('open') as value",
  );
  expect(report).toMatchObject({ projectId: project, category: "phishing" });
  const outcome = await suspend(project, true, report.id);
  expect(outcome).toMatchObject({ state: "taken_down" });
  expect(outcome.queuedJobs).toHaveLength(1);
  const [takedown] = (
    await db.query<any>("select * from builder_client_jobs where id=$1", [
      outcome.queuedJobs[0],
    ])
  ).rows;
  expect(takedown).toMatchObject({
    action: "unpublish",
    operator_takedown: true,
    requested_by: null,
    previous_artifact_id: "baseline",
  });
  // The existing worker claim accepts it without a customer requester.
  const token = randomUUID();
  expect(
    await service("select builder_client_claim($1,'fixture',$2) as value", [
      takedown.id,
      token,
    ]),
  ).toMatchObject({ owner_token: token, phase: "building" });
  expect(await suspend(project, true)).toMatchObject({
    destinationsWithPendingWork: [site.id],
    queuedJobs: [],
  });
  expect(
    (await service("select builder_operator_reports('actioned') as value"))[0],
  ).toMatchObject({
    id: report.id,
    suspension: "taken_down",
    reviewer: "kaizen-operator",
  });
  await expect(
    service(
      "select builder_operator_dismiss_report($1,'kaizen-operator','Duplicate') as value",
      [report.id],
    ),
  ).rejects.toThrow(/already reviewed/);
  await expect(
    raw(
      "insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,previous_artifact_id,artifact_id,phase) select $1::uuid,$2,id,builder_client_destination_public(d),version,'fixture',null,'unpublish','baseline',$1::uuid::text,'failed' from builder_client_destinations d where id=$3",
      [randomUUID(), project, site.id],
    ),
  ).rejects.toThrow(/builder_client_jobs_requester/);
});

it("pauses hosted repository output while suspended and keeps abuse records private", async () => {
  await suspend(project);
  await expect(
    raw(
      "insert into builder_repository_output_jobs(id,project_id,channel,artifact_id,commit_hash,measurement,phase) values($1,$2,'staging','output',$3,$4,'reserved')",
      [
        randomUUID(),
        project,
        "d".repeat(40),
        {
          bytes: 100,
          pages: 1,
          sourceBytes: 100,
          sourceRevision: "c".repeat(64),
          manifestSha256: "b".repeat(64),
        },
      ],
    ),
  ).rejects.toThrow(/Publishing is paused/);
  for (const table of [
    "builder_project_suspensions",
    "builder_abuse_reports",
    "builder_abuse_actions",
  ])
    for (const role of ["anon", "authenticated", "service_role"])
      await expect(as(role, alice, `select * from ${table}`)).rejects.toThrow(
        /permission denied/,
      );
  for (const role of ["anon", "authenticated"])
    await expect(
      as(
        role,
        alice,
        "select builder_operator_suspend($1,null,'someone','Take it down',true)",
        [project],
      ),
    ).rejects.toThrow(/permission denied/);
});

it("runs an operator takedown through the real client worker and refuses a publication queued before it", async () => {
  await phase(await job(), "live");
  const site = await destination();
  const root = await mkdtemp(path.join(os.tmpdir(), "kaizen-takedown-"));
  try {
    const store = path.join(root, "store"),
      source = path.join(root, "source");
    const identity = {
      projectId: project,
      destinationId: site.id,
      environment: "production",
      origin: site.origin,
    };
    await mkdir(source);
    await writeFile(path.join(source, "index.html"), "<h1>Reported page</h1>");
    await bindClientStore({ store, client: identity });
    await stageRelease({ store, client: identity, source, id: "baseline" });
    await initialiseStore({ store, id: "baseline" });
    const registry = path.join(root, "destinations.json");
    await writeFile(
      registry,
      JSON.stringify({
        schemaVersion: 1,
        destinations: [{ ...identity, label: "Fixture", store }],
      }),
    );
    const client = {
      getClient: async (id: string) =>
        (
          await db.query<any>("select * from builder_client_jobs where id=$1", [
            id,
          ])
        ).rows[0],
      rpc: async (name: string, input: Record<string, unknown>) => {
        const entries = Object.entries(input);
        try {
          return (
            await as(
              "service_role",
              null,
              `select ${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")}) as value`,
              entries.map(([, value]) =>
                value && typeof value === "object"
                  ? JSON.stringify(value)
                  : value,
              ),
            )
          )[0].value;
        } catch (error) {
          (error as any).definitive = true;
          throw error;
        }
      },
    };
    const services = {
      client,
      workerId: "fixture",
      registry,
      workDirectory: path.join(root, "work"),
      samplesRoot: path.join(root, "samples"),
      compile: async () => {
        throw new Error("A takedown never compiles a website");
      },
      registeredAsset: async () => {
        throw new Error("Unexpected asset request");
      },
      adapters: {
        validateConfig: async () => {},
        reload: async () => {},
        checkLive: async () => {},
      },
    };
    const queued = await job();
    const first = await suspend(project, true);
    expect(first.destinationsWithPendingWork).toEqual([site.id]);
    await expect(runClientPublication(queued, services)).rejects.toThrow(
      /Publishing is paused/,
    );
    expect((await client.getClient(queued)).phase).toBe("failed");
    const retry = await suspend(project, true);
    expect(retry.queuedJobs).toHaveLength(1);
    const takedown = retry.queuedJobs[0];
    expect(await runClientPublication(takedown, services)).toMatchObject({
      phase: "live",
    });
    expect((await listReleases(store)).selectedReleaseId).toBe(takedown);
    expect(
      await readFile(
        path.join(store, "releases", takedown, "site/index.html"),
        "utf8",
      ),
    ).toContain("temporarily unavailable");
    // The reported release stays retained for a reviewed restore.
    await verifyRelease(store, "baseline");
    expect(
      (
        await db.query<any>(
          "select active_artifact_id from builder_client_destinations where id=$1",
          [site.id],
        )
      ).rows[0].active_artifact_id,
    ).toBe(takedown);
    expect(
      (
        await db.query<any>(
          "select count(*)::integer as count from builder_client_jobs where project_id=$1",
          [project],
        )
      ).rows[0].count,
    ).toBeGreaterThanOrEqual(3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
