import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  BUILDER_LEGAL,
  currentLegalDocuments,
  isBuilderLegalState,
} from "../../shared/builderLegal";

let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111",
  person = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  stranger = "44444444-4444-4444-8444-444444444444";
const alpha = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  beta = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const requestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id)); alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ('${owner}','owner@fixture.invalid',now(),'{}'),('${person}','person@fixture.invalid',now(),'{"full_name":"Fixture person","private":"Unrelated private metadata"}'),
    ('${other}','other@fixture.invalid',now(),'{}'),('${stranger}','stranger@fixture.invalid',now(),'{}');`);
  for (const file of [
    "202609100001_visual_builder.sql",
    "202609100002_builder_site_design.sql",
    "202609100008_builder_releases.sql",
    "202609110001_builder_projects.sql",
    "202609120001_builder_project_capabilities.sql",
    "202609130001_builder_invitations.sql",
    "202609130002_builder_accounts.sql",
    "202609140004_builder_legal_privacy.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.exec(`insert into builder_projects(id,name) values('${alpha}','Alpha'),('${beta}','Other website');
    insert into builder_project_members(project_id,user_id,role,can_publish) values
    ('${alpha}','${owner}','owner',false),('${alpha}','${person}','editor',true),('${beta}','${other}','owner',true),('${beta}','${person}','editor',false);
    insert into builder_project_workspaces(project_id,payload) values('${alpha}','{"pages":[],"assets":[],"saved":[],"private":"Preserve website content"}');`);
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
async function as(role: string, sql: string, args: any[] = []) {
  await db.exec(`set role ${role}; savepoint legal_action`);
  try {
    return await db.query<any>(sql, args);
  } catch (error) {
    await db.exec("rollback to savepoint legal_action");
    throw error;
  } finally {
    await db.exec("release savepoint legal_action; reset role");
  }
}
async function rpc(name: string, args: any[]) {
  return (
    await as(
      "service_role",
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`,
      args,
    )
  ).rows[0].result;
}
const legal = (actor: string | null = person) =>
  rpc("builder_legal_state", [actor]);
const accept = (
  actor = person,
  version: string = BUILDER_LEGAL.version,
  terms: string = BUILDER_LEGAL.termsHash,
  privacy: string = BUILDER_LEGAL.privacyHash,
  confirmed = true,
) => rpc("builder_legal_accept", [actor, version, terms, privacy, confirmed]);
const request = (
  actor = person,
  project: string | null = alpha,
  kind = "export",
  details = "A copy of my submitted personal data",
  id = requestId,
) => rpc("builder_privacy_request", [actor, project, kind, details, id]);
const list = (
  actor: string | null = person,
  inbox = false,
  before: string | null = null,
) => rpc("builder_privacy_list", [actor, inbox, before]);
const update = (
  actor: string | null = owner,
  status = "in_review",
  version = 1,
  response = "We are checking the requested records.",
  id = requestId,
) => rpc("builder_privacy_update", [actor, id, version, status, response]);

