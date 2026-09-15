import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  readFile,
  readdir,
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import {
  HostedUploads,
  hostedUploadId,
} from "../../scripts/builder-hosted-uploads";
import { UploadSpool } from "../../scripts/builder-upload-spool";
import { AssetCleanupWorker } from "../../scripts/builder-asset-cleanup";
import { NativeAssetCleanup } from "../../scripts/builder-native-asset-cleanup";
import { startUploadHost } from "../../scripts/builder-upload-host";
import { HostedUploadConnection } from "./hostedUploads";
import type { Asset } from "../../shared/visualBuilder";
import { projectAssetUrl } from "../../shared/builderProjectOperations";
import { copyFileThroughUploadService } from "../../supabase/functions/_shared/builderCopyUploads";

let db: PGlite, project: string;
const spoolRoots: string[] = [];
const beta = "11111111-1111-4111-8111-111111111111",
  alice = "22222222-2222-4222-8222-222222222222",
  bob = "33333333-3333-4333-8333-333333333333";
const worker = "fixture-upload-worker",
  hash = "a".repeat(64);
const legacyAsset = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  size: 40,
  hash: "b".repeat(64),
  mime: "image/png",
  kind: "image",
  url: "https://fixture.supabase.co/storage/v1/object/public/builder-media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Existing file",
  pack: "Legacy",
  path: "existing.png",
};
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id),metadata jsonb default '{}',version text default 'fixture-version');
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create table public.contact_form_submissions(name text,last_name text,email text,phone text,website text,message text,marketing_consent boolean,consent_to_gdpr boolean,source_page text,user_agent text);
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
    insert into auth.users(id,email,email_confirmed_at) values('${beta}','beta@example.test',now());`);
  const skipped = new Set([
    "202609120003_builder_error_retention.sql",
    "202609140002_builder_function_limit_retention.sql",
    "202609140005_builder_privacy_retention.sql",
    "202609150008_builder_billing_retention.sql",
  ]);
  for (const file of (await readdir("supabase/migrations")).sort()) {
    if (
      !/^\d+_(?:visual_builder|builder_.*)\.sql$/.test(file) ||
      skipped.has(file)
    )
      continue;
    if (file === "202609150010_builder_uploads.sql")
      await db.exec(
        `insert into storage.objects(bucket_id,name,metadata) values('builder-media','${legacyAsset.id}','{"size":40,"eTag":"old"}');`,
      );
    if (file === "202609150012_builder_asset_files.sql")
      await db.query(
        "insert into builder_assets(id,hash,payload) values($1,$2,$3)",
        [legacyAsset.id, legacyAsset.hash, legacyAsset],
      );
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    if (file === "202609100001_visual_builder.sql")
      await db.exec(`insert into builder_editors(user_id) values('${beta}');`);
  }
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`begin; insert into auth.users(id,email,email_confirmed_at) values('${alice}','alice@example.test',now()),('${bob}','bob@example.test',now());
    insert into builder_legal_acceptances(user_id,version) select id,'2026-09-14' from auth.users;`);
  project = (
    await as(
      "authenticated",
      alice,
      "select builder_create_project('Upload fixture') as id",
    )
  )[0].id;
});
afterEach(async () => {
  await db.exec("rollback");
  for (const root of spoolRoots.splice(0))
    await rm(root, { recursive: true, force: true });
});

it("refuses direct builder Storage writes even with an unrelated permissive policy", async () => {
  // These rows stand in for provider metadata; production writes use its API.
  await db.exec(`grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
    create policy fixture_unrelated_storage_write on storage.objects for all to anon,authenticated using (true) with check (true);`);
  for (const [bucket, actor] of [
    ["builder-media", beta],
    ["builder-source", beta],
    ["builder-project-files", alice],
  ]) {
    const name =
      bucket === "builder-project-files"
        ? `${project}/${randomUUID()}`
        : randomUUID();
    for (const role of ["anon", "authenticated"]) {
      await expect(
        as(
          role,
          actor,
          "insert into storage.objects(bucket_id,name) values($1,$2)",
          [bucket, name],
        ),
      ).rejects.toThrow(/row-level security/);
    }
    await as(
      "service_role",
      null,
      "insert into storage.objects(bucket_id,name) values($1,$2)",
      [bucket, name],
    );
    for (const role of ["anon", "authenticated"]) {
      expect(
        await as(
          role,
          actor,
          "update storage.objects set name='replaced' where bucket_id=$1 and name=$2 returning id",
          [bucket, name],
        ),
      ).toEqual([]);
      expect(
        await as(
          role,
          actor,
          "delete from storage.objects where bucket_id=$1 and name=$2 returning id",
          [bucket, name],
        ),
      ).toEqual([]);
    }
  }
  await as(
    "authenticated",
    alice,
    "insert into storage.objects(bucket_id,name) values('other-application','fixture')",
  );
  await expect(
    as(
      "authenticated",
      alice,
      "update storage.objects set bucket_id='builder-media' where bucket_id='other-application' returning id",
    ),
  ).rejects.toThrow(/row-level security/);
  expect(
    await as(
      "authenticated",
      alice,
      "update storage.objects set name='renamed' where bucket_id='other-application' returning name",
    ),
  ).toEqual([{ name: "renamed" }]);
  expect(
    await as(
      "authenticated",
      alice,
      "delete from storage.objects where bucket_id='other-application' returning name",
    ),
  ).toEqual([{ name: "renamed" }]);
});

it("preserves member reads and private project boundaries after upload cutover", async () => {
  await db.exec(
    "grant select,insert,update,delete on storage.objects to anon,authenticated",
  );
  const name = `${project}/${randomUUID()}`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('builder-project-files',$1)",
    [name],
  );
  expect(
    await as(
      "authenticated",
      alice,
      "select name from storage.objects where name=$1",
      [name],
    ),
  ).toEqual([{ name }]);
  for (const [role, actor] of [
    ["authenticated", bob],
    ["anon", ""],
  ])
    expect(
      await as(role, actor, "select name from storage.objects where name=$1", [
        name,
      ]),
    ).toEqual([]);
  expect(
    await as(
      "authenticated",
      beta,
      "select name from storage.objects where bucket_id='builder-media'",
    ),
  ).toEqual([{ name: legacyAsset.id }]);
  await db.query("update builder_projects set archived=true where id=$1", [
    project,
  ]);
  expect(
    await as(
      "authenticated",
      alice,
      "select name from storage.objects where name=$1",
      [name],
    ),
  ).toEqual([{ name }]);
});
async function as(
  role: string,
  actor: string | null,
  query: string,
  args: any[] = [],
): Promise<any[]> {
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",
    [actor || "", role],
  );
  await db.exec(`set role ${role}; savepoint upload_test`);
  try {
    return (await db.query(query, args)).rows;
  } catch (error) {
    await db.exec("rollback to savepoint upload_test");
    throw error;
  } finally {
    await db.exec("release savepoint upload_test; reset role");
  }
}
const rpc = async (name: string, args: any[]) =>
  (
    await as(
      "service_role",
      null,
      `select ${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
      args,
    )
  )[0].value;
const reserve = (bytes = 10, options: any = {}) =>
  rpc("builder_upload_reserve", [
    options.project || project,
    options.actor || alice,
    options.id || randomUUID(),
    options.asset || randomUUID(),
    bytes,
    options.hash || hash,
    options.mime || "image/png",
    options.kind || "image",
    options.worker || worker,
  ]);
const claim = (
  upload: any,
  token = randomUUID(),
  previous: string | null = null,
  cleanup = false,
) => rpc("builder_upload_claim", [upload.id, worker, token, previous, cleanup]);
const usage = async (target = project) =>
  (
    await db.query<any>(
      "select * from builder_project_billing where project_id=$1",
      [target],
    )
  ).rows[0];
async function storedObject(
  upload: any,
  bytes = upload.bytes,
  version = "fixture-version",
) {
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata,version) values($1,$2,$3,$4)",
    [
      upload.bucket_id,
      upload.object_name,
      JSON.stringify({ size: bytes, eTag: "fixture-etag" }),
      version,
    ],
  );
}
const evidence = (upload: any) => ({
  id: upload.id,
  attemptId: upload.owner_token,
  bytes: upload.bytes,
  sha256: upload.sha256,
  version: "fixture-version",
  etag: "fixture-etag",
  verifiedAt: new Date().toISOString(),
});
async function storing(upload: any) {
  return rpc("builder_upload_assert", [
    upload.id,
    worker,
    upload.owner_token,
    alice,
    true,
  ]);
}

it("backfills unregistered provider objects and reserves space before bytes are accepted", async () => {
  expect(await usage("kaizen")).toMatchObject({
    workspace_bytes: 40,
    storage_bytes: 40,
    registered_bytes: 40,
  });
  const upload = await reserve(60);
  expect(upload).toMatchObject({
    projectId: project,
    bytes: 60,
    status: "reserved",
  });
  expect(JSON.stringify(upload)).not.toMatch(
    /owner_token|bucket_id|worker_id|object_name/,
  );
  expect(await usage()).toMatchObject({
    workspace_bytes: 0,
    storage_bytes: 60,
    registered_bytes: 60,
  });
  expect(
    (
      await db.query(
        "select * from storage.objects where bucket_id='builder-project-files'",
      )
    ).rows,
  ).toHaveLength(0);
});

it("refuses an upload that would exceed the account and never frees capacity just because time passed", async () => {
  await db.exec("update builder_plans set storage_bytes=100 where id='free';");
  const first = await reserve(60);
  await expect(reserve(41)).rejects.toThrow("storage limit");
  await db.exec(
    "update builder_uploads set created_at=now()-interval '30 days',updated_at=now()-interval '30 days';",
  );
  await expect(reserve(41)).rejects.toThrow("storage limit");
  await rpc("builder_upload_cancel", [project, alice, first.id]);
  await expect(reserve(41)).rejects.toThrow("storage limit");
  expect((await usage()).storage_bytes).toBe(60);
});

it("counts physical unregistered objects and declared workspace data without counting one file twice", async () => {
  await db.exec("update builder_plans set storage_bytes=100 where id='free';");
  const upload = await storing(await claim(await reserve(60)));
  await storedObject(upload);
  await rpc("builder_upload_finish", [
    upload.id,
    worker,
    upload.owner_token,
    evidence(upload),
  ]);
  await as(
    "service_role",
    null,
    "select builder_commit_project_workspace($1,$2,0,$3)",
    [
      project,
      alice,
      JSON.stringify({
        pages: [],
        assets: [
          {
            id: upload.asset_id,
            size: 60,
            hash: upload.sha256,
            mime: upload.mime,
            kind: upload.asset_kind,
            url: projectAssetUrl(project, upload.asset_id),
          },
        ],
        saved: [],
      }),
    ],
  );
  expect(await usage()).toMatchObject({
    workspace_bytes: 60,
    storage_bytes: 60,
    registered_bytes: 60,
  });
  await reserve(40);
  expect((await usage()).registered_bytes).toBe(100);
  await expect(reserve(1)).rejects.toThrow("storage limit");
  // Removing metadata alone does not remove the stored object or release bytes.
  await as(
    "service_role",
    null,
    "select builder_commit_project_workspace($1,$2,1,$3)",
    [project, alice, JSON.stringify({ pages: [], assets: [], saved: [] })],
  );
  expect(await usage()).toMatchObject({
    workspace_bytes: 0,
    storage_bytes: 100,
    registered_bytes: 100,
  });
});

it("reconciles provider objects not registered by a client and rejects unverifiable size metadata", async () => {
  await db.exec("update builder_plans set storage_bytes=100 where id='free';");
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('builder-project-files',$1,'{\"size\":80}')",
    [`${project}/${randomUUID()}`],
  );
  await expect(reserve(21)).rejects.toThrow("storage limit");
  await reserve(20);
  expect((await usage()).registered_bytes).toBe(100);
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('builder-project-files',$1,'{}')",
    [`${project}/${randomUUID()}`],
  );
  await expect(reserve(1)).rejects.toThrow("usage needs to be verified");
});

it("binds idempotency to the account, project and immutable file", async () => {
  const id = randomUUID(),
    asset = randomUUID();
  const first = await reserve(10, { id, asset });
  expect(await reserve(10, { id, asset })).toEqual(first);
  expect((await usage()).registered_bytes).toBe(10);
  for (const change of [
    { asset: randomUUID() },
    { hash: "b".repeat(64) },
    { mime: "image/jpeg" },
    { worker: "other" },
  ])
    await expect(reserve(10, { id, asset, ...change })).rejects.toThrow(
      "different file",
    );
  await expect(reserve(11, { id, asset })).rejects.toThrow("different file");
  await expect(reserve(10, { asset })).rejects.toThrow("different file");
  await expect(reserve(10, { id, asset, actor: bob })).rejects.toThrow(
    "website access",
  );
});

it("keeps every ledger mutation and worker field private", async () => {
  const upload = await reserve();
  for (const role of ["anon", "authenticated", "service_role"])
    await expect(
      as(role, alice, "select * from builder_uploads"),
    ).rejects.toThrow("permission denied");
  for (const role of ["anon", "authenticated"])
    await expect(
      as(role, alice, "select builder_upload_claim($1,$2,$3)", [
        upload.id,
        worker,
        randomUUID(),
      ]),
    ).rejects.toThrow("permission denied");
  await expect(
    as("service_role", null, "select builder_storage_sync($1)", [project]),
  ).rejects.toThrow("permission denied");
  await expect(
    rpc("builder_upload_read", [project, bob, upload.id]),
  ).rejects.toThrow("website access");
});

it("requires exact worker recovery and refuses old callbacks or writes after storing starts", async () => {
  const upload = await claim(await reserve());
  await expect(claim(upload)).rejects.toThrow("existing upload worker");
  await expect(
    rpc("builder_upload_claim", [upload.id, "other", randomUUID()]),
  ).rejects.toThrow("Configured upload worker");
  const recovered = await claim(upload, randomUUID(), upload.owner_token);
  await expect(
    rpc("builder_upload_assert", [
      upload.id,
      worker,
      upload.owner_token,
      alice,
    ]),
  ).rejects.toThrow("no longer owns");
  await storing(recovered);
  await expect(
    rpc("builder_upload_assert", [
      upload.id,
      worker,
      recovered.owner_token,
      alice,
    ]),
  ).rejects.toThrow("already being stored");
});

it("requires actual matching provider bytes/version and fresh worker verification before storing", async () => {
  const upload = await storing(await claim(await reserve(12)));
  const receipt = evidence(upload);
  await expect(
    rpc("builder_upload_finish", [
      upload.id,
      worker,
      upload.owner_token,
      receipt,
    ]),
  ).rejects.toThrow("stored file changed");
  await storedObject(upload, 13);
  await expect(
    rpc("builder_upload_finish", [
      upload.id,
      worker,
      upload.owner_token,
      receipt,
    ]),
  ).rejects.toThrow("stored file changed");
  await db.query("update storage.objects set metadata=$1 where name=$2", [
    JSON.stringify({ size: 12, eTag: "fixture-etag" }),
    upload.object_name,
  ]);
  await expect(
    rpc("builder_upload_finish", [
      upload.id,
      worker,
      upload.owner_token,
      { ...receipt, version: "other" },
    ]),
  ).rejects.toThrow("stored file changed");
  await expect(
    rpc("builder_upload_finish", [
      upload.id,
      worker,
      upload.owner_token,
      { ...receipt, sha256: "b".repeat(64) },
    ]),
  ).rejects.toThrow("Verified stored file");
  await expect(
    rpc("builder_upload_finish", [
      upload.id,
      worker,
      upload.owner_token,
      { ...receipt, verifiedAt: "2020-01-01T00:00:00Z" },
    ]),
  ).rejects.toThrow("Fresh stored file");
  const result = await rpc("builder_upload_finish", [
    upload.id,
    worker,
    upload.owner_token,
    receipt,
  ]);
  expect(result.status).toBe("stored");
  expect(
    await rpc("builder_upload_finish", [
      upload.id,
      worker,
      upload.owner_token,
      receipt,
    ]),
  ).toEqual(result);
  expect((await usage()).storage_bytes).toBe(12);
  expect(
    (await rpc("builder_upload_cancel", [project, alice, upload.id]))
      .cancelRequested,
  ).toBe(false);
});

