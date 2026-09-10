import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { localPreviewAction } from "../../scripts/builder-previews";
import {
  createPrivatePreview,
  validatePreviewDocument,
} from "../../shared/builderPreviews";
import { newDocument, starterBlocks } from "./starters";

describe("private preview permissions and lifecycle", () => {
  let db: PGlite;
  const editor = "11111111-1111-4111-8111-111111111111",
    second = "22222222-2222-4222-8222-222222222222";
  const document = newDocument(
    "Private design review",
    "private-design-review",
    false,
  );
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
      "202609100009_builder_previews.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(`grant usage on schema public to anon,authenticated,service_role;
      insert into auth.users(id) values('${editor}'),('${second}');
      insert into builder_editors(user_id) values('${editor}'),('${second}');`);
  }, 30_000);
  beforeEach(async () => {
    await db.exec("reset role; truncate builder_previews");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      editor,
    ]);
  });
  afterAll(async () => {
    await db?.close();
  });
  async function run(
    sql: string,
    args: unknown[] = [],
    role = "authenticated",
  ) {
    await db.exec(`set role ${role}`);
    try {
      return (await db.query<{ result: any }>(`select ${sql} as result`, args))
        .rows[0].result;
    } finally {
      await db.exec("reset role");
    }
  }
  const create = (id = crypto.randomUUID(), snapshot = document, hours = 24) =>
    run("builder_create_preview($1::uuid,$2::jsonb,$3)", [
      id,
      JSON.stringify(snapshot),
      hours,
    ]);
  it("freezes one snapshot, preserves expiry on retries and never exposes it as a publication", async () => {
    const id = crypto.randomUUID(),
      created = await create(id);
    expect(created).not.toHaveProperty("document");
    expect(await create(id)).toEqual(created);
    expect(
      (await run("builder_read_preview($1::uuid)", [id])).document,
    ).toEqual(document);
    await expect(
      create(id, { ...document, title: "Later draft" }),
    ).rejects.toThrow("different snapshot");
    expect((await db.query("select * from builder_publications")).rows).toEqual(
      [],
    );
    expect((await run("builder_list_previews()"))[0]).not.toHaveProperty(
      "document",
    );
    expect(
      Date.parse(created.expiresAt) - Date.parse(created.createdAt),
    ).toBeGreaterThanOrEqual(24 * 3_600_000);
  });
  it("requires editor membership for every operation and allows other authorised editors to review", async () => {
    const created = await create();
    for (const operation of [
      "builder_list_previews()",
      `builder_read_preview('${created.id}')`,
      `builder_revoke_preview('${created.id}')`,
    ])
      await expect(run(operation, [], "anon")).rejects.toThrow(
        /permission denied/i,
      );
    await expect(
      run("(select count(*) from builder_previews)"),
    ).rejects.toThrow(/permission denied/i);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      crypto.randomUUID(),
    ]);
    for (const operation of [
      "builder_list_previews()",
      `builder_read_preview('${created.id}')`,
      `builder_revoke_preview('${created.id}')`,
    ])
      await expect(run(operation)).rejects.toThrow("editor access");
    await expect(create()).rejects.toThrow("editor access");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      second,
    ]);
    expect(
      (await run("builder_read_preview($1::uuid)", [created.id])).document
        .title,
    ).toBe(document.title);
    await run("builder_revoke_preview($1::uuid)", [created.id]);
    await expect(
      run("builder_read_preview($1::uuid)", [created.id]),
    ).rejects.toThrow("revoked");
    expect(
      (
        await db.query<{ document: unknown }>(
          "select document from builder_previews where id=$1",
          [created.id],
        )
      ).rows[0].document,
    ).toBeNull();
  });
  it("expires and revokes access without allowing a stale creation retry to reactivate the link", async () => {
    const revoked = await create();
    await run("builder_revoke_preview($1::uuid)", [revoked.id]);
    expect(await run("builder_revoke_preview($1::uuid)", [revoked.id])).toBe(
      true,
    );
    await expect(create(revoked.id)).rejects.toThrow("expired or was revoked");
    const expired = await create();
    await db.query(
      "update builder_previews set expires_at=now()-interval '1 second' where id=$1",
      [expired.id],
    );
    await expect(
      run("builder_read_preview($1::uuid)", [expired.id]),
    ).rejects.toThrow("expired");
    expect(await run("builder_list_previews()")).toEqual([]);
    await create(); // Opportunistic expiry cleanup clears the private document but retains the ID tombstone.
    expect(
      (
        await db.query<{ document: unknown }>(
          "select document from builder_previews where id=$1",
          [expired.id],
        )
      ).rows[0].document,
    ).toBeNull();
    await expect(create(expired.id)).rejects.toThrow("expired or was revoked");
  });
  it("bounds lifetime, size and active previews", async () => {
    await expect(create(crypto.randomUUID(), document, 0)).rejects.toThrow(
      "Invalid",
    );
    await expect(create(crypto.randomUUID(), document, 169)).rejects.toThrow(
      "Invalid",
    );
    await expect(
      create(crypto.randomUUID(), {
        ...document,
        description: "x".repeat(2_000_001),
      }),
    ).rejects.toThrow("oversized");
    for (let i = 0; i < 50; i++) await create();
    await expect(create()).rejects.toThrow("50 active previews");
    const rows = await run("builder_list_previews()");
    await run("builder_revoke_preview($1::uuid)", [rows[0].id]);
    await create();
    expect(await run("builder_list_previews()")).toHaveLength(50);
  });
});

describe("local private previews", () => {
  it("persists immutable previews separately, enforces expiry/revocation and rejects filesystem traversal", async () => {
    const base = path.resolve("test-results/private-preview-storage");
    await mkdir(base, { recursive: true });
    const root = await mkdtemp(path.join(base, "case-"));
    try {
      const document = newDocument("Local saved copy", "saved-copy", false),
        id = crypto.randomUUID(),
        now = Date.now();
      const input = {
        action: "preview-create",
        id,
        document,
        hours: 1 as const,
      };
      const created = await localPreviewAction(root, input, now);
      expect(await localPreviewAction(root, input, now + 1000)).toEqual(
        created,
      );
      document.title = "Later local edit";
      expect(
        (
          (await localPreviewAction(
            root,
            { action: "preview-read", id },
            now,
          )) as any
        ).document.title,
      ).toBe("Local saved copy");
      await expect(localPreviewAction(root, input, now)).rejects.toThrow(
        "different snapshot",
      );
      await expect(
        localPreviewAction(
          root,
          { action: "preview-read", id },
          now + 3_600_000,
        ),
      ).rejects.toThrow("expired");
      await localPreviewAction(root, { action: "preview-revoke", id }, now);
      await expect(
        localPreviewAction(root, { action: "preview-read", id }, now),
      ).rejects.toThrow("revoked");
      await expect(localPreviewAction(root, input, now)).rejects.toThrow(
        "revoked",
      );
      expect(
        await localPreviewAction(root, { action: "preview-list" }, now),
      ).toEqual([]);
      expect(
        JSON.parse(
          await readFile(path.join(root, "previews", `${id}.json`), "utf8"),
        ).document,
      ).toBeNull();
      await expect(
        localPreviewAction(
          root,
          { action: "preview-read", id: "../../workspace" },
          now,
        ),
      ).rejects.toThrow("Invalid preview ID");
      await expect(
        readFile(path.join(root, "workspace.json")),
      ).rejects.toThrow();
    } finally {
      if (!path.resolve(root).startsWith(base + path.sep))
        throw new Error("Unsafe preview fixture cleanup");
      await rm(root, { recursive: true, force: true });
    }
  });
  it("requires materialised shared and CMS content before storing a preview", () => {
    const document = newDocument("Preview", "preview-fixture", false);
    expect(() =>
      createPrivatePreview(
        crypto.randomUUID(),
        { ...document, site: { useTheme: true } },
        24,
      ),
    ).toThrow("Resolve shared");
    document.data.content = [starterBlocks.ContentList()];
    expect(() => validatePreviewDocument(document)).toThrow("CMS content");
    document.data.content[0].props.records = [];
    expect(validatePreviewDocument(document)).toEqual(document);
  });
});
