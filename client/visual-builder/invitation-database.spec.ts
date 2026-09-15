import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

describe("email invitations and project membership transactions", () => {
  let db: PGlite;
  const owner = "11111111-1111-4111-8111-111111111111",
    editor = "22222222-2222-4222-8222-222222222222",
    stranger = "33333333-3333-4333-8333-333333333333",
    invited = "44444444-4444-4444-8444-444444444444";
  const alpha = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    beta = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
      ('${owner}','owner@example.test',now(),'{"full_name":"Fixture Owner","private":"not-a-directory-field"}'),
      ('${editor}','editor@example.test',null,'{"builder_password_set":false}'),
      ('${stranger}','unrelated@example.test',now(),'{}');`);
    for (const file of [
      "202609100001_visual_builder.sql",
      "202609100002_builder_site_design.sql",
      "202609100008_builder_releases.sql",
      "202609110001_builder_projects.sql",
      "202609120001_builder_project_capabilities.sql",
      "202609130001_builder_invitations.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(`insert into builder_projects(id,name) values('${alpha}','Alpha'),('${beta}','Beta');
      insert into builder_project_members(project_id,user_id,role,can_publish) values
      ('${alpha}','${owner}','owner',true),('${alpha}','${editor}','editor',false),('${beta}','${stranger}','owner',true);`);
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
  async function as<T>(role: string, run: () => Promise<T>, id = owner) {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
      [id, role],
    );
    await db.exec(`set role ${role}; savepoint invitation_action`);
    try {
      return await run();
    } catch (error) {
      await db.exec("rollback to savepoint invitation_action");
      throw error;
    } finally {
      await db.exec("release savepoint invitation_action; reset role");
    }
  }
  async function prepare(
    email: string | null = "new@example.test",
    member: string | null = null,
    actor = owner,
    project = alpha,
  ) {
    return as(
      "service_role",
      async () =>
        (
          await db.query<{ result: any }>(
            "select builder_prepare_invitation($1,$2,$3,$4) as result",
            [project, actor, email, member],
          )
        ).rows[0].result,
    );
  }
  async function complete(
    record: any,
    member = invited,
    add = true,
    actor = owner,
    role = "editor",
    publish = false,
    project = alpha,
  ) {
    return as(
      "service_role",
      async () =>
        (
          await db.query<{ result: boolean }>(
            "select builder_complete_invitation($1,$2,$3,$4,$5,$6,$7,$8) as result",
            [
              project,
              actor,
              record.email,
              member,
              record.version,
              add,
              role,
              publish,
            ],
          )
        ).rows[0].result,
    );
  }
  const addAccount = () =>
    db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,'new@example.test','{\"builder_password_set\":false}')",
      [invited],
    );
  const member = async (id = invited) =>
    (
      await db.query(
        "select role,can_publish from builder_project_members where project_id=$1 and user_id=$2",
        [alpha, id],
      )
    ).rows;
  const directory = (id = owner, project = alpha) =>
    as(
      "authenticated",
      async () =>
        (
          await db.query<{ result: any[] }>(
            "select builder_member_directory($1) as result",
            [project],
          )
        ).rows[0].result,
      id,
    );
  const remove = (id: string) =>
    as("authenticated", () =>
      db.query("select builder_set_project_member($1,$2,null)", [alpha, id]),
    );

  it("lists names, email and setup state only for the selected project's owner", async () => {
    const people = await directory();
    expect(people).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: owner,
          email: "owner@example.test",
          name: "Fixture Owner",
          invitation_state: "active",
        }),
        expect.objectContaining({
          user_id: editor,
          invitation_state: "invited",
        }),
      ]),
    );
    expect(JSON.stringify(people)).not.toMatch(
      /unrelated|not-a-directory-field/,
    );
    await db.query(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [editor],
    );
    expect(
      (await directory()).find((p) => p.user_id === editor).invitation_state,
    ).toBe("setup");
    for (const actor of [editor, stranger])
      await expect(directory(actor)).rejects.toThrow(/owner access/);
    await expect(directory(owner, beta)).rejects.toThrow(/owner access/);
    await db.query("update builder_projects set archived=true where id=$1", [
      alpha,
    ]);
    await expect(directory()).rejects.toThrow(/owner access/);
  });
  it("keeps auth lookup, invitation writes and counters unavailable to browser roles", async () => {
    for (const role of ["anon", "authenticated"]) {
      for (const sql of [
        "select * from auth.users",
        "select * from builder_invitation_limits",
        "delete from builder_invitation_limits",
        "select builder_prepare_invitation('kaizen',null,'new@example.test')",
        "select builder_complete_invitation('kaizen',null,'new@example.test',null,1,true,'owner',true)",
      ])
        await expect(as(role, () => db.exec(sql))).rejects.toThrow(
          /permission denied/,
        );
    }
    await expect(
      as("service_role", () =>
        db.exec("delete from builder_invitation_limits"),
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec("grant select on builder_invitation_limits to authenticated");
    await prepare();
    expect(
      (
        await as("authenticated", () =>
          db.query("select * from builder_invitation_limits"),
        )
      ).rows,
    ).toEqual([]);
  });
  it("adds the Auth-returned email identity with separate editing and publishing permissions", async () => {
    const record = await prepare(" New@Example.Test ");
    expect(record).toMatchObject({
      email: "new@example.test",
      accountId: null,
      confirmed: false,
      alreadyMember: false,
    });
    await addAccount();
    expect(await complete(record)).toBe(true);
    expect(await member()).toEqual([{ role: "editor", can_publish: false }]);
    const access = await as(
      "authenticated",
      () =>
        db.query(
          "select builder_project_access($1,'edit') as edit,builder_project_access($1,'publish') as publish",
          [alpha],
        ),
      invited,
    );
    expect(access.rows).toEqual([{ edit: true, publish: false }]);
  });
  it("refuses non-owners, foreign members, invalid email and archived projects before consuming email capacity", async () => {
    for (const actor of [editor, stranger])
      await expect(prepare("new@example.test", null, actor)).rejects.toThrow(
        /owner access/,
      );
    await expect(prepare(null, stranger)).rejects.toThrow(/member not found/);
    for (const email of [
      "bad",
      "a\n@example.test",
      "x".repeat(255) + "@example.test",
    ])
      await expect(prepare(email)).rejects.toThrow(/valid email/);
    await db.query("update builder_projects set archived=true where id=$1", [
      alpha,
    ]);
    await expect(prepare()).rejects.toThrow(/owner access/);
    expect(
      (await db.query("select * from builder_invitation_limits")).rows,
    ).toEqual([]);
  });
  it("refuses membership for a missing, changed or unrelated Auth identity", async () => {
    const record = await prepare();
    await expect(complete(record)).rejects.toThrow(/account changed/);
    await expect(complete(record, stranger)).rejects.toThrow(/account changed/);
    await addAccount();
    await db.query(
      "update auth.users set email='changed@example.test' where id=$1",
      [invited],
    );
    await expect(complete(record)).rejects.toThrow(/account changed/);
    expect(await member()).toEqual([]);
  });
  it("never restores a removed member from a delayed first invitation or resend", async () => {
    const first = await prepare();
    await addAccount();
    await complete(first);
    const resend = await prepare(null, invited);
    await remove(invited);
    await expect(complete(first)).rejects.toThrow(/access changed/);
    await expect(complete(resend, invited, false)).rejects.toThrow(
      /access changed/,
    );
    expect(await member()).toEqual([]);
    await expect(prepare(null, invited)).rejects.toThrow(/member not found/);
    expect(await complete(await prepare())).toBe(true);
  });
  it("rechecks ownership and archive status after the Auth operation", async () => {
    await db.query(
      "insert into builder_project_members(project_id,user_id,role) values($1,$2,'owner')",
      [alpha, stranger],
    );
    const record = await prepare();
    await addAccount();
    await as(
      "authenticated",
      () =>
        db.query("select builder_set_project_member($1,$2,null)", [
          alpha,
          owner,
        ]),
      stranger,
    );
    await expect(complete(record)).rejects.toThrow(/owner access/);
    const other = await prepare("new@example.test", null, stranger);
    await db.query("update builder_projects set archived=true where id=$1", [
      alpha,
    ]);
    await expect(complete(other, invited, true, stranger)).rejects.toThrow(
      /owner access/,
    );
    expect(await member()).toEqual([]);
  });
  it("resends without editing roles and cannot demote the last owner through an invitation", async () => {
    const resend = await prepare(null, editor);
    expect(resend).toMatchObject({
      accountId: editor,
      email: "editor@example.test",
      alreadyMember: true,
      confirmed: false,
    });
    expect(await complete(resend, editor, false, owner, "owner", true)).toBe(
      false,
    );
    expect(await member(editor)).toEqual([
      { role: "editor", can_publish: false },
    ]);
    const own = await prepare("owner@example.test");
    expect(await complete(own, owner, true, owner, "editor", false)).toBe(
      false,
    );
    expect(await member(owner)).toEqual([{ role: "owner", can_publish: true }]);
    await expect(remove(owner)).rejects.toThrow(/at least one/);
  });
  it("limits email attempts with one bounded counter and resets the window", async () => {
    for (let i = 0; i < 20; i++) await prepare();
    await expect(prepare()).rejects.toThrow(/Invitation limit/);
    expect(
      (await db.query("select attempts from builder_invitation_limits")).rows,
    ).toEqual([{ attempts: 20 }]);
    await db.exec(
      "update builder_invitation_limits set window_start=window_start-interval '1 hour'",
    );
    await prepare();
    expect(
      (await db.query("select attempts from builder_invitation_limits")).rows,
    ).toEqual([{ attempts: 1 }]);
  });
  it("refuses ambiguous email identities and preserves access on malformed completion", async () => {
    await db.query(
      "insert into auth.users(id,email) values($1,'EDITOR@example.test')",
      [invited],
    );
    await expect(prepare("editor@example.test")).rejects.toThrow(
      /operator check/,
    );
    const record = await prepare("unrelated@example.test");
    await expect(
      complete(record, stranger, true, owner, "admin"),
    ).rejects.toThrow(/valid project access/);
    expect(await member(stranger)).toEqual([]);
  });
});