it("keeps cancelled space charged until both local/provider removal are confirmed, even after lost access", async () => {
  const upload = await claim(await reserve(30));
  await storedObject(upload);
  await rpc("builder_upload_cancel", [project, alice, upload.id]);
  await expect(storing(upload)).rejects.toThrow("no longer owns");
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    alice,
  ]);
  await claim(upload, upload.owner_token, null, true);
  const receipt = {
    id: upload.id,
    attemptId: upload.owner_token,
    localRemoved: true,
    providerRemoved: true,
    verifiedAt: new Date().toISOString(),
  };
  await expect(
    rpc("builder_upload_remove_finish", [
      upload.id,
      worker,
      upload.owner_token,
      { ...receipt, localRemoved: false },
    ]),
  ).rejects.toThrow("Verified upload removal");
  await expect(
    rpc("builder_upload_remove_finish", [
      upload.id,
      worker,
      upload.owner_token,
      receipt,
    ]),
  ).rejects.toThrow("Confirm the stored file");
  expect((await usage()).storage_bytes).toBe(30);
  // This SQL operation represents the fixture Storage API's completed removal.
  await db.query("delete from storage.objects where name=$1", [
    upload.object_name,
  ]);
  expect(
    (
      await rpc("builder_upload_remove_finish", [
        upload.id,
        worker,
        upload.owner_token,
        receipt,
      ])
    ).status,
  ).toBe("removed");
  expect((await usage()).storage_bytes).toBe(0);
});

it("moves all reserved space during billing transfer and preserves it across downgrade or archive", async () => {
  await reserve(30);
  await as(
    "authenticated",
    alice,
    "select builder_set_project_member($1,$2,'owner',true)",
    [project, bob],
  );
  await rpc("builder_take_project_billing", [project, bob]);
  expect(
    (
      await db.query<any>(
        "select user_id,registered_bytes from builder_billing_accounts where user_id in ($1,$2) order by user_id",
        [alice, bob],
      )
    ).rows,
  ).toEqual([
    { user_id: alice, registered_bytes: 0 },
    { user_id: bob, registered_bytes: 30 },
  ]);
  await db.exec("update builder_plans set storage_bytes=20 where id='free';");
  await expect(reserve(1, { actor: bob })).rejects.toThrow("storage limit");
  expect((await usage()).registered_bytes).toBe(30);
  await db.query("update builder_projects set archived=true where id=$1", [
    project,
  ]);
  await expect(reserve()).rejects.toThrow("website access");
  expect((await usage()).registered_bytes).toBe(30);
});

it("bounds pending upload count independently of small claimed byte lengths", async () => {
  for (let i = 0; i < 20; i++) await reserve(1);
  await expect(reserve(1)).rejects.toThrow("pending upload");
  expect((await usage()).storage_bytes).toBe(20);
});

it("binds an upload retry to its original asset kind even when the bucket is unchanged", async () => {
  const options = { id: randomUUID(), asset: randomUUID(), kind: "image" };
  const original = await reserve(10, options);
  await expect(reserve(10, { ...options, kind: "font" })).rejects.toThrow(
    "different file or account",
  );
  expect(await reserve(10, options)).toEqual(original);
  expect((await usage()).storage_bytes).toBe(10);
});

it("accepts only the identical stored completion receipt after a lost reply", async () => {
  const upload = await storing(await claim(await reserve(12)));
  await storedObject(upload);
  const receipt = evidence(upload);
  const finish = (value: unknown) =>
    rpc("builder_upload_finish", [
      upload.id,
      worker,
      upload.owner_token,
      value,
    ]);
  await expect(finish({ ...receipt, bytes: "12" })).rejects.toThrow(
    "Verified stored file",
  );
  const completed = await finish(receipt);
  for (const changed of [
    null,
    { ...receipt, id: randomUUID() },
    { ...receipt, attemptId: randomUUID() },
    { ...receipt, verifiedAt: "2020-01-01T00:00:00Z" },
    { ...receipt, unexpected: true },
    { ...receipt, bytes: "12" },
  ]) {
    await expect(finish(changed)).rejects.toThrow(
      "Completed upload evidence changed",
    );
  }
  expect(await finish(receipt)).toEqual(completed);
  expect((await usage()).storage_bytes).toBe(12);
});

it("accepts only the identical removal receipt without releasing capacity twice", async () => {
  const reserved = await reserve(12);
  await rpc("builder_upload_cancel", [project, alice, reserved.id]);
  const upload = await claim(reserved, randomUUID(), null, true);
  const receipt = {
    id: upload.id,
    attemptId: upload.owner_token,
    localRemoved: true,
    providerRemoved: true,
    verifiedAt: new Date().toISOString(),
  };
  const finish = (value: unknown) =>
    rpc("builder_upload_remove_finish", [
      upload.id,
      worker,
      upload.owner_token,
      value,
    ]);
  const completed = await finish(receipt);
  for (const changed of [
    null,
    { ...receipt, id: randomUUID() },
    { ...receipt, attemptId: randomUUID() },
    { ...receipt, localRemoved: false },
    { ...receipt, providerRemoved: false },
    { ...receipt, unexpected: true },
    { ...receipt, verifiedAt: null },
  ]) {
    await expect(finish(changed)).rejects.toThrow(
      "Completed upload removal evidence changed",
    );
  }
  expect(await finish(receipt)).toEqual(completed);
  expect((await usage()).storage_bytes).toBe(0);
});

it("limits durable worker recovery reads to its worker and the original active uploader", async () => {
  const upload = await claim(await reserve(10));
  expect(
    await rpc("builder_upload_worker_read", [upload.id, worker, alice]),
  ).toMatchObject({
    id: upload.id,
    actor_id: alice,
    owner_token: upload.owner_token,
  });
  await expect(
    rpc("builder_upload_worker_read", [upload.id, "wrong-worker", alice]),
  ).rejects.toThrow("Configured upload worker");
  await expect(
    rpc("builder_upload_worker_read", [upload.id, worker, bob]),
  ).rejects.toThrow("original account");
  for (const role of ["anon", "authenticated"]) {
    await expect(
      as(role, alice, "select builder_upload_worker_read($1,$2,$3)", [
        upload.id,
        worker,
        alice,
      ]),
    ).rejects.toThrow("permission denied");
  }
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    alice,
  ]);
  await expect(
    rpc("builder_upload_worker_read", [upload.id, worker, alice]),
  ).rejects.toThrow("confirmed, active account");
  // Actor-less service recovery must still reconcile abandoned data after access ends.
  expect(
    await rpc("builder_upload_worker_read", [upload.id, worker, null]),
  ).toMatchObject({ id: upload.id, owner_token: upload.owner_token });
});

async function hostedFixture(target = project) {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-hosted-upload-"));
  spoolRoots.push(root);
  const spool = await UploadSpool.create(root, {
    bytes: 1024 ** 2,
    files: 10,
    freeBytes: 0,
  });
  const file = {
    projectId: target,
    assetId: randomUUID(),
    bytes: 13,
    sha256: createHash("sha256").update("fixture bytes").digest("hex"),
    mime: "image/png",
    kind: "image",
  };
  const id = hostedUploadId(target, file.assetId),
    stored = new Map<string, Buffer>();
  const controls = {
    loseFinishReply: false,
    failRemoval: false,
    failFinish: false,
    revokeDuringVerify: false,
    failCleanupAck: false,
    failProviderRemoval: false,
    failAssetFinish: false,
    loseAssetFinishReply: false,
    failAssetAck: false,
    failDiscoveryFinish: false,
    loseDiscoveryFinishReply: false,
    changeDiscoveryVersion: false,
    revokeAfterStore: false,
    writes: 0,
  };
  const receipt = (item: any) => ({
    bytes: item.bytes,
    sha256: item.sha256,
    version: "fixture-version",
    etag: "fixture-etag",
  });
  const providerKey = (item: {
    project_id: string;
    asset_id: string;
    bucket_id: string;
    object_name: string;
  }) =>
    item.object_name ===
    (item.project_id === "kaizen"
      ? item.asset_id
      : `${item.project_id}/${item.asset_id}`)
      ? hostedUploadId(item.project_id, item.asset_id)
      : `${item.bucket_id}/${item.object_name}`;
  const services: ConstructorParameters<typeof HostedUploads>[0] = {
    workerId: worker,
    spool,
    origins: ["https://builder.example.test"],
    access: {
      verify: async (token) => {
        if (![alice, bob].includes(token))
          throw new Error("invalid fixture sign-in");
        return { id: token, expiresAt: Date.now() + 60000 };
      },
    },
    rpc: async (name, args) => {
      if (name === "builder_upload_finish" && controls.failFinish)
        throw new Error("fixture unavailable");
      if (name === "builder_upload_remove_finish" && controls.failRemoval)
        throw new Error("fixture unavailable");
      if (name === "builder_upload_cleanup_ack" && controls.failCleanupAck)
        throw new Error("fixture unavailable");
      if (name === "builder_asset_cleanup_finish" && controls.failAssetFinish)
        throw new Error("fixture unavailable");
      if (name === "builder_asset_cleanup_ack" && controls.failAssetAck)
        throw new Error("fixture unavailable");
      if (
        name === "builder_asset_discovery_finish" &&
        controls.failDiscoveryFinish
      )
        throw new Error("fixture unavailable");
      if (
        name === "builder_asset_discovery_finish" &&
        controls.changeDiscoveryVersion
      )
        await db.query(
          "update storage.objects set version='changed-during-discovery' where bucket_id='builder-project-files' and name=$1",
          [`${target}/${file.assetId}`],
        );
      const entries = Object.entries(args);
      if (
        !/^builder_(?:upload|asset|native|project_copy)_[a-z_]+$/.test(name) ||
        entries.some(([key]) => !/^[a-z_]+$/.test(key))
      )
        throw new Error("Invalid fixture RPC");
      const value = (
        await as(
          "service_role",
          null,
          `select ${name}(${entries.map(([key], index) => `${key}=>$${index + 1}`).join(",")}) as value`,
          entries.map(([, value]) => value),
        )
      )[0].value;
      if (name === "builder_upload_finish" && controls.loseFinishReply)
        throw new Error("fixture lost reply");
      if (
        name === "builder_asset_cleanup_finish" &&
        controls.loseAssetFinishReply
      )
        throw new Error("fixture lost reply");
      if (
        name === "builder_asset_discovery_finish" &&
        controls.loseDiscoveryFinishReply
      )
        throw new Error("fixture lost reply");
      return value;
    },
    provider: {
      inspect: async (item) =>
        stored.has(providerKey(item)) ? receipt(item) : null,
      measure: async (item) => {
        const bytes = stored.get(providerKey(item));
        if (!bytes) return null;
        if (bytes.length !== item.bytes)
          throw new Error("fixture object mismatch");
        return {
          ...receipt(item),
          sha256: createHash("sha256").update(bytes).digest("hex"),
          mime: file.mime,
        };
      },
      verify: async (item) => {
        const value = stored.get(providerKey(item));
        if (
          !value ||
          value.length !== item.bytes ||
          createHash("sha256").update(value).digest("hex") !== item.sha256
        )
          throw new Error("fixture object mismatch");
        if (controls.revokeDuringVerify)
          await db.query(
            "update auth.users set email_confirmed_at=null where id=$1",
            [alice],
          );
        return receipt(item);
      },
      ensure: async (item, source) => {
        const bytes = await readFile(source);
        expect(bytes.length).toBe(item.bytes);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(
          item.sha256,
        );
        if (!stored.has(item.id)) {
          await storedObject(item);
          stored.set(item.id, bytes);
          controls.writes++;
        }
        if (controls.revokeAfterStore)
          await db.query(
            "update auth.users set email_confirmed_at=null where id=$1",
            [alice],
          );
        return receipt(item);
      },
      remove: async (item) => {
        if (controls.failProviderRemoval)
          throw new Error("fixture provider unavailable");
        const key = providerKey(item),
          bytes = stored.get(key);
        if (
          bytes &&
          (bytes.length !== item.bytes ||
            createHash("sha256").update(bytes).digest("hex") !== item.sha256)
        )
          throw new Error("fixture object mismatch");
        await db.query(
          "delete from storage.objects where bucket_id=$1 and name=$2",
          [item.bucket_id, item.object_name],
        );
        stored.delete(key);
      },
    },
  };
  const service = new HostedUploads(services);
  const send = (
    method: string,
    suffix: string,
    body?: string,
    extra: Record<string, string> = {},
    actor = alice,
  ) =>
    service.handle(
      new Request(`https://builder.example.test/editor-uploads${suffix}`, {
        method,
        headers: {
          Authorization: `Bearer ${actor}`,
          Origin: "https://builder.example.test",
          "Tus-Resumable": "1.0.0",
          ...extra,
        },
        ...(body === undefined ? {} : { body }),
      }),
    );
  const start = (value = file, actor = alice) =>
    send(
      "POST",
      "",
      undefined,
      {
        "Upload-Length": String(value.bytes),
        "Upload-Metadata": `file ${Buffer.from(JSON.stringify(value)).toString("base64")}`,
      },
      actor,
    );
  const patch = (offset: number, body: string, actor = alice) =>
    send(
      "PATCH",
      `/${id}`,
      body,
      {
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      actor,
    );
  return {
    service,
    services,
    spool,
    file,
    id,
    controls,
    start,
    send,
    patch,
    stored,
  };
}

it("runs authenticated reservation, TUS transfer and verified finish against the actual quota migration", async () => {
  const api = await hostedFixture();
  const created = await api.start();
  expect(created.status).toBe(201);
  expect(created.headers.get("location")).toBe(`/editor-uploads/${api.id}`);
  expect((await usage()).storage_bytes).toBe(13);
  expect((await api.patch(0, "fixture bytes")).status).toBe(204);
  expect(
    (await api.send("HEAD", `/${api.id}`)).headers.get("upload-offset"),
  ).toBe("13");
  const finished = await api.send("POST", `/${api.id}/finish`);
  expect(finished.status).toBe(200);
  const value = await finished.json();
  expect(value).toMatchObject({
    id: api.id,
    status: "stored",
    bytes: 13,
    assetId: api.file.assetId,
  });
  expect(JSON.stringify(value)).not.toMatch(
    /worker_id|owner_token|bucket_id|object_name|completion_evidence/,
  );
  expect(await api.spool.state(api.id)).toBeNull();
  expect((await usage()).storage_bytes).toBe(13);
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(200);
  expect(api.controls.writes).toBe(1);
});

it("resumes a lost creation reply without truncating bytes and binds retries to the original uploader", async () => {
  const api = await hostedFixture();
  expect((await api.start()).status).toBe(201);
  expect((await api.patch(0, "fixture")).status).toBe(204);
  expect((await api.start()).status).toBe(201);
  expect(
    (await api.send("HEAD", `/${api.id}`)).headers.get("upload-offset"),
  ).toBe("7");
  expect((await api.patch(7, " bytes", bob)).status).toBe(403);
  expect((await api.start({ ...api.file, kind: "font" })).status).toBe(409);
  expect((await api.patch(7, " bytes")).status).toBe(204);
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(200);
});

it("rejects account capacity before creating temporary bytes", async () => {
  const api = await hostedFixture();
  await db.exec("update builder_plans set storage_bytes=12 where id='free'");
  expect((await api.start()).status).toBe(429);
  expect(await api.spool.state(api.id)).toBeNull();
  expect((await usage()).storage_bytes).toBe(0);
  expect(api.controls.writes).toBe(0);
});

it("cancels a partial transfer only after removing its data and does not delete completed assets", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture");
  const cancelled = await api.send("DELETE", `/${api.id}`);
  expect(cancelled.status).toBe(200);
  expect((await cancelled.json()).status).toBe("removed");
  expect((await usage()).storage_bytes).toBe(0);
  expect(await api.spool.state(api.id)).toBeNull();
  const second = await hostedFixture();
  await second.start();
  await second.patch(0, "fixture bytes");
  await second.send("POST", `/${second.id}/finish`);
  const kept = await second.send("DELETE", `/${second.id}`);
  expect(kept.status).toBe(200);
  expect((await kept.json()).status).toBe("stored");
  expect(second.stored.has(second.id)).toBe(true);
});

