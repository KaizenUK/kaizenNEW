import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { prepareReleaseRequest } from "../../shared/builderReleases";
import { newDocument } from "./starters";

let db: PGlite;
const beta = "11111111-1111-4111-8111-111111111111",
  alice = "22222222-2222-4222-8222-222222222222",
  bob = "33333333-3333-4333-8333-333333333333",
  editor = "44444444-4444-4444-8444-444444444444";
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
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
    insert into auth.users(id,email,email_confirmed_at) values('${beta}','beta@example.test',now());`);
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
    if (file === "202609150002_builder_billing.sql") {
      await db.query(
        "insert into builder_projects(id,name) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','No draft yet')",
      );
      await db.query(
        "insert into builder_project_members(project_id,user_id,role,can_publish) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',$1,'owner',true)",
        [beta],
      );
    }
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    if (file === "202609100001_visual_builder.sql")
      await db.query("insert into builder_editors(user_id) values($1)", [beta]);
  }
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`begin;
    insert into auth.users(id,email,email_confirmed_at) values('${alice}','alice@example.test',now()),('${bob}','bob@example.test',now()),('${editor}','editor@example.test',now());
    insert into builder_legal_acceptances(user_id,version) select id,'2026-09-14' from auth.users;`);
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
  await db.exec(`set role ${role};savepoint quota_action`);
  try {
    return (await db.query<any>(sql, args)).rows;
  } catch (error) {
    await db.exec("rollback to savepoint quota_action");
    throw error;
  } finally {
    await db.exec("release savepoint quota_action;reset role");
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
const inspect = async (actor = alice, target = project) =>
  (
    await as(
      "service_role",
      null,
      "select builder_project_billing_summary($1,$2) as data",
      [target, actor],
    )
  )[0].data;
const save = async (pages: number, bytes = 0, target = project) => {
  const workspace = {
    pages: Array.from({ length: pages }, (_, i) => ({
      id: `page-${i}`,
      draft: { title: `Page ${i}` },
    })),
    assets: bytes ? [{ id: "asset-fixture", size: bytes }] : [],
    saved: [],
  };
  return as(
    "service_role",
    null,
    "select builder_commit_project_workspace($1,$2,(select version from builder_project_workspaces where project_id=$1),$3::jsonb)",
    [target, alice, JSON.stringify(workspace)],
  );
};
const take = (actor = bob, target = project) =>
  as("service_role", null, "select builder_take_project_billing($1,$2)", [
    target,
    actor,
  ]);
async function addOwner(actor = bob, target = project) {
  await as(
    "authenticated",
    alice,
    "select builder_set_project_member($1,$2,'owner',true)",
    [target, actor],
  );
}
async function plus(actor = alice) {
  await db.query(
    "insert into builder_billing_accounts(user_id) values($1) on conflict do nothing",
    [actor],
  );
  await db.query(
    "insert into builder_subscriptions(id,user_id,status,plan_id,price_id,period_end,cancel_at_period_end) values($1,$2,'active','plus','price_plus',now()+interval '1 month',false)",
    [`sub_${actor.replace(/-/g, "")}`, actor],
  );
}
async function job(
  phase = "queued",
  action = "publish",
  target = project,
  snapshotPages = 1,
  snapshotBytes = 0,
) {
  const id = crypto.randomUUID(),
    destination = crypto.randomUUID();
  await db.query(
    "insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id) values($1,$2,'production',$3,'Fixture','fixture','baseline') on conflict(project_id,environment) where enabled do nothing",
    [destination, target, `https://${destination}.example.test`],
  );
  return (
    await as(
      "service_role",
      null,
      "insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,snapshot,previous_artifact_id,artifact_id,phase) select $1::uuid,$2,id,'{}',version,'fixture',$3,$4,$5::jsonb,active_artifact_id,$1::uuid::text,$6 from builder_client_destinations where project_id=$2 and environment='production' returning id",
      [
        id,
        target,
        alice,
        action,
        JSON.stringify({
          workspace: {
            pages: Array.from({ length: snapshotPages }, () => ({})),
            assets: snapshotBytes
              ? [{ id: "reviewed-asset", size: snapshotBytes }]
              : [],
          },
        }),
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

it("backfills an existing owned website with no saved workspace as zero usage", async () => {
  expect(
    await inspect(beta, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
  ).toMatchObject({
    plan: { id: "beta" },
    pages: 0,
    registeredBytes: 0,
    accountUsage: { projects: 2 },
  });
});

it("atomically assigns the first owner, keeps beta access and counts archived websites", async () => {
  expect(await inspect()).toMatchObject({
    isBillingOwner: true,
    plan: { id: "free" },
    accountUsage: { projects: 1, registeredBytes: 0, publications: 0 },
  });
  expect((await inspect(beta, "kaizen")).plan.id).toBe("beta");
  await expect(create(alice)).rejects.toThrow(/website limit/);
  await as(
    "authenticated",
    alice,
    "select builder_update_project($1,1,null,true)",
    [project],
  );
  await expect(create(alice)).rejects.toThrow(/Archived websites also count/);
  expect(
    (
      await db.query<{ id: string }>(
        "select id from builder_projects order by id",
      )
    ).rows.map((row) => row.id),
  ).toEqual(["kaizen", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", project].sort());
});
it("does not charge invitations and only lets another owner take billing for their own account", async () => {
  await addOwner();
  await as(
    "authenticated",
    alice,
    "select builder_set_project_member($1,$2,'editor',false)",
    [project, editor],
  );
  expect(await inspect(bob)).toMatchObject({
    isBillingOwner: false,
    canTakeBilling: true,
    accountUsage: null,
  });
  expect(await inspect(editor)).toMatchObject({
    canTakeBilling: false,
    accountUsage: null,
  });
  await expect(take(editor)).rejects.toThrow(/Only a website owner/);
  await take();
  await take();
  expect(await inspect(bob)).toMatchObject({
    isBillingOwner: true,
    accountUsage: { projects: 1 },
  });
  expect(
    (
      await db.query<any>(
        "select project_count from builder_billing_accounts where user_id=$1",
        [alice],
      )
    ).rows[0].project_count,
  ).toBe(0);
  await create(alice);
});
it("refuses a transfer that exceeds the receiver's plan without moving any counters", async () => {
  await addOwner();
  const second = await create(bob);
  await save(2, 100);
  await expect(take()).rejects.toThrow(/website limit/);
  expect(await inspect()).toMatchObject({
    isBillingOwner: true,
    accountUsage: { projects: 1, registeredBytes: 100 },
  });
  expect(await inspect(bob, second)).toMatchObject({
    isBillingOwner: true,
    accountUsage: { projects: 1, registeredBytes: 0 },
  });
});
it("requires billing transfer before owner removal or account deletion, while project deletion releases usage", async () => {
  await addOwner();
  await expect(
    as(
      "authenticated",
      alice,
      "select builder_set_project_member($1,$2,null,false)",
      [project, alice],
    ),
  ).rejects.toThrow(/take over website billing/);
  await take();
  await as(
    "authenticated",
    bob,
    "select builder_set_project_member($1,$2,null,false)",
    [project, alice],
  );
  await db.query("delete from builder_projects where id=$1", [project]);
  expect(
    (
      await db.query<any>(
        "select project_count,registered_bytes from builder_billing_accounts where user_id=$1",
        [bob],
      )
    ).rows[0],
  ).toEqual({ project_count: 0, registered_bytes: 0 });
});
it("enforces page and registered-storage increases transactionally across draft and restore payloads", async () => {
  await save(5, 100);
  await expect(save(6, 100)).rejects.toThrow(/page limit/);
  expect(await inspect()).toMatchObject({ pages: 5, registeredBytes: 100 });
  await expect(save(5, 104857601)).rejects.toThrow(/storage limit/);
  expect(await inspect()).toMatchObject({ pages: 5, registeredBytes: 100 });
  await save(3, 80);
  expect(await inspect()).toMatchObject({ pages: 3, registeredBytes: 80 });
});
it("aggregates storage across owned websites and preserves existing edits after downgrade", async () => {
  await plus();
  const second = await create(alice);
  await save(6, 104857600);
  await save(1, 104857600, second);
  await db.query(
    "update builder_subscriptions set status='canceled' where user_id=$1",
    [alice],
  );
  await save(6, 104857600);
  await save(5, 100);
  expect(await inspect()).toMatchObject({
    pages: 5,
    accountUsage: { projects: 2, registeredBytes: 104857700 },
  });
  await expect(save(5, 101)).rejects.toThrow(/storage limit/);
  await expect(job()).rejects.toThrow(/exceeds its current plan/);
});
it("reserves monthly publication allowance, returns failed jobs and counts successful jobs once", async () => {
  await save(1);
  for (let i = 0; i < 10; i++) {
    const id = await job();
    await phase(id, "failed");
  }
  expect((await inspect()).accountUsage.publications).toBe(0);
  for (let i = 0; i < 10; i++) {
    const id = await job();
    await phase(id, "live");
    await phase(id, "live");
  }
  expect((await inspect()).accountUsage.publications).toBe(10);
  await expect(job()).rejects.toThrow(/monthly publishing limit/);
  expect((await inspect()).accountUsage.publications).toBe(10);
  expect(
    (await db.query("select * from builder_client_jobs where phase='queued'"))
      .rows,
  ).toHaveLength(0);
});
it("allows rollback and unpublishing after exhaustion and preserves operator recovery", async () => {
  await save(1);
  for (let i = 0; i < 10; i++) await job("live");
  const rollback = await job("queued", "rollback");
  await phase(rollback, "live");
  const removal = await job("queued", "unpublish");
  await phase(removal, "live");
  expect((await inspect()).accountUsage.publications).toBe(10);
  await db.query(
    "update builder_plans set publishes_per_month=11 where id='free'",
  );
  const recovery = await job();
  await phase(recovery, "failed");
  await phase(recovery, "activating");
  await phase(recovery, "live");
  await phase(recovery, "live");
  expect((await inspect()).accountUsage.publications).toBe(11);
});
it("rechecks the reviewed snapshot and current plan before activation, and blocks billing transfer during pending work", async () => {
  await plus();
  await save(6);
  const queued = await job("queued", "publish", project, 6);
  await addOwner();
  await expect(take()).rejects.toThrow(/pending publication/);
  await db.query(
    "update builder_subscriptions set status='canceled' where user_id=$1",
    [alice],
  );
  await save(1);
  await expect(phase(queued, "building")).rejects.toThrow(
    /reviewed publication exceeds/,
  );
  await phase(queued, "failed");
  expect((await inspect()).accountUsage.publications).toBe(0);
  await take();
  expect((await inspect(bob)).isBillingOwner).toBe(true);
});
it("tracks the original site's actual page and asset tables rather than its compatibility workspace", async () => {
  const page = crypto.randomUUID(),
    asset = crypto.randomUUID();
  await db.query(
    'insert into builder_pages(id,payload) values($1,\'{"draft":{"slug":"fixture-page"}}\')',
    [page],
  );
  await db.query(
    "insert into builder_assets(id,hash,payload) values($1,'fixture','{\"size\":100}')",
    [asset],
  );
  expect(await inspect(beta, "kaizen")).toMatchObject({
    pages: 1,
    registeredBytes: 100,
  });
  await db.exec(
    "insert into builder_project_workspaces(project_id) values('kaizen')",
  );
  expect(await inspect(beta, "kaizen")).toMatchObject({
    pages: 1,
    registeredBytes: 100,
  });
  await db.query("delete from builder_assets where id=$1", [asset]);
  expect((await inspect(beta, "kaizen")).registeredBytes).toBe(0);
});
it.each(["anon", "authenticated", "service_role"])(
  "denies %s direct quota records and helper execution",
  async (role) => {
    for (const table of [
      "builder_project_billing",
      "builder_billing_months",
      "builder_publication_allowances",
    ])
      for (const command of ["select * from", "delete from", "truncate"])
        await expect(as(role, alice, `${command} ${table}`)).rejects.toThrow(
          /permission denied/,
        );
    await expect(
      as(role, alice, "select builder_reserve_publication('client',$1,$2)", [
        crypto.randomUUID(),
        project,
      ]),
    ).rejects.toThrow(/permission denied/);
    if (role !== "service_role")
      await expect(
        as(role, alice, "select builder_take_project_billing($1,$2)", [
          project,
          bob,
        ]),
      ).rejects.toThrow(/permission denied/);
  },
);

const repositoryBinding = "a".repeat(64),
  repositoryCommit = "b".repeat(40),
  repositoryBase = "c".repeat(40);
const reserveRepository = async (
  id: string,
  attempt = 1,
  actor = alice,
  target = project,
  binding = repositoryBinding,
) => {
  if (
    !(
      await db.query<{ repository_staging_job: string | null }>(
        "select repository_staging_job from builder_project_billing where project_id=$1",
        [target],
      )
    ).rows[0]?.repository_staging_job
  ) {
    const job = crypto.randomUUID();
    const sample = {
      bytes: 0,
      pages: 0,
      sourceBytes: 0,
      sourceRevision: "a".repeat(64),
      manifestSha256: "d".repeat(64),
    };
    await as(
      "service_role",
      null,
      "select builder_repository_output_begin($1,$2,'staging','fixture-staged',$3,$4)",
      [target, job, repositoryCommit, sample],
    );
    await as(
      "service_role",
      null,
      "select builder_repository_output_settle($1,$2,'staging','fixture-staged',$3,$4,'live')",
      [target, job, repositoryCommit, sample],
    );
  }
  return as(
    "service_role",
    null,
    "select builder_repository_publish_begin($1,$2,$3,$4,$5,$6,$7,'fixture-staged') as result",
    [target, actor, id, binding, repositoryCommit, repositoryBase, attempt],
  );
};
const settleRepository = (
  id: string,
  outcome: string,
  attempt = 1,
  actor = alice,
) =>
  as(
    "service_role",
    null,
    "select builder_repository_publish_settle($1,$2,$3,$4,$5,$6,$7,$8,'fixture-staged') as result",
    [
      project,
      actor,
      id,
      repositoryBinding,
      repositoryCommit,
      repositoryBase,
      attempt,
      outcome,
    ],
  );

it("binds repository retries to one allowance and settles verified delivery exactly once", async () => {
  const id = crypto.randomUUID();
  expect((await reserveRepository(id))[0].result).toEqual({
    attempt: 1,
    phase: "reserved",
  });
  await reserveRepository(id);
  expect((await inspect()).accountUsage.publications).toBe(1);
  await settleRepository(id, "sent");
  expect((await inspect()).accountUsage.publications).toBe(1);
  await settleRepository(id, "live");
  await settleRepository(id, "live");
  expect((await inspect()).accountUsage.publications).toBe(1);
  await expect(settleRepository(id, "failed")).rejects.toThrow(
    /already finished/,
  );
});
it("keeps an uncertain repository reservation and blocks transfer or a competing review", async () => {
  const id = crypto.randomUUID();
  await reserveRepository(id);
  await addOwner();
  await db.query(
    "update builder_repository_publications set updated_at=now()-interval '1 year' where id=$1",
    [id],
  );
  await expect(take()).rejects.toThrow(/pending publication/);
  await expect(reserveRepository(crypto.randomUUID())).rejects.toThrow(
    /pending repository publication/,
  );
  expect((await inspect()).accountUsage.publications).toBe(1);
  await settleRepository(id, "failed");
  await settleRepository(id, "failed");
  expect((await inspect()).accountUsage.publications).toBe(0);
  await take();
});
it("charges an explicit repository retry to the current payer and fences older failure messages", async () => {
  const id = crypto.randomUUID();
  await reserveRepository(id);
  await settleRepository(id, "failed");
  await addOwner();
  await take();
  expect((await reserveRepository(id))[0].result.phase).toBe("failed");
  expect((await reserveRepository(id, 2))[0].result).toEqual({
    attempt: 2,
    phase: "reserved",
  });
  expect((await inspect(bob)).accountUsage.publications).toBe(1);
  await expect(settleRepository(id, "failed", 1)).rejects.toThrow(/stale/);
  await expect(reserveRepository(id, 1)).rejects.toThrow(/Refresh/);
  await settleRepository(id, "live", 2);
  expect((await inspect(bob)).accountUsage.publications).toBe(1);
});
it("fences a delayed reserve when the helper already proved it never started Git", async () => {
  const id = crypto.randomUUID();
  expect((await settleRepository(id, "failed"))[0].result).toEqual({
    attempt: 1,
    phase: "failed",
  });
  expect((await reserveRepository(id))[0].result.phase).toBe("failed");
  expect((await inspect()).accountUsage.publications).toBe(0);
  await reserveRepository(id, 2);
  expect((await inspect()).accountUsage.publications).toBe(1);
  await expect(settleRepository(id, "failed", 1)).rejects.toThrow(/stale/);
  await settleRepository(id, "failed", 2);
  expect((await inspect()).accountUsage.publications).toBe(0);
});
it("rechecks repository identity, current publishing access and downgraded limits before pushing", async () => {
  const id = crypto.randomUUID();
  await reserveRepository(id);
  await expect(
    reserveRepository(id, 1, alice, project, "d".repeat(64)),
  ).rejects.toThrow(/different website changes/);
  await expect(reserveRepository(id, 1, bob)).rejects.toThrow(
    /publishing permission/,
  );
  await db.query(
    "update builder_project_members set can_publish=false where project_id=$1 and user_id=$2",
    [project, alice],
  );
  await expect(reserveRepository(id)).rejects.toThrow(/publishing permission/);
  await expect(settleRepository(id, "failed")).rejects.toThrow(
    /publishing permission/,
  );
  await db.query(
    "update builder_project_members set can_publish=true where project_id=$1 and user_id=$2",
    [project, alice],
  );
  await plus();
  await save(6);
  await db.query(
    "update builder_subscriptions set status='canceled' where user_id=$1",
    [alice],
  );
  await expect(reserveRepository(id)).rejects.toThrow(
    /exceeds its current plan/,
  );
  await settleRepository(id, "failed");
  expect((await inspect()).accountUsage.publications).toBe(0);
});
it("refuses exhausted repository publishing without leaving a job or reservation", async () => {
  await db.query(
    "insert into builder_billing_months(user_id,month,publications) values($1,date_trunc('month',now() at time zone 'UTC')::date,10)",
    [alice],
  );
  await expect(reserveRepository(crypto.randomUUID())).rejects.toThrow(
    /monthly publishing limit/,
  );
  expect(
    (await db.query("select * from builder_repository_publications")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "select * from builder_publication_allowances where kind='repository'",
      )
    ).rows,
  ).toHaveLength(0);
});

it("returns the old month's allowance and reserves the current month on an explicit repository retry", async () => {
  const id = crypto.randomUUID();
  await reserveRepository(id);
  await db.query(
    "insert into builder_billing_months(user_id,month,publications) values($1,(date_trunc('month',now() at time zone 'UTC')-interval '1 month')::date,1)",
    [alice],
  );
  await db.query(
    "update builder_billing_months set publications=0 where user_id=$1 and month=date_trunc('month',now() at time zone 'UTC')::date",
    [alice],
  );
  await db.query(
    "update builder_publication_allowances set month=(date_trunc('month',now() at time zone 'UTC')-interval '1 month')::date where kind='repository' and job_id=$1",
    [id],
  );
  await settleRepository(id, "failed");
  await reserveRepository(id, 2);
  expect((await inspect()).accountUsage.publications).toBe(1);
  expect(
    (
      await db.query<{ publications: number }>(
        "select publications from builder_billing_months where user_id=$1 and month<(date_trunc('month',now() at time zone 'UTC'))::date",
        [alice],
      )
    ).rows,
  ).toEqual([{ publications: 0 }]);
  await settleRepository(id, "failed", 2);
  await settleRepository(id, "live", 2);
  await settleRepository(id, "live", 2);
  expect((await inspect()).accountUsage.publications).toBe(1);
});

const usageRead = async (actor: string | null = alice, target = project) =>
  (
    await as(
      "service_role",
      null,
      "select builder_repository_usage_read($1,$2) as value",
      [target, actor],
    )
  )[0].value;
const usageWrite = async (
  version: number,
  channel: string,
  bytes: number,
  pages?: number,
  operation = "reserve",
  actor: string | null = alice,
  target = project,
) =>
  (
    await as(
      "service_role",
      null,
      "select builder_repository_usage_write($1,$2,$3,$4,$5,$6) as value",
      [
        target,
        actor,
        version,
        channel,
        {
          bytes,
          revision: "d".repeat(64),
          ...(pages === undefined ? {} : { pages }),
        },
        operation,
      ],
    )
  )[0].value;

it("accounts for source plus the largest rendered copy together with managed assets", async () => {
  await save(2, 10);
  await usageWrite(0, "source", 100);
  await usageWrite(1, "preview", 200, 3);
  await usageWrite(2, "staging", 180, 4);
  await usageWrite(3, "production", 250, 2);
  expect(await inspect()).toMatchObject({
    pages: 4,
    registeredBytes: 360,
    accountUsage: { registeredBytes: 360 },
  });
  await save(1, 20);
  expect(await inspect()).toMatchObject({ pages: 4, registeredBytes: 370 });
  await usageWrite(4, "production", 90, 1);
  expect(await inspect()).toMatchObject({ pages: 4, registeredBytes: 320 });
});

it("fences stale storage observations and refuses malformed or unsigned direct writes", async () => {
  await usageWrite(0, "source", 100);
  await expect(
    usageWrite(0, "source", 0, undefined, "observe"),
  ).rejects.toThrow(/storage changed/);
  await expect(usageWrite(1, "source", -1)).rejects.toThrow(
    /Invalid repository usage/,
  );
  await expect(usageWrite(1, "preview", 10, 1.5)).rejects.toThrow(
    /Invalid repository usage/,
  );
  await expect(usageWrite(1, "source", 10, 1)).rejects.toThrow(
    /Invalid repository usage/,
  );
  await expect(
    as(
      "authenticated",
      alice,
      "select builder_repository_usage_write($1,$2,1,'source',$3,'observe')",
      [project, alice, { bytes: 0, revision: "d".repeat(64) }],
    ),
  ).rejects.toThrow(/permission denied/);
  expect(await usageRead()).toMatchObject({
    version: 1,
    measurements: { source: { bytes: 100 } },
  });
});

it("preserves observed over-limit source, prevents growth, and prevents publication until reduced", async () => {
  const limit = 100 * 1024 * 1024;
  await usageWrite(0, "source", limit + 100, undefined, "observe");
  await expect(usageWrite(1, "source", limit + 101)).rejects.toThrow(
    /exceeds its current plan/,
  );
  await expect(usageWrite(1, "preview", 10, 1, "publish")).rejects.toThrow(
    /exceeds its current plan/,
  );
  await usageWrite(1, "source", limit - 10);
  await usageWrite(2, "preview", 10, 1, "publish");
  expect((await inspect()).registeredBytes).toBe(limit);
  await expect(save(1, 1)).rejects.toThrow(/storage limit/);
});

it("counts generated pages and prevents managed publication from bypassing measured repository usage", async () => {
  await save(1);
  await expect(usageWrite(0, "preview", 100, 6, "publish")).rejects.toThrow(
    /exceeds its current plan/,
  );
  expect((await usageRead()).version).toBe(0);
  await usageWrite(0, "production", 100, 6, "observe");
  await save(1);
  await expect(job()).rejects.toThrow(/exceeds its current plan/);
  await usageWrite(1, "production", 100, 4);
  await job();
});

it("moves repository usage with explicit billing ownership and refuses a plan that cannot hold it", async () => {
  await addOwner();
  await usageWrite(0, "source", 110 * 1024 * 1024, undefined, "observe");
  await expect(take()).rejects.toThrow(/storage limit/);
  await plus(bob);
  await take();
  expect((await inspect(bob)).accountUsage.registeredBytes).toBe(
    110 * 1024 * 1024,
  );
  expect(
    (
      await db.query<{ repository_bytes: number }>(
        "select repository_bytes from builder_billing_accounts where user_id=$1",
        [alice],
      )
    ).rows[0].repository_bytes,
  ).toBe(0);
  await db.query("delete from builder_projects where id=$1", [project]);
  expect(
    (
      await db.query<{ repository_bytes: number }>(
        "select repository_bytes from builder_billing_accounts where user_id=$1",
        [bob],
      )
    ).rows[0].repository_bytes,
  ).toBe(0);
});

it("rechecks the actor, archive and deletion before trusting a new storage measurement", async () => {
  await expect(usageRead(bob)).rejects.toThrow(/editing permission/);
  await db.query(
    "insert into builder_project_members(project_id,user_id,role,can_publish) values($1,$2,'editor',false)",
    [project, editor],
  );
  await usageWrite(0, "source", 100, undefined, "observe", editor);
  await db.query("update auth.users set deleted_at=now() where id=$1", [
    editor,
  ]);
  await expect(usageRead(editor)).rejects.toThrow(/editing permission/);
  await db.query("update builder_projects set archived=true where id=$1", [
    project,
  ]);
  await expect(usageRead()).rejects.toThrow(/active website/);
});

const outputSample = (pages = 2, bytes = 100, sourceBytes = 50) => ({
  pages,
  bytes,
  sourceBytes,
  sourceRevision: "a".repeat(64),
  manifestSha256: "d".repeat(64),
});
const outputBegin = async (
  id: string,
  sample = outputSample(),
  channel = "staging",
  artifact = id,
  recovery = false,
  commit = repositoryCommit,
) =>
  (
    await as(
      "service_role",
      null,
      "select builder_repository_output_begin($1,$2,$3,$4,$5,$6,$7) as value",
      [project, id, channel, artifact, commit, sample, recovery],
    )
  )[0].value;
const outputSettle = async (
  id: string,
  outcome: string,
  sample = outputSample(),
  channel = "staging",
  artifact = id,
  commit = repositoryCommit,
) =>
  (
    await as(
      "service_role",
      null,
      "select builder_repository_output_settle($1,$2,$3,$4,$5,$6,$7) as value",
      [project, id, channel, artifact, commit, sample, outcome],
    )
  )[0].value;
const nativeReserveMeasured = (
  id: string,
  artifact: string,
  commit = repositoryCommit,
) =>
  as(
    "service_role",
    null,
    "select builder_repository_publish_begin($1,$2,$3,$4,$5,$6,1,$7)",
    [project, alice, id, repositoryBinding, commit, repositoryBase, artifact],
  );

it("holds a new output before switching, consumes it once, and releases an older larger copy only after verification", async () => {
  const id = crypto.randomUUID(),
    sample = outputSample(2, 300, 100);
  expect(await outputBegin(id, sample)).toEqual({ id, phase: "reserved" });
  expect(await outputBegin(id, sample)).toEqual({ id, phase: "reserved" });
  expect((await inspect()).registeredBytes).toBe(400);
  await outputSettle(id, "live", sample);
  await outputSettle(id, "live", sample);
  expect((await inspect()).registeredBytes).toBe(400);
  const smaller = crypto.randomUUID(),
    next = outputSample(1, 100, 50);
  await outputBegin(smaller, next);
  expect((await inspect()).registeredBytes).toBe(400);
  await outputSettle(smaller, "live", next);
  expect((await inspect()).registeredBytes).toBe(150);
  await expect(outputSettle(smaller, "failed", next)).rejects.toThrow(
    /live output/,
  );
});

it("requires the exact verified staged artifact rather than a commit or public usage claim", async () => {
  const id = crypto.randomUUID(),
    review = crypto.randomUUID();
  await expect(nativeReserveMeasured(review, id)).rejects.toThrow(
    /has not been measured/,
  );
  await outputBegin(id);
  await expect(nativeReserveMeasured(review, id)).rejects.toThrow(
    /has not been measured/,
  );
  await outputSettle(id, "live");
  await expect(nativeReserveMeasured(review, "other-artifact")).rejects.toThrow(
    /has not been measured/,
  );
  await expect(
    nativeReserveMeasured(review, id, "e".repeat(40)),
  ).rejects.toThrow(/has not been measured/);
  await nativeReserveMeasured(review, id);
  expect((await inspect()).accountUsage.publications).toBe(1);
});

it("rejects an oversized generated release without reserving bytes or trusting changed artifact identity", async () => {
  const id = crypto.randomUUID();
  await expect(outputBegin(id, outputSample(6))).rejects.toThrow(
    /exceeds its current plan/,
  );
  await expect(
    outputBegin(id, outputSample(1, 100 * 1024 * 1024, 1)),
  ).rejects.toThrow(/exceeds its current plan/);
  expect(
    (await db.query("select * from builder_repository_output_jobs")).rows,
  ).toHaveLength(0);
  await outputBegin(id);
  await expect(outputBegin(id, outputSample(2, 99))).rejects.toThrow(
    /different release artifact/,
  );
  await expect(outputBegin(id, outputSample(), "production")).rejects.toThrow(
    /different release artifact/,
  );
  await expect(outputSettle(id, "live", outputSample(3))).rejects.toThrow(
    /stale or belongs/,
  );
  await outputSettle(id, "failed");
  expect((await inspect()).registeredBytes).toBe(0);
});

it("fences a delayed reservation after a definitive pre-switch abort", async () => {
  const id = crypto.randomUUID();
  await outputSettle(id, "failed");
  expect(await outputBegin(id)).toEqual({ id, phase: "failed" });
  expect((await inspect()).registeredBytes).toBe(0);
  const next = crypto.randomUUID();
  await outputBegin(next);
  await outputSettle(next, "live");
  await expect(outputSettle(id, "live")).rejects.toThrow(/newer output owns/);
  expect((await inspect()).registeredBytes).toBe(150);
});

it("retains uncertain bytes across recovery, fences the old worker and releases them after the restored artifact is verified", async () => {
  const first = crypto.randomUUID(),
    original = outputSample(2, 40 * 1024 * 1024, 0);
  await outputBegin(first, original);
  await outputSettle(first, "live", original);
  await plus();
  const bad = crypto.randomUUID(),
    larger = outputSample(10, 80 * 1024 * 1024, 0);
  await outputBegin(bad, larger);
  await db.query(
    "update builder_subscriptions set status='canceled' where user_id=$1",
    [alice],
  );
  const restore = crypto.randomUUID();
  await outputBegin(restore, original, "staging", first, true);
  expect((await inspect()).registeredBytes).toBe(80 * 1024 * 1024);
  await expect(outputSettle(bad, "failed", larger)).rejects.toThrow(
    /recovery now owns/,
  );
  await expect(outputSettle(bad, "live", larger)).rejects.toThrow(
    /recovery now owns/,
  );
  await outputSettle(restore, "live", original, "staging", first);
  expect((await inspect()).registeredBytes).toBe(40 * 1024 * 1024);
  expect(
    (
      await db.query<{ phase: string }>(
        "select phase from builder_repository_output_jobs where id=$1",
        [bad],
      )
    ).rows[0].phase,
  ).toBe("failed");
});

it("allows a smaller preview, staging and production replacement to resolve a downgrade without discarding the old live usage early", async () => {
  await plus();
  const old = crypto.randomUUID(),
    larger = outputSample(6, 150 * 1024 * 1024, 0);
  await outputBegin(old, larger, "production");
  await outputSettle(old, "live", larger, "production");
  await db.query(
    "update builder_subscriptions set status='canceled' where user_id=$1",
    [alice],
  );
  await usageWrite(
    (await usageRead()).version,
    "preview",
    10 * 1024 * 1024,
    4,
    "publish",
  );
  const stage = crypto.randomUUID(),
    smaller = outputSample(4, 10 * 1024 * 1024, 0);
  await outputBegin(stage, smaller);
  await outputSettle(stage, "live", smaller);
  expect((await inspect()).registeredBytes).toBe(150 * 1024 * 1024);
  await nativeReserveMeasured(crypto.randomUUID(), stage);
  const live = crypto.randomUUID();
  await outputBegin(live, smaller, "production");
  expect((await inspect()).registeredBytes).toBe(150 * 1024 * 1024);
  await outputSettle(live, "live", smaller, "production");
  expect((await inspect()).registeredBytes).toBe(10 * 1024 * 1024);
});

it("keeps pending output with its billing owner and permits final reconciliation after archival", async () => {
  await addOwner();
  const id = crypto.randomUUID();
  await outputBegin(id);
  await expect(take()).rejects.toThrow(/pending publication or recovery/);
  await db.query("update builder_projects set archived=true where id=$1", [
    project,
  ]);
  await outputSettle(id, "live");
  const recoveryId = crypto.randomUUID();
  await expect(outputBegin(recoveryId)).rejects.toThrow(
    /archived|access|active/,
  );
  await outputBegin(recoveryId, outputSample(), "staging", recoveryId, true);
  await outputSettle(recoveryId, "live");
  expect((await inspect()).registeredBytes).toBe(150);
});

it("checks a reviewed snapshot against storage used by the payer's other websites", async () => {
  await plus();
  const second = await create(alice);
  await save(1, 1900 * 1024 * 1024, second);
  await expect(
    job("queued", "publish", project, 1, 200 * 1024 * 1024),
  ).rejects.toThrow(/reviewed publication exceeds/);
  expect((await inspect()).accountUsage.publications).toBe(0);
  const accepted = await job(
    "queued",
    "publish",
    project,
    1,
    100 * 1024 * 1024,
  );
  await phase(accepted, "failed");
  expect((await inspect()).accountUsage.publications).toBe(0);
});

it("finishes actual account deletion only after billing transfer and preserves the receiving website's content and usage", async () => {
  await save(1, 100);
  await addOwner();
  const request = (
    await as(
      "service_role",
      null,
      "select builder_account_deletion_request($1) as id",
      [alice],
    )
  )[0].id;
  await expect(
    as(
      "service_role",
      null,
      "select builder_account_deletion_prepare($1,$2,$3)",
      [bob, request, project],
    ),
  ).rejects.toThrow(/take over website billing/);
  expect(
    (
      await db.query<any>(
        "select status from builder_account_deletions where user_id=$1",
        [alice],
      )
    ).rows[0].status,
  ).toBe("pending");
  await take();
  await as(
    "service_role",
    null,
    "select builder_billing_bind_customer($1,'cus_deletionfixture')",
    [alice],
  );
  await expect(
    as(
      "service_role",
      null,
      "select builder_account_deletion_prepare($1,$2,$3)",
      [bob, request, project],
    ),
  ).rejects.toThrow(/Refresh billing/);
  const claimed = (
    await as(
      "service_role",
      null,
      "select builder_billing_claim('cus_deletionfixture','evt_deletefixture','customer.subscription.deleted') as data",
    )
  )[0].data;
  await as(
    "service_role",
    null,
    "select builder_billing_finish($1,'cus_deletionfixture',$2,'evt_deletefixture','[]','[]')",
    [alice, claimed.token],
  );
  await as(
    "service_role",
    null,
    "select builder_account_deletion_prepare($1,$2,$3)",
    [bob, request, project],
  );
  await expect(
    as("service_role", null, "select builder_account_deletion_complete($1)", [
      request,
    ]),
  ).rejects.toThrow(/not yet confirmed/);
  // Synthetic Auth boundary: no provider or actual account is touched.
  await db.query("update auth.users set deleted_at=now() where id=$1", [alice]);
  await as(
    "service_role",
    null,
    "select builder_account_deletion_complete($1)",
    [request],
  );
  await as(
    "service_role",
    null,
    "select builder_account_deletion_complete($1)",
    [request],
  );
  expect(
    (
      await db.query<any>(
        "select status from builder_account_deletions where user_id=$1",
        [alice],
      )
    ).rows[0].status,
  ).toBe("completed");
  expect(
    (
      await db.query("select 1 from builder_project_members where user_id=$1", [
        alice,
      ])
    ).rows,
  ).toEqual([]);
  expect(await inspect(bob)).toMatchObject({
    isBillingOwner: true,
    pages: 1,
    registeredBytes: 100,
    accountUsage: { projects: 1, registeredBytes: 100 },
  });
  expect(
    (
      await db.query<any>(
        "select payload from builder_project_workspaces where project_id=$1",
        [project],
      )
    ).rows[0].payload.pages[0].draft.title,
  ).toBe("Page 0");
});

async function legacyRelease() {
  if (!(await db.query("select id from builder_pages")).rows.length)
    await as(
      "authenticated",
      beta,
      "select builder_save_page($1,0,$2::jsonb)",
      [
        crypto.randomUUID(),
        newDocument("Original site", "original-site", false),
      ],
    );
  const pages = (
    await db.query<any>("select payload from builder_pages order by id")
  ).rows.map((row) => row.payload);
  const request = prepareReleaseRequest(
    { pages, assets: [], saved: [] },
    "page",
    pages[0].id,
  );
  const id = crypto.randomUUID(),
    owner = crypto.randomUUID(),
    artifact = `release-${id}`;
  await as(
    "service_role",
    null,
    "select builder_queue_release($1,$2,$3::jsonb)",
    [id, beta, request],
  );
  await as("service_role", null, "select builder_claim_release($1,$2,$3)", [
    id,
    owner,
    artifact,
  ]);
  await legacyAdvance(id, owner, "activating");
  await legacyAdvance(id, owner, "verifying");
  return { id, owner, artifact };
}
const legacyProof = (artifactId: string) => ({
  artifactId,
  manifestSha256: "f".repeat(64),
  checkedResponses: 3,
});
const legacySample = {
  bytes: 30,
  pages: 1,
  sourceBytes: 20,
  sourceRevision: "d".repeat(64),
  manifestSha256: "f".repeat(64),
};
const legacyAdvance = (
  id: string,
  owner: string,
  status: string,
  proof: unknown = null,
) =>
  as(
    "service_role",
    null,
    "select builder_advance_release($1,$2,$3,$4::jsonb)",
    [id, owner, status, proof],
  );
const legacyReserve = (id: string, artifact: string, recovery = false) =>
  as(
    "service_role",
    null,
    "select builder_repository_output_begin('kaizen',$1,'production',$2,$3,$4::jsonb,$5)",
    [id, artifact, "b".repeat(40), legacySample, recovery],
  );
const legacyBeginRecovery = (
  item: { id: string; owner: string; artifact: string },
  owner: string,
  desired = item.artifact,
  baseline = "legacy-baseline",
) =>
  as(
    "service_role",
    null,
    "select builder_release_recovery_begin($1,$2,$3,$4,$5,$6)",
    [item.id, item.owner, owner, item.artifact, desired, baseline],
  );
const legacyFinishRecovery = (
  id: string,
  owner: string,
  artifact: string,
  usageId: string,
) =>
  as(
    "service_role",
    null,
    "select builder_release_recovery_finish($1,$2,$3::jsonb,$4,$5,$6::jsonb) as data",
    [id, owner, legacyProof(artifact), usageId, "b".repeat(40), legacySample],
  );

it("atomically recovers publication and usage, fences the interrupted worker and preserves newer drafts", async () => {
  const item = await legacyRelease(),
    recoveryOwner = crypto.randomUUID(),
    usageId = crypto.randomUUID();
  await legacyReserve(item.id, item.artifact);
  await legacyBeginRecovery(item, recoveryOwner);
  await legacyBeginRecovery(item, recoveryOwner); // Lost begin acknowledgement.
  await expect(
    legacyAdvance(item.id, item.owner, "live", legacyProof(item.artifact)),
  ).rejects.toThrow(/ownership mismatch/);
  await legacyReserve(usageId, item.artifact, true);
  await expect(
    as(
      "service_role",
      null,
      "select builder_repository_output_settle('kaizen',$1,'production',$2,$3,$4::jsonb,'failed')",
      [item.id, item.artifact, "b".repeat(40), legacySample],
    ),
  ).rejects.toThrow(/recovery now owns/);
  await db.exec(
    "update builder_pages set payload=jsonb_set(payload,'{draft,title}','\"Newer unsaved publication draft\"')",
  );
  await expect(
    legacyFinishRecovery(
      item.id,
      recoveryOwner,
      item.artifact,
      crypto.randomUUID(),
    ),
  ).rejects.toThrow(/stale or belongs/);
  expect(
    (await db.query<any>("select release_id from builder_release_head")).rows[0]
      .release_id,
  ).toBeNull();
  expect(
    (await db.query("select id from builder_publications")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query<any>("select status from builder_releases where id=$1", [
        item.id,
      ])
    ).rows[0].status,
  ).toBe("recovery_required");
  await legacyFinishRecovery(item.id, recoveryOwner, item.artifact, usageId);
  await legacyFinishRecovery(item.id, recoveryOwner, item.artifact, usageId);
  expect(
    (await db.query<any>("select release_id from builder_release_head")).rows[0]
      .release_id,
  ).toBe(item.id);
  expect(
    (await db.query<any>("select document from builder_publications")).rows[0]
      .document.title,
  ).toBe("Original site");
  expect(
    (await db.query<any>("select payload from builder_pages")).rows[0].payload
      .draft.title,
  ).toBe("Newer unsaved publication draft");
  expect((await inspect(beta, "kaizen")).accountUsage.publications).toBe(1);
  expect(
    (
      await db.query<any>(
        "select repository_production_job from builder_project_billing where project_id='kaizen'",
      )
    ).rows[0].repository_production_job,
  ).toBe(usageId);
});

it("recovers the exact previous publication and returns the pending publication allowance once", async () => {
  const first = await legacyRelease();
  await legacyAdvance(
    first.id,
    first.owner,
    "live",
    legacyProof(first.artifact),
  );
  const item = await legacyRelease(),
    recoveryOwner = crypto.randomUUID(),
    usageId = crypto.randomUUID();
  await legacyReserve(item.id, item.artifact);
  await legacyBeginRecovery(
    item,
    recoveryOwner,
    first.artifact,
    first.artifact,
  );
  await legacyReserve(usageId, first.artifact, true);
  await legacyFinishRecovery(item.id, recoveryOwner, first.artifact, usageId);
  await legacyFinishRecovery(item.id, recoveryOwner, first.artifact, usageId);
  expect(
    (await db.query<any>("select release_id from builder_release_head")).rows[0]
      .release_id,
  ).toBe(first.id);
  expect(
    (
      await db.query<any>("select status from builder_releases where id=$1", [
        item.id,
      ])
    ).rows[0].status,
  ).toBe("rolled_back");
  expect((await inspect(beta, "kaizen")).accountUsage.publications).toBe(1);
});

it("refuses changed recovery ownership, arbitrary artifacts, and rollback of an already committed publication", async () => {
  const item = await legacyRelease(),
    recoveryOwner = crypto.randomUUID();
  await expect(
    legacyBeginRecovery({ ...item, owner: crypto.randomUUID() }, recoveryOwner),
  ).rejects.toThrow(/ownership changed/);
  await expect(
    legacyBeginRecovery(item, recoveryOwner, "unrelated-artifact"),
  ).rejects.toThrow(/does not belong/);
  await legacyAdvance(item.id, item.owner, "live", legacyProof(item.artifact));
  await expect(
    legacyBeginRecovery(item, recoveryOwner, "legacy-baseline"),
  ).rejects.toThrow(/already committed/);
  await legacyBeginRecovery(item, recoveryOwner);
  const usageId = crypto.randomUUID();
  await legacyReserve(usageId, item.artifact, true);
  await legacyFinishRecovery(item.id, recoveryOwner, item.artifact, usageId);
  expect((await inspect(beta, "kaizen")).accountUsage.publications).toBe(1);
});

it("checks the original site's frozen page set and preserves over-limit original drafts/assets after downgrade", async () => {
  const asset = crypto.randomUUID();
  await db.query(
    "insert into builder_assets(id,hash,payload) values($1,'legacy-limit','{\"size\":200}')",
    [asset],
  );
  await db.exec(
    "update builder_plans set storage_bytes=100,pages_per_project=1 where id='beta'",
  );
  await db.query(
    'update builder_assets set payload=payload||\'{"label":"Still editable"}\'::jsonb where id=$1',
    [asset],
  );
  // Exercise the actual table trigger, retaining the surrounding fixture transaction.
  await db.exec("savepoint legacy_growth");
  try {
    await expect(
      db.query(
        "insert into builder_assets(id,hash,payload) values($1,'extra-asset','{\"size\":1}')",
        [crypto.randomUUID()],
      ),
    ).rejects.toThrow(/storage limit/);
  } finally {
    await db.exec(
      "rollback to savepoint legacy_growth;release savepoint legacy_growth",
    );
  }
  await db.query("delete from builder_assets where id=$1", [asset]);
  const id = crypto.randomUUID();
  // A trusted queued snapshot cannot use a smaller current workspace to hide
  // extra pages. Supply the native snapshot shape (id + document) to its guard.
  await db.exec("savepoint oversized_legacy_snapshot");
  try {
    await expect(
      db.query(
        'insert into builder_releases(id,requested_by,request,snapshot,baseline) values($1,$2,\'{"action":"site"}\',$3::jsonb,builder_live_snapshot())',
        [
          id,
          beta,
          {
            schemaVersion: 1,
            pages: [
              { id: crypto.randomUUID(), document: {} },
              { id: crypto.randomUUID(), document: {} },
            ],
            site: null,
          },
        ],
      ),
    ).rejects.toThrow(/reviewed publication exceeds/);
  } finally {
    await db.exec(
      "rollback to savepoint oversized_legacy_snapshot;release savepoint oversized_legacy_snapshot",
    );
  }
  expect((await inspect(beta, "kaizen")).accountUsage.publications).toBe(0);
});

it("prunes old completed billing events while retaining recent and unresolved observations", async () => {
  await db.query(
    "insert into builder_billing_events(id,user_id,customer_id,kind,received_at,processed_at) values('evt_oldcomplete',$1,'cus_fixture','refresh',now()-interval '100 days',now()-interval '100 days'),('evt_oldpending',$1,'cus_fixture','refresh',now()-interval '100 days',null),('evt_recentcomplete',$1,'cus_fixture','refresh',now(),now())",
    [alice],
  );
  expect(
    (
      await as(
        "service_role",
        null,
        "select builder_prune_billing_events() as removed",
      )
    )[0].removed,
  ).toBe(1);
  expect(
    (
      await as(
        "service_role",
        null,
        "select builder_prune_billing_events() as removed",
      )
    )[0].removed,
  ).toBe(0);
  expect(
    (
      await db.query<any>("select id from builder_billing_events order by id")
    ).rows.map((row) => row.id),
  ).toEqual(["evt_oldpending", "evt_recentcomplete"]);
});
