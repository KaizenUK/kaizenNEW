import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

describe("hosted project membership and private storage migration", () => {
  let db: PGlite;
  const owner = "11111111-1111-4111-8111-111111111111",
    editor = "22222222-2222-4222-8222-222222222222",
    stranger = "33333333-3333-4333-8333-333333333333";
  let alpha: string, beta: string;
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to anon,authenticated,service_role;
      grant select,insert,update,delete on storage.objects to anon,authenticated;
      insert into auth.users(id) values('${owner}'),('${editor}'),('${stranger}');`);
    await db.exec(
      await readFile(
        "supabase/migrations/202609100001_visual_builder.sql",
        "utf8",
      ),
    );
    await db.exec(
      `insert into public.builder_editors(user_id) values('${owner}'),('${editor}'); insert into public.builder_pages(id,payload) values(gen_random_uuid(),'{"legacy":"drafts/publications/history unchanged"}');`,
    );
    for (const file of [
      "202609100002_builder_site_design.sql",
      "202609100008_builder_releases.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(
      await readFile(
        "supabase/migrations/202609110001_builder_projects.sql",
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202609120001_builder_project_capabilities.sql",
        "utf8",
      ),
    );
    alpha = await as(
      owner,
      async () =>
        (
          await db.query<{ id: string }>(
            "select builder_create_project('Alpha') as id",
          )
        ).rows[0].id,
    );
    beta = await as(
      stranger,
      async () =>
        (
          await db.query<{ id: string }>(
            "select builder_create_project('Beta') as id",
          )
        ).rows[0].id,
    );
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  async function as<T>(
    id: string,
    action: () => Promise<T>,
    role = "authenticated",
  ) {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
      [id, role],
    );
    await db.exec(`set role ${role}`);
    try {
      return await action();
    } finally {
      await db.exec("reset role");
    }
  }
  it("registers legacy access without modifying any original page data", async () => {
    expect(
      (await db.query<{ payload: any }>("select payload from builder_pages"))
        .rows[0].payload,
    ).toEqual({ legacy: "drafts/publications/history unchanged" });
    expect(
      (
        await db.query<{ role: string; can_publish: boolean }>(
          "select role,can_publish from builder_project_members where project_id='kaizen' and user_id=$1",
          [owner],
        )
      ).rows[0],
    ).toEqual({ role: "owner", can_publish: true });
    await as(stranger, async () =>
      expect((await db.query("select * from builder_pages")).rows).toEqual([]),
    );
  });
  it("assigns safe defaults, prevents user escalation and keeps a single legacy publication workspace", async () => {
    expect(
      (
        await db.query<{ capabilities: any }>(
          "select capabilities from builder_projects where id='kaizen'",
        )
      ).rows[0].capabilities,
    ).toEqual({
      hasInventory: true,
      legacyWorkspace: true,
      publishPath: "github",
    });
    expect(
      (
        await db.query<{ capabilities: any }>(
          "select capabilities from builder_projects where id=$1",
          [alpha],
        )
      ).rows[0].capabilities,
    ).toEqual({
      hasInventory: false,
      legacyWorkspace: false,
      publishPath: "worker",
    });
    await as(owner, async () => {
      await expect(
        db.query(
          "update builder_projects set capabilities=jsonb_set(capabilities,'{publishPath}','\"github\"') where id=$1",
          [alpha],
        ),
      ).rejects.toThrow(/permission denied/);
    });
    await expect(
      db.query("update builder_projects set capabilities='{}' where id=$1", [
        alpha,
      ]),
    ).rejects.toThrow(/capabilities_valid/);
    await expect(
      db.query(
        "update builder_projects set capabilities=jsonb_set(capabilities,'{publishPath}','\"github\"') where id=$1",
        [alpha],
      ),
    ).rejects.toThrow(/capabilities_valid/);
    await expect(
      db.query(
        "update builder_projects set capabilities=(select capabilities from builder_projects where id='kaizen') where id=$1",
        [alpha],
      ),
    ).rejects.toThrow(/one_legacy_workspace/);
  });
  it("resolves legacy access from configuration rather than a fixed project ID", async () => {
    await db.exec("begin");
    try {
      await db.exec(
        `update builder_projects set capabilities='{"hasInventory":false,"legacyWorkspace":false,"publishPath":"worker"}' where id='kaizen'`,
      );
      await db.query(
        `update builder_projects set capabilities='{"hasInventory":true,"legacyWorkspace":true,"publishPath":"github"}' where id=$1`,
        [beta],
      );
      await as(owner, async () => {
        expect(
          (
            await db.query<{ allowed: boolean }>(
              "select builder_is_editor() as allowed",
            )
          ).rows[0].allowed,
        ).toBe(false);
        expect((await db.query("select * from builder_pages")).rows).toEqual(
          [],
        );
      });
      await as(stranger, async () => {
        expect(
          (
            await db.query<{ allowed: boolean }>(
              "select builder_is_editor() as allowed",
            )
          ).rows[0].allowed,
        ).toBe(true);
        expect(
          (await db.query("select * from builder_pages")).rows,
        ).toHaveLength(1);
      });
    } finally {
      await db.exec("rollback");
    }
  });
  it("enforces independent metadata, workspace and member reads for unrelated accounts", async () => {
    await as(owner, async () => {
      expect(
        (
          await db.query<{ id: string }>(
            "select id from builder_projects order by id",
          )
        ).rows.map((r) => r.id),
      ).toEqual([alpha, "kaizen"].sort());
      expect(
        (
          await db.query(
            "select * from builder_project_workspaces where project_id=$1",
            [beta],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await db.query(
            "select * from builder_project_members where project_id=$1",
            [beta],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await db.query<{ access: boolean }>(
            "select builder_project_access($1,'read',$2) as access",
            [beta, stranger],
          )
        ).rows[0].access,
      ).toBe(false);
    });
    await as(stranger, async () => {
      expect(
        (
          await db.query(
            "select * from builder_project_workspaces where project_id=$1",
            [alpha],
          )
        ).rows,
      ).toEqual([]);
      await expect(
        db.query("select builder_update_project($1,1,'Stolen',null)", [alpha]),
      ).rejects.toThrow(/owner access/);
      await expect(
        db.query("select builder_set_project_member($1,$2,'owner',true)", [
          alpha,
          stranger,
        ]),
      ).rejects.toThrow(/owner access/);
    });
  });
  it("separates editing from explicit publication permission and prevents removing the final owner", async () => {
    await as(owner, () =>
      db.query("select builder_set_project_member($1,$2,'editor',false)", [
        alpha,
        editor,
      ]),
    );
    await as(editor, async () => {
      const permissions = (
        await db.query<{ edit: boolean; publish: boolean }>(
          "select builder_project_access($1,'edit') as edit,builder_project_access($1,'publish') as publish",
          [alpha],
        )
      ).rows[0];
      expect(permissions).toEqual({ edit: true, publish: false });
      await expect(
        db.query("select builder_set_project_member($1,$2,'owner',true)", [
          alpha,
          editor,
        ]),
      ).rejects.toThrow(/owner access/);
    });
    await as(owner, async () => {
      await db.query("select builder_set_project_member($1,$2,'editor',true)", [
        alpha,
        editor,
      ]);
      await expect(
        db.query("select builder_set_project_member($1,$2,null,false)", [
          alpha,
          owner,
        ]),
      ).rejects.toThrow(/at least one/);
    });
    await as(editor, async () =>
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select builder_project_access($1,'publish') as allowed",
            [alpha],
          )
        ).rows[0].allowed,
      ).toBe(true),
    );
  });
  it("requires the validated server for commits and rechecks membership, versions and archive status", async () => {
    const payload = { pages: [], assets: [], saved: [] };
    await as(owner, () =>
      expect(
        db.query("select builder_commit_project_workspace($1,$2,0,$3::jsonb)", [
          alpha,
          owner,
          JSON.stringify(payload),
        ]),
      ).rejects.toThrow(/permission denied/),
    );
    await as(
      owner,
      async () => {
        await db.query(
          "select builder_commit_project_workspace($1,$2,0,$3::jsonb)",
          [alpha, owner, JSON.stringify(payload)],
        );
        await expect(
          db.query(
            "select builder_commit_project_workspace($1,$2,0,$3::jsonb)",
            [alpha, owner, JSON.stringify(payload)],
          ),
        ).rejects.toThrow(/changed during/);
        await expect(
          db.query(
            "select builder_commit_project_workspace($1,$2,1,$3::jsonb)",
            [alpha, stranger, JSON.stringify(payload)],
          ),
        ).rejects.toThrow(/editor access/);
      },
      "service_role",
    );
    await as(owner, () =>
      db.query("select builder_update_project($1,1,null,true)", [alpha]),
    );
    await as(
      owner,
      async () => {
        expect(
          (
            await db.query<{ allowed: boolean }>(
              "select builder_project_access($1,'edit') as allowed",
              [alpha],
            )
          ).rows[0].allowed,
        ).toBe(false);
        await expect(
          db.query(
            "select builder_commit_project_workspace($1,$2,1,$3::jsonb)",
            [alpha, owner, JSON.stringify(payload)],
          ),
        ).rejects.toThrow(/editor access/);
      },
      "service_role",
    );
    await as(owner, () =>
      db.query("select builder_update_project($1,2,null,false)", [alpha]),
    );
  });
  it("enforces project ownership at storage boundaries, including overwrites and revocation", async () => {
    const asset = crypto.randomUUID();
    expect(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets where id='builder-project-files'",
        )
      ).rows[0].public,
    ).toBe(false);
    await as(owner, () =>
      db.query(
        "insert into storage.objects(bucket_id,name) values('builder-project-files',$1)",
        [`${alpha}/${asset}`],
      ),
    );
    await as(stranger, async () => {
      expect(
        (
          await db.query("select * from storage.objects where name=$1", [
            `${alpha}/${asset}`,
          ])
        ).rows,
      ).toEqual([]);
      await expect(
        db.query(
          "insert into storage.objects(bucket_id,name) values('builder-project-files',$1)",
          [`${alpha}/${crypto.randomUUID()}`],
        ),
      ).rejects.toThrow(/row-level security/);
    });
    await as(owner, async () => {
      expect(
        (
          await db.query(
            "update storage.objects set name=$1 where name=$2 returning id",
            [`${alpha}/${crypto.randomUUID()}`, `${alpha}/${asset}`],
          )
        ).rows,
      ).toEqual([]);
      await expect(
        db.query(
          "insert into storage.objects(bucket_id,name) values('builder-project-files',$1)",
          [`${alpha}/../${beta}/${asset}`],
        ),
      ).rejects.toThrow(/row-level security/);
      await db.query("select builder_set_project_member($1,$2,null,false)", [
        alpha,
        editor,
      ]);
    });
    await as(editor, async () =>
      expect(
        (
          await db.query("select * from storage.objects where name=$1", [
            `${alpha}/${asset}`,
          ])
        ).rows,
      ).toEqual([]),
    );
  });
  it("denies direct workspace mutations and malformed server payloads", async () => {
    await as(owner, async () => {
      await expect(
        db.exec("truncate builder_project_workspaces cascade"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("update builder_projects set destination='{}' where id=$1", [
          alpha,
        ]),
      ).rejects.toThrow(/permission denied/);
    });
    await as(
      owner,
      () =>
        expect(
          db.query(
            "select builder_commit_project_workspace($1,$2,1,'{}'::jsonb)",
            [alpha, owner],
          ),
        ).rejects.toThrow(/check constraint/),
      "service_role",
    );
  });
  it("keeps private previews scoped and rejects revoked writers", async () => {
    const id = crypto.randomUUID();
    const snapshot = {
      id,
      document: { schemaVersion: 1 },
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const write = (actor: string, value = snapshot) =>
      db.query(
        "select builder_project_preview_write($1,$2,$3,$4::jsonb,false)",
        [alpha, actor, id, JSON.stringify(value)],
      );
    await as(owner, () =>
      expect(write(owner)).rejects.toThrow(/permission denied/),
    );
    await as(owner, () => write(owner), "service_role");
    await as(stranger, async () =>
      expect(
        (
          await db.query(
            "select * from builder_project_previews where project_id=$1",
            [alpha],
          )
        ).rows,
      ).toEqual([]),
    );
    await as(owner, async () =>
      expect(
        (
          await db.query(
            "select * from builder_project_previews where project_id=$1",
            [alpha],
          )
        ).rows,
      ).toHaveLength(1),
    );
    await as(
      editor,
      () => expect(write(editor)).rejects.toThrow(/editor access/),
      "service_role",
    );
    await as(
      owner,
      () =>
        expect(
          write(owner, { ...snapshot, document: { schemaVersion: 2 } }),
        ).rejects.toThrow(/Invalid preview/),
      "service_role",
    );
    await as(
      owner,
      () =>
        db.query("select builder_project_preview_write($1,$2,$3,null,true)", [
          alpha,
          owner,
          id,
        ]),
      "service_role",
    );
    await as(owner, async () =>
      expect(
        (
          await db.query(
            "select * from builder_project_previews where project_id=$1",
            [alpha],
          )
        ).rows,
      ).toEqual([]),
    );
  });
  it("enforces legacy publication permissions at release insertion and syncs revoked membership", async () => {
    const insert = () =>
      db.query(
        "insert into builder_releases(id,requested_by,request,snapshot,baseline) values(gen_random_uuid(),$1,'{}','{}','{}')",
        [editor],
      );
    await as(owner, () =>
      db.query(
        "select builder_set_project_member('kaizen',$1,'editor',false)",
        [editor],
      ),
    );
    await expect(insert()).rejects.toThrow(/publish permission/);
    await as(owner, () =>
      db.query("select builder_set_project_member('kaizen',$1,'editor',true)", [
        editor,
      ]),
    );
    await insert();
    await as(owner, () =>
      db.query("select builder_set_project_member('kaizen',$1,null,false)", [
        editor,
      ]),
    );
    expect(
      (
        await db.query("select * from builder_editors where user_id=$1", [
          editor,
        ])
      ).rows,
    ).toEqual([]);
    await as(editor, async () =>
      expect((await db.query("select * from builder_pages")).rows).toEqual([]),
    );
  });
});