it("reconciles a committed finish with a lost reply without storing or charging twice", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture bytes");
  api.controls.loseFinishReply = true;
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(200);
  expect(api.controls.writes).toBe(1);
  expect((await usage()).storage_bytes).toBe(13);
  expect(await api.spool.state(api.id)).toBeNull();
});

it("retries removal after local cleanup succeeded but the database was unavailable", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture");
  api.controls.failRemoval = true;
  expect((await api.send("DELETE", `/${api.id}`)).status).toBe(503);
  expect((await usage()).storage_bytes).toBe(13);
  expect((await api.spool.state(api.id)).released).toBe(true);
  api.controls.failRemoval = false;
  const result = await api.send("DELETE", `/${api.id}`);
  expect(result.status).toBe(200);
  expect((await result.json()).status).toBe("removed");
  expect((await usage()).storage_bytes).toBe(0);
  expect(await api.spool.state(api.id)).toBeNull();
});

it("keeps storage charged and refuses completion if account access changes during provider upload", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture bytes");
  api.controls.revokeAfterStore = true;
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(403);
  expect((await usage()).storage_bytes).toBe(13);
  expect((await api.spool.state(api.id)).released).toBe(false);
  const row = await rpc("builder_upload_worker_read", [api.id, worker, null]);
  expect(row.status).toBe("storing");
  expect(api.stored.has(api.id)).toBe(true);
});

it("recovers the actual database owner when a newer process stopped before its claim committed", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture");
  const original = await api.spool.state(api.id);
  const child = spawn(process.execPath, ["-e", "process.exit(0)"], {
    stdio: "ignore",
  });
  await once(child, "exit");
  // Model the two durable attempt records left by stopped workers: SQL still
  // owns the first token, while the newest local intent did not reach SQL.
  const prior = { ...original.attempt, pid: child.pid };
  await writeFile(
    path.join(api.spool.directory, "states", `${api.id}.json`),
    JSON.stringify({
      ...original,
      previousAttempts: [prior],
      attempt: { ...prior, token: randomUUID() },
    }),
  );
  expect((await api.patch(7, " bytes")).status).toBe(204);
  const recovered = await rpc("builder_upload_worker_read", [
    api.id,
    worker,
    alice,
  ]);
  expect(recovered.owner_token).not.toBe(prior.token);
  await expect(
    rpc("builder_upload_assert", [api.id, worker, prior.token, alice, false]),
  ).rejects.toThrow("no longer owns");
  expect(await api.spool.attempt(api.id, prior.token)).toEqual(prior);
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(200);
});

