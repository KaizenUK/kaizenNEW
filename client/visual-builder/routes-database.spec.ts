import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { newDocument } from "./starters";
import { makeRestorePlan } from "../../shared/builderBackup";
import { initialRoutes } from "../../shared/builderRoutes";

describe("redirect publication PostgreSQL transactions", () => {
  let db: PGlite;
  const editor = "11111111-1111-4111-8111-111111111111";
  const rule = (source = "/retired/", destination = "/") => ({
    id: crypto.randomUUID(),
    source,
    destination,
    status: 302,
  });
  const result = async (sql: string, args: unknown[] = []) =>
    (await db.query<{ value: any }>(`select ${sql} as value`, args)).rows[0]
      .value;
  const role = async (name: string, action: () => Promise<any>) => {
    await db.exec(`set role ${name}`);
    try {
      return await action();
    } finally {
      await db.exec("reset role");
    }
  };
  const save = (version: number, rules: unknown[]) =>
    role("authenticated", () =>
      result("builder_save_routes($1,$2::jsonb)", [
        version,
        JSON.stringify(rules),
      ]),
    );
  const queue = (version: number) =>
    role("service_role", () =>
      result("builder_queue_routes_release($1::uuid,$2::uuid,$3)", [
        crypto.randomUUID(),
        editor,
        version,
      ]),
    );
  async function live(id: string) {
    const owner = crypto.randomUUID();
    await role("service_role", async () => {
      await result("builder_claim_release($1::uuid,$2::uuid,$3)", [
        id,
        owner,
        `artifact-${id}`,
      ]);
      for (const phase of ["activating", "verifying", "live"])
        await result(
          "builder_advance_release($1::uuid,$2::uuid,$3,$4::jsonb,null)",
          [
            id,
            owner,
            phase,
            JSON.stringify({
              artifactId: `artifact-${id}`,
              manifestSha256: "a".repeat(64),
              checkedResponses: 5,
            }),
          ],
        );
    });
  }
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;`);
    for (const name of [
      "001_visual_builder",
      "002_builder_site_design",
      "004_builder_library",
      "005_builder_backup",
      "006_builder_images",
      "007_builder_conversions",
      "008_builder_releases",
      "009_builder_previews",
      "010_builder_routes",
    ])
      await db.exec(
        await readFile(`supabase/migrations/202609100${name}.sql`, "utf8"),
      );
    await db.exec(
      `grant usage on schema public to anon,authenticated,service_role;insert into auth.users values('${editor}');insert into builder_editors values('${editor}');`,
    );
  }, 30000);
  beforeEach(async () => {
    await db.exec(
      "reset role;truncate builder_release_head,builder_releases,builder_publications,builder_pages,builder_site,builder_saved,builder_assets,builder_routes;insert into builder_release_head(id) values('site');",
    );
    await db.query("insert into builder_routes values('site',$1::jsonb)", [
      JSON.stringify(initialRoutes()),
    ]);
    await result("set_config('request.jwt.claim.sub',$1,false)", [editor]);
  });
  afterAll(async () => {
    await db?.close();
  });
  it("protects drafts, normalizes paths, rejects loops and stale edits", async () => {
    const saved = await save(0, [rule("retired")]);
    expect(saved.draft[0].source).toBe("/retired/");
    expect(
      (
        await role("anon", () =>
          db.query<{ rules: unknown[] }>(
            "select rules from builder_public_redirects",
          ),
        )
      ).rows[0].rules,
    ).toEqual([]);
    await expect(
      role("anon", () => db.query("select payload from builder_routes")),
    ).rejects.toThrow(/permission/);
    await expect(save(0, [])).rejects.toThrow(/another window/);
    await expect(
      save(1, [rule("/a/", "/b/"), rule("/b/", "/a/")]),
    ).rejects.toThrow(/cycle/);
    await expect(save(1, [rule("/builder/")])).rejects.toThrow(/existing site/);
    await result("set_config('request.jwt.claim.sub',$1,false)", [
      crypto.randomUUID(),
    ]);
    expect(
      (
        await role("authenticated", () =>
          db.query("select payload from builder_routes"),
        )
      ).rows,
    ).toEqual([]);
    await expect(save(1, [])).rejects.toThrow(/editor access/);
  });
  it("freezes rules, commits only verified releases, preserves newer drafts and rolls back", async () => {
    const original = rule();
    await save(0, [original]);
    const first = await queue(1);
    await save(1, [{ ...original, destination: "/contact/" }]);
    expect(
      (
        await db.query<{ rules: unknown[] }>(
          "select rules from builder_public_redirects",
        )
      ).rows[0].rules,
    ).toEqual([]);
    await expect(queue(2)).rejects.toThrow(/pending/);
    await live(first.id);
    expect(
      (
        await db.query<{ rules: unknown[] }>(
          "select rules from builder_public_redirects",
        )
      ).rows[0].rules,
    ).toEqual([original]);
    expect(
      (await db.query<{ payload: any }>("select payload from builder_routes"))
        .rows[0].payload.version,
    ).toBe(2);
    const second = await queue(2);
    await live(second.id);
    const rollback = await role("service_role", () =>
      result("builder_queue_rollback($1::uuid,$2::uuid,$3::uuid)", [
        crypto.randomUUID(),
        editor,
        first.id,
      ]),
    );
    // Rollback claims use the retained artifact ID, not a new build.
    const owner = crypto.randomUUID();
    await role("service_role", async () => {
      await result("builder_claim_release($1::uuid,$2::uuid,$3)", [
        rollback.id,
        owner,
        `artifact-${first.id}`,
      ]);
      for (const phase of ["activating", "verifying", "live"])
        await result(
          "builder_advance_release($1::uuid,$2::uuid,$3,$4::jsonb,null)",
          [
            rollback.id,
            owner,
            phase,
            JSON.stringify({
              artifactId: `artifact-${first.id}`,
              manifestSha256: "a".repeat(64),
              checkedResponses: 5,
            }),
          ],
        );
    });
    const state = (
      await db.query<{ payload: any }>("select payload from builder_routes")
    ).rows[0].payload;
    expect(state.published).toEqual([original]);
    expect(state.draft[0].destination).toBe("/contact/");
  });
  it("reserves live and pending sources, rejects occupied sources, and leaves failed requests unpublished", async () => {
    await save(0, [rule()]);
    const pending = await queue(1);
    const addPage = (slug: string) =>
      role("authenticated", () =>
        result("builder_save_page($1::uuid,0,$2::jsonb)", [
          crypto.randomUUID(),
          JSON.stringify(newDocument(slug, slug, false)),
        ]),
      );
    await expect(addPage("retired")).rejects.toThrow(/pending redirect/);
    await role("service_role", () =>
      result("builder_fail_queued_release($1::uuid,$2)", [
        pending.id,
        "Dispatch refused",
      ]),
    );
    expect(
      (
        await db.query<{ rules: unknown[] }>(
          "select rules from builder_public_redirects",
        )
      ).rows[0].rules,
    ).toEqual([]);
    await addPage("retired");
    await expect(queue(1)).rejects.toThrow(/current draft/);
  });
  it("restores redirect drafts atomically with backups without changing live rules", async () => {
    await save(0, [rule()]);
    await live((await queue(1)).id);
    const current = await role("authenticated", () =>
      result("builder_backup_workspace()"),
    );
    const incoming = {
      ...current,
      routes: { ...current.routes, draft: [rule("/backup-old/", "/contact/")] },
    };
    const plan = makeRestorePlan(current, incoming);
    const restored = await role("authenticated", () =>
      result("builder_restore_backup($1::jsonb)", [JSON.stringify(plan)]),
    );
    expect(restored.routes.draft).toEqual(incoming.routes.draft);
    expect(restored.routes.published).toEqual(current.routes.published);
    await expect(
      role("authenticated", () =>
        result("builder_restore_backup($1::jsonb)", [JSON.stringify(plan)]),
      ),
    ).rejects.toThrow(/Redirects changed/);
    const invalid = makeRestorePlan(restored, incoming);
    invalid.routes!.draft[0].source = "/builder/";
    await expect(
      role("authenticated", () =>
        result("builder_restore_backup($1::jsonb)", [JSON.stringify(invalid)]),
      ),
    ).rejects.toThrow(/existing site/);
    expect(
      await role("authenticated", () => result("builder_backup_workspace()")),
    ).toEqual(restored);
  });
});