it("registers the exact public document bytes and exposes no acceptance for a first sign-in", async () => {
  const state = await legal();
  expect(isBuilderLegalState(state)).toBe(true);
  expect(currentLegalDocuments(state)).toBe(true);
  expect(state).toEqual({ ...BUILDER_LEGAL, acceptedAt: null });
  for (const [name, hash] of [
    ["terms", BUILDER_LEGAL.termsHash],
    ["privacy", BUILDER_LEGAL.privacyHash],
  ]) {
    const bytes = await readFile(
      `src/pages/builder/legal/${BUILDER_LEGAL.version}/${name}.md`,
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
  }
});
it("records only the specified verified account once and preserves the original timestamp on retry", async () => {
  const first = await accept();
  expect(first.acceptedAt).toBeTruthy();
  expect(await accept()).toEqual(first);
  expect((await legal(owner)).acceptedAt).toBeNull();
  expect(
    (
      await db.query(
        "select count(*)::int as total from builder_legal_acceptances",
      )
    ).rows,
  ).toEqual([{ total: 1 }]);
});
it("refuses unconfirmed, changed and stale document acceptance", async () => {
  await expect(
    accept(
      person,
      BUILDER_LEGAL.version,
      BUILDER_LEGAL.termsHash,
      BUILDER_LEGAL.privacyHash,
      false,
    ),
  ).rejects.toThrow(/current document/);
  await expect(
    accept(person, BUILDER_LEGAL.version, "a".repeat(64)),
  ).rejects.toThrow(/current document/);
  await expect(accept(person, "2026-09-13" as any)).rejects.toThrow(
    /current document/,
  );
  expect((await legal()).acceptedAt).toBeNull();
});
it("requires explicit acceptance for a new version and preserves the old version's history", async () => {
  await accept();
  await db.exec(`update builder_legal_versions set active=false;
    insert into builder_legal_versions(version,terms_hash,privacy_hash,active) values('2026-09-15','${"a".repeat(64)}','${"b".repeat(64)}',true);`);
  const next = await legal();
  expect(next.acceptedAt).toBeNull();
  expect(currentLegalDocuments(next)).toBe(false);
  await expect(accept()).rejects.toThrow(/current document/);
  await rpc("builder_legal_accept", [
    person,
    next.version,
    next.termsHash,
    next.privacyHash,
    true,
  ]);
  expect(
    (
      await db.query(
        "select version from builder_legal_acceptances order by version",
      )
    ).rows,
  ).toEqual([{ version: "2026-09-14" }, { version: "2026-09-15" }]);
  await expect(
    as(
      "postgres",
      "update builder_legal_versions set terms_hash=$1 where version=$2",
      ["c".repeat(64), BUILDER_LEGAL.version],
    ),
  ).rejects.toThrow(/new legal document version/);
});
it.each(["anon", "authenticated", "service_role"])(
  "%s cannot directly read or forge legal acceptance or privacy rows",
  async (role) => {
    await request();
    await accept();
    for (const table of [
      "builder_legal_versions",
      "builder_legal_acceptances",
      "builder_privacy_requests",
    ]) {
      await expect(as(role, `select * from ${table}`)).rejects.toThrow(
        /permission denied/,
      );
      await expect(as(role, `delete from ${table}`)).rejects.toThrow(
        /permission denied/,
      );
    }
    if (role !== "service_role") {
      await expect(
        as(role, "select builder_legal_state($1)", [person]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(role, "select builder_privacy_list($1,true,null)", [owner]),
      ).rejects.toThrow(/permission denied/);
    }
  },
);
it("routes a website request to its current owner and exposes no other website or private account metadata", async () => {
  await request();
  const own = (await list()).items;
  expect(own).toHaveLength(1);
  expect(own[0]).toMatchObject({
    id: requestId,
    kind: "export",
    projectId: alpha,
    name: "Fixture person",
    email: "person@fixture.invalid",
    status: "open",
  });
  expect((await list(owner, true)).items).toEqual(own);
  expect((await list(other, true)).items).toEqual([]);
  expect((await list(stranger)).items).toEqual([]);
  expect((await list(null, true)).items).toEqual([]);
  expect(JSON.stringify(own)).not.toContain("Unrelated private metadata");
});
it("routes account requests and websites without owners to Kaizen's operator queue", async () => {
  await request(person, null);
  expect((await list(null, true)).items).toHaveLength(1);
  await expect(update(owner)).rejects.toThrow(/owner review/);
  await update(
    null,
    "fulfilled",
    1,
    "The requested copy was sent securely to the verified requester.",
  );
  expect((await list()).items[0].status).toBe("fulfilled");
  await request(
    person,
    alpha,
    "erasure",
    "Remove my name from the website.",
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  );
  await db.query(
    "delete from builder_project_members where project_id=$1 and user_id=$2",
    [alpha, owner],
  );
  expect(
    (await list(null, true)).items.some(
      (item: any) => item.projectId === alpha,
    ),
  ).toBe(true);
});
it("retains a request across transport retries but refuses another actor or changed content using its identity", async () => {
  expect(await request()).toBe(await request());
  expect((await list()).items).toHaveLength(1);
  await expect(request(owner)).rejects.toThrow(/different information/);
  await expect(request(person, beta)).rejects.toThrow(/different information/);
  await expect(request(person, alpha, "erasure")).rejects.toThrow(
    /different information/,
  );
});
it("requires current project membership to request and current owner authority to respond", async () => {
  await expect(request(stranger)).rejects.toThrow(/website access/);
  await request();
  await expect(update(person)).rejects.toThrow(/owner review/);
  await expect(update(other)).rejects.toThrow(/owner review/);
  await expect(update(null)).rejects.toThrow(/owner review/);
  await db.query(
    "update builder_project_members set role='editor' where project_id=$1 and user_id=$2",
    [alpha, owner],
  );
  await expect(update(owner)).rejects.toThrow(/owner review/);
  expect((await list(owner, true)).items).toEqual([]);
});
it("records an owner response without exporting, deleting an account or changing website contents", async () => {
  await request(
    person,
    alpha,
    "erasure",
    "Remove my contact details from an old page.",
  );
  await update(owner, "in_review");
  await expect(update(owner, "fulfilled", 1)).rejects.toThrow(
    /request changed/,
  );
  await update(
    owner,
    "fulfilled",
    2,
    "The relevant live record was removed; backup treatment was explained separately.",
  );
  const item = (await list()).items[0];
  expect(item).toMatchObject({ status: "fulfilled", version: 3 });
  expect(item.response).toContain("backup treatment");
  expect(
    (
      await db.query(
        "select payload->>'private' as content from builder_project_workspaces where project_id=$1",
        [alpha],
      )
    ).rows[0],
  ).toEqual({ content: "Preserve website content" });
  expect(
    (
      await db.query<{ deleted_at: string | null }>(
        "select deleted_at from auth.users where id=$1",
        [person],
      )
    ).rows[0].deleted_at,
  ).toBeNull();
});
it("only lets the requester cancel an open request and cannot reopen a handled request", async () => {
  await request();
  await expect(update(owner, "cancelled")).rejects.toThrow(/requester/);
  await update(person, "cancelled");
  await expect(update(owner, "in_review", 2)).rejects.toThrow(
    /request changed/,
  );
  expect((await list()).items[0].status).toBe("cancelled");
});
it("paginates complete request histories and refuses a cursor outside the caller's scope", async () => {
  await db.query(
    `insert into builder_privacy_requests(id,user_id,project_id,requester_name,requester_email,kind,details,requested_at)
    select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,$1,$2,'Fixture','fixture@invalid.test','export','Synthetic request',now()-n*interval '1 minute' from generate_series(1,51) n`,
    [person, alpha],
  );
  const first = await list();
  expect(first.items).toHaveLength(50);
  const second = await list(person, false, first.nextCursor);
  expect(second.items).toHaveLength(1);
  expect(second.nextCursor).toBeNull();
  expect(
    new Set([...first.items, ...second.items].map((item: any) => item.id)).size,
  ).toBe(51);
  await expect(list(stranger, false, first.nextCursor)).rejects.toThrow(
    /unavailable/,
  );
});
it("bounds repeated request creation and never accepts blank, invalid or excessive notes", async () => {
  for (const [kind, details] of [
    ["delete-site", "Valid note"],
    ["export", " "],
    ["export", "x".repeat(1001)],
    ["export", "Invalid\u0001note"],
  ])
    await expect(request(person, alpha, kind, details)).rejects.toThrow(
      /request type/,
    );
  await db.query(
    `insert into builder_privacy_requests(id,user_id,requester_name,requester_email,kind,details)
    select gen_random_uuid(),$1,'Fixture','fixture@invalid.test','export','Synthetic request' from generate_series(1,20)`,
    [person],
  );
  await expect(request()).rejects.toThrow(/Too many requests/);
});
it("expires closed requests while preserving open records and documented retention holds", async () => {
  await request();
  await accept();
  await update(
    owner,
    "fulfilled",
    1,
    "The response has been delivered securely.",
  );
  await db.query(
    "update builder_privacy_requests set closed_at=now()-interval '3 years',retention_hold=true where id=$1",
    [requestId],
  );
  await rpc("builder_prune_privacy_records", []);
  expect((await list()).items).toHaveLength(1);
  await db.query(
    "update builder_privacy_requests set retention_hold=false where id=$1",
    [requestId],
  );
  await db.query(
    "update auth.users set deleted_at=now()-interval '3 years' where id=$1",
    [person],
  );
  await db.query(
    "update builder_legal_acceptances set retention_hold=true where user_id=$1",
    [person],
  );
  await rpc("builder_prune_privacy_records", []);
  expect(
    (await db.query("select * from builder_legal_acceptances")).rows,
  ).toHaveLength(1);
  await db.query(
    "update builder_legal_acceptances set retention_hold=false where user_id=$1",
    [person],
  );
  await rpc("builder_prune_privacy_records", []);
  expect(
    (await db.query("select * from builder_privacy_requests")).rows,
  ).toEqual([]);
  expect(
    (await db.query("select * from builder_legal_acceptances")).rows,
  ).toEqual([]);
  await expect(legal()).rejects.toThrow(/active account/);
});