it("validates protocol, route and request shape before reserving storage", async () => {
  const api = await hostedFixture();
  const base = "https://builder.example.test/editor-uploads";
  expect(
    (await api.service.handle(new Request(base, { method: "POST" }))).status,
  ).toBe(412);
  expect((await api.send("POST", "", "unexpected bytes")).status).toBe(400);
  expect((await api.send("GET", `/${api.id}/finish`)).status).toBe(405);
  expect(
    (
      await api.service.handle(
        new Request(base, {
          method: "OPTIONS",
          headers: { Origin: "https://foreign.example.test" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await api.service.handle(
        new Request(base + "?arbitrary=true", { method: "OPTIONS" }),
      )
    ).status,
  ).toBe(404);
  expect(await api.spool.state(api.id)).toBeNull();
  expect((await usage()).storage_bytes).toBe(0);
});

it("uploads through the actual client transport, HTTP host, TUS handler and database before verified completion", async () => {
  const api = await hostedFixture();
  const host = await startUploadHost({ port: 0, service: api.service });
  try {
    const connection = new HostedUploadConnection({
      origin: host.origin,
      projectId: project,
      accountId: alice,
      scope: "fixture-scope",
      allowLoopback: true,
      getSession: async () => ({
        user: { id: alice },
        access_token: alice,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    // The Node TUS adapter accepts Buffer; browser adapters provide the same bytes from Blob.
    const bytes = Buffer.from("fixture bytes");
    Object.defineProperty(bytes, "size", { value: bytes.length });
    const asset = {
      id: api.file.assetId,
      hash: api.file.sha256,
      size: api.file.bytes,
      mime: api.file.mime,
      kind: "image",
    } as Asset;
    const saved: string[] = [],
      progress: number[] = [];
    await connection.upload(
      asset,
      bytes as unknown as Blob,
      (value) => progress.push(value),
      {
        scope: "fixture-scope",
        onUploadUrl: async (value) => {
          saved.push(value);
        },
      },
    );
    expect(saved).toEqual([`${host.origin}/editor-uploads/${api.id}`]);
    expect(progress[progress.length - 1]).toBe(100);
    expect(api.stored.get(api.id)?.toString()).toBe("fixture bytes");
    expect((await usage()).storage_bytes).toBe(13);
    expect(await api.spool.state(api.id)).toBeNull();
  } finally {
    await host.close();
  }
}, 15000);

it("can register an already-counted stored file after downgrade without increasing storage", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture bytes");
  await api.send("POST", `/${api.id}/finish`);
  await db.exec("update builder_plans set storage_bytes=12 where id='free'");
  await as(
    "service_role",
    null,
    "select builder_commit_project_workspace($1,$2,0,$3)",
    [
      project,
      alice,
      JSON.stringify({
        pages: [],
        assets: [
          {
            id: api.file.assetId,
            size: 13,
            hash: api.file.sha256,
            mime: api.file.mime,
            kind: api.file.kind,
            url: projectAssetUrl(project, api.file.assetId),
          },
        ],
        saved: [],
      }),
    ],
  );
  expect(await usage()).toMatchObject({
    workspace_bytes: 13,
    storage_bytes: 13,
    registered_bytes: 13,
  });
  await expect(reserve(1)).rejects.toThrow("storage limit");
});

const nativeWorker = "fixture-native-cleanup",
  nativeProducer = "fixture-native-helper",
  nativeConfiguration = "7".repeat(64);
const nativeConfigurationArgs = (enabled = false) => [
  nativeWorker,
  nativeConfiguration,
  ["kaizen", project],
  JSON.stringify([
    { workerId: nativeProducer, projectIds: ["kaizen", project] },
  ]),
  enabled,
];
const configureNative = (enabled = false) =>
  rpc("builder_native_asset_configure", nativeConfigurationArgs(enabled));
const nativeIdentity = () => [
  randomUUID(),
  nativeProducer,
  nativeConfiguration,
  project,
  process.pid,
  "fixture-host",
  randomUUID(),
];
const beginNative = (identity: any[], actor: string | null = alice) =>
  rpc("builder_native_operation_begin", [...identity, actor]);
const endNative = (identity: any[]) =>
  rpc("builder_native_operation_end", identity);
const observeNative = () =>
  rpc("builder_native_cleanup_observe", [nativeWorker, nativeConfiguration]);
const nativeQueue = () =>
  rpc("builder_native_asset_cleanup_queue", [
    nativeWorker,
    nativeConfiguration,
    20,
  ]);
async function nativeJob() {
  const file = await unregisteredFile();
  await configureNative(true);
  await nativeQueue();
  const job = await assetJob(file.id);
  await db.query(
    "update builder_asset_cleanup set eligible_at=now()-interval '1 day' where id=$1",
    [job.id],
  );
  return { ...job, file };
}
const nativeClearance = (id: string, token: string, epoch: string) =>
  rpc("builder_native_cleanup_clearance", [
    id,
    nativeWorker,
    token,
    nativeConfiguration,
    epoch,
    "9".repeat(64),
  ]);

async function nativeCleanupFixture() {
  const api = await hostedFixture();
  await preexistingFile(api);
  expect((await adoptFile(api)).status).toBe(200);
  const legacyUrl = "https://fixture.example.test/older-file-without-an-id.png";
  await db.query(
    "update builder_asset_files set file_url=$1 where project_id=$2 and asset_id=$3",
    [legacyUrl, project, api.file.assetId],
  );
  const directory = await mkdtemp(
    path.join(tmpdir(), "kaizen-native-cleanup-"),
  );
  spoolRoots.push(directory);
  const repository = path.join(directory, "repository"),
    original = path.join(directory, "kaizen");
  const drafts = path.join(directory, "drafts"),
    retained = path.join(directory, "releases"),
    candidates = path.join(directory, "candidates");
  for (const root of [repository, original, drafts, retained, candidates])
    await mkdir(root, { mode: 0o700 });
  const execute = promisify(execFile);
  const git = async (root: string, ...args: string[]) =>
    execute("git", ["-C", root, "-c", "core.hooksPath=/dev/null", ...args], {
      env: {
        PATH: process.env.PATH,
        LANG: "C",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_AUTHOR_NAME: "Fixture",
        GIT_AUTHOR_EMAIL: "fixture@example.test",
        GIT_COMMITTER_NAME: "Fixture",
        GIT_COMMITTER_EMAIL: "fixture@example.test",
      },
    });
  for (const root of [repository, original]) {
    await git(root, "init", "--initial-branch=main");
    await writeFile(path.join(root, "page.txt"), "Ordinary source");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "Fixture source");
  }
  const spool = await UploadSpool.create(path.join(directory, "spool"), {
    bytes: 1024 ** 2,
    files: 10,
    freeBytes: 0,
  });
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let afterRpc: ((name: string) => Promise<void>) | undefined;
  let beforeRemoval: (() => Promise<void>) | undefined;
  const controls = { mismatchedCoverage: false, providerRemovals: 0 };
  const invoke = async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    const result = await api.services.rpc(name, args);
    await afterRpc?.(name);
    if (
      name === "builder_native_cleanup_observe" &&
      controls.mismatchedCoverage
    )
      return { ...result, projects: ["kaizen"] };
    return result;
  };
  const native = new NativeAssetCleanup(
    {
      version: 1,
      workerId: nativeWorker,
      projects: ["kaizen", project],
      producers: [
        { workerId: nativeProducer, projectIds: ["kaizen", project] },
      ],
      roots: [
        { kind: "repository", path: repository, projectIds: [project] },
        { kind: "repository", path: original, projectIds: ["kaizen"] },
        { kind: "tree", path: drafts, projectIds: ["kaizen", project] },
        { kind: "tree", path: retained, projectIds: ["kaizen", project] },
        {
          kind: "repository-collection",
          path: candidates,
          projectIds: ["kaizen", project],
        },
      ],
    },
    invoke,
  );
  const configured = native.inventory;
  await rpc("builder_native_asset_configure", [
    nativeWorker,
    configured.fingerprint,
    configured.configuration.projects,
    JSON.stringify(configured.configuration.producers),
    true,
  ]);
  const cleanup = new AssetCleanupWorker({
    workerId: nativeWorker,
    spool,
    rpc: invoke,
    native,
    fileLockId: hostedUploadId,
    provider: {
      ...api.services.provider,
      remove: async (item) => {
        const attempt = (await spool.state(item.id))?.attempt;
        expect(attempt?.pid).toBe(process.pid);
        expect(await api.spool.state(item.id)).toBe(null);
        expect((await assetJob(api.file.assetId)).owner_token).toBe(
          attempt?.token,
        );
        await beforeRemoval?.();
        controls.providerRemovals++;
        return api.services.provider.remove(item);
      },
    },
  });
  expect(await cleanup.queue()).toEqual([]);
  const job = await assetJob(api.file.assetId);
  expect(job.worker_id).toBe(nativeWorker);
  await db.query(
    "update builder_asset_cleanup set eligible_at=now()-interval '1 day' where id=$1",
    [job.id],
  );
  const identity = () => {
    const value = nativeIdentity();
    value[2] = configured.fingerprint;
    return value;
  };
  return {
    api,
    cleanup,
    native,
    calls,
    controls,
    spool,
    job,
    legacyUrl,
    repository,
    original,
    drafts,
    retained,
    candidates,
    git,
    identity,
    afterRpc: (value: typeof afterRpc) => {
      afterRpc = value;
    },
    beforeRemoval: (value: typeof beforeRemoval) => {
      beforeRemoval = value;
    },
  };
}

it.each(["source", "drafts", "release", "packed candidate"])(
  "keeps a native file referenced only by %s and restarts its recovery grace",
  async (kind) => {
    const f = await nativeCleanupFixture();
    if (kind === "packed candidate") {
      const candidate = path.join(f.candidates, "retained");
      await f.git(f.candidates, "clone", f.original, candidate);
      await writeFile(path.join(candidate, "old.txt"), f.legacyUrl);
      await f.git(candidate, "add", ".");
      await f.git(candidate, "commit", "-m", "Retained reference");
      await rm(path.join(candidate, "old.txt"));
      await f.git(candidate, "add", "-A");
      await f.git(candidate, "commit", "-m", "Remove working reference");
      await f.git(candidate, "repack", "-ad");
    } else {
      const root =
        kind === "source"
          ? f.original
          : kind === "drafts"
            ? f.drafts
            : f.retained;
      await writeFile(
        path.join(root, "retained.json"),
        JSON.stringify({ image: f.legacyUrl }),
      );
    }
    await expect(f.cleanup.run(f.job.id)).rejects.toThrow("remain referenced");
    const job = await assetJob(f.api.file.assetId);
    expect(Date.parse(job.eligible_at)).toBeGreaterThan(
      Date.now() + 6 * 86400000,
    );
    expect(job.native_clearance).toBe(null);
    expect(f.controls.providerRemovals).toBe(0);
    expect(f.api.stored.has(f.api.id)).toBe(true);
    expect(await f.spool.state(f.job.id)).toBe(null);
    expect(await f.cleanup.queue()).toEqual([]);
  },
);

it("removes an unused native file only after the complete inventory clears the exact durable attempt", async () => {
  const f = await nativeCleanupFixture();
  expect(await f.cleanup.queue()).toEqual([f.job.id]);
  f.beforeRemoval(async () => {
    // Adoption is through a different worker/spool; the SQL state still rejects it.
    expect((await adoptFile(f.api)).status).toBe(409);
  });
  await f.cleanup.run(f.job.id);
  const clearance = f.calls.find(
    (call) => call.name === "builder_native_cleanup_clearance",
  )!;
  const claim = f.calls.find(
    (call) => call.name === "builder_asset_cleanup_claim",
  )!;
  expect(clearance.args.token).toBe(claim.args.token);
  expect(clearance.args.inventory_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(f.calls.indexOf(clearance)).toBeLessThan(f.calls.indexOf(claim));
  expect((await assetJob(f.api.file.assetId)).local_cleanup_pending).toBe(
    false,
  );
  expect(f.api.stored.has(f.api.id)).toBe(false);
  expect(await f.spool.state(f.job.id)).toBe(null);
  expect((await usage()).storage_bytes).toBe(0);
});

it.each(["during scan", "after clearance"])(
  "rejects native producer activity %s before provider removal",
  async (when) => {
    const f = await nativeCleanupFixture();
    const identity = f.identity();
    let entered = false;
    f.afterRpc(async (name) => {
      if (
        !entered &&
        name ===
          (when === "during scan"
            ? "builder_native_cleanup_observe"
            : "builder_native_cleanup_clearance")
      ) {
        entered = true;
        await beginNative(identity);
        if (when === "during scan") await endNative(identity);
      }
    });
    await expect(f.cleanup.run(f.job.id)).rejects.toThrow();
    expect(f.controls.providerRemovals).toBe(0);
    expect((await assetJob(f.api.file.assetId)).phase).toBe("pending");
    if (when === "after clearance") await endNative(identity);
    f.afterRpc(undefined);
    await f.cleanup.run(f.job.id);
    expect(f.api.stored.has(f.api.id)).toBe(false);
  },
);

it("retains native data when coverage or a required root cannot be verified", async () => {
  const f = await nativeCleanupFixture();
  f.controls.mismatchedCoverage = true;
  await expect(f.cleanup.run(f.job.id)).rejects.toThrow("retained");
  f.controls.mismatchedCoverage = false;
  await rm(f.drafts, { recursive: true });
  await expect(f.cleanup.run(f.job.id)).rejects.toThrow();
  expect(
    f.calls.some((call) => call.name === "builder_native_cleanup_clearance"),
  ).toBe(false);
  expect(f.controls.providerRemovals).toBe(0);
  expect(f.api.stored.has(f.api.id)).toBe(true);
});

it("reconciles a native removal after provider completion without inventing another scan or releasing charges early", async () => {
  const f = await nativeCleanupFixture();
  f.api.controls.failAssetFinish = true;
  await expect(f.cleanup.run(f.job.id)).rejects.toThrow("unavailable");
  expect(f.api.stored.has(f.api.id)).toBe(false);
  expect((await usage()).storage_bytes).toBe(13);
  expect((await assetJob(f.api.file.assetId)).phase).toBe("removing");
  f.api.controls.failAssetFinish = false;
  const scanned = f.calls.filter(
    (call) => call.name === "builder_native_cleanup_observe",
  ).length;
  const identity = f.identity();
  await beginNative(identity);
  await f.cleanup.run(f.job.id);
  expect(
    f.calls.filter((call) => call.name === "builder_native_cleanup_observe"),
  ).toHaveLength(scanned);
  expect((await usage()).storage_bytes).toBe(0);
  await endNative(identity);
});

it("keeps native cleanup disabled until configured and excludes native clients from the ordinary queue", async () => {
  const file = await unregisteredFile();
  const old = await dueAsset(file.id);
  await configureNative();
  expect(await assetQueue()).toEqual([]);
  expect(await assetJob(file.id)).toMatchObject({
    worker_id: nativeWorker,
    phase: "pending",
  });
  await expect(observeNative()).rejects.toThrow(
    "Configured native file cleanup",
  );
  await expect(
    rpc("builder_asset_cleanup_claim", [old.id, worker, randomUUID(), null]),
  ).rejects.toThrow(/native reference/);
  expect((await fileRecord(project, file.id)).status).toBe("verified");
});

it("requires every retained native scope and a configured producer before accepting host inventory", async () => {
  await configureNative();
  const dropped = nativeConfigurationArgs();
  dropped[2] = ["kaizen"];
  await expect(rpc("builder_native_asset_configure", dropped)).rejects.toThrow(
    "every retained native website",
  );
  const missing = nativeConfigurationArgs();
  missing[3] = JSON.stringify([
    { workerId: nativeProducer, projectIds: ["kaizen"] },
  ]);
  await expect(rpc("builder_native_asset_configure", missing)).rejects.toThrow(
    "Every native website",
  );
  const foreign = nativeIdentity();
  foreign[1] = "unconfigured-helper";
  await expect(beginNative(foreign)).rejects.toThrow(
    "Configured native website producer",
  );
  const wrongProfile = nativeIdentity();
  wrongProfile[2] = "8".repeat(64);
  await expect(beginNative(wrongProfile)).rejects.toThrow(
    "Configured native website producer",
  );
  await expect(beginNative(nativeIdentity(), bob)).rejects.toThrow(
    "Current website access",
  );
});

it("retains active producer protection without an expiry and binds every retry to its original process", async () => {
  await configureNative(true);
  const identity = nativeIdentity(),
    before = await observeNative();
  const active = await beginNative(identity);
  expect(active.phase).toBe("active");
  expect(await beginNative(identity)).toEqual(active);
  await db.query(
    "update builder_native_asset_operations set created_at=now()-interval '1 year' where id=$1",
    [identity[0]],
  );
  await expect(observeNative()).rejects.toThrow("Finish or reconcile");
  const replacement = [...identity];
  replacement[4] = process.pid + 1;
  await expect(beginNative(replacement)).rejects.toThrow("another process");
  await expect(endNative(replacement)).rejects.toThrow("another process");
  const changed = nativeConfigurationArgs(true);
  changed[1] = "8".repeat(64);
  await expect(rpc("builder_native_asset_configure", changed)).rejects.toThrow(
    "active website operations",
  );
  // End is a narrow worker recovery operation and must still work after Auth
  // expires or project membership changes, once local work actually stopped.
  await db.query(
    "update auth.users set deleted_at=clock_timestamp() where id=$1",
    [alice],
  );
  expect((await endNative(identity)).phase).toBe("complete");
  const after = await observeNative();
  expect(BigInt(after.epoch)).toBe(BigInt(before.epoch) + 2n);
  expect((await beginNative(identity)).phase).toBe("complete");
  await endNative(identity);
  expect(await observeNative()).toEqual(after);
});

it("records an end-before-begin tombstone so a delayed request cannot reopen a finished operation", async () => {
  await configureNative(true);
  const identity = nativeIdentity();
  const completed = await endNative(identity);
  const observation = await observeNative();
  expect(completed.phase).toBe("complete");
  expect(await beginNative(identity)).toEqual(completed);
  expect(await observeNative()).toEqual(observation);
});

it("rejects a native removal scan if an edit begins or completes before clearance or claim", async () => {
  const job = await nativeJob(),
    token = randomUUID();
  const original = await observeNative(),
    identity = nativeIdentity();
  await beginNative(identity);
  await expect(nativeClearance(job.id, token, original.epoch)).rejects.toThrow(
    "Finish or reconcile",
  );
  await endNative(identity);
  await expect(nativeClearance(job.id, token, original.epoch)).rejects.toThrow(
    "Repeat the complete reference check",
  );
  const next = await observeNative();
  await nativeClearance(job.id, token, next.epoch);
  const another = nativeIdentity();
  await beginNative(another);
  await endNative(another);
  await expect(
    rpc("builder_asset_cleanup_claim", [job.id, nativeWorker, token, null]),
  ).rejects.toThrow("Verify repository");
  expect((await fileRecord(project, job.file.id)).status).toBe("verified");
});

it("binds native clearance to its attempt and keeps retired identities visible to later producers", async () => {
  const job = await nativeJob(),
    token = randomUUID(),
    observation = await observeNative();
  await nativeClearance(job.id, token, observation.epoch);
  await expect(
    rpc("builder_asset_cleanup_claim", [
      job.id,
      nativeWorker,
      randomUUID(),
      null,
    ]),
  ).rejects.toThrow("native reference check");
  expect(
    (
      await rpc("builder_asset_cleanup_claim", [
        job.id,
        nativeWorker,
        token,
        null,
      ])
    ).phase,
  ).toBe("removing");
  const identity = nativeIdentity();
  await beginNative(identity);
  const retired = await rpc("builder_native_operation_assets", [
    identity[0],
    nativeProducer,
    nativeConfiguration,
    "",
  ]);
  expect(retired).toMatchObject({
    id: identity[0],
    cursor: null,
    assets: [{ assetId: job.file.id, projectId: project }],
  });
  await expect(
    registerFile(project, registrationAsset(job.file.api)),
  ).rejects.toThrow("Verify this file");
  await expect(
    as(
      "service_role",
      null,
      "update builder_projects set settings=jsonb_build_object('image',$2::text) where id=$1",
      [project, job.file.id],
    ),
  ).rejects.toThrow(/removed|remov/);
  await endNative(identity);
  await expect(
    rpc("builder_native_operation_assets", [
      identity[0],
      nativeProducer,
      nativeConfiguration,
      "",
    ]),
  ).rejects.toThrow("Active native website operation");
  const changed = nativeConfigurationArgs(true);
  changed[1] = "8".repeat(64);
  await expect(rpc("builder_native_asset_configure", changed)).rejects.toThrow(
    "Reconcile native file removal",
  );
});

it("keeps native producer identities, configuration and cleanup authority unavailable to browsers", async () => {
  await configureNative();
  const identity = nativeIdentity();
  for (const role of ["anon", "authenticated"]) {
    for (const table of [
      "builder_native_asset_state",
      "builder_native_asset_scopes",
      "builder_native_asset_operations",
    ])
      await expect(as(role, alice, `select * from ${table}`)).rejects.toThrow(
        "permission denied",
      );
    await expect(
      as(
        role,
        alice,
        "select builder_native_operation_begin($1,$2,$3,$4,$5,$6,$7,$8)",
        [...identity, alice],
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      as(
        role,
        alice,
        "select builder_native_operation_end($1,$2,$3,$4,$5,$6,$7)",
        identity,
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      as(
        role,
        alice,
        "select builder_asset_cleanup_claim_internal($1,$2,$3,null)",
        [randomUUID(), nativeWorker, randomUUID()],
      ),
    ).rejects.toThrow("permission denied");
  }
});

const cleanupQueue = (size = 20, selectedWorker = worker) =>
  rpc("builder_upload_cleanup_queue", [selectedWorker, size]);
const staleUpload = (id: string) =>
  db.query(
    "update builder_uploads set activity_at=now()-interval '8 days' where id=$1",
    [id],
  );

it("cleans abandoned partial uploads without a browser and frees quota only after verified removal", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture");
  expect(await cleanupQueue()).toEqual([]);
  await staleUpload(api.id);
  expect(await cleanupQueue()).toEqual([api.id]);
  expect((await usage()).storage_bytes).toBe(13);
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
  expect((await usage()).storage_bytes).toBe(0);
  expect(await api.spool.state(api.id)).toBeNull();
  expect(await cleanupQueue()).toEqual([]);
  expect(
    (await rpc("builder_upload_worker_read", [api.id, worker])).status,
  ).toBe("removed");
  expect((await api.start()).status).toBe(409);
});

it("releases a lost-POST reservation even when its file is larger than the local spool allowance", async () => {
  const api = await hostedFixture();
  const upload = await reserve(2 * 1024 ** 2);
  await staleUpload(upload.id);
  expect(await api.spool.state(upload.id)).toBeNull();
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
  expect((await usage()).storage_bytes).toBe(0);
  expect(await api.spool.state(upload.id)).toBeNull();
});

it("rechecks queued expiry under the local lock and extends the window only for new accepted bytes", async () => {
  const api = await hostedFixture();
  await api.start();
  await staleUpload(api.id);
  const before = await rpc("builder_upload_worker_read", [api.id, worker]);
  await api.send("HEAD", `/${api.id}`);
  await api.start();
  await api.patch(0, "");
  expect(
    (await rpc("builder_upload_worker_read", [api.id, worker])).activity_at,
  ).toBe(before.activity_at);
  expect(await cleanupQueue()).toEqual([api.id]);
  expect((await api.patch(0, "fixture")).status).toBe(204);
  const current = await rpc("builder_upload_worker_read", [api.id, worker]);
  expect(current.received_bytes).toBe(7);
  expect(current.activity_at).not.toBe(before.activity_at);
  expect(
    await rpc("builder_upload_cleanup_prepare", [api.id, worker]),
  ).toBeNull();
  expect(await cleanupQueue()).toEqual([]);
  await expect(
    rpc("builder_upload_progress", [
      api.id,
      worker,
      current.owner_token,
      alice,
      6,
    ]),
  ).rejects.toThrow("offset");
  await expect(
    rpc("builder_upload_progress", [
      api.id,
      worker,
      current.owner_token,
      alice,
      14,
    ]),
  ).rejects.toThrow("offset");
});

it("removes an unfinished provider upload after access is revoked without requiring the former account", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture bytes");
  api.controls.revokeAfterStore = true;
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(403);
  expect(api.stored.has(api.id)).toBe(true);
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
  expect(api.stored.has(api.id)).toBe(false);
  expect((await usage()).storage_bytes).toBe(0);
});

it("reconciles terminal local cleanup after a lost acknowledgement without deleting the saved provider asset", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture bytes");
  api.controls.failCleanupAck = true;
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(503);
  expect(api.stored.has(api.id)).toBe(true);
  expect(await api.spool.state(api.id)).toBeNull();
  expect(await cleanupQueue()).toEqual([api.id]);
  api.controls.failCleanupAck = false;
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
  expect(await cleanupQueue()).toEqual([]);
  expect(api.stored.has(api.id)).toBe(true);
  expect((await usage()).storage_bytes).toBe(13);
});

it("keeps failed cleanup charged, rotates it behind other work and resumes when the provider recovers", async () => {
  const api = await hostedFixture();
  await api.start();
  await staleUpload(api.id);
  api.controls.failProviderRemoval = true;
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 1,
  });
  expect((await usage()).storage_bytes).toBe(13);
  const second = await reserve(3);
  await staleUpload(second.id);
  expect(await cleanupQueue(1)).toEqual([second.id]);
  api.controls.failProviderRemoval = false;
  expect(await api.service.maintain()).toEqual({
    examined: 2,
    cleaned: 2,
    deferred: 0,
  });
  expect((await usage()).storage_bytes).toBe(0);
});

it("cannot cancel a queued upload while its foreground operation owns the file lock", async () => {
  const api = await hostedFixture();
  await api.start();
  await staleUpload(api.id);
  await api.spool.withUpload(api.id, async () => {
    expect(await api.service.maintain()).toEqual({
      examined: 1,
      cleaned: 0,
      deferred: 1,
    });
    expect(
      (await rpc("builder_upload_worker_read", [api.id, worker]))
        .cancel_requested,
    ).toBe(false);
  });
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
});

it("keeps maintenance private, bounded and assigned to the configured worker", async () => {
  const upload = await reserve();
  await staleUpload(upload.id);
  for (const role of ["anon", "authenticated"]) {
    for (const query of [
      "select builder_upload_cleanup_queue($1)",
      `select builder_upload_cleanup_prepare('${upload.id}',$1)`,
      `select builder_upload_cleanup_ack('${upload.id}',$1,'${randomUUID()}')`,
      `select builder_upload_progress('${upload.id}',$1,'${randomUUID()}','${alice}',1)`,
    ])
      await expect(as(role, alice, query, [worker])).rejects.toThrow(
        "permission denied",
      );
  }
  expect(await cleanupQueue(20, "different-worker")).toEqual([]);
  await expect(
    rpc("builder_upload_cleanup_prepare", [upload.id, "different-worker"]),
  ).rejects.toThrow("Configured upload worker");
  await expect(
    rpc("builder_upload_cleanup_ack", [upload.id, worker, randomUUID()]),
  ).rejects.toThrow("Confirmed upload completion");
  await expect(cleanupQueue(0)).rejects.toThrow("Invalid upload maintenance");
  await expect(cleanupQueue(101)).rejects.toThrow("Invalid upload maintenance");
});

async function beginCopy(
  options: {
    id?: string;
    workspace?: any;
    actor?: string;
    source?: string;
    name?: string;
  } = {},
) {
  const id = options.id || randomUUID();
  const assetId = randomUUID();
  const workspace = options.workspace || {
    pages: [],
    assets: [
      {
        id: assetId,
        size: 13,
        hash,
        mime: "image/png",
        kind: "image",
        url: projectAssetUrl(id, assetId),
      },
    ],
    saved: [],
  };
  return rpc("builder_project_copy_begin", [
    options.source || project,
    options.actor || alice,
    id,
    options.name || "Copy fixture",
    JSON.stringify(workspace),
  ]);
}
async function finishCopyFile(copy: any, asset = copy.workspace.assets[0]) {
  const upload = await storing(
    await claim(
      await reserve(asset.size, {
        project: copy.project_id,
        asset: asset.id,
        hash: asset.hash,
        mime: asset.mime,
        kind: asset.kind,
      }),
    ),
  );
  await storedObject(upload);
  await rpc("builder_upload_finish", [
    upload.id,
    worker,
    upload.owner_token,
    evidence(upload),
  ]);
  return upload;
}

async function cancelCopy(copy: any, actor = alice, version?: number) {
  const current = (
    await db.query<any>("select version from builder_projects where id=$1", [
      copy.project_id,
    ])
  ).rows[0];
  return rpc("builder_project_copy_cancel", [
    copy.project_id,
    actor,
    version ?? current?.version ?? 1,
  ]);
}

it("cancels only unfinished copies owned by the current active account", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const copy = await beginCopy();
  await expect(cancelCopy(copy, bob)).rejects.toThrow("access");
  await db.query(
    "insert into builder_project_members(project_id,user_id,role) values($1,$2,'editor')",
    [copy.project_id, bob],
  );
  await expect(cancelCopy(copy, bob)).rejects.toThrow("owner");
  await expect(cancelCopy(copy, alice, 999)).rejects.toThrow(
    "Refresh Projects",
  );
  await expect(cancelCopy({ project_id: project })).rejects.toThrow(
    "unfinished copy",
  );
  const finished = await beginCopy({
    workspace: { pages: [], assets: [], saved: [] },
  });
  await rpc("builder_project_copy_finish", [finished.project_id, alice]);
  await expect(cancelCopy(finished)).rejects.toThrow("unfinished copy");
  await db.query(
    "update builder_project_members set role='owner' where project_id=$1 and user_id=$2",
    [copy.project_id, bob],
  );
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    bob,
  ]);
  await expect(cancelCopy(copy, bob)).rejects.toThrow(
    "confirmed, active account",
  );
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
    bob,
  ]);
  expect(await cancelCopy(copy, bob)).toMatchObject({
    cancelled: true,
    cleanupPending: true,
  });
  expect(await cancelCopy(copy, bob, 999)).toMatchObject({
    cancelled: true,
    cleanupPending: true,
  });
});

