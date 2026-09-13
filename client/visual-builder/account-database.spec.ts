import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

describe("owner-confirmed account deletion", () => {
  let db: PGlite;
  const owner = "11111111-1111-4111-8111-111111111111",
    person = "22222222-2222-4222-8222-222222222222",
    other = "33333333-3333-4333-8333-333333333333",
    stranger = "44444444-4444-4444-8444-444444444444";
  const alpha = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    beta = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    gamma = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id)); alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
      ('${owner}','owner@example.test',now(),'{}'),('${person}','person@example.test',now(),'{"full_name":"A real fixture person","private":"never expose this"}'),
      ('${other}','other@example.test',now(),'{}'),('${stranger}','stranger@example.test',now(),'{}');`);
    for (const file of [
      "202609100001_visual_builder.sql",
      "202609100002_builder_site_design.sql",
      "202609100008_builder_releases.sql",
      "202609110001_builder_projects.sql",
      "202609120001_builder_project_capabilities.sql",
      "202609130001_builder_invitations.sql",
      "202609130002_builder_accounts.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(`insert into builder_projects(id,name) values('${alpha}','Alpha'),('${beta}','Private Beta'),('${gamma}','Gamma');
      insert into builder_project_members(project_id,user_id,role,can_publish) values
      ('${alpha}','${owner}','owner',false),('${alpha}','${person}','editor',true),('${beta}','${other}','owner',true),('${beta}','${person}','editor',false),('${gamma}','${stranger}','owner',true);
      insert into builder_project_workspaces(project_id,payload) values('${alpha}','{"pages":[],"assets":[],"saved":[],"fixture":"Keep this website"}');
      insert into storage.objects(bucket_id,name,owner) values('builder-project-files','${alpha}/fixture','${person}');
      create table fixture_release_history(actor uuid references auth.users(id),receipt text);
      insert into fixture_release_history values('${person}','Keep this release history');`);
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  beforeEach(async () => {
    await db.exec("begin");
  });
  afterEach(async () => {
    await db.exec("rollback");
  });
  async function as<T>(role: string, run: () => Promise<T>, actor = owner) {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
      [actor, role],
    );
    await db.exec(`set role ${role}; savepoint account_action`);
    try {
      return await run();
    } catch (error) {
      await db.exec("rollback to savepoint account_action");
      throw error;
    } finally {
      await db.exec("release savepoint account_action; reset role");
    }
  }
  async function rpc(sql: string, args: unknown[] = []) {
    return as(
      "service_role",
      async () =>
        (await db.query<{ result: any }>(`select ${sql} as result`, args))
          .rows[0]?.result,
    );
  }
  const request = (actor = person) =>
    rpc("builder_account_deletion_request($1)", [actor]);
  const state = (actor = person) =>
    rpc("builder_account_deletion_state($1)", [actor]);
  const prepare = (
    id: string,
    actor: string | null = owner,
    project: string | null = alpha,
  ) => rpc("builder_account_deletion_prepare($1,$2,$3)", [actor, id, project]);
  const cancel = (id: string, actor = person) =>
    rpc("builder_account_deletion_cancel($1,$2)", [actor, id]);
  const complete = (id: string) =>
    rpc("builder_account_deletion_complete($1)", [id]);
  const softDelete = () =>
    db.query(
      "update auth.users set deleted_at=now(),email=null,raw_user_meta_data='{}' where id=$1",
      [person],
    );

  it("records a bounded request idempotently and exposes only each owner's own website for review", async () => {
    const id = await request();
    expect(await request()).toBe(id);
    const own = await state();
    expect(own.request).toMatchObject({
      id,
      status: "pending",
      accessChanged: false,
      needsOperator: false,
    });
    expect(own.request.projects.map((p: any) => p.name)).toEqual([
      "Alpha",
      "Private Beta",
    ]);
    expect((await state(owner)).reviews).toEqual([
      expect.objectContaining({
        id,
        projectId: alpha,
        name: "A real fixture person",
        email: "person@example.test",
        approved: false,
      }),
    ]);
    expect(JSON.stringify(await state(owner))).not.toMatch(
      /Private Beta|never expose this/,
    );
    expect((await state(stranger)).reviews).toEqual([]);
    expect(
      (await db.query("select * from builder_account_deletions")).rows,
    ).toHaveLength(1);
  });
  it("requires a separate current owner for every website and keeps content, files and release references", async () => {
    const id = await request();
    expect(await prepare(id)).toEqual({ status: "pending" });
    expect(
      (
        await db.query(
          "select * from builder_project_members where user_id=$1",
          [person],
        )
      ).rows,
    ).toHaveLength(2);
    expect(await prepare(id, other, beta)).toEqual({
      status: "processing",
      userId: person,
    });
    expect(
      (
        await db.query(
          "select * from builder_project_members where user_id=$1",
          [person],
        )
      ).rows,
    ).toEqual([]);
    await expect(complete(id)).rejects.toThrow(/not yet confirmed/);
    await softDelete();
    await complete(id);
    await complete(id);
    expect((await state()).request.status).toBe("completed");
    expect(
      (
        await db.query(
          "select payload->>'fixture' as content from builder_project_workspaces where project_id=$1",
          [alpha],
        )
      ).rows,
    ).toEqual([{ content: "Keep this website" }]);
    expect((await db.query("select owner from storage.objects")).rows).toEqual([
      { owner: person },
    ]);
    expect(
      (await db.query("select receipt from fixture_release_history")).rows,
    ).toEqual([{ receipt: "Keep this release history" }]);
  });
  it("refuses self-confirmation, editor publishing permission and unrelated owners", async () => {
    const id = await request();
    await expect(prepare(id, person)).rejects.toThrow(
      /another current project owner/i,
    );
    await expect(prepare(id, stranger)).rejects.toThrow(
      /another current project owner/i,
    );
    await expect(prepare(id, owner, beta)).rejects.toThrow(
      /another current project owner/i,
    );
    await expect(prepare(id, null)).rejects.toThrow(/owner approvals/);
    expect(
      (await state()).request.projects.every((p: any) => !p.approved),
    ).toBe(true);
  });
  it("lets only the requester cancel, and never revives a cancelled request", async () => {
    const id = await request();
    await prepare(id);
    await expect(cancel(id, owner)).rejects.toThrow(/not your current/);
    await cancel(id);
    await cancel(id);
    expect((await state()).request).toBeNull();
    await expect(prepare(id, other, beta)).rejects.toThrow(/cancelled/);
    const next = await request();
    expect(next).not.toBe(id);
    expect(
      (await state()).request.projects.every((p: any) => !p.approved),
    ).toBe(true);
    await expect(prepare(id)).rejects.toThrow(/unavailable/);
  });
  it("requires a new request when target membership is added or removed after consent", async () => {
    const id = await request();
    await prepare(id);
    await db.query(
      "insert into builder_project_members(project_id,user_id,role) values($1,$2,'editor')",
      [gamma, person],
    );
    expect((await state()).request.accessChanged).toBe(true);
    await expect(prepare(id, other, beta)).rejects.toThrow(
      /Project access changed/,
    );
    await db.query(
      "delete from builder_project_members where project_id=$1 and user_id=$2",
      [gamma, person],
    );
    await db.query(
      "delete from builder_project_members where project_id=$1 and user_id=$2",
      [alpha, person],
    );
    await expect(prepare(id, other, beta)).rejects.toThrow(
      /Project access changed/,
    );
    expect((await state()).request.status).toBe("pending");
  });
  it("discards an approval's authority when its owner is removed or demoted", async () => {
    const id = await request();
    await prepare(id);
    await db.query(
      "insert into builder_project_members(project_id,user_id,role) values($1,$2,'owner')",
      [alpha, stranger],
    );
    await as(
      "authenticated",
      () =>
        db.query("select builder_set_project_member($1,$2,'editor',false)", [
          alpha,
          owner,
        ]),
      stranger,
    );
    expect(
      (await state()).request.projects.find((p: any) => p.id === alpha)
        .approved,
    ).toBe(false);
    expect(await prepare(id, other, beta)).toEqual({ status: "pending" });
    expect(await prepare(id, stranger)).toEqual({
      status: "processing",
      userId: person,
    });
  });
  it("protects the last owner including archived websites", async () => {
    await db.query(
      "update builder_project_members set role='owner' where project_id=$1 and user_id=$2",
      [alpha, person],
    );
    await as(
      "authenticated",
      () =>
        db.query("select builder_set_project_member($1,$2,null)", [
          alpha,
          owner,
        ]),
      person,
    );
    await db.query("update builder_projects set archived=true where id=$1", [
      alpha,
    ]);
    const id = await request();
    expect(
      (await state()).request.projects.find((p: any) => p.id === alpha)
        .lastOwner,
    ).toBe(true);
    await expect(prepare(id, other, beta)).rejects.toThrow(
      /Keep another owner/,
    );
    await db.query(
      "insert into builder_project_members(project_id,user_id,role) values($1,$2,'owner')",
      [alpha, owner],
    );
    expect(await prepare(id)).toEqual({ status: "pending" });
    expect(await prepare(id, other, beta)).toEqual({
      status: "processing",
      userId: person,
    });
  });
  it("keeps an interrupted removal closed and retryable without restoring membership", async () => {
    const id = await request();
    await prepare(id);
    await prepare(id, other, beta);
    await expect(cancel(id)).rejects.toThrow(/already started/);
    expect(await prepare(id, person, null)).toEqual({
      status: "processing",
      userId: person,
    });
    expect(await prepare(id, owner, null)).toEqual({
      status: "processing",
      userId: person,
    });
    await expect(prepare(id, stranger, null)).rejects.toThrow(/owner access/);
    for (const action of [
      () =>
        as("authenticated", () =>
          db.query("select builder_set_project_member($1,$2,'editor')", [
            alpha,
            person,
          ]),
        ),
      () =>
        as(
          "authenticated",
          () => db.query("select builder_create_project('Do not create')"),
          person,
        ),
      () =>
        db.query(
          "insert into builder_project_members(project_id,user_id,role) values($1,$2,'owner')",
          [gamma, person],
        ),
    ]) {
      await db.exec("savepoint rejected_membership");
      await expect(action()).rejects.toThrow(/cannot receive project access/);
      await db.exec(
        "rollback to savepoint rejected_membership; release savepoint rejected_membership",
      );
    }
    expect((await state(owner)).reviews[0]).toMatchObject({
      name: "",
      email: "",
      status: "processing",
    });
    await softDelete();
    await complete(id);
    await expect(request()).rejects.toThrow(/active account/);
  });
  it("routes orphan requests to a service-only operator review without giving project owners global authority", async () => {
    await db.query("delete from builder_project_members where user_id=$1", [
      person,
    ]);
    const id = await request();
    expect((await state()).request.needsOperator).toBe(true);
    await expect(prepare(id, owner, alpha)).rejects.toThrow(
      /another current project owner/i,
    );
    const queue = await as("service_role", () =>
      db.query("select * from builder_account_orphan_requests()"),
    );
    expect(queue.rows).toEqual([
      expect.objectContaining({
        request_id: id,
        user_id: person,
        status: "pending",
      }),
    ]);
    expect(await prepare(id, null, null)).toEqual({
      status: "processing",
      userId: person,
    });
    await softDelete();
    await complete(id);
  });
  it("keeps all account RPCs and raw request rows inaccessible to browser roles", async () => {
    const id = await request();
    for (const role of ["anon", "authenticated"]) {
      for (const sql of [
        "select * from builder_account_deletions",
        "select * from builder_account_deletion_projects",
        `select builder_account_deletion_request('${person}')`,
        `select builder_account_deletion_state('${person}')`,
        `select builder_account_deletion_cancel('${person}','${id}')`,
        `select builder_account_deletion_prepare(null,'${id}')`,
        `select builder_account_deletion_complete('${id}')`,
        "select * from builder_account_orphan_requests()",
      ])
        await expect(as(role, () => db.exec(sql))).rejects.toThrow(
          /permission denied/,
        );
    }
    await expect(
      as("service_role", () =>
        db.exec("select * from builder_account_deletions"),
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec(
      "grant select on builder_account_deletions,builder_account_deletion_projects to authenticated",
    );
    expect(
      (
        await as("authenticated", () =>
          db.query("select * from builder_account_deletions"),
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await as("authenticated", () =>
          db.query("select * from builder_account_deletion_projects"),
        )
      ).rows,
    ).toEqual([]);
  });
});
