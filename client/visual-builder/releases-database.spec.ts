import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  prepareReleaseRequest,
  validateReleaseSnapshot,
  type ReleaseRequest,
} from "../../shared/builderReleases";
import { initialSiteDesign } from "../../shared/builderSite";
import {
  clone,
  type Workspace,
  type BuilderPage,
} from "../../shared/visualBuilder";
import { newDocument, starterBlocks } from "./starters";

describe("frozen builder release PostgreSQL transactions", () => {
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
      "202609100008_builder_releases.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(`grant usage on schema public to anon,authenticated,service_role;
      insert into auth.users(id) values('${editor}'); insert into builder_editors(user_id) values('${editor}');`);
  }, 30_000);
  beforeEach(async () => {
    await db.exec(
      "reset role; truncate builder_release_head,builder_releases,builder_publications,builder_pages,builder_site,builder_assets; insert into builder_release_head(id) values('site');",
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
  async function result(sql: string, args: unknown[] = []) {
    const response = await db.query<{ result: any }>(
      `select ${sql} as result`,
      args,
    );
    return response.rows[0].result;
  }
  async function workspace(): Promise<Workspace> {
    return {
      pages: (
        await db.query<{ payload: BuilderPage }>(
          "select payload from builder_pages order by id",
        )
      ).rows.map((row) => row.payload),
      site: (
        await db.query<{ payload: Workspace["site"] }>(
          "select payload from builder_site",
        )
      ).rows[0]?.payload,
      assets: (
        await db.query<{ payload: Workspace["assets"][number] }>(
          "select payload from builder_assets order by id",
        )
      ).rows.map((row) => row.payload),
      saved: [],
    };
  }
  async function seed() {
    const design = initialSiteDesign();
    design.components = [
      {
        id: "header",
        name: "Shared header",
        kind: "header",
        blocks: [starterBlocks.Menu()],
      },
    ];
    await role("authenticated", async () => {
      await result("builder_save_site(0,$1::jsonb)", [JSON.stringify(design)]);
      for (const slug of ["release-one", "release-two", "release-three"])
        await result("builder_save_page($1::uuid,0,$2::jsonb)", [
          crypto.randomUUID(),
          JSON.stringify({
            ...newDocument(slug, slug, false),
            site: { useTheme: true, headerId: "header" },
          }),
        ]);
    });
    return workspace();
  }
  const queue = (
    input: ReleaseRequest,
    id = crypto.randomUUID(),
    actor = editor,
  ) =>
    role("service_role", () =>
      result("builder_queue_release($1::uuid,$2::uuid,$3::jsonb)", [
        id,
        actor,
        JSON.stringify(input),
      ]),
    );
  const claim = (id: string, owner: string, artifact = `artifact-${id}`) =>
    role("service_role", () =>
      result("builder_claim_release($1::uuid,$2::uuid,$3)", [
        id,
        owner,
        artifact,
      ]),
    );
  const advance = (
    id: string,
    owner: string,
    phase: string,
    proof: unknown = null,
    detail: string | null = null,
  ) =>
    role("service_role", () =>
      result("builder_advance_release($1::uuid,$2::uuid,$3,$4::jsonb,$5)", [
        id,
        owner,
        phase,
        proof === null ? null : JSON.stringify(proof),
        detail,
      ]),
    );
  const proof = (artifactId: string) => ({
    artifactId,
    manifestSha256: "a".repeat(64),
    checkedResponses: 5,
  });
  async function publish(input: ReleaseRequest) {
    const queued = await queue(input),
      owner = crypto.randomUUID();
    const claimed = await claim(queued.id, owner);
    await advance(queued.id, owner, "activating");
    await advance(queued.id, owner, "verifying");
    await advance(queued.id, owner, "live", proof(claimed.artifact_id));
    return { id: queued.id, owner, artifact: claimed.artifact_id };
  }
  it("keeps all three pages private until verified, and preserves drafts edited during deployment", async () => {
    const initial = await seed(),
      unchanged = clone(initial);
    const request = prepareReleaseRequest(initial, "site"),
      queued = await queue(request),
      owner = crypto.randomUUID();
    expect(initial).toEqual(unchanged);
    expect(await workspace()).toEqual(initial);
    expect(
      (
        await role("anon", () =>
          db.query("select document from builder_publications"),
        )
      ).rows,
    ).toEqual([]);
    const claimed = await claim(queued.id, owner);
    expect(validateReleaseSnapshot(claimed.snapshot).pages).toHaveLength(3);
    expect(JSON.stringify(claimed.snapshot.pages)).not.toContain(
      '"type":"Shared"',
    );
    const nextDocument = {
      ...initial.pages[0].draft,
      title: "Later private edit",
    };
    const nextDesign = {
      ...initial.site!.draft,
      theme: { ...initial.site!.draft.theme, accent: "#654321" },
    };
    await role("authenticated", async () => {
      await result("builder_save_page($1::uuid,1,$2::jsonb)", [
        initial.pages[0].id,
        JSON.stringify(nextDocument),
      ]);
      await result("builder_save_site(1,$1::jsonb)", [
        JSON.stringify(nextDesign),
      ]);
    });
    await advance(queued.id, owner, "activating");
    await advance(queued.id, owner, "verifying");
    expect(
      (await db.query("select document from builder_publications")).rows,
    ).toHaveLength(0);
    await expect(
      advance(queued.id, owner, "live", proof("another-artifact")),
    ).rejects.toThrow("another artifact");
    const live = await advance(
      queued.id,
      owner,
      "live",
      proof(claimed.artifact_id),
    );
    expect(live.live).toBe(true);
    expect(
      await advance(queued.id, owner, "live", proof(claimed.artifact_id)),
    ).toEqual(live);
    const saved = await workspace();
    expect(saved.pages[0].draft.title).toBe("Later private edit");
    expect(saved.pages[0].published!.title).toBe(initial.pages[0].draft.title);
    expect(saved.pages[0].version).toBe(2);
    expect(
      saved.pages[0].revisions[saved.pages[0].revisions.length - 1]?.label,
    ).toBe("Verified live release");
    expect(saved.site!.draft).toEqual(nextDesign);
    expect(saved.site!.published).toEqual(initial.site!.draft);
    expect(saved.site!.version).toBe(2);
    expect(
      (
        await role("anon", () =>
          db.query("select document from builder_publications"),
        )
      ).rows,
    ).toHaveLength(3);
  });
  it("makes request/claim retries idempotent, rejects competing workers and hides candidate/ownership data", async () => {
    const initial = await seed(),
      request = prepareReleaseRequest(initial, "site"),
      id = crypto.randomUUID();
    const first = await queue(request, id);
    expect(await queue(request, id)).toEqual(first);
    await expect(queue({ ...request, action: "deploy" }, id)).rejects.toThrow(
      "already used",
    );
    await expect(queue(request)).rejects.toThrow("Another release is pending");
    await expect(
      role("authenticated", () =>
        result("builder_queue_release($1::uuid,$2::uuid,$3::jsonb)", [
          crypto.randomUUID(),
          editor,
          JSON.stringify(request),
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);
    const owner = crypto.randomUUID(),
      claimed = await claim(id, owner);
    expect(await claim(id, owner)).toEqual(claimed);
    await expect(claim(id, crypto.randomUUID())).rejects.toThrow(
      "Another worker",
    );
    await expect(
      advance(id, crypto.randomUUID(), "activating"),
    ).rejects.toThrow("ownership mismatch");
    await expect(
      advance(id, owner, "live", proof(claimed.artifact_id)),
    ).rejects.toThrow("Invalid release status transition");
    const list = await role("authenticated", () =>
      result("builder_list_releases()"),
    );
    expect(list[0].status).toBe("building");
    for (const secret of [
      "snapshot",
      "baseline",
      "request",
      "worker_id",
      "evidence",
    ])
      expect(list[0]).not.toHaveProperty(secret);
    await expect(
      role("authenticated", () => db.query("select * from builder_releases")),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      role("anon", () => result("builder_list_releases()")),
    ).rejects.toThrow(/permission denied/i);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      crypto.randomUUID(),
    ]);
    await expect(
      role("authenticated", () => result("builder_list_releases()")),
    ).rejects.toThrow("editor access");
  });
  it("rejects stale pages, site, assets and non-editor requests before creating a release", async () => {
    const initial = await seed(),
      request = prepareReleaseRequest(initial, "site");
    await expect(
      queue(request, crypto.randomUUID(), crypto.randomUUID()),
    ).rejects.toThrow("editor access");
    const stale = clone(request);
    stale.expected.pages[initial.pages[0].id] = 0;
    await expect(queue(stale)).rejects.toThrow("workspace changed");
    stale.expected = clone(request.expected);
    stale.expected.site!.version = 0;
    await expect(queue(stale)).rejects.toThrow("workspace changed");
    await db.query(
      "insert into builder_assets(id,hash,payload) values($1,'hash',$2::jsonb)",
      [
        crypto.randomUUID(),
        JSON.stringify({ name: "Added during preparation" }),
      ],
    );
    await expect(queue(request)).rejects.toThrow("workspace changed");
    expect((await db.query("select id from builder_releases")).rows).toEqual(
      [],
    );
  });
  it("keeps failures out of later builds and disallows legacy publication during an active release", async () => {
    await publish(prepareReleaseRequest(await seed(), "site"));
    const initial = await workspace(),
      page = initial.pages[0];
    page.draft.title = "Candidate that must not leak";
    await role("authenticated", () =>
      result("builder_save_page($1::uuid,$2,$3::jsonb)", [
        page.id,
        page.version,
        JSON.stringify(page.draft),
      ]),
    );
    const queued = await queue(
        prepareReleaseRequest(await workspace(), "page", page.id),
      ),
      owner = crypto.randomUUID();
    await expect(
      role("service_role", () =>
        result("builder_publish_page($1::uuid,$2)", [
          page.id,
          page.version + 1,
        ]),
      ),
    ).rejects.toThrow("pending release");
    const baseline = await result("builder_live_snapshot()");
    await claim(queued.id, owner);
    await advance(
      queued.id,
      owner,
      "failed",
      null,
      "Build failed. Correct the component and publish again.",
    );
    expect(await result("builder_live_snapshot()")).toEqual(baseline);
    const later = await queue(
      prepareReleaseRequest(await workspace(), "deploy"),
    );
    const frozen = await claim(later.id, crypto.randomUUID());
    expect(frozen.snapshot).toEqual(baseline);
    expect(JSON.stringify(frozen.snapshot)).not.toContain(
      "Candidate that must not leak",
    );
  });
  it("reconciles an exact retained rollback without overwriting current drafts, then supports unpublishing", async () => {
    const first = await publish(prepareReleaseRequest(await seed(), "site"));
    const firstSnapshot = await result("builder_live_snapshot()"),
      initial = await workspace();
    const page = initial.pages[0];
    page.draft.title = "Second published revision";
    await role("authenticated", () =>
      result("builder_save_page($1::uuid,$2,$3::jsonb)", [
        page.id,
        page.version,
        JSON.stringify(page.draft),
      ]),
    );
    await publish(prepareReleaseRequest(await workspace(), "page", page.id));
    const rollbackId = crypto.randomUUID(),
      owner = crypto.randomUUID();
    await role("service_role", () =>
      result("builder_queue_rollback($1::uuid,$2::uuid,$3::uuid)", [
        rollbackId,
        editor,
        first.id,
      ]),
    );
    await expect(claim(rollbackId, owner, "rebuilt-artifact")).rejects.toThrow(
      "original retained artifact",
    );
    expect((await claim(rollbackId, owner, first.artifact)).snapshot).toEqual(
      firstSnapshot,
    );
    await advance(rollbackId, owner, "activating");
    await advance(rollbackId, owner, "verifying");
    await advance(rollbackId, owner, "live", proof(first.artifact));
    expect(await result("builder_live_snapshot()")).toEqual(firstSnapshot);
    expect((await workspace()).pages[0].draft.title).toBe(
      "Second published revision",
    );
    await publish(
      prepareReleaseRequest(await workspace(), "unpublish", page.id),
    );
    expect(
      (await db.query("select document from builder_publications")).rows,
    ).toHaveLength(2);
    const after = (await workspace()).pages[0];
    expect(after.published).toBeNull();
    expect(after.draft.title).toBe("Second published revision");
  });
  it("holds uncertain recovery until the owning worker supplies evidence for the previous artifact", async () => {
    const first = await publish(prepareReleaseRequest(await seed(), "site"));
    const queued = await queue(
        prepareReleaseRequest(await workspace(), "deploy"),
      ),
      owner = crypto.randomUUID();
    const claimed = await claim(queued.id, owner);
    await advance(queued.id, owner, "activating");
    await advance(
      queued.id,
      owner,
      "recovery_required",
      null,
      "Nginx recovery could not be verified. Inspect the worker transaction.",
    );
    await expect(
      queue(prepareReleaseRequest(await workspace(), "deploy")),
    ).rejects.toThrow("Another release is pending");
    await expect(
      advance(
        queued.id,
        owner,
        "rolled_back",
        proof(claimed.artifact_id),
        "Recovery checked",
      ),
    ).rejects.toThrow("previous live artifact");
    await advance(
      queued.id,
      owner,
      "rolled_back",
      proof(first.artifact),
      "Previous release restored and checked",
    );
    expect(
      (
        await role("authenticated", () => result("builder_list_releases()"))
      ).find((r: any) => r.id === first.id).live,
    ).toBe(true);
    await queue(prepareReleaseRequest(await workspace(), "deploy"));
  });
  it("fails an unclaimed dispatch idempotently, but cannot cancel a claimed worker", async () => {
    const input = prepareReleaseRequest(await seed(), "site"),
      first = await queue(input);
    const fail = (id: string) =>
      role("service_role", () =>
        result("builder_fail_queued_release($1::uuid,$2)", [
          id,
          "GitHub declined the deployment request. Check the configured token.",
        ]),
      );
    expect((await fail(first.id)).status).toBe("failed");
    expect((await fail(first.id)).status).toBe("failed");
    const second = await queue(input);
    await claim(second.id, crypto.randomUUID());
    await expect(fail(second.id)).rejects.toThrow("already claimed");
  });
  it("reserves rollback URLs while allowing ordinary draft autosave after live promotion", async () => {
    const first = await publish(prepareReleaseRequest(await seed(), "site"));
    const initial = await workspace(),
      page = initial.pages[0],
      oldSlug = page.draft.slug;
    const moved = { ...page.draft, slug: "moved-campaign" };
    const saved = await role("authenticated", () =>
      result("builder_save_page($1::uuid,$2,$3::jsonb)", [
        page.id,
        page.version,
        JSON.stringify(moved),
      ]),
    );
    await publish(prepareReleaseRequest(await workspace(), "page", page.id));
    // Same draft version is still usable after publication; the new live snapshot survives autosave.
    const autosaved = await role("authenticated", () =>
      result("builder_save_page($1::uuid,$2,$3::jsonb)", [
        page.id,
        saved.version,
        JSON.stringify({ ...moved, title: "Keep this private" }),
      ]),
    );
    expect(autosaved.published.slug).toBe("moved-campaign");
    expect(autosaved.published.title).not.toBe("Keep this private");
    await role("service_role", () =>
      result("builder_queue_rollback($1::uuid,$2::uuid,$3::uuid)", [
        crypto.randomUUID(),
        editor,
        first.id,
      ]),
    );
    await expect(
      role("authenticated", () =>
        result("builder_save_page($1::uuid,0,$2::jsonb)", [
          crypto.randomUUID(),
          JSON.stringify(newDocument("Conflicting draft", oldSlug, false)),
        ]),
      ),
    ).rejects.toThrow("reserved by a pending release");
  });
  it("queues ordinary code/CMS builds from verified publications and cannot bypass a pending editor release", async () => {
    const request = prepareReleaseRequest(await seed(), "site");
    const queued = await queue(request);
    const deploy = (id: string) =>
      role("service_role", () =>
        result("builder_queue_deployment($1::uuid)", [id]),
      );
    await expect(deploy(crypto.randomUUID())).rejects.toThrow(
      "Another release is pending",
    );
    await role("service_role", () =>
      result("builder_fail_queued_release($1::uuid,$2)", [
        queued.id,
        "Dispatch declined. Check the configuration.",
      ]),
    );
    const id = crypto.randomUUID(),
      normal = await deploy(id);
    expect(await deploy(id)).toEqual(normal);
    expect((await claim(id, crypto.randomUUID())).snapshot.pages).toEqual([]);
  });
});