it("keeps cancelled request identity after an empty destination is purged", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const copy = await beginCopy();
  await cancelCopy(copy);
  expect((await usage(copy.project_id)).registered_bytes).toBe(0);
  expect(await rpc("builder_project_copy_purge_queue", [worker, 20])).toEqual([
    copy.project_id,
  ]);
  expect(
    await rpc("builder_project_copy_purge", [copy.project_id, worker]),
  ).toBe(true);
  expect(
    (
      await db.query("select id from builder_projects where id=$1", [
        copy.project_id,
      ])
    ).rows,
  ).toEqual([]);
  expect(
    (await db.query("select id from builder_projects where id=$1", [project]))
      .rows,
  ).toHaveLength(1);
  expect(await cancelCopy(copy)).toEqual({
    projectId: copy.project_id,
    cancelled: true,
    cleanupPending: false,
  });
  await expect(cancelCopy(copy, bob)).rejects.toThrow("another account");
  await expect(beginCopy({ id: copy.project_id })).rejects.toThrow(
    "copy was cancelled",
  );
  expect(
    await rpc("builder_project_copy_purge", [copy.project_id, worker]),
  ).toBe(true);
});

it("fences copy resume, new uploads, source copying, restoration and late completion after cancellation", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const copy = await beginCopy(),
    asset = copy.workspace.assets[0];
  const upload = await storing(
    await claim(
      await reserve(asset.size, { project: copy.project_id, asset: asset.id }),
    ),
  );
  await storedObject(upload);
  await cancelCopy(copy);
  await expect(
    rpc("builder_project_copy_resume", [copy.project_id, alice]),
  ).rejects.toThrow("copy was cancelled");
  await expect(
    rpc("builder_project_copy_finish", [copy.project_id, alice]),
  ).rejects.toThrow("copy was cancelled");
  await expect(reserve(1, { project: copy.project_id })).rejects.toThrow(
    "copy was cancelled",
  );
  await expect(beginCopy({ source: copy.project_id })).rejects.toThrow(
    "Finish the source copy",
  );
  await expect(
    as(
      "service_role",
      null,
      "update builder_projects set archived=false where id=$1",
      [copy.project_id],
    ),
  ).rejects.toThrow("copy was cancelled");
  await expect(
    rpc("builder_upload_finish", [
      upload.id,
      worker,
      upload.owner_token,
      evidence(upload),
    ]),
  ).rejects.toThrow();
  expect((await usage(copy.project_id)).registered_bytes).toBe(asset.size);
  expect(
    await rpc("builder_project_copy_purge", [copy.project_id, worker]),
  ).toBe(false);
});

it("retains stored copy bytes until provider removal and local cleanup acknowledgement", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const copy = await beginCopy(),
    upload = await finishCopyFile(copy);
  await rpc("builder_upload_cleanup_ack", [
    upload.id,
    worker,
    upload.owner_token,
  ]);
  await cancelCopy(copy);
  expect((await usage(copy.project_id)).registered_bytes).toBe(13);
  expect(
    await rpc("builder_project_copy_purge", [copy.project_id, worker]),
  ).toBe(false);
  const jobs = await rpc("builder_asset_cleanup_queue", [worker, 20]);
  const id = (
    await db.query<any>(
      "select id from builder_asset_cleanup where project_id=$1",
      [copy.project_id],
    )
  ).rows[0].id;
  expect(jobs).toContain(id);
  const token = randomUUID();
  await rpc("builder_asset_cleanup_claim", [id, worker, token, null]);
  await db.query(
    "delete from storage.objects where bucket_id='builder-project-files' and name=$1",
    [`${copy.project_id}/${upload.asset_id}`],
  );
  expect(
    await rpc("builder_project_copy_purge", [copy.project_id, worker]),
  ).toBe(false);
  await rpc("builder_asset_cleanup_finish", [
    id,
    worker,
    token,
    JSON.stringify({
      id,
      attemptId: token,
      localRemoved: true,
      providerRemoved: true,
      verifiedAt: new Date().toISOString(),
    }),
  ]);
  expect(
    await rpc("builder_project_copy_purge", [copy.project_id, worker]),
  ).toBe(false);
  await rpc("builder_asset_cleanup_ack", [id, worker, token]);
  expect(
    await rpc("builder_project_copy_purge", [copy.project_id, worker]),
  ).toBe(true);
});

it("keeps cancellation and purge routines private", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const copy = await beginCopy();
  for (const role of ["anon", "authenticated", "service_role"])
    await expect(
      as(role, alice, "select * from builder_project_copy_cancellations"),
    ).rejects.toThrow("permission denied");
  for (const role of ["anon", "authenticated"]) {
    await expect(
      as(role, alice, "select builder_project_copy_cancel($1,$2,1)", [
        copy.project_id,
        alice,
      ]),
    ).rejects.toThrow("permission denied");
    await expect(
      as(role, alice, "select builder_project_copy_purge($1,$2)", [
        copy.project_id,
        worker,
      ]),
    ).rejects.toThrow("permission denied");
    await expect(
      as(role, alice, "select builder_project_copy_purge_queue($1,20)", [
        worker,
      ]),
    ).rejects.toThrow("permission denied");
  }
});

it("purges a cancelled partial copy through real upload maintenance without touching its source", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const id = randomUUID(),
    api = await hostedFixture(id);
  const copy = await beginCopy({
    id,
    workspace: {
      pages: [],
      saved: [],
      assets: [
        {
          id: api.file.assetId,
          size: api.file.bytes,
          hash: api.file.sha256,
          mime: api.file.mime,
          kind: api.file.kind,
          url: projectAssetUrl(id, api.file.assetId),
        },
      ],
    },
  });
  expect((await api.start()).status).toBe(201);
  expect((await api.patch(0, "fixtu")).status).toBe(204);
  await cancelCopy(copy);
  expect((await usage(id)).registered_bytes).toBe(13);
  expect(await api.service.maintain()).toMatchObject({
    cleaned: 1,
    deferred: 0,
    copiesPurged: 1,
  });
  expect(await api.spool.state(api.id)).toBeNull();
  expect(
    (await db.query("select id from builder_projects where id=$1", [id])).rows,
  ).toEqual([]);
  expect(
    (await db.query("select id from builder_projects where id=$1", [project]))
      .rows,
  ).toHaveLength(1);
  expect(await api.service.maintain()).toMatchObject({
    examined: 0,
    cleaned: 0,
    deferred: 0,
  });
});

it("retries actual stored-copy removal before purging after an unavailable completion", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const id = randomUUID(),
    api = await hostedFixture(id);
  const copy = await beginCopy({
    id,
    workspace: {
      pages: [],
      saved: [],
      assets: [
        {
          id: api.file.assetId,
          size: api.file.bytes,
          hash: api.file.sha256,
          mime: api.file.mime,
          kind: api.file.kind,
          url: projectAssetUrl(id, api.file.assetId),
        },
      ],
    },
  });
  expect((await api.start()).status).toBe(201);
  expect((await api.patch(0, "fixture bytes")).status).toBe(204);
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(200);
  await cancelCopy(copy);
  api.controls.failAssetFinish = true;
  expect(await api.service.maintain()).toMatchObject({ deferred: 1 });
  expect((await usage(id)).registered_bytes).toBe(13);
  expect(api.stored.size).toBe(0);
  expect(
    (await db.query("select id from builder_projects where id=$1", [id])).rows,
  ).toHaveLength(1);
  api.controls.failAssetFinish = false;
  expect(await api.service.maintain()).toMatchObject({
    deferred: 0,
    copiesPurged: 1,
  });
  expect(
    (await db.query("select id from builder_projects where id=$1", [id])).rows,
  ).toEqual([]);
  await expect(beginCopy({ id })).rejects.toThrow("copy was cancelled");
});

it("reserves the whole copy's plan allowance atomically before any file transfer", async () => {
  const deniedId = randomUUID();
  await expect(beginCopy({ id: deniedId })).rejects.toThrow("website limit");
  expect(
    (await db.query("select id from builder_projects where id=$1", [deniedId]))
      .rows,
  ).toHaveLength(0);
  await db.exec(
    "update builder_plans set projects=10,storage_bytes=12 where id='free'",
  );
  await expect(beginCopy({ id: deniedId })).rejects.toThrow("storage limit");
  expect(
    (await db.query("select id from builder_projects where id=$1", [deniedId]))
      .rows,
  ).toHaveLength(0);
  await db.exec("update builder_plans set storage_bytes=13 where id='free'");
  const copy = await beginCopy({ id: deniedId });
  expect(await usage(copy.project_id)).toMatchObject({
    workspace_bytes: 13,
    registered_bytes: 13,
    storage_bytes: 0,
  });
  await finishCopyFile(copy);
  expect(await usage(copy.project_id)).toMatchObject({
    workspace_bytes: 13,
    registered_bytes: 13,
    storage_bytes: 13,
  });
});

it("reuses the original frozen copy after a lost reply and rejects identity changes", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const first = await beginCopy();
  const retry = await beginCopy({
    id: first.project_id,
    workspace: { pages: [], assets: [], saved: [] },
  });
  expect(retry.workspace).toEqual(first.workspace);
  expect(retry.project_id).toBe(first.project_id);
  expect(
    (await db.query("select * from builder_project_copies")).rows,
  ).toHaveLength(1);
  await expect(beginCopy({ id: first.project_id, actor: bob })).rejects.toThrow(
    "another website or account",
  );
  await expect(
    beginCopy({ id: first.project_id, name: "Changed name" }),
  ).rejects.toThrow("another website or account");
});

it("cannot edit or complete a copy before all its exact files are verified and never overwrites a finished copy on retry", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const copy = await beginCopy();
  await expect(
    rpc("builder_commit_project_workspace", [
      copy.project_id,
      alice,
      0,
      JSON.stringify({ pages: [], assets: [], saved: [] }),
    ]),
  ).rejects.toThrow("Finish copying");
  await expect(
    rpc("builder_project_copy_finish", [copy.project_id, alice]),
  ).rejects.toThrow("every file");
  await finishCopyFile(copy);
  await db.query(
    "update storage.objects set version='changed-version' where name=$1",
    [`${copy.project_id}/${copy.workspace.assets[0].id}`],
  );
  await expect(
    rpc("builder_project_copy_finish", [copy.project_id, alice]),
  ).rejects.toThrow("every file");
  await db.query(
    "update storage.objects set version='fixture-version' where name=$1",
    [`${copy.project_id}/${copy.workspace.assets[0].id}`],
  );
  await rpc("builder_project_copy_finish", [copy.project_id, alice]);
  const state = await rpc("builder_project_copy_state", [
    copy.project_id,
    alice,
  ]);
  expect(state.status).toBe("complete");
  expect(state.storedAssets).toEqual([copy.workspace.assets[0].id]);
  await rpc("builder_commit_project_workspace", [
    copy.project_id,
    alice,
    1,
    JSON.stringify({
      ...copy.workspace,
      saved: [{ id: randomUUID(), name: "Later user change" }],
    }),
  ]);
  await rpc("builder_project_copy_finish", [copy.project_id, alice]);
  const current = (
    await db.query<any>(
      "select version,payload from builder_project_workspaces where project_id=$1",
      [copy.project_id],
    )
  ).rows[0];
  expect(current.version).toBe(2);
  expect(current.payload.saved[0].name).toBe("Later user change");
});

it("requires the original account's current access to source and destination when resuming", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const copy = await beginCopy();
  await expect(
    rpc("builder_project_copy_resume", [copy.project_id, bob]),
  ).rejects.toThrow("original account");
  await db.query("update builder_projects set archived=true where id=$1", [
    copy.project_id,
  ]);
  await expect(
    rpc("builder_project_copy_resume", [copy.project_id, alice]),
  ).rejects.toThrow("website access");
  await db.query("update builder_projects set archived=false where id=$1", [
    copy.project_id,
  ]);
  await db.query(
    "insert into builder_project_members(project_id,user_id,role,can_publish) values($1,$2,'owner',true)",
    [project, bob],
  );
  await rpc("builder_take_project_billing", [project, bob]);
  await db.query(
    "delete from builder_project_members where project_id=$1 and user_id=$2",
    [project, alice],
  );
  await expect(
    rpc("builder_project_copy_resume", [copy.project_id, alice]),
  ).rejects.toThrow("website access");
});

