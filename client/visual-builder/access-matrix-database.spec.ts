import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";

// The inventory is deliberately explicit: every new builder table needs a
// seeded access decision. These are synthetic accounts and unpublished data.
const privateTables = [
  "builder_editors",
  "builder_contact_requests",
  "builder_releases",
  "builder_release_head",
  "builder_previews",
  "builder_client_errors",
  "builder_invitation_limits",
  "builder_account_deletions",
  "builder_account_deletion_projects",
  "builder_function_limits",
  "builder_legal_versions",
  "builder_legal_acceptances",
  "builder_privacy_requests",
  "builder_account_initializations",
  "builder_plans",
  "builder_billing_accounts",
  "builder_subscriptions",
  "builder_billing_events",
  "builder_billing_checkouts",
  "builder_project_billing",
  "builder_billing_months",
  "builder_publication_allowances",
  "builder_repository_publications",
  "builder_repository_output_jobs",
  "builder_release_retirements",
  "builder_domains",
  "builder_uploads",
  "builder_project_copies",
  "builder_project_copy_cancellations",
  "builder_asset_files",
  "builder_asset_cleanup",
  "builder_asset_discovery",
  "builder_native_asset_state",
  "builder_native_asset_scopes",
  "builder_native_asset_operations",
  "builder_project_suspensions",
  "builder_abuse_reports",
  "builder_abuse_actions",
];
const legacyTables = [
  "builder_pages",
  "builder_assets",
  "builder_saved",
  "builder_site",
  "builder_routes",
];
const projectTables = [
  "builder_projects",
  "builder_project_members",
  "builder_project_workspaces",
  "builder_project_previews",
  "builder_client_destinations",
  "builder_client_reviews",
  "builder_client_jobs",
];
const allTables = [
  ...privateTables,
  ...legacyTables,
  ...projectTables,
  "builder_publications",
].sort();
const ids = {
  legacy: "11111111-1111-4111-8111-111111111111",
  owner: "22222222-2222-4222-8222-222222222222",
  editor: "33333333-3333-4333-8333-333333333333",
  other: "44444444-4444-4444-8444-444444444444",
  stranger: "55555555-5555-4555-8555-555555555555",
};
const alpha = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const beta = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const page = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const browserFunctions = [
  "builder_is_editor",
  "builder_save_page",
  "builder_save_site",
  "builder_update_asset_metadata",
  "builder_replace_asset",
  "builder_backup_workspace",
  "builder_restore_backup",
  "builder_set_asset_image",
  "builder_set_asset_conversion",
  "builder_list_releases",
  "builder_create_preview",
  "builder_read_preview",
  "builder_list_previews",
  "builder_revoke_preview",
  "builder_save_routes",
  "builder_project_access",
  "builder_create_project",
  "builder_update_project",
  "builder_set_project_member",
  "builder_client_history",
  "builder_legacy_project_id",
  "builder_member_directory",
  "builder_release_availability",
].sort();

