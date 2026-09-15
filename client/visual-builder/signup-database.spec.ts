import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { BUILDER_LEGAL } from "../../shared/builderLegal";

let db: PGlite;
const existing = "11111111-1111-4111-8111-111111111111";
const newcomer = "22222222-2222-4222-8222-222222222222";
const invited = "33333333-3333-4333-8333-333333333333";
const project = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id)); alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
    insert into auth.users(id,email,email_confirmed_at) values('${existing}','existing@example.test',now());`);
  for (const file of [
    "202609100001_visual_builder.sql",
    "202609100002_builder_site_design.sql",
    "202609100008_builder_releases.sql",
    "202609110001_builder_projects.sql",
    "202609120001_builder_project_capabilities.sql",
    "202609130001_builder_invitations.sql",
    "202609130002_builder_accounts.sql",
    "202609140004_builder_legal_privacy.sql",
    "202609150001_builder_signup.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`begin;
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${newcomer}','new@example.test',now(),'{"legalAccepted":true}'),('${invited}','invited@example.test',now(),'{}');
    insert into builder_legal_acceptances(user_id,version) select id,'${BUILDER_LEGAL.version}' from auth.users;`);
});
afterEach(async () => {
  await db.exec("rollback");
});
async function as(role: string, sql: string, args: any[] = []) {
  await db.exec(`set role ${role}; savepoint signup_action`);
  try {
    return (await db.query<any>(sql, args)).rows;
  } catch (error) {
    await db.exec("rollback to savepoint signup_action");
    throw error;
  } finally {
    await db.exec("release savepoint signup_action; reset role");
  }
}
const bootstrap = async (actor: string | null = newcomer) =>
  (
    await as("service_role", "select builder_bootstrap_account($1) as result", [
      actor,
    ])
  )[0].result;
const count = async () =>
  (
    await db.query<any>(
      "select count(*)::int as n from builder_projects where id<>'kaizen'",
    )
  ).rows[0].n;

it("atomically creates one empty, owner-controlled website without a publication destination", async () => {
  const result = await bootstrap();
  expect(result.created).toBe(true);
  expect(result.projectId).not.toBe("kaizen");
  expect(await count()).toBe(1);
  const row = (
    await db.query<any>(
      "select p.*,m.user_id,m.role,m.can_publish,w.payload from builder_projects p join builder_project_members m on m.project_id=p.id join builder_project_workspaces w on w.project_id=p.id where p.id=$1",
      [result.projectId],
    )
  ).rows[0];
  expect(row).toMatchObject({
    name: "My website",
    user_id: newcomer,
    role: "owner",
    can_publish: true,
    destination: { kind: "unconfigured" },
    capabilities: { legacyWorkspace: false, publishPath: "worker" },
  });
  expect(row.payload.pages).toEqual([]);
  expect(
    (
      await db.query<any>(
        "select count(*)::int as n from builder_legal_acceptances where user_id=$1",
        [newcomer],
      )
    ).rows[0].n,
  ).toBe(1);
});
it("reuses the persisted first project for retries without rewriting acceptance or workspace bytes", async () => {
  const first = await bootstrap();
  await db.query(
    'update builder_project_workspaces set payload=payload||\'{"fixtureDraft":"Retain edits"}\' where project_id=$1',
    [first.projectId],
  );
  for (let i = 0; i < 8; i++)
    expect(await bootstrap()).toEqual({
      created: false,
      projectId: first.projectId,
    });
  expect(await count()).toBe(1);
  expect(
    (
      await db.query<any>(
        "select payload from builder_project_workspaces where project_id=$1",
        [first.projectId],
      )
    ).rows[0].payload.fixtureDraft,
  ).toBe("Retain edits");
});
it.each([
  "unconfirmed",
  "deleted",
  "no-email",
  "unaccepted",
  "stale-acceptance",
  "unknown",
])(
  "denies %s accounts without a partial project or initialization",
  async (mode) => {
    if (mode === "unconfirmed")
      await db.query(
        "update auth.users set email_confirmed_at=null where id=$1",
        [newcomer],
      );
    if (mode === "deleted")
      await db.query("update auth.users set deleted_at=now() where id=$1", [
        newcomer,
      ]);
    if (mode === "no-email")
      await db.query("update auth.users set email='' where id=$1", [newcomer]);
    if (mode === "unaccepted")
      await db.query("delete from builder_legal_acceptances where user_id=$1", [
        newcomer,
      ]);
    if (mode === "stale-acceptance")
      await db.exec(
        `update builder_legal_versions set active=false; insert into builder_legal_versions(version,terms_hash,privacy_hash,active) values('2026-09-15','${"a".repeat(64)}','${"b".repeat(64)}',true);`,
      );
    await expect(
      bootstrap(mode === "unknown" ? null : newcomer),
    ).rejects.toThrow(/Confirm your email|Accept the current/);
    expect(await count()).toBe(0);
    expect(
      (
        await db.query(
          "select * from builder_account_initializations where user_id=$1",
          [newcomer],
        )
      ).rows,
    ).toHaveLength(0);
  },
);
it("does not manufacture projects for pre-existing accounts or invited users whose access was revoked", async () => {
  expect(await bootstrap(existing)).toEqual({
    created: false,
    projectId: null,
  });
  await db.exec(
    `insert into builder_projects(id,name) values('${project}','Invited website'); insert into builder_project_members(project_id,user_id,role) values('${project}','${invited}','editor');`,
  );
  expect(await bootstrap(invited)).toEqual({
    created: false,
    projectId: project,
  });
  await db.query("delete from builder_project_members where user_id=$1", [
    invited,
  ]);
  expect(await bootstrap(invited)).toEqual({ created: false, projectId: null });
  expect(await count()).toBe(1);
});
it("retains initialization through archival, membership loss and deletion", async () => {
  const first = await bootstrap();
  await db.query("update builder_projects set archived=true where id=$1", [
    first.projectId,
  ]);
  expect(await bootstrap()).toEqual({
    created: false,
    projectId: first.projectId,
  });
  await db.query("delete from builder_project_members where user_id=$1", [
    newcomer,
  ]);
  expect(await bootstrap()).toEqual({ created: false, projectId: null });
  await db.query("delete from builder_projects where id=$1", [first.projectId]);
  expect(await bootstrap()).toEqual({ created: false, projectId: null });
  expect(await count()).toBe(0);
});
it("rolls back every first-project row after a workspace failure, then recovers on retry", async () => {
  await db.exec(`create function fixture_reject_workspace() returns trigger language plpgsql as $$begin raise exception 'Fixture storage failed'; end;$$;
    create trigger fixture_reject before insert on builder_project_workspaces for each row execute function fixture_reject_workspace();`);
  await expect(bootstrap()).rejects.toThrow(/Fixture storage failed/);
  expect(await count()).toBe(0);
  expect(
    (
      await db.query(
        "select * from builder_account_initializations where user_id=$1",
        [newcomer],
      )
    ).rows,
  ).toHaveLength(0);
  await db.exec("drop trigger fixture_reject on builder_project_workspaces");
  expect((await bootstrap()).created).toBe(true);
});
it.each(["anon", "authenticated", "service_role"])(
  "%s has no direct initialization access or forged membership trigger privileges",
  async (role) => {
    for (const sql of [
      "select * from builder_account_initializations",
      "delete from builder_account_initializations",
      "truncate builder_account_initializations",
      `insert into builder_account_initializations(user_id) values('${newcomer}')`,
      "select builder_remember_project_membership()",
    ])
      await expect(as(role, sql)).rejects.toThrow(/permission denied/);
    if (role !== "service_role")
      await expect(
        as(role, "select builder_bootstrap_account($1)", [newcomer]),
      ).rejects.toThrow(/permission denied/);
  },
);