it("restarts an expired copy file only after verified removal and local acknowledgement, with old tokens fenced out", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const copy = await beginCopy(),
    asset = copy.workspace.assets[0];
  const upload = await claim(
    await reserve(13, { project: copy.project_id, asset: asset.id }),
  );
  await rpc("builder_upload_cancel", [copy.project_id, alice, upload.id]);
  await claim(upload, upload.owner_token, null, true);
  const receipt = {
    id: upload.id,
    attemptId: upload.owner_token,
    localRemoved: true,
    providerRemoved: true,
    verifiedAt: new Date().toISOString(),
  };
  await rpc("builder_upload_remove_finish", [
    upload.id,
    worker,
    upload.owner_token,
    receipt,
  ]);
  await rpc("builder_project_copy_resume", [copy.project_id, alice]);
  expect(
    (await rpc("builder_upload_worker_read", [upload.id, worker])).status,
  ).toBe("removed");
  expect((await usage(copy.project_id)).registered_bytes).toBe(13);
  await rpc("builder_upload_cleanup_ack", [
    upload.id,
    worker,
    upload.owner_token,
  ]);
  await rpc("builder_project_copy_resume", [copy.project_id, alice]);
  expect(
    await rpc("builder_upload_worker_read", [upload.id, worker]),
  ).toMatchObject({
    status: "reserved",
    completed_token: null,
    owner_token: null,
    cancel_requested: false,
    local_cleanup_pending: true,
  });
  await expect(
    rpc("builder_upload_remove_finish", [
      upload.id,
      worker,
      upload.owner_token,
      receipt,
    ]),
  ).rejects.toThrow("no longer owns");
  const next = await claim(upload);
  expect(next.owner_token).not.toBe(upload.owner_token);
});

it("keeps frozen copy contents private and returns only permitted pending-copy summaries", async () => {
  await db.exec("update builder_plans set projects=10 where id='free'");
  const copy = await beginCopy();
  for (const role of ["anon", "authenticated", "service_role"])
    await expect(
      as(role, alice, "select * from builder_project_copies"),
    ).rejects.toThrow("permission denied");
  for (const role of ["anon", "authenticated"])
    for (const name of [
      "builder_project_copy_state",
      "builder_project_copy_resume",
      "builder_project_copy_finish",
    ])
      await expect(
        as(role, alice, `select ${name}($1,$2)`, [copy.project_id, alice]),
      ).rejects.toThrow("permission denied");
  expect(await rpc("builder_project_copy_summaries", [bob])).toEqual([]);
  await db.query(
    "insert into builder_project_members(project_id,user_id,role) values($1,$2,'editor')",
    [copy.project_id, bob],
  );
  expect(await rpc("builder_project_copy_summaries", [bob])).toEqual([
    {
      projectId: copy.project_id,
      pending: true,
      canResume: false,
      files: 1,
      copied: 0,
    },
  ]);
});

it("transfers the Edge copy through the actual HTTP upload service and quota database before completion", async () => {
  const api = await hostedFixture();
  const host = await startUploadHost({ service: api.service, port: 0 });
  try {
    await copyFileThroughUploadService({
      origin: "https://builder.example.test",
      token: alice,
      projectId: project,
      asset: {
        id: api.file.assetId,
        size: 13,
        hash: api.file.sha256,
        kind: "image",
        mime: "image/png",
      } as Asset,
      bytes: new TextEncoder().encode("fixture bytes").buffer,
      fetch: (input, init) => {
        const url = new URL(String(input));
        expect(url.origin).toBe("https://builder.example.test");
        return fetch(`${host.origin}${url.pathname}`, init);
      },
    });
    expect(api.stored.get(api.id)?.toString()).toBe("fixture bytes");
    expect(await api.spool.state(api.id)).toBeNull();
    expect((await usage()).storage_bytes).toBe(13);
  } finally {
    await host.close();
  }
});

const registrationAsset = (api: Awaited<ReturnType<typeof hostedFixture>>) => ({
  id: api.file.assetId,
  hash: api.file.sha256,
  size: api.file.bytes,
  mime: api.file.mime,
  kind: api.file.kind,
  name: "Fixture image",
  path: "fixture.png",
  pack: "Fixture",
  url: "https://untrusted.example.test/forged.png",
  tags: [],
  favourite: false,
});
const registerFile = (target: string, asset: any, actor = alice) =>
  rpc("builder_register_asset", [
    target,
    actor,
    JSON.stringify(asset),
    "https://fixture.supabase.co",
  ]);
const adoptFile = (
  api: Awaited<ReturnType<typeof hostedFixture>>,
  description = api.file,
) =>
  api.send("POST", "/adopt", undefined, {
    "Upload-Length": String(description.bytes),
    "Upload-Metadata": `file ${Buffer.from(JSON.stringify(description)).toString("base64")}`,
  });
async function preexistingFile(api: Awaited<ReturnType<typeof hostedFixture>>) {
  await storedObject({
    id: api.id,
    bytes: api.file.bytes,
    bucket_id:
      api.file.projectId === "kaizen"
        ? "builder-media"
        : "builder-project-files",
    object_name:
      api.file.projectId === "kaizen"
        ? api.file.assetId
        : `${api.file.projectId}/${api.file.assetId}`,
  });
  api.stored.set(api.id, Buffer.from("fixture bytes"));
  // Existing provider files are reconciled by migration 010 at cutover. These
  // fixtures add them after migrations have run, so establish that same baseline.
  await db.query("select builder_storage_sync($1)", [api.file.projectId]);
}
const fileRecord = async (target: string, assetId: string) =>
  (
    await db.query<any>(
      "select * from builder_asset_files where project_id=$1 and asset_id=$2",
      [target, assetId],
    )
  ).rows[0];

it("preserves migrated library identities and metadata without claiming a fresh verification", async () => {
  expect(await fileRecord("kaizen", legacyAsset.id)).toMatchObject({
    status: "legacy",
    verified_at: null,
    file_url: legacyAsset.url,
  });
  await as(
    "authenticated",
    beta,
    "update builder_assets set payload=payload||'{\"favourite\":true}'::jsonb where id=$1",
    [legacyAsset.id],
  );
  await expect(
    as(
      "authenticated",
      beta,
      "update builder_assets set payload=jsonb_set(payload,'{size}','1') where id=$1",
      [legacyAsset.id],
    ),
  ).rejects.toThrow("Verify this file");
  await expect(
    as(
      "authenticated",
      beta,
      "update builder_assets set payload=jsonb_set(payload,'{url}','\"https://untrusted.example.test/file\"') where id=$1",
      [legacyAsset.id],
    ),
  ).rejects.toThrow("verified address");
  expect(
    (
      await db.query<any>("select payload from builder_assets where id=$1", [
        legacyAsset.id,
      ])
    ).rows[0].payload,
  ).toMatchObject({ favourite: true, size: 40, url: legacyAsset.url });
});

it("requires a verified file record and actual provider metadata before registering a new client asset", async () => {
  const api = await hostedFixture(),
    asset = registrationAsset(api);
  await preexistingFile(api);
  await expect(registerFile(project, asset)).rejects.toThrow(
    "Verify this file",
  );
  expect((await adoptFile(api)).status).toBe(200);
  const result = await registerFile(project, asset);
  expect(result.url).toBe(projectAssetUrl(project, asset.id));
  expect((await fileRecord(project, asset.id)).status).toBe("verified");
  expect(await registerFile(project, asset)).toEqual(result);
  await expect(
    registerFile(project, { ...asset, pack: "Other" }),
  ).rejects.toThrow("already in use");
  expect(
    (
      await db.query<any>(
        "select version from builder_project_workspaces where project_id=$1",
        [project],
      )
    ).rows[0].version,
  ).toBe(1);
});

it("registers original Kaizen uploads through the same verified RPC and denies direct browser insertion", async () => {
  await db.query(
    "insert into builder_project_members(project_id,user_id,role) values('kaizen',$1,'editor')",
    [alice],
  );
  const api = await hostedFixture("kaizen"),
    asset = registrationAsset(api);
  await api.start();
  await api.patch(0, "fixture bytes");
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(200);
  expect((await fileRecord("kaizen", asset.id)).file_url).toBeNull();
  const result = await registerFile("kaizen", asset);
  expect(result.url).toBe(
    `https://fixture.supabase.co/storage/v1/object/public/builder-media/${asset.id}`,
  );
  await expect(
    as(
      "authenticated",
      alice,
      "insert into builder_assets(id,hash,payload) values($1,$2,$3)",
      [randomUUID(), asset.hash, asset],
    ),
  ).rejects.toThrow("permission denied");
  await as(
    "authenticated",
    alice,
    "update builder_assets set payload=payload||'{\"favourite\":true}'::jsonb where id=$1",
    [asset.id],
  );
  await expect(
    as(
      "authenticated",
      alice,
      "update builder_assets set payload=jsonb_set(payload,'{mime}','\"text/html\"') where id=$1",
      [asset.id],
    ),
  ).rejects.toThrow("Verify this file");
});

it("adopts already-existing bytes without a temporary reservation or overwrite, including after downgrade", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  await db.exec("update builder_plans set storage_bytes=12 where id='free'");
  expect((await adoptFile(api)).status).toBe(200);
  await registerFile(project, registrationAsset(api));
  expect(await usage()).toMatchObject({
    storage_bytes: 13,
    workspace_bytes: 13,
    registered_bytes: 13,
  });
  expect(api.controls.writes).toBe(0);
  expect(await api.spool.state(api.id)).toBeNull();
  expect(
    (await db.query("select id from builder_uploads where id=$1", [api.id]))
      .rows,
  ).toHaveLength(0);
  expect(await api.service.maintain()).toEqual({
    examined: 0,
    cleaned: 0,
    deferred: 0,
  });
  expect(api.stored.has(api.id)).toBe(true);
});

it("keeps provider bytes and their observed quota after a failed adoption checksum", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  expect((await adoptFile(api, { ...api.file, sha256: hash })).status).not.toBe(
    200,
  );
  expect(api.stored.has(api.id)).toBe(true);
  expect((await usage()).storage_bytes).toBe(13);
  expect(await fileRecord(project, api.file.assetId)).toBeUndefined();
  expect(await api.spool.state(api.id)).toBeNull();
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 0,
    catalogued: 1,
  });
  expect(await fileRecord(project, api.file.assetId)).toMatchObject({
    status: "observed",
    sha256: api.file.sha256,
  });
});

it("refuses adoption completion after current account access changes", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  api.controls.revokeDuringVerify = true;
  expect((await adoptFile(api)).status).toBe(403);
  expect(await fileRecord(project, api.file.assetId)).toBeUndefined();
  expect(api.stored.has(api.id)).toBe(true);
  expect((await usage()).storage_bytes).toBe(13);
});

it("reconciles the original upload owner before adopting a provider write whose database finish failed", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture bytes");
  api.controls.failFinish = true;
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(503);
  expect(
    (await rpc("builder_upload_worker_read", [api.id, worker])).status,
  ).toBe("storing");
  expect(await fileRecord(project, api.file.assetId)).toBeUndefined();
  api.controls.failFinish = false;
  expect((await adoptFile(api)).status).toBe(200);
  expect(
    (await rpc("builder_upload_worker_read", [api.id, worker])).status,
  ).toBe("stored");
  expect((await fileRecord(project, api.file.assetId)).status).toBe("verified");
  expect(api.controls.writes).toBe(1);
  expect(await api.spool.state(api.id)).toBeNull();
  expect(await cleanupQueue()).toEqual([]);
});

it("rejects changed immutable file fields and URLs even through direct workspace commits", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  await adoptFile(api);
  const asset = await registerFile(project, registrationAsset(api));
  for (const patch of [
    { size: 1 },
    { hash },
    { mime: "text/html" },
    { kind: "code" },
    { url: projectAssetUrl(randomUUID(), asset.id) },
  ]) {
    await expect(
      rpc("builder_commit_project_workspace", [
        project,
        alice,
        1,
        JSON.stringify({
          pages: [],
          assets: [{ ...asset, ...patch }],
          saved: [],
        }),
      ]),
    ).rejects.toThrow(/Verify this file|verified address/);
  }
  expect(
    (
      await db.query<any>(
        "select version from builder_project_workspaces where project_id=$1",
        [project],
      )
    ).rows[0].version,
  ).toBe(1);
});

it("denies browser access to private file records and adoption/registration RPCs", async () => {
  for (const role of ["anon", "authenticated", "service_role"])
    await expect(
      as(role, alice, "select * from builder_asset_files"),
    ).rejects.toThrow("permission denied");
  for (const role of ["anon", "authenticated"]) {
    await expect(
      as(
        role,
        alice,
        "select builder_register_asset($1,$2,'{}','https://fixture.supabase.co')",
        [project, alice],
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      as(
        role,
        alice,
        "select builder_asset_adoption_context($1,$2,$3,$4,13,$5,'image/png','image',$6)",
        [project, alice, randomUUID(), randomUUID(), hash, worker],
      ),
    ).rejects.toThrow("permission denied");
  }
});

it("requires fresh exact adoption evidence and refuses a provider change after verification", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  const args = [
    project,
    alice,
    api.id,
    api.file.assetId,
    13,
    api.file.sha256,
    "image/png",
    "image",
    worker,
  ];
  const receipt = {
    bytes: 13,
    sha256: api.file.sha256,
    version: "fixture-version",
    etag: "fixture-etag",
    verifiedAt: new Date().toISOString(),
  };
  for (const changed of [
    { ...receipt, bytes: "13" },
    { ...receipt, sha256: hash },
    { ...receipt, extra: true },
    { ...receipt, verifiedAt: "2020-01-01T00:00:00Z" },
  ])
    await expect(
      rpc("builder_asset_adopt_finish", [...args, changed]),
    ).rejects.toThrow(/evidence|Fresh stored file/);
  await db.query("update storage.objects set version='changed' where name=$1", [
    `${project}/${api.file.assetId}`,
  ]);
  await expect(
    rpc("builder_asset_adopt_finish", [...args, receipt]),
  ).rejects.toThrow("changed during verification");
  expect(await fileRecord(project, api.file.assetId)).toBeUndefined();
});

it("cannot replace a migrated library identity by uploading to its missing provider key", async () => {
  await db.query(
    "delete from storage.objects where bucket_id='builder-media' and name=$1",
    [legacyAsset.id],
  );
  await expect(
    reserve(40, {
      actor: beta,
      project: "kaizen",
      asset: legacyAsset.id,
      hash: legacyAsset.hash,
    }),
  ).rejects.toThrow("library file already exists");
  expect(
    (
      await db.query("select id from builder_uploads where asset_id=$1", [
        legacyAsset.id,
      ])
    ).rows,
  ).toHaveLength(0);
  expect((await fileRecord("kaizen", legacyAsset.id)).status).toBe("legacy");
});

const references = (target: string, assetId: string) =>
  as("service_role", null, "select * from builder_asset_references($1,$2)", [
    target,
    assetId,
  ]);
