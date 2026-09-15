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
import {
  buildProblemReport,
  classifyDiagnosticError,
  storedDiagnostic,
} from "../../shared/builderDiagnostics";

describe("operator error recording and retention", () => {
  let db: PGlite;
  const owner = "11111111-1111-4111-8111-111111111111";
  const editor = "22222222-2222-4222-8222-222222222222";
  const stranger = "33333333-3333-4333-8333-333333333333";
  const alpha = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const beta = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  let diagnostic: ReturnType<typeof storedDiagnostic>;
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      insert into auth.users values('${owner}'),('${editor}'),('${stranger}');`);
    for (const file of [
      "202609100001_visual_builder.sql",
      "202609100002_builder_site_design.sql",
      "202609100008_builder_releases.sql",
      "202609110001_builder_projects.sql",
      "202609120001_builder_project_capabilities.sql",
      "202609120002_builder_client_errors.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(`insert into builder_projects(id,name) values('${alpha}','Alpha'),('${beta}','Beta');
      insert into builder_project_members(project_id,user_id,role,can_publish) values
      ('${alpha}','${owner}','owner',true),('${alpha}','${editor}','editor',false),('${beta}','${stranger}','owner',true);`);
    diagnostic = storedDiagnostic(
      await buildProblemReport({
        projectId: alpha,
        page: { screen: "website-editor", route: "/about/?token=secret" },
        lastError: classifyDiagnosticError(
          "Build failed secret-token",
          "helper",
        ),
        userAgent: "Chrome/130.0 Windows",
        helper: { local: false, status: "connected" },
      }),
    );
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
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec(`set role ${role}`);
    // A rejected statement inside a transaction needs a savepoint before the next assertion.
    await db.exec("savepoint role_action");
    try {
      return await run();
    } catch (error) {
      await db.exec("rollback to savepoint role_action");
      throw error;
    } finally {
      await db.exec("release savepoint role_action; reset role");
    }
  }
  const record = (
    actor = editor,
    project = alpha,
    value: unknown = diagnostic,
  ) =>
    as(
      "service_role",
      async () =>
        (
          await db.query<{ recorded: boolean }>(
            "select builder_record_client_error($1,$2,$3) as recorded",
            [project, actor, JSON.stringify(value)],
          )
        ).rows[0].recorded,
    );

  it("records editor/helper failures under verified identity with server time and only defined fields", async () => {
    expect(
      await record(editor, alpha, {
        ...diagnostic,
        user_id: stranger,
        project_id: beta,
        created_at: "2099-01-01",
        token: "secret-token",
      }),
    ).toBe(true);
    const rows = await as("service_role", () =>
      db.query<any>(
        "select *, created_at=now() as server_time from builder_client_errors",
      ),
    );
    expect(rows.rows[0]).toMatchObject({
      project_id: alpha,
      user_id: editor,
      category: "build",
      source: "helper",
      server_time: true,
    });
    expect(JSON.stringify(rows)).not.toContain("secret-token");
    expect(JSON.stringify(rows)).not.toContain("/about/");
    expect(rows.rows[0].route_hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("keeps all project users out of the operator table and service recording RPC", async () => {
    await record();
    for (const [role, id] of [
      ["anon", stranger],
      ["authenticated", owner],
      ["authenticated", editor],
      ["authenticated", stranger],
    ]) {
      for (const sql of [
        "select * from builder_client_errors",
        "delete from builder_client_errors",
        "update builder_client_errors set category='unknown'",
        "insert into builder_client_errors(project_id) values('kaizen')",
        "select builder_prune_client_errors()",
      ])
        await expect(as(role, () => db.exec(sql), id)).rejects.toThrow(
          /permission denied/,
        );
      await expect(
        as(
          role,
          () =>
            db.query("select builder_record_client_error($1,$2,$3)", [
              alpha,
              owner,
              JSON.stringify(diagnostic),
            ]),
          id,
        ),
      ).rejects.toThrow(/permission denied/);
    }
    await expect(
      as("service_role", () => db.exec("delete from builder_client_errors")),
    ).rejects.toThrow(/permission denied/);
    // RLS is a second boundary even if a future migration accidentally grants SELECT.
    await db.exec("grant select on builder_client_errors to authenticated");
    expect(
      (
        await as("authenticated", () =>
          db.query("select * from builder_client_errors"),
        )
      ).rows,
    ).toEqual([]);
  });
  it("rechecks cross-project, missing, revoked and archived membership in the recording transaction", async () => {
    await expect(record(stranger)).rejects.toThrow(/membership required/);
    await expect(record(editor, beta)).rejects.toThrow(/membership required/);
    await expect(record(editor, "missing")).rejects.toThrow(
      /membership required/,
    );
    await as("authenticated", () =>
      db.query("select builder_set_project_member($1,$2,null)", [
        alpha,
        editor,
      ]),
    );
    await expect(record()).rejects.toThrow(/membership required/);
    await db.query("update builder_projects set archived=true where id=$1", [
      alpha,
    ]);
    await expect(record(owner)).rejects.toThrow(/membership required/);
  });
  it("enforces field bounds at the database even when the service bypasses JSON normalization", async () => {
    for (const bad of [
      { source: "secret-token" },
      { category: "arbitrary" },
      { screen: null },
      { browser_version: 10000 },
      { page_id: "token-secret" },
      { route_hash: "/private/file" },
    ])
      await expect(
        record(editor, alpha, { ...diagnostic, ...bad }),
      ).rejects.toThrow(/constraint/);
    expect(
      (await db.query("select * from builder_client_errors")).rows,
    ).toEqual([]);
  });
  it("limits each account and project independently using server receipt times", async () => {
    for (let index = 0; index < 20; index++) expect(await record()).toBe(true);
    expect(await record()).toBe(false);
    expect(await record(owner)).toBe(true);
    expect(await record(stranger, beta)).toBe(true);
    await db.exec(`insert into builder_client_errors(project_id,user_id,created_at,category,source,screen,browser_family,platform,helper_mode,helper_status)
      select '${alpha}','${owner}',now()-interval '2 hours','unknown','browser','pages','Other','Other','hosted','disconnected' from generate_series(1,1979);`);
    expect(await record(owner)).toBe(false);
    expect(await record(stranger, beta)).toBe(true);
  });
  it("physically deletes expired records, including idle projects, and preserves the retention boundary", async () => {
    await record();
    await record(owner);
    await record(stranger, beta);
    await db.query(
      "update builder_client_errors set created_at=now()-interval '14 days'-interval '1 second' where user_id=$1",
      [editor],
    );
    await db.query(
      "update builder_client_errors set created_at=now()-interval '14 days' where user_id=$1",
      [owner],
    );
    const result = await as("service_role", () =>
      db.query<any>("select builder_prune_client_errors() as removed"),
    );
    expect(Number(result.rows[0].removed)).toBe(1);
    expect(
      (
        await db.query<any>(
          "select user_id from builder_client_errors order by user_id",
        )
      ).rows.map((row) => row.user_id),
    ).toEqual([owner, stranger]);
    await db.query("delete from auth.users where id=$1", [stranger]);
    expect(
      (await db.query("select * from builder_client_errors")).rows,
    ).toHaveLength(1);
  });
  it("installs a required hourly retention job whose SQL can prune without new events", async () => {
    // PGlite has no pg_cron worker. Only that extension and scheduler are fixtures;
    // the migration's job definition and real retention function execute unchanged.
    const sql = await readFile(
      "supabase/migrations/202609120003_builder_error_retention.sql",
      "utf8",
    );
    const extension =
      "create extension if not exists pg_cron with schema pg_catalog;";
    expect(sql).toContain(extension);
    await db.exec(`create schema cron; create table cron.fixture_jobs(name text,schedule text,command text);
      create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.fixture_jobs values($1,$2,$3) returning 1::bigint $$;`);
    await db.exec(sql.replace(extension, ""));
    const job = (await db.query<any>("select * from cron.fixture_jobs"))
      .rows[0];
    expect(job).toMatchObject({
      name: "builder-client-error-retention",
      schedule: "17 * * * *",
      command: "select public.builder_prune_client_errors()",
    });
    await record();
    await db.exec(
      "update builder_client_errors set created_at=now()-interval '15 days'",
    );
    await db.exec(job.command);
    expect(
      (await db.query("select * from builder_client_errors")).rows,
    ).toEqual([]);
  });
});