describe("complete builder table access matrix", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id));
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to anon,authenticated,service_role;
      grant select,insert,update,delete on storage.objects to anon,authenticated;
      create table public.contact_form_submissions(name text,last_name text,email text,phone text,website text,message text,marketing_consent boolean,consent_to_gdpr boolean,source_page text,user_agent text);
      -- Model permissive platform table defaults, including TRUNCATE, which RLS
      -- does not guard. Migrations must explicitly remove inherited privileges.
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
    `);
    for (const [name, id] of Object.entries(ids))
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
        [id, `${name}@example.test`],
      );

    const scheduleOnly = new Set([
      "202609120003_builder_error_retention.sql",
      "202609140002_builder_function_limit_retention.sql",
      "202609140005_builder_privacy_retention.sql",
      "202609150008_builder_billing_retention.sql",
    ]);
    for (const file of (await readdir("supabase/migrations")).sort()) {
      if (!/^\d+_(?:visual_builder|builder_.*)\.sql$/.test(file)) continue;
      // PGlite has no cron worker. The actual data/access migrations all run;
      // scheduler jobs have separate tests and require verification at rollout.
      if (scheduleOnly.has(file)) continue;
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    await db.exec(`
      insert into builder_projects(id,name) values('${alpha}','Alpha canary'),('${beta}','Beta canary');
      insert into builder_project_members(project_id,user_id,role,can_publish) values
        ('kaizen','${ids.legacy}','owner',true),('${alpha}','${ids.owner}','owner',true),
        ('${alpha}','${ids.editor}','editor',false),('${beta}','${ids.other}','owner',true);
      insert into builder_project_workspaces(project_id) values('kaizen'),('${alpha}'),('${beta}') on conflict do nothing;
      insert into builder_pages(id,payload) values('${page}','{"draft":{"slug":"/published-canary/"},"private":"unpublished draft canary"}');
      insert into builder_publications(id,slug,document) values('${page}','/published-canary/','{"title":"Public snapshot canary"}');
      -- A preserved library identity is an explicit legacy fixture, not a
      -- fabricated verified upload. The access matrix tests its private row too.
      insert into builder_asset_files(project_id,asset_id,bytes,sha256,mime,asset_kind,bucket_id,object_name,file_url,status)
        values('kaizen','${page}',10,repeat('a',64),'text/plain','other','builder-source','${page}','private:${page}','legacy');
      insert into builder_assets(id,hash,payload) values('${page}',repeat('a',64),jsonb_build_object('id','${page}','hash',repeat('a',64),'size',10,'mime','text/plain','kind','other','url','private:${page}','private','asset source canary'));
      insert into builder_asset_cleanup(project_id,asset_id,worker_id) values('kaizen','${page}','private-asset-worker');
      insert into builder_release_retirements(project_id,scope,artifact_id,worker_id,store_fingerprint,manifest_sha256,bytes)
        values('kaizen','repository:production','private-retained-artifact','private-release-worker',repeat('a',64),repeat('b',64),10);
      insert into builder_abuse_reports(id,fingerprint,reporter,project_id,origin,category,details,contact) values(gen_random_uuid(),repeat('a',64),repeat('b',64),'${alpha}','https://abuse-canary.example.test','phishing','private abuse report canary','private-reporter@example.test');
      insert into builder_projects(id,name) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Suspension canary');insert into builder_project_suspensions(project_id,state,reason,operator) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','suspended','private suspension canary','matrix-operator');
      insert into builder_abuse_actions(project_id,action,reason,operator) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','suspend','private abuse action canary','matrix-operator');
      insert into builder_native_asset_operations(id,worker_id,configuration,project_id,process_id,host,instance_id,phase,completed_at)
        values('${page}','private-native-worker',repeat('a',64),'kaizen',123,'fixture-host','${page}','complete',now());
      insert into builder_asset_discovery(project_id,asset_id,bucket_id,object_name,bytes,object_version,object_etag,worker_id)
        values('${alpha}','${page}','builder-project-files','${alpha}/private-discovery-canary',10,'private-version','private-etag','private-asset-worker');
      insert into builder_uploads(id,project_id,asset_id,actor_id,worker_id,bucket_id,object_name,bytes,sha256,mime,asset_kind)
        values('${page}','${alpha}','${page}','${ids.owner}','private-upload-worker','builder-project-files','${alpha}/${page}',10,repeat('a',64),'text/plain','other');
      insert into builder_project_copies(project_id,source_project_id,actor_id,source_legacy,requested_name,workspace,status)
        values('${alpha}','${beta}','${ids.owner}',false,'Private completed copy','{}','complete');
      insert into builder_saved(id,payload) values('${page}','{"private":"saved block canary"}');
      insert into builder_site(id,payload) values('site','{"draft":{"canary":"private site draft"}}') on conflict(id) do update set payload=excluded.payload;
      update builder_routes set payload='{"draft":[{"canary":"private redirect draft"}],"published":[{"source":"/public-old/","destination":"/public-new/","status":301}]}' where id='site';
      insert into builder_contact_requests values(gen_random_uuid(),'contact canary','email hash canary',now());
      insert into builder_releases(id,requested_by,request,snapshot,baseline,status) values('${page}','${ids.legacy}','{"private":"release canary"}','{"schemaVersion":1,"pages":[],"site":null}','{}','live');
      update builder_release_head set release_id='${page}' where id='site';
      insert into builder_previews(id,created_by,document,duration_hours,expires_at) values('${page}','${ids.legacy}','{"private":"preview canary"}',1,now()+interval '1 hour');
      insert into builder_account_deletions(user_id,request_id,status) values('${ids.editor}','${page}','pending');
      insert into builder_account_deletion_projects(request_id,project_id) values('${page}','${alpha}');
      insert into builder_project_copy_cancellations(project_id,requested_by,original_actor,phase,completed_at)
        values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${ids.owner}','${ids.owner}','complete',now());
      insert into builder_function_limits values('builder-publish','${ids.owner}',now(),1);
      insert into builder_legal_acceptances(user_id,version) values('${ids.owner}','2026-09-14');
      insert into builder_billing_accounts(user_id,customer_id) values('${ids.owner}','cus_canary') on conflict(user_id) do update set customer_id=excluded.customer_id;
      insert into builder_subscriptions(id,user_id,status,plan_id,price_id,period_end,cancel_at_period_end) values('sub_canary','${ids.owner}','active','plus','price_canary',now()+interval '1 month',false);
      insert into builder_billing_events(id,user_id,customer_id,kind) values('evt_canary','${ids.owner}','cus_canary','customer.subscription.updated');
      insert into builder_billing_checkouts(user_id,plan_id,price_id,session_id,state) values('${ids.owner}','plus','price_canary','cs_test_canary','open');
      insert into builder_repository_publications(id,project_id,requested_by,repository_binding,commit_hash,base_hash,phase,staging_artifact)
        values('${page}','${alpha}','${ids.owner}',repeat('a',64),repeat('b',40),repeat('c',40),'live','fixture-staged');
      insert into builder_repository_output_jobs(id,project_id,channel,artifact_id,commit_hash,measurement,phase) values('${page}','${alpha}','staging','canary-output',repeat('b',40),'${JSON.stringify({ bytes: 10, pages: 1, sourceBytes: 20, sourceRevision: "a".repeat(64), manifestSha256: "d".repeat(64) })}','live');
      insert into builder_privacy_requests(id,user_id,project_id,requester_name,requester_email,kind,details) values('${page}','${ids.editor}','${alpha}','Privacy canary','privacy@example.test','export','Private request canary');
    `);
    for (const [project, actor] of [
      [alpha, ids.owner],
      [beta, ids.other],
    ]) {
      const destination = crypto.randomUUID();
      await db.query(
        "insert into builder_domains(id,project_id,hostname,verification_token,worker_id,requested_by,binding_kind,candidate_destination_id) values($1,$2,$3,repeat('d',64),'private-domain-worker',$4,'client-primary',$5)",
        [
          crypto.randomUUID(),
          project,
          `${project}.fixture.co.uk`,
          actor,
          crypto.randomUUID(),
        ],
      );
      await db.query(
        "insert into builder_project_previews(project_id,id,payload,expires_at) values($1,$2,'{\"private\":\"project preview canary\"}',now()+interval '1 hour'),($1,$3,'{\"private\":\"expired canary\"}',now()-interval '1 hour')",
        [project, crypto.randomUUID(), crypto.randomUUID()],
      );
      await db.query(
        "insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id) values($1,$2,'staging',$3,'Fixture staging','private-worker-canary','fixture-artifact')",
        [destination, project, `https://${project}.example.test`],
      );
      for (const reviewer of project === alpha ? [actor, ids.editor] : [actor])
        await db.query(
          "insert into builder_client_reviews(id,project_id,destination_id,actor,action,snapshot,workspace_version,destination_version,previous_artifact_id,artifact_id) values($1,$2,$3,$4,'publish','{\"private\":\"review canary\"}',0,1,'fixture-before','fixture-after')",
          [crypto.randomUUID(), project, destination, reviewer],
        );
      await db.query(
        "insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,snapshot,previous_artifact_id,artifact_id,owner_token) values($1,$2,$3,'{}',1,'private-worker-canary',$4,'publish','{\"private\":\"job canary\"}','fixture-before','fixture-after',$5)",
        [crypto.randomUUID(), project, destination, actor, crypto.randomUUID()],
      );
      await db.query(
        "insert into builder_client_errors(project_id,user_id,category,source,screen,browser_family,platform,helper_mode,helper_status) values($1,$2,'network','browser','pages','Other','Other','hosted','disconnected')",
        [project, actor],
      );
      await db.query(
        "insert into builder_invitation_limits values($1,now(),1)",
        [project],
      );
      await db.query(
        "insert into storage.objects(bucket_id,name,owner) values('builder-project-files',$1,$2)",
        [`${project}/${page}`, actor],
      );
    }
    await db.query(
      "insert into storage.objects(bucket_id,name,owner) values('builder-source','legacy-canary',$1)",
      [ids.legacy],
    );
  }, 30_000);
  afterAll(async () => {
    await db?.close();
  });

  async function as<T>(
    role: "anon" | "authenticated" | "service_role",
    actor: string,
    run: () => Promise<T>,
  ) {
    // Each operation has its own rollback, including a mistakenly permitted
    // destructive statement: no probe can erase a later test's canary evidence.
    await db.exec("begin");
    try {
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",
        [actor, role],
      );
      await db.exec(`set local role ${role}`);
      return await run();
    } finally {
      await db.exec("rollback");
    }
  }

  it("reviews every builder table with RLS enabled and nonempty canary data", async () => {
    const tables = (
      await db.query<{ name: string; enabled: boolean }>(
        "select c.relname as name,c.relrowsecurity as enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname like 'builder_%' order by c.relname",
      )
    ).rows;
    expect(tables.map((t) => t.name)).toEqual(allTables);
    expect(tables.filter((t) => !t.enabled)).toEqual([]);
    for (const table of allTables)
      expect(
        (
          await db.query<{ count: number }>(
            `select count(*)::integer as count from ${table}`,
          )
        ).rows[0].count,
        table,
      ).toBeGreaterThan(0);
  });

  for (const role of ["anon", "authenticated"] as const) {
    it(`${role} has no TRUNCATE, REFERENCES or TRIGGER privilege on any builder table`, async () => {
      for (const table of allTables) {
        await expect(
          as(role, ids.stranger, () => db.exec(`truncate ${table} cascade`)),
          table,
        ).rejects.toThrow(/permission denied/);
        const rights = (
          await db.query<{
            truncate: boolean;
            references: boolean;
            trigger: boolean;
          }>(
            "select has_table_privilege($1,$2,'TRUNCATE') as truncate,has_table_privilege($1,$2,'REFERENCES') as references,has_table_privilege($1,$2,'TRIGGER') as trigger",
            [role, table],
          )
        ).rows[0];
        expect(rights, table).toEqual({
          truncate: false,
          references: false,
          trigger: false,
        });
      }
    });
    it(`${role} cannot directly read or mutate private operational tables`, async () => {
      for (const table of privateTables)
        for (const sql of [
          `select * from ${table}`,
          `delete from ${table}`,
          `insert into ${table} default values`,
        ])
          await expect(
            as(role, ids.owner, () => db.exec(sql)),
            sql,
          ).rejects.toThrow(/permission denied/);
    });
  }

  for (const [name, actor] of Object.entries(ids)) {
    it(`${name} reads only the intended legacy and project rows`, async () => {
      await as("authenticated", actor, async () => {
        for (const table of legacyTables)
          expect(
            (await db.query(`select * from ${table}`)).rows,
            table,
          ).toHaveLength(name === "legacy" ? 1 : 0);
        const expected =
          name === "legacy"
            ? ["kaizen"]
            : name === "owner" || name === "editor"
              ? [alpha]
              : name === "other"
                ? [beta]
                : [];
        for (const table of projectTables) {
          const column = table === "builder_projects" ? "id" : "project_id";
          const rows = (
            await db.query<Record<string, string>>(
              `select ${column} from ${table}`,
            )
          ).rows;
          const projectExpected =
            table.startsWith("builder_client_") ||
            table === "builder_project_previews"
              ? expected.filter((p) => p !== "kaizen")
              : expected;
          expect(
            [...new Set(rows.map((r) => r[column]))].sort(),
            table,
          ).toEqual(projectExpected);
          if (
            table === "builder_project_previews" ||
            table === "builder_client_reviews"
          )
            expect(rows, table).toHaveLength(projectExpected.length);
        }
        expect(
          (
            await db.query<{ actor: string }>(
              "select actor from builder_client_reviews",
            )
          ).rows.every((row) => row.actor === actor),
        ).toBe(true);
        const names = (
          await db.query<{ name: string }>(
            "select name from storage.objects order by name",
          )
        ).rows.map((r) => r.name);
        expect(names).toEqual(
          name === "legacy"
            ? ["legacy-canary"]
            : expected.map((p) => `${p}/${page}`),
        );
      });
    });
  }

  it("allows only published snapshots and published redirect columns to visitors", async () => {
    await as("anon", "", async () => {
      expect(
        (await db.query("select document from builder_publications")).rows,
      ).toEqual([{ document: { title: "Public snapshot canary" } }]);
      expect(
        (await db.query("select * from builder_public_redirects")).rows,
      ).toEqual([
        {
          id: "site",
          rules: [
            {
              source: "/public-old/",
              destination: "/public-new/",
              status: 301,
            },
          ],
        },
      ]);
      expect((await db.query("select * from storage.objects")).rows).toEqual(
        [],
      );
    });
    for (const table of [...legacyTables, ...projectTables])
      await expect(
        as("anon", "", () => db.exec(`select * from ${table}`)),
        table,
      ).rejects.toThrow(/permission denied/);
  });

  it("keeps worker identity and claims inaccessible even to project owners", async () => {
    for (const sql of [
      "select worker_id from builder_client_destinations",
      "select worker_id,owner_token from builder_client_jobs",
    ])
      await expect(
        as("authenticated", ids.owner, () => db.exec(sql)),
      ).rejects.toThrow(/permission denied/);
  });

  it("exposes exactly the reviewed browser RPCs despite permissive function defaults", async () => {
    const functions = (
      await db.query<{
        name: string;
        anonymous: boolean;
        authenticated: boolean;
        definer: boolean;
        config: string[] | null;
      }>(
        "select p.proname as name,has_function_privilege('anon',p.oid,'EXECUTE') as anonymous,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,p.prosecdef as definer,p.proconfig as config from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,8)='builder_' order by p.proname",
      )
    ).rows;
    expect(functions.filter((f) => f.anonymous)).toEqual([]);
    expect(functions.filter((f) => f.authenticated).map((f) => f.name)).toEqual(
      browserFunctions,
    );
    for (const f of functions.filter((f) => f.definer))
      expect(f.config, f.name).toContain("search_path=public, pg_temp");
    for (const role of ["anon", "authenticated"] as const)
      await expect(
        as(role, ids.stranger, () => db.exec("select builder_live_snapshot()")),
      ).rejects.toThrow(/permission denied/);
  });

  it("never lets the public redirect projection mutate the private draft table", async () => {
    for (const role of ["anon", "authenticated"] as const)
      for (const sql of [
        "update builder_public_redirects set id=id",
        "delete from builder_public_redirects",
      ])
        await expect(as(role, ids.legacy, () => db.exec(sql))).rejects.toThrow(
          /permission denied/,
        );
  });

  it("uses the real release head when an editor supplies a same-named temporary table", async () => {
    await as("authenticated", ids.legacy, async () => {
      await db.exec(
        "create temporary table builder_release_head(id text,release_id uuid); insert into builder_release_head values('site',gen_random_uuid())",
      );
      const result = (
        await db.query<{ releases: { id: string; live: boolean }[] }>(
          "select public.builder_list_releases() as releases",
        )
      ).rows[0].releases;
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: page, live: true });
    });
  });

  it("keeps archived projects readable but refuses editing or uploads", async () => {
    await db.exec("begin");
    try {
      await db.query("update builder_projects set archived=true where id=$1", [
        alpha,
      ]);
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",
        [ids.owner],
      );
      await db.exec("set local role authenticated");
      expect(
        (await db.query("select project_id from builder_project_workspaces"))
          .rows,
      ).toEqual([{ project_id: alpha }]);
      expect(
        (
          await db.query<{ read: boolean; edit: boolean; publish: boolean }>(
            "select builder_project_access($1,'read') as read,builder_project_access($1,'edit') as edit,builder_project_access($1,'publish') as publish",
            [alpha],
          )
        ).rows[0],
      ).toEqual({ read: true, edit: false, publish: false });
      await expect(
        db.query(
          "insert into storage.objects(bucket_id,name) values('builder-project-files',$1)",
          [`${alpha}/${crypto.randomUUID()}`],
        ),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await db.exec("rollback");
    }
  });

  it("prevents direct draft, publication, project, membership and job mutation by owners", async () => {
    for (const table of [
      "builder_pages",
      "builder_publications",
      "builder_site",
      "builder_routes",
      ...projectTables,
    ]) {
      const field =
        table === "builder_projects"
          ? "id"
          : projectTables.includes(table)
            ? "project_id"
            : "id";
      for (const sql of [
        `update ${table} set ${field}=${field}`,
        `delete from ${table}`,
        `insert into ${table} default values`,
      ])
        await expect(
          as("authenticated", ids.legacy, () => db.exec(sql)),
          sql,
        ).rejects.toThrow(/permission denied/);
    }
  });

  it("preserves allowed legacy asset/block editing while denying outsiders and malformed assets", async () => {
    await as("authenticated", ids.legacy, async () => {
      expect(
        (
          await db.query(
            'update builder_assets set payload=payload || \'{"label":"Reviewed label"}\' returning id',
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            'update builder_saved set payload=\'{"label":"Saved block"}\' returning id',
          )
        ).rows,
      ).toHaveLength(1);
    });
    await expect(
      as("authenticated", ids.legacy, () =>
        db.exec("update builder_assets set payload='{}'"),
      ),
    ).rejects.toThrow("Invalid library file identity");
    for (const actor of [ids.owner, ids.stranger]) {
      await as("authenticated", actor, async () => {
        for (const table of ["builder_assets", "builder_saved"])
          expect(
            (await db.query(`update ${table} set payload='{}' returning id`))
              .rows,
          ).toEqual([]);
      });
      await expect(
        as("authenticated", actor, () =>
          db.exec(`insert into builder_saved values(gen_random_uuid(),'{}')`),
        ),
      ).rejects.toThrow(/row-level security/);
    }
  });

  it("removes row access immediately after membership revocation", async () => {
    await db.exec("begin");
    try {
      await db.query("delete from builder_project_members where user_id=$1", [
        ids.editor,
      ]);
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",
        [ids.editor],
      );
      await db.exec("set local role authenticated");
      for (const table of projectTables) {
        const column = table === "builder_projects" ? "id" : "project_id";
        expect(
          (await db.query(`select ${column} from ${table}`)).rows,
          table,
        ).toEqual([]);
      }
      expect((await db.query("select * from storage.objects")).rows).toEqual(
        [],
      );
    } finally {
      await db.exec("rollback");
    }
  });
});