async function removalState(
  target: string,
  assetId: string,
  status = "removing",
) {
  await db.exec("savepoint removal_fixture");
  try {
    await db.query(
      "update builder_asset_files set status=$3 where project_id=$1 and asset_id=$2",
      [target, assetId, status],
    );
  } catch (error) {
    await db.exec("rollback to savepoint removal_fixture");
    throw error;
  } finally {
    await db.exec("release savepoint removal_fixture");
  }
}
async function unregisteredFile() {
  const api = await hostedFixture();
  await preexistingFile(api);
  expect((await adoptFile(api)).status).toBe(200);
  return {
    api,
    id: api.file.assetId,
    url: projectAssetUrl(project, api.file.assetId),
  };
}

it("retains library files and saved revisions after their current page stops using them", async () => {
  const file = await unregisteredFile();
  const asset = await registerFile(project, registrationAsset(file.api));
  expect(await references(project, file.id)).toEqual([
    { source: "Workspace and library", reference_count: 1 },
  ]);
  await expect(removalState(project, file.id)).rejects.toThrow("still used");
  await rpc("builder_commit_project_workspace", [
    project,
    alice,
    1,
    JSON.stringify({
      pages: [
        {
          id: randomUUID(),
          draft: { title: "Changed image" },
          revisions: [{ document: { image: asset.url } }],
        },
      ],
      assets: [],
      saved: [],
    }),
  ]);
  expect(await references(project, file.id)).toEqual([
    { source: "Workspace and library", reference_count: 1 },
  ]);
  await expect(removalState(project, file.id)).rejects.toThrow("still used");
  expect(file.api.stored.has(file.api.id)).toBe(true);
});

it("releases expired preview references and refuses a later revival while the file is being removed", async () => {
  const file = await unregisteredFile(),
    preview = randomUUID();
  await db.query(
    "insert into builder_project_previews(project_id,id,payload,expires_at) values($1,$2,$3,now()+interval '1 hour')",
    [project, preview, { document: { image: file.url } }],
  );
  expect(await references(project, file.id)).toEqual([
    { source: "Client previews", reference_count: 1 },
  ]);
  await expect(removalState(project, file.id)).rejects.toThrow("still used");
  await db.query(
    "update builder_project_previews set expires_at=now()-interval '1 hour' where id=$1",
    [preview],
  );
  expect(await references(project, file.id)).toEqual([]);
  await removalState(project, file.id);
  await expect(
    as(
      "service_role",
      null,
      "update builder_project_previews set expires_at=now()+interval '1 hour' where id=$1",
      [preview],
    ),
  ).rejects.toThrow("being removed");
  await expect(
    rpc("builder_commit_project_workspace", [
      project,
      alice,
      0,
      JSON.stringify({ pages: [], assets: [], saved: [{ image: file.url }] }),
    ]),
  ).rejects.toThrow("being removed");
  expect((await fileRecord(project, file.id)).status).toBe("removing");
});

it.each(["completion", "cancellation"])(
  "retains source and destination references until copy %s",
  async (ending) => {
    const file = await unregisteredFile();
    const sourceFile = await fileRecord(project, file.id);
    await db.exec("update builder_plans set projects=10 where id='free'");
    const destination = (
      await as(
        "authenticated",
        alice,
        "select builder_create_project('Copy fixture') as id",
      )
    )[0].id;
    const snapshot = {
      pages: [],
      assets: [{ id: file.id, url: projectAssetUrl(destination, file.id) }],
      saved: [],
    };
    await db.query(
      "insert into builder_project_copies(project_id,source_project_id,actor_id,source_legacy,requested_name,workspace) values($1,$2,$3,false,'Copy fixture',$4)",
      [destination, project, alice, snapshot],
    );
    expect(await references(project, file.id)).toEqual([
      { source: "Pending website copies", reference_count: 1 },
    ]);
    expect(await references(destination, file.id)).toEqual([
      { source: "Pending website copies", reference_count: 1 },
    ]);
    await expect(removalState(project, file.id)).rejects.toThrow("still used");
    if (ending === "cancellation") {
      await cancelCopy({ project_id: destination });
      expect(
        await rpc("builder_project_copy_purge", [destination, worker]),
      ).toBe(true);
    } else {
      await db.query(
        'update builder_project_copies set workspace=\'{"pages":[],"assets":[],"saved":[]}\',status=\'complete\' where project_id=$1',
        [destination],
      );
    }
    expect(await references(project, file.id)).toEqual([]);
    expect(await fileRecord(project, file.id)).toEqual(sourceFile);
  },
);

it("retains publication history after its review expires, including failed release snapshots", async () => {
  const file = await unregisteredFile(),
    destination = randomUUID(),
    review = randomUUID(),
    job = randomUUID();
  await db.query(
    "insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id) values($1,$2,'staging','https://references.example.test','Reference fixture','reference-worker','baseline')",
    [destination, project],
  );
  await db.query(
    "insert into builder_client_reviews(id,project_id,destination_id,actor,action,snapshot,workspace_version,destination_version,previous_artifact_id,artifact_id) values($1,$2,$3,$4,'publish',$5,0,1,'baseline','next')",
    [review, project, destination, alice, { image: file.url }],
  );
  await db.query(
    "insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,snapshot,previous_artifact_id,artifact_id,phase) values($1,$2,$3,'{}',1,'reference-worker',$4,'publish',$5,'baseline','next','failed')",
    [job, project, destination, alice, { image: file.url }],
  );
  expect((await references(project, file.id)).map((r) => r.source)).toEqual([
    "Publication history",
    "Publication reviews",
  ]);
  await db.query(
    "update builder_client_reviews set expires_at=now()-interval '1 hour' where id=$1",
    [review],
  );
  expect(await references(project, file.id)).toEqual([
    { source: "Publication history", reference_count: 1 },
  ]);
  await expect(removalState(project, file.id)).rejects.toThrow("still used");
});

it("includes legacy content and cross-project media references before requiring native repository proof", async () => {
  await db.query("update builder_routes set payload=$1 where id='site'", [
    { draft: [{ source: "/image", destination: `/media/${legacyAsset.id}` }] },
  ]);
  await db.query("insert into builder_pages(id,payload) values($1,$2)", [
    randomUUID(),
    {
      draft: {
        title: "Reference fixture",
        slug: "/reference-fixture/",
        image: legacyAsset.url,
      },
      revisions: [{ document: { image: legacyAsset.url } }],
    },
  ]);
  await db.query("insert into builder_saved(id,payload) values($1,$2)", [
    randomUUID(),
    { image: legacyAsset.url },
  ]);
  await db.query("update builder_projects set settings=$2 where id=$1", [
    project,
    { image: legacyAsset.url },
  ]);
  const sources = (await references("kaizen", legacyAsset.id)).map(
    (r) => r.source,
  );
  expect(sources).toEqual(
    expect.arrayContaining([
      "Library",
      "Pages and history",
      "Redirects",
      "Saved blocks",
      "Website settings",
    ]),
  );
  await expect(removalState("kaizen", legacyAsset.id)).rejects.toThrow(
    "still used",
  );
  await db.query("delete from builder_assets where id=$1", [legacyAsset.id]);
  await db.exec("delete from builder_pages; delete from builder_saved");
  await db.exec(
    'update builder_routes set payload=\'{"draft":[],"published":[],"revisions":[]}\' where id=\'site\'',
  );
  expect(await references("kaizen", legacyAsset.id)).toEqual([
    { source: "Website settings", reference_count: 1 },
  ]);
  await db.query("update builder_projects set settings='{}' where id=$1", [
    project,
  ]);
  expect(await references("kaizen", legacyAsset.id)).toEqual([]);
  await expect(removalState("kaizen", legacyAsset.id)).rejects.toThrow(
    "Verify repository",
  );
});

it("keeps a removed file unavailable to new settings, previews, copies and workspace references", async () => {
  const file = await unregisteredFile();
  await removalState(project, file.id, "removed");
  await expect(
    as(
      "service_role",
      null,
      "update builder_projects set settings=$2 where id=$1",
      [project, { logo: file.url }],
    ),
  ).rejects.toThrow("being removed");
  await expect(
    as(
      "service_role",
      null,
      "insert into builder_project_previews(project_id,id,payload,expires_at) values($1,$2,$3,now()+interval '1 hour')",
      [project, randomUUID(), { image: file.url }],
    ),
  ).rejects.toThrow("being removed");
  await expect(
    rpc("builder_commit_project_workspace", [
      project,
      alice,
      0,
      JSON.stringify({
        pages: [{ draft: { image: file.url } }],
        assets: [],
        saved: [],
      }),
    ]),
  ).rejects.toThrow("being removed");
  expect(file.api.stored.has(file.api.id)).toBe(true); // State fencing alone is not provider deletion.
});

it("prevents project cascades from losing provider objects and unfinished upload reservations", async () => {
  const upload = await reserve();
  await expect(
    as("service_role", null, "delete from builder_projects where id=$1", [
      project,
    ]),
  ).rejects.toThrow("verified website file cleanup");
  expect(
    await rpc("builder_upload_worker_read", [upload.id, worker]),
  ).toMatchObject({ id: upload.id, status: "reserved" });
  const file = await unregisteredFile();
  await removalState(project, file.id, "removed");
  await expect(
    as("service_role", null, "delete from builder_projects where id=$1", [
      project,
    ]),
  ).rejects.toThrow("verified website file cleanup");
  expect(
    (
      await db.query(
        "select name from storage.objects where bucket_id='builder-project-files'",
      )
    ).rows,
  ).toEqual([{ name: `${project}/${file.id}` }]);
  await expect(
    as("service_role", null, "delete from builder_projects where id='kaizen'"),
  ).rejects.toThrow("Preserve the original website");
});

it("keeps reference inventory private and scoped to the requested client project", async () => {
  const file = await unregisteredFile();
  await registerFile(project, registrationAsset(file.api));
  for (const role of ["anon", "authenticated"])
    await expect(
      as(role, alice, "select * from builder_asset_references($1,$2)", [
        project,
        file.id,
      ]),
    ).rejects.toThrow("permission denied");
  expect(await references(randomUUID(), file.id)).toEqual([]);
});

const assetQueue = (chosenWorker = worker) =>
  rpc("builder_asset_cleanup_queue", [chosenWorker, 20]);
const assetJob = async (assetId: string) =>
  (
    await db.query<any>(
      "select * from builder_asset_cleanup where project_id=$1 and asset_id=$2",
      [project, assetId],
    )
  ).rows[0];
async function dueAsset(assetId: string) {
  await assetQueue();
  const job = await assetJob(assetId);
  expect(job?.phase).toBe("pending");
  await db.query(
    "update builder_asset_cleanup set eligible_at=now()-interval '1 day' where id=$1",
    [job.id],
  );
  return job;
}

it("removes unused verified files through the worker and releases each object only once", async () => {
  for (const uploaded of [false, true]) {
    const api = await hostedFixture();
    if (uploaded) {
      await api.start();
      await api.patch(0, "fixture bytes");
      expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(200);
    } else {
      await preexistingFile(api);
      expect((await adoptFile(api)).status).toBe(200);
    }
    expect(await assetQueue()).toEqual([]);
    expect(api.stored.has(api.id)).toBe(true);
    expect((await usage()).storage_bytes).toBe(13);
    const job = await dueAsset(api.file.assetId);
    expect(await api.service.maintain()).toEqual({
      examined: 1,
      cleaned: 1,
      deferred: 0,
    });
    expect(api.stored.has(api.id)).toBe(false);
    expect((await fileRecord(project, api.file.assetId)).status).toBe(
      "removed",
    );
    expect(await assetJob(api.file.assetId)).toMatchObject({
      phase: "removed",
      local_cleanup_pending: false,
    });
    expect(await api.spool.state(job.id)).toBeNull();
    expect((await usage()).storage_bytes).toBe(0);
    if (uploaded)
      expect(
        await rpc("builder_upload_worker_read", [api.id, worker]),
      ).toMatchObject({ status: "removed", local_cleanup_pending: false });
    expect(await api.service.maintain()).toEqual({
      examined: 0,
      cleaned: 0,
      deferred: 0,
    });
  }
});

it("restarts the recovery window when a new reference appears before cleanup claims the file", async () => {
  const file = await unregisteredFile(),
    job = await dueAsset(file.id);
  await db.query("update builder_projects set settings=$2 where id=$1", [
    project,
    { image: file.url },
  ]);
  expect(
    new Date((await assetJob(file.id)).eligible_at).getTime(),
  ).toBeGreaterThan(Date.now() + 6 * 86400000);
  await db.query("update builder_projects set settings='{}' where id=$1", [
    project,
  ]);
  await expect(
    rpc("builder_asset_cleanup_claim", [job.id, worker, randomUUID(), null]),
  ).rejects.toThrow("import recovery");
  expect(await file.api.service.maintain()).toEqual({
    examined: 0,
    cleaned: 0,
    deferred: 0,
  });
  expect(file.api.stored.has(file.api.id)).toBe(true);
});

it("keeps adopted bytes charged after provider deletion until SQL confirms cleanup", async () => {
  const file = await unregisteredFile(),
    job = await dueAsset(file.id);
  file.api.controls.failAssetFinish = true;
  expect(await file.api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 1,
  });
  expect(file.api.stored.has(file.api.id)).toBe(false);
  expect((await assetJob(file.id)).phase).toBe("removing");
  expect((await file.api.spool.state(job.id))?.released).toBe(true);
  await reserve(1); // Forces fresh physical usage accounting after the lost completion.
  expect((await usage()).storage_bytes).toBe(14);
  file.api.controls.failAssetFinish = false;
  expect(await file.api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
  expect((await usage()).storage_bytes).toBe(1);
  expect(await file.api.spool.state(job.id)).toBeNull();
});

it("reconciles lost cleanup replies and retries local acknowledgement after forgetting the spool", async () => {
  const file = await unregisteredFile(),
    job = await dueAsset(file.id);
  file.api.controls.loseAssetFinishReply = true;
  file.api.controls.failAssetAck = true;
  expect(await file.api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 1,
  });
  expect(await assetJob(file.id)).toMatchObject({
    phase: "removed",
    local_cleanup_pending: true,
  });
  expect((await usage()).storage_bytes).toBe(0);
  expect(await file.api.spool.state(job.id)).toBeNull();
  file.api.controls.failAssetAck = false;
  expect(await file.api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
  expect((await assetJob(file.id)).local_cleanup_pending).toBe(false);
});

it("preserves changed provider bytes and fences new references while cleanup awaits reconciliation", async () => {
  const file = await unregisteredFile();
  await dueAsset(file.id);
  file.api.stored.set(file.api.id, Buffer.from("changed bytes"));
  expect(await file.api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 1,
  });
  expect(file.api.stored.get(file.api.id)?.toString()).toBe("changed bytes");
  expect((await usage()).storage_bytes).toBe(13);
  await expect(
    rpc("builder_commit_project_workspace", [
      project,
      alice,
      0,
      JSON.stringify({ pages: [], assets: [], saved: [{ image: file.url }] }),
    ]),
  ).rejects.toThrow("being removed");
  file.api.stored.set(file.api.id, Buffer.from("fixture bytes"));
  expect(await file.api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
});

