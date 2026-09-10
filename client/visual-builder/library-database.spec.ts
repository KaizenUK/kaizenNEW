import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  assetUsage,
  reviewAssetReplacement,
} from "../../shared/builderLibrary";
import { type Workspace } from "../../shared/visualBuilder";
import { libraryFixture } from "./library-fixture";
import { makeRestorePlan } from "../../shared/builderBackup";
import {
  conversionDraft,
  validateConversion,
} from "../../shared/builderConversions";

describe("library PostgreSQL transactions", () => {
  let db: PGlite;
  const editor = "11111111-1111-4111-8111-111111111111";
  beforeAll(async () => {
    db = await PGlite.create();
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
      "202609100004_builder_library.sql",
      "202609100005_builder_backup.sql",
      "202609100006_builder_images.sql",
      "202609100007_builder_conversions.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(`grant usage on schema public to anon,authenticated,service_role;
      insert into auth.users(id) values('${editor}'); insert into public.builder_editors(user_id) values('${editor}');`);
  }, 30_000);
  beforeEach(async () => {
    await db.exec(
      "reset role; truncate public.builder_publications,public.builder_pages,public.builder_site,public.builder_assets,public.builder_saved;",
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      editor,
    ]);
  });
  afterAll(async () => {
    await db?.close();
  });
  async function rpc<T>(
    name:
      | "builder_update_asset_metadata"
      | "builder_replace_asset"
      | "builder_restore_backup",
    input: unknown,
    role = "authenticated",
  ): Promise<T> {
    await db.exec(`set role ${role}`);
    try {
      return (
        await db.query<{ result: T }>(
          `select public.${name}($1::jsonb) result`,
          [JSON.stringify(input)],
        )
      ).rows[0].result;
    } finally {
      await db.exec("reset role");
    }
  }
  async function seed() {
    const workspace = libraryFixture();
    for (const asset of workspace.assets)
      await db.query("insert into builder_assets values($1,$2,$3)", [
        asset.id,
        asset.hash,
        JSON.stringify(asset),
      ]);
    for (const page of workspace.pages) {
      await db.query("insert into builder_pages values($1,$2)", [
        page.id,
        JSON.stringify(page),
      ]);
      await db.query(
        "insert into builder_publications(id,slug,document) values($1,$2,$3)",
        [page.id, page.published!.slug, JSON.stringify(page.published)],
      );
    }
    for (const saved of workspace.saved)
      await db.query("insert into builder_saved values($1,$2)", [
        saved.id,
        JSON.stringify(saved),
      ]);
    await db.query("insert into builder_site values('site',$1)", [
      JSON.stringify(workspace.site),
    ]);
    return workspace;
  }
  const snapshot = async () =>
    (
      await db.query<{ result: Workspace }>(
        "select public.builder_backup_workspace() result",
      )
    ).rows[0].result;
  it("saves conversion briefs with editor access, reference validation and asset concurrency checks", async () => {
    const workspace = await seed(),
      source = {
        ...workspace.assets[0],
        kind: "code" as const,
        name: "Sample.tsx",
      };
    await db.query("update builder_assets set payload=$2 where id=$1", [
      source.id,
      JSON.stringify(source),
    ]);
    workspace.assets[0] = source;
    const draft = conversionDraft(source, workspace.assets);
    async function save(
      expected: typeof source,
      input = draft,
      role = "authenticated",
    ) {
      await db.exec(`set role ${role}`);
      try {
        return (
          await db.query<{ result: typeof source }>(
            "select builder_set_asset_conversion($1,$2) result",
            [JSON.stringify(expected), JSON.stringify(input)],
          )
        ).rows[0].result;
      } finally {
        await db.exec("reset role");
      }
    }
    const result = await save(source);
    validateConversion(result.conversion!, result, [
      result,
      ...workspace.assets.slice(1),
    ]);
    expect(result.conversion!.version).toBe(1);
    expect(result.hash).toBe(source.hash);
    await expect(save(source)).rejects.toThrow(/changed/);
    await expect(
      save(result, { ...draft, status: "available" as any }),
    ).rejects.toThrow(/Invalid/);
    await expect(save(result, { ...draft, sources: [] })).rejects.toThrow();
    await expect(save(result, draft, "anon")).rejects.toThrow(
      /permission denied/,
    );
    const wrong = {
      ...draft,
      sources: [
        ...draft.sources,
        {
          assetId: crypto.randomUUID(),
          hash: "c".repeat(64),
          role: "reference" as const,
        },
      ],
    };
    await expect(save(result, wrong)).rejects.toThrow(/missing or changed/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      crypto.randomUUID(),
    ]);
    await expect(save(result)).rejects.toThrow(/editor access/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      editor,
    ]);
    const current = await snapshot(),
      plan = makeRestorePlan(current, current);
    plan.assetUpdates = [
      {
        expected: result,
        asset: {
          ...result,
          conversion: { ...result.conversion!, sources: [] },
        },
      },
    ];
    await expect(rpc("builder_restore_backup", plan)).rejects.toThrow();
    expect(await snapshot()).toEqual(current);
  });
  it("attaches only registered image variants, rejects stale writes and requires editor access", async () => {
    const workspace = await seed(),
      original = workspace.assets[0],
      before = await snapshot();
    const file = {
      ...original,
      id: crypto.randomUUID(),
      url: "/media/generated.webp",
      mime: "image/webp",
      generatedFrom: original.url,
      size: 320,
      hash: "b".repeat(64),
    };
    const image = {
      source: original.url,
      status: "ready",
      width: 1600,
      height: 800,
      variants: [
        {
          url: file.url,
          width: 320,
          height: 160,
          size: file.size,
          hash: file.hash,
        },
      ],
    };
    const attach = async (
      metadata: unknown = image,
      role = "authenticated",
    ) => {
      await db.exec(`set role ${role}`);
      try {
        return (
          await db.query<{ result: unknown }>(
            "select builder_set_asset_image($1::jsonb,$2::jsonb) result",
            [JSON.stringify(original), JSON.stringify(metadata)],
          )
        ).rows[0].result;
      } finally {
        await db.exec("reset role");
      }
    };
    await expect(attach()).rejects.toThrow(/file is missing/);
    await db.query("insert into builder_assets values($1,$2,$3)", [
      file.id,
      file.hash,
      JSON.stringify(file),
    ]);
    await expect(attach({ ...image, width: null })).rejects.toThrow(
      /dimensions/,
    );
    await expect(
      attach({ ...image, variants: [image.variants[0], image.variants[0]] }),
    ).rejects.toThrow(/Duplicate/);
    await expect(
      attach({
        ...image,
        variants: [{ ...image.variants[0], hash: "c".repeat(64) }],
      }),
    ).rejects.toThrow(/file is missing/);
    await expect(attach(image, "anon")).rejects.toThrow(/permission denied/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      "22222222-2222-4222-8222-222222222222",
    ]);
    await expect(attach()).rejects.toThrow(/editor access/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      editor,
    ]);
    expect(await attach()).toEqual({ ...original, image });
    await expect(attach()).rejects.toThrow(/asset changed/);
    expect((await snapshot()).pages).toEqual(before.pages);
  });
  it("restores an empty workspace with shared definitions and history while keeping old publications inactive", async () => {
    const backup = await seed();
    await db.exec(
      "truncate builder_pages,builder_publications,builder_site,builder_saved",
    );
    const empty = await snapshot();
    const next = await rpc<Workspace>(
      "builder_restore_backup",
      makeRestorePlan(empty, backup),
    );
    expect(next.pages).toHaveLength(3);
    expect(
      next.pages.every((page) => !page.published && page.version === 1),
    ).toBe(true);
    expect(next.site!.draft).toEqual(backup.site!.draft);
    expect(next.site!.published).toBeNull();
    expect(next.saved).toEqual(backup.saved);
    expect((await db.query("select * from builder_publications")).rows).toEqual(
      [],
    );
  });
  it("restores matching drafts and asset metadata atomically, preserving publications and a pre-restore revision", async () => {
    const backup = await seed();
    const document = { ...backup.pages[0].draft, title: "Before restoring" };
    await db.query("select builder_save_page($1,$2,$3)", [
      backup.pages[0].id,
      backup.pages[0].version,
      JSON.stringify(document),
    ]);
    const current = await snapshot(),
      plan = makeRestorePlan(current, backup);
    plan.assetUpdates = [
      {
        expected: current.assets[0],
        asset: {
          ...current.assets[0],
          tags: ["restored"],
          favourite: true,
          originalPack: "Source pack",
        },
      },
    ];
    const publications = (
      await db.query("select * from builder_publications order by id")
    ).rows;
    const restored = await rpc<Workspace>("builder_restore_backup", plan);
    expect(
      (await db.query("select * from builder_publications order by id")).rows,
    ).toEqual(publications);
    const page = restored.pages.find((item) => item.id === backup.pages[0].id)!;
    expect(page.draft.title).toBe(backup.pages[0].draft.title);
    expect(page.revisions.slice(-2)[0].document.title).toBe("Before restoring");
    expect(restored.site!.published).toEqual(current.site!.published);
    expect(
      restored.assets.find((asset) => asset.id === current.assets[0].id)!.tags,
    ).toEqual(["restored"]);
    await expect(rpc("builder_restore_backup", plan)).rejects.toThrow(
      /changed/i,
    );
  });
  it("rolls back staged pages and metadata on a late restore error and requires editor membership", async () => {
    const backup = await seed(),
      plan = makeRestorePlan(backup, backup),
      before = await snapshot();
    plan.assetUpdates = [
      {
        expected: backup.assets[0],
        asset: { ...backup.assets[0], favourite: true },
      },
    ];
    plan.pages[1].draft.slug = "builder";
    await expect(rpc("builder_restore_backup", plan)).rejects.toThrow(
      /existing site/,
    );
    expect(await snapshot()).toEqual(before);
    await expect(rpc("builder_restore_backup", plan, "anon")).rejects.toThrow(
      /permission denied/,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      "22222222-2222-4222-8222-222222222222",
    ]);
    await expect(rpc("builder_restore_backup", plan)).rejects.toThrow(
      /editor access/,
    );
    await expect(snapshot()).rejects.toThrow(/editor access/);
  });
  it("requires editor membership and exposes neither RPC to anonymous users", async () => {
    const workspace = await seed(),
      review = reviewAssetReplacement(
        workspace,
        workspace.assets[0].id,
        workspace.assets[1].id,
      );
    for (const [name, input] of [
      ["builder_replace_asset", review],
      ["builder_update_asset_metadata", []],
    ] as const) {
      await expect(rpc(name, input, "anon")).rejects.toThrow(
        /permission denied/i,
      );
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        "22222222-2222-4222-8222-222222222222",
      ]);
      await expect(rpc(name, input)).rejects.toThrow(/editor access/i);
    }
  });
  it("applies bulk metadata atomically, retains original pack and rejects changes to file fields", async () => {
    const workspace = await seed();
    const changes = workspace.assets.map((asset) => ({
      id: asset.id,
      expected: asset,
      patch: {
        tags: [" hero ", "hero", "web"],
        pack: " Launch ",
        favourite: true,
      },
    }));
    const before = (await db.query("select * from builder_assets order by id"))
      .rows;
    await expect(
      rpc("builder_update_asset_metadata", [
        changes[0],
        { ...changes[1], expected: { ...changes[1].expected, name: "stale" } },
      ]),
    ).rejects.toThrow(/another window/i);
    expect(
      (await db.query("select * from builder_assets order by id")).rows,
    ).toEqual(before);
    await expect(
      rpc("builder_update_asset_metadata", [
        { ...changes[0], patch: { url: "/changed" } },
      ]),
    ).rejects.toThrow(/metadata/i);
    const updated = await rpc<Workspace["assets"]>(
      "builder_update_asset_metadata",
      changes,
    );
    expect(updated).toEqual(
      workspace.assets.map((asset) => ({
        ...asset,
        originalPack: "Source pack",
        pack: "Launch",
        tags: ["hero", "web"],
        favourite: true,
      })),
    );
  });
  it("replaces page, shared component and saved references without changing publications or original assets", async () => {
    const workspace = await seed(),
      [source, replacement] = workspace.assets;
    const publications = (
      await db.query("select * from builder_publications order by id")
    ).rows;
    const next = await rpc<Workspace>(
      "builder_replace_asset",
      reviewAssetReplacement(workspace, source.id, replacement.id),
    );
    expect(
      (await db.query("select * from builder_publications order by id")).rows,
    ).toEqual(publications);
    expect(next.assets.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      workspace.assets.sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(next.site!.published).toEqual(workspace.site!.published);
    expect(next.site!.version).toBe(workspace.site!.version + 1);
    expect(
      assetUsage(next, source).pages.every((page) => !page.draft && page.live),
    ).toBe(true);
    expect(assetUsage(next, replacement).pages).toHaveLength(3);
    const page = next.pages.find((item) => item.id === workspace.pages[0].id)!;
    expect(page.revisions.slice(0, -1)).toEqual(workspace.pages[0].revisions);
    expect(next.saved[0].blocks[0].props.src).toBe(replacement.url);
  });
  it("rejects stale page versions and saved content before writing any replacement", async () => {
    const workspace = await seed(),
      review = reviewAssetReplacement(
        workspace,
        workspace.assets[0].id,
        workspace.assets[1].id,
      );
    const before = (await db.query("select * from builder_pages order by id"))
      .rows;
    const stale = structuredClone(review);
    stale.pageVersions[workspace.pages[0].id]--;
    await expect(rpc("builder_replace_asset", stale)).rejects.toThrow(
      /Pages changed/,
    );
    expect(
      (await db.query("select * from builder_pages order by id")).rows,
    ).toEqual(before);
    await db.query(
      "update builder_saved set payload=jsonb_set(payload,'{name}','\"New name\"')",
    );
    await expect(rpc("builder_replace_asset", review)).rejects.toThrow(
      /Reusable content changed/,
    );
    expect(
      (await db.query("select * from builder_pages order by id")).rows,
    ).toEqual(before);
  });
});
