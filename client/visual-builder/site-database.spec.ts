import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  initialSiteDesign,
  resolveSiteDocument,
} from "../../shared/builderSite";
import { newDocument, starterBlocks } from "./starters";

describe("site design PostgreSQL migrations", () => {
  let db: PGlite;
  const editor = "11111111-1111-4111-8111-111111111111";
  beforeAll(async () => {
    db = await PGlite.create();
    // Supabase-owned schemas/roles are fixtures; the application migrations run unchanged.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key,bucket_id text,name text);
      alter table storage.objects enable row level security;`);
    for (const file of [
      "202609100001_visual_builder.sql",
      "202609100002_builder_site_design.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(`grant usage on schema public to anon,authenticated,service_role;
      grant select on public.builder_site,public.builder_pages to authenticated;
      grant select on public.builder_publications to anon,authenticated;
      insert into auth.users(id) values('${editor}'); insert into public.builder_editors(user_id) values('${editor}');`);
  }, 30_000);
  beforeEach(async () => {
    await db.exec(
      "reset role; truncate public.builder_publications,public.builder_pages,public.builder_site;",
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      editor,
    ]);
  });
  afterAll(async () => {
    await db?.close();
  });
  async function role<T>(
    name: "anon" | "authenticated" | "service_role",
    action: () => Promise<T>,
  ) {
    await db.exec(`set role ${name}`);
    try {
      return await action();
    } finally {
      await db.exec("reset role");
    }
  }
  async function seed() {
    const design = initialSiteDesign();
    design.components = [
      {
        id: "header",
        name: "Header",
        kind: "header",
        blocks: [starterBlocks.Menu()],
      },
    ];
    const pages = ["one", "two", "three"].map((slug) => ({
      id: crypto.randomUUID(),
      document: {
        ...newDocument(slug, `database-${slug}`, false),
        site: { useTheme: true, headerId: "header" },
      },
    }));
    await role("authenticated", async () => {
      await db.query("select public.builder_save_site(0,$1::jsonb)", [
        JSON.stringify(design),
      ]);
      for (const page of pages)
        await db.query(
          "select public.builder_save_page($1::uuid,0,$2::jsonb)",
          [page.id, JSON.stringify(page.document)],
        );
    });
    return {
      design,
      pages,
      versions: Object.fromEntries(pages.map((page) => [page.id, 1])),
      snapshots: pages.map((page) => ({
        id: page.id,
        document: resolveSiteDocument(page.document, design),
      })),
    };
  }
  it("limits site drafts to editors and publication to the trusted service", async () => {
    const design = initialSiteDesign();
    await expect(
      role("anon", () =>
        db.query("select public.builder_save_site(0,$1::jsonb)", [
          JSON.stringify(design),
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      "22222222-2222-4222-8222-222222222222",
    ]);
    await expect(
      role("authenticated", () =>
        db.query("select public.builder_save_site(0,$1::jsonb)", [
          JSON.stringify(design),
        ]),
      ),
    ).rejects.toThrow("Builder editor access required");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      editor,
    ]);
    await seed();
    await expect(
      role("authenticated", () =>
        db.query("select public.builder_publish_site(1,'{}','[]')"),
      ),
    ).rejects.toThrow(/permission denied/i);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      "22222222-2222-4222-8222-222222222222",
    ]);
    const result = await role("authenticated", () =>
      db.query("select payload from public.builder_site"),
    );
    expect(result.rows).toEqual([]);
  });
  it("publishes three resolved snapshots together and keeps later shared drafts private", async () => {
    const { design, versions, snapshots } = await seed();
    const result = await role("service_role", () =>
      db.query<{ result: any }>(
        "select public.builder_publish_site(1,$1::jsonb,$2::jsonb) as result",
        [JSON.stringify(versions), JSON.stringify(snapshots)],
      ),
    );
    expect(result.rows[0].result.pages).toHaveLength(3);
    expect(result.rows[0].result.site.version).toBe(2);
    const live = await role("anon", () =>
      db.query<{ document: any }>(
        "select document from public.builder_publications",
      ),
    );
    expect(live.rows).toHaveLength(3);
    expect(
      live.rows.every(
        (row) =>
          !row.document.site &&
          !JSON.stringify(row.document).includes('"type":"Shared"'),
      ),
    ).toBe(true);
    design.theme.accent = "#ff5500";
    await role("authenticated", () =>
      db.query("select public.builder_save_site(2,$1::jsonb)", [
        JSON.stringify(design),
      ]),
    );
    expect(
      (await db.query("select document from public.builder_publications")).rows,
    ).toEqual(live.rows);
    await expect(
      role("authenticated", () =>
        db.query("select public.builder_save_site(2,$1::jsonb)", [
          JSON.stringify(design),
        ]),
      ),
    ).rejects.toThrow("another window");
  });
  it("rolls back every page if a snapshot is invalid and rejects stale or null versions", async () => {
    const { versions, snapshots, design } = await seed();
    snapshots[1].document.slug = "unexpected-route";
    await expect(
      role("service_role", () =>
        db.query("select public.builder_publish_site(1,$1::jsonb,$2::jsonb)", [
          JSON.stringify(versions),
          JSON.stringify(snapshots),
        ]),
      ),
    ).rejects.toThrow("Invalid publication snapshot");
    expect(
      (await db.query("select * from public.builder_publications")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ payload: any }>(
          "select payload from public.builder_pages",
        )
      ).rows.every(
        (row) => row.payload.version === 1 && row.payload.published === null,
      ),
    ).toBe(true);
    await expect(
      role("service_role", () =>
        db.query("select public.builder_publish_site(0,$1::jsonb,'[]')", [
          JSON.stringify(versions),
        ]),
      ),
    ).rejects.toThrow("Site design changed");
    await expect(
      role("authenticated", () =>
        db.query("select public.builder_save_site(null,$1::jsonb)", [
          JSON.stringify(design),
        ]),
      ),
    ).rejects.toThrow("another window");
    versions[Object.keys(versions)[0]] = 0;
    await expect(
      role("service_role", () =>
        db.query("select public.builder_publish_site(1,$1::jsonb,'[]')", [
          JSON.stringify(versions),
        ]),
      ),
    ).rejects.toThrow("Pages changed");
  });
});