it("serializes stored cleanup with the original upload/adoption lock", async () => {
  const file = await unregisteredFile(),
    job = await dueAsset(file.id);
  await file.api.spool.withUpload(file.api.id, async () => {
    expect(await file.api.service.maintain()).toEqual({
      examined: 1,
      cleaned: 0,
      deferred: 1,
    });
    expect((await assetJob(file.id)).phase).toBe("pending");
    expect(file.api.stored.has(file.api.id)).toBe(true);
    expect(await file.api.spool.state(job.id)).toBeNull();
  });
  expect(await file.api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
});

it("requires actual stopped-process evidence before taking over another cleanup attempt", async () => {
  const file = await unregisteredFile(),
    job = await dueAsset(file.id),
    token = randomUUID();
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  await once(child, "spawn");
  try {
    await file.api.spool.withUpload(job.id, async () => {
      await file.api.spool.reserve(job.id, 13, true);
      await file.api.spool.setAttempt(job.id, {
        token,
        pid: child.pid!,
        host: (await import("node:os")).hostname(),
        receipt: null,
      });
    });
    await rpc("builder_asset_cleanup_claim", [job.id, worker, token, null]);
    expect(await file.api.service.maintain()).toEqual({
      examined: 1,
      cleaned: 0,
      deferred: 1,
    });
    expect((await assetJob(file.id)).owner_token).toBe(token);
    const exited = once(child, "exit");
    child.kill();
    await exited;
    expect(await file.api.service.maintain()).toEqual({
      examined: 1,
      cleaned: 1,
      deferred: 0,
    });
    expect((await assetJob(file.id)).completed_token).not.toBe(token);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
});

it("requires private ownership, fresh exact removal evidence and observed provider absence", async () => {
  const file = await unregisteredFile(),
    job = await dueAsset(file.id),
    token = randomUUID();
  for (const role of ["anon", "authenticated", "service_role"])
    await expect(
      as(role, alice, "select * from builder_asset_cleanup"),
    ).rejects.toThrow("permission denied");
  for (const role of ["anon", "authenticated"])
    await expect(
      as(role, alice, "select builder_asset_cleanup_read($1,$2)", [
        job.id,
        worker,
      ]),
    ).rejects.toThrow("permission denied");
  expect(await assetQueue("another-worker")).toEqual([]);
  await expect(
    rpc("builder_asset_cleanup_claim", [job.id, "another-worker", token, null]),
  ).rejects.toThrow("Configured file cleanup worker");
  await rpc("builder_asset_cleanup_claim", [job.id, worker, token, null]);
  const receipt = {
    id: job.id,
    attemptId: token,
    localRemoved: true,
    providerRemoved: true,
    verifiedAt: new Date().toISOString(),
  };
  for (const patch of [
    { providerRemoved: false },
    { unexpected: true },
    { verifiedAt: new Date(Date.now() - 600000).toISOString() },
  ])
    await expect(
      rpc("builder_asset_cleanup_finish", [
        job.id,
        worker,
        token,
        { ...receipt, ...patch },
      ]),
    ).rejects.toThrow(/Verified file removal|required|Confirm the stored file/);
  await expect(
    rpc("builder_asset_cleanup_finish", [job.id, worker, token, receipt]),
  ).rejects.toThrow("Confirm the stored file");
  await expect(
    rpc("builder_asset_cleanup_claim", [job.id, worker, randomUUID(), null]),
  ).rejects.toThrow("Reconcile the existing");
  // Provider metadata fixture: the worker/API removal is covered above.
  await db.query(
    "delete from storage.objects where bucket_id='builder-project-files' and name=$1",
    [`${project}/${file.id}`],
  );
  await rpc("builder_asset_cleanup_finish", [job.id, worker, token, receipt]);
  await rpc("builder_asset_cleanup_finish", [job.id, worker, token, receipt]);
  await expect(
    rpc("builder_asset_cleanup_finish", [
      job.id,
      worker,
      token,
      { ...receipt, verifiedAt: new Date(Date.now() + 1).toISOString() },
    ]),
  ).rejects.toThrow("evidence changed");
  expect((await usage()).storage_bytes).toBe(0);
});

it("cleans an empty legacy file with a metadata-only recovery record", async () => {
  const api = await hostedFixture();
  await db.query(
    "insert into builder_asset_files(project_id,asset_id,bytes,sha256,mime,asset_kind,bucket_id,object_name,file_url,status) values($1,$2,0,$3,'text/plain','other','builder-project-files',$4,$5,'legacy')",
    [
      project,
      api.file.assetId,
      createHash("sha256").update("").digest("hex"),
      `${project}/${api.file.assetId}`,
      projectAssetUrl(project, api.file.assetId),
    ],
  );
  await storedObject({
    bytes: 0,
    bucket_id: "builder-project-files",
    object_name: `${project}/${api.file.assetId}`,
  });
  api.stored.set(api.id, Buffer.alloc(0));
  const job = await dueAsset(api.file.assetId);
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
  expect(api.stored.has(api.id)).toBe(false);
  expect(await api.spool.state(job.id)).toBeNull();
  expect((await fileRecord(project, api.file.assetId)).status).toBe("removed");
});

const discoveryQueue = (chosenWorker = worker, batch = 20) =>
  rpc("builder_asset_discovery_queue", [chosenWorker, batch]);
const discoveryJob = async (objectName: string) =>
  (
    await db.query<any>(
      "select * from builder_asset_discovery where bucket_id='builder-project-files' and object_name=$1",
      [objectName],
    )
  ).rows[0];
const discoveryReceipt = (api: Awaited<ReturnType<typeof hostedFixture>>) => ({
  present: true,
  bytes: api.file.bytes,
  sha256: api.file.sha256,
  mime: api.file.mime,
  version: "fixture-version",
  etag: "fixture-etag",
  verifiedAt: new Date().toISOString(),
});

it("discovers uncatalogued bytes without registering a library file and cleans only after recovery grace", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 0,
    catalogued: 1,
  });
  const file = await fileRecord(project, api.file.assetId);
  expect(file).toMatchObject({
    status: "observed",
    identity_source: "discovery",
    bytes: 13,
    sha256: api.file.sha256,
    mime: api.file.mime,
  });
  expect((await usage()).storage_bytes).toBe(13);
  await expect(registerFile(project, registrationAsset(api))).rejects.toThrow(
    "Verify this file",
  );
  expect(api.controls.writes).toBe(0);
  expect(await api.spool.state(api.id)).toBeNull();
  expect(
    new Date((await assetJob(file.asset_id)).eligible_at).getTime(),
  ).toBeGreaterThan(Date.now() + 6 * 86400000);
  expect(await api.service.maintain()).toEqual({
    examined: 0,
    cleaned: 0,
    deferred: 0,
  });
  await dueAsset(file.asset_id);
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
  expect(api.stored.size).toBe(0);
  expect((await usage()).storage_bytes).toBe(0);
  expect((await discoveryJob(file.object_name)).phase).toBe("managed");
});

it("lets an interrupted import reverify and register a discovered canonical file", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  await api.service.maintain();
  expect((await fileRecord(project, api.file.assetId)).asset_kind).toBe(
    "other",
  );
  expect((await adoptFile(api, { ...api.file, sha256: hash })).status).not.toBe(
    200,
  );
  expect((await adoptFile(api)).status).toBe(200);
  const asset = await registerFile(project, registrationAsset(api));
  expect(await fileRecord(project, api.file.assetId)).toMatchObject({
    status: "verified",
    identity_source: "registered",
    asset_kind: "image",
    file_url: asset.url,
  });
  expect(asset.url).toBe(projectAssetUrl(project, api.file.assetId));
  expect((await usage()).storage_bytes).toBe(13);
  expect(await api.service.maintain()).toEqual({
    examined: 0,
    cleaned: 0,
    deferred: 0,
  });
  expect(api.stored.has(api.id)).toBe(true);
});

it("keeps older filenames used through literal, JSON-escaped or encoded URLs", async () => {
  const api = await hostedFixture();
  const objectName = `${project}/old folder/café #?"\\photo.png`,
    key = `builder-project-files/${objectName}`;
  await storedObject({
    id: randomUUID(),
    bucket_id: "builder-project-files",
    object_name: objectName,
    bytes: 13,
  });
  api.stored.set(key, Buffer.from("fixture bytes"));
  expect(await api.service.maintain()).toMatchObject({
    catalogued: 1,
    deferred: 0,
  });
  const found = await discoveryJob(objectName),
    file = await fileRecord(project, found.asset_id);
  expect(file.object_name).toBe(objectName);
  for (const address of [
    objectName,
    objectName.split("/").map(encodeURIComponent).join("/"),
  ]) {
    await db.query("update builder_projects set settings=$2 where id=$1", [
      project,
      {
        logo: `https://fixture.supabase.co/storage/v1/object/public/builder-project-files/${address}`,
      },
    ]);
    expect(await references(project, found.asset_id)).not.toEqual([]);
    expect(await api.service.maintain()).toMatchObject({
      cleaned: 0,
      deferred: 0,
    });
  }
  await db.query("update builder_projects set settings='{}' where id=$1", [
    project,
  ]);
  await dueAsset(found.asset_id);
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 1,
    deferred: 0,
  });
  expect(api.stored.has(key)).toBe(false);
  expect((await usage()).storage_bytes).toBe(0);
});

it("retains an observation and its quota when the provider identity changes before discovery completion", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  api.controls.changeDiscoveryVersion = true;
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 1,
  });
  expect(await fileRecord(project, api.file.assetId)).toBeUndefined();
  expect((await usage()).storage_bytes).toBe(13);
  expect((await discoveryJob(`${project}/${api.file.assetId}`)).phase).toBe(
    "pending",
  );
  api.controls.changeDiscoveryVersion = false;
  await db.query(
    "update storage.objects set version='fixture-version' where name=$1",
    [`${project}/${api.file.assetId}`],
  );
  expect(await api.service.maintain()).toMatchObject({
    catalogued: 1,
    deferred: 0,
  });
});

it("retries unknown discovery completion and reconciles a lost successful reply", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  api.controls.failDiscoveryFinish = true;
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 1,
  });
  expect(await fileRecord(project, api.file.assetId)).toBeUndefined();
  api.controls.failDiscoveryFinish = false;
  api.controls.loseDiscoveryFinishReply = true;
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 0,
  });
  expect((await fileRecord(project, api.file.assetId)).status).toBe("observed");
  expect(await api.service.maintain()).toEqual({
    examined: 0,
    cleaned: 0,
    deferred: 0,
  });
  expect(api.stored.size).toBe(1);
});

it("requires both provider and SQL absence before retiring an observation", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  const [id] = await discoveryQueue();
  await expect(
    rpc("builder_asset_discovery_finish", [
      id,
      worker,
      { present: false, verifiedAt: new Date().toISOString() },
    ]),
  ).rejects.toThrow("Confirm the observed file is absent");
  api.stored.clear();
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 1,
  });
  expect((await usage()).storage_bytes).toBe(13);
  await db.query("delete from storage.objects where name=$1", [
    `${project}/${api.file.assetId}`,
  ]);
  expect(await api.service.maintain()).toEqual({
    examined: 1,
    cleaned: 0,
    deferred: 0,
  });
  expect((await discoveryJob(`${project}/${api.file.assetId}`)).phase).toBe(
    "absent",
  );
  expect(await fileRecord(project, api.file.assetId)).toBeUndefined();
  expect((await usage()).storage_bytes).toBe(0);
});

it("does not rediscover registered files, upload ledgers or native Kaizen files", async () => {
  const api = await hostedFixture();
  await api.start();
  await api.patch(0, "fixture bytes");
  api.controls.failFinish = true;
  expect((await api.send("POST", `/${api.id}/finish`)).status).toBe(503);
  const second = await hostedFixture();
  await preexistingFile(second);
  expect((await adoptFile(second)).status).toBe(200);
  const native = await hostedFixture("kaizen");
  await preexistingFile(native);
  expect(await discoveryQueue()).toEqual([]);
  expect(await fileRecord(project, api.file.assetId)).toBeUndefined();
  expect((await fileRecord(project, second.file.assetId)).status).toBe(
    "verified",
  );
});

it("rechecks a concurrent successful adoption before accepting discovery data", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  const [id] = await discoveryQueue();
  expect((await adoptFile(api)).status).toBe(200);
  expect(
    await rpc("builder_asset_discovery_finish", [
      id,
      worker,
      discoveryReceipt(api),
    ]),
  ).toEqual({ catalogued: false });
  expect((await fileRecord(project, api.file.assetId)).identity_source).toBe(
    "registered",
  );
  expect(await rpc("builder_asset_discovery_read", [id, worker])).toBeNull();
});

it("uses the normal file lock while probing an uncatalogued upload", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  await api.spool.withUpload(api.id, async () => {
    expect(await api.service.maintain()).toEqual({
      examined: 1,
      cleaned: 0,
      deferred: 1,
    });
    expect(await fileRecord(project, api.file.assetId)).toBeUndefined();
  });
  expect(await api.service.maintain()).toMatchObject({
    catalogued: 1,
    deferred: 0,
  });
});

it("restricts discovery to its private worker and strictly validated fresh observations", async () => {
  const api = await hostedFixture();
  await preexistingFile(api);
  const [id] = await discoveryQueue();
  for (const role of ["anon", "authenticated", "service_role"]) {
    await expect(
      as(role, alice, "select * from builder_asset_discovery"),
    ).rejects.toThrow("permission denied");
    if (role !== "service_role") {
      await expect(
        as(role, alice, "select builder_asset_discovery_queue($1,20)", [
          worker,
        ]),
      ).rejects.toThrow("permission denied");
      await expect(
        as(role, alice, "select builder_asset_discovery_read($1,$2)", [
          id,
          worker,
        ]),
      ).rejects.toThrow("permission denied");
      await expect(
        as(role, alice, "select builder_asset_discovery_finish($1,$2,$3)", [
          id,
          worker,
          discoveryReceipt(api),
        ]),
      ).rejects.toThrow("permission denied");
    }
  }
  expect(await discoveryQueue("another-worker")).toEqual([]);
  await expect(
    rpc("builder_asset_discovery_read", [id, "another-worker"]),
  ).rejects.toThrow("Configured file discovery worker");
  for (const change of [
    { bytes: "13" },
    { bytes: 14 },
    { sha256: "bad" },
    { mime: null },
    { mime: "bad\nvalue" },
    { version: "replaced" },
    { etag: 123 },
    { extra: true },
    { verifiedAt: new Date(Date.now() - 600000).toISOString() },
    { verifiedAt: new Date(Date.now() + 600000).toISOString() },
  ]) {
    await expect(
      rpc("builder_asset_discovery_finish", [
        id,
        worker,
        { ...discoveryReceipt(api), ...change },
      ]),
    ).rejects.toThrow();
  }
  expect(await fileRecord(project, api.file.assetId)).toBeUndefined();
  expect((await usage()).storage_bytes).toBe(13);
  expect(
    await rpc("builder_asset_discovery_finish", [
      id,
      worker,
      discoveryReceipt(api),
    ]),
  ).toEqual({ catalogued: true });
});

it("leaves unsafe paths and unsupported metadata counted without automatic removal authority", async () => {
  for (const [name, metadata] of [
    [`${project}/../outside`, { size: 13, eTag: "fixture-etag" }],
    [`${project}/./outside`, { size: 13, eTag: "fixture-etag" }],
    [`${project}/bad\nname`, { size: 13, eTag: "fixture-etag" }],
    [`${project}/large`, { size: 52428801, eTag: "fixture-etag" }],
    [`${project}/missing-version-tag`, { size: 13 }],
  ] as const) {
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('builder-project-files',$1,$2)",
      [name, metadata],
    );
  }
  expect(await discoveryQueue()).toEqual([]);
  await db.query("select builder_storage_sync($1)", [project]);
  expect((await usage()).storage_bytes).toBe(52428853);
  await db.exec(
    "update builder_plans set storage_bytes=52428853 where id='free'",
  );
  await expect(reserve(1)).rejects.toThrow("storage limit");
});
