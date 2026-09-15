import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  readFile,
  readdir,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import {
  runDomainJob,
  runDomainQueue,
  type DomainWorkerServices,
} from "../../scripts/builder-domain-worker";
import { domainReleases } from "../../scripts/builder-domain-releases";
import { createReleaseClient } from "../../scripts/builder-release-worker.mjs";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const editor = "33333333-3333-4333-8333-333333333333";
const worker = "fixture-domains";
const hostname = "customer.fixture.co.uk";
let db: PGlite, project: string;
const workerRoots: string[] = [],
  workerChildren: ChildProcess[] = [];

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id));alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create table public.contact_form_submissions(name text,last_name text,email text,phone text,website text,message text,marketing_consent boolean,consent_to_gdpr boolean,source_page text,user_agent text);
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
    insert into auth.users(id,email,email_confirmed_at) values('${alice}','alice@example.test',now());`);
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
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    if (file === "202609100001_visual_builder.sql") {
      await db.query("insert into builder_editors(user_id) values($1)", [
        alice,
      ]);
    }
  }
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`begin;
    insert into auth.users(id,email,email_confirmed_at) values('${bob}','bob@example.test',now()),('${editor}','editor@example.test',now());
    insert into builder_legal_acceptances(user_id,version) select id,'2026-09-14' from auth.users;`);
  project = (
    await sql(
      "select builder_create_project('Domain fixture') as id",
      [],
      "authenticated",
      alice,
    )
  )[0].id;
});
afterEach(async () => {
  for (const child of workerChildren.splice(0))
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "exit");
      child.kill();
      await closed;
    }
  for (const root of workerRoots.splice(0))
    await rm(root, { recursive: true, force: true });
  await db.exec("rollback");
});
async function sql(
  query: string,
  args: unknown[] = [],
  role = "service_role",
  actor: string | null = null,
): Promise<any[]> {
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",
    [actor || "", role],
  );
  await db.exec(`set role ${role};savepoint domain_action`);
  try {
    return (await db.query(query, args)).rows;
  } catch (error) {
    await db.exec("rollback to savepoint domain_action");
    throw error;
  } finally {
    await db.exec("release savepoint domain_action;reset role");
  }
}
const rpc = async (name: string, args: unknown[]) =>
  (
    await sql(
      `select ${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
      args,
    )
  )[0].value;
const state = (target = project, actor = alice) =>
  rpc("builder_domain_state", [target, actor]);
const add = (
  options: {
    id?: string;
    target?: string;
    actor?: string;
    host?: string;
    challenge?: string;
  } = {},
) =>
  rpc("builder_domain_request", [
    options.target || project,
    options.actor || alice,
    options.id || randomUUID(),
    "add",
    null,
    options.host || hostname,
    options.challenge || "a".repeat(64),
    worker,
  ]);
const request = (domain: any, command = "verify", actor = alice) =>
  rpc("builder_domain_request", [
    domain.projectId,
    actor,
    domain.id,
    command,
    domain.version,
  ]);
const claim = (
  domain: any,
  token = randomUUID(),
  previous: string | null = null,
  selectedWorker = worker,
) => rpc("builder_domain_claim", [domain.id, selectedWorker, token, previous]);
const dnsResult = (job: any, status = "verified") =>
  rpc("builder_domain_dns_result", [job.id, job.owner_token, status]);
async function queued() {
  return (await request((await add()).domain)).domain;
}
async function otherProject() {
  return (
    await sql(
      "select builder_create_project('Other domain fixture') as id",
      [],
      "authenticated",
      bob,
    )
  )[0].id;
}
async function destination(target = project) {
  const id = randomUUID();
  await db.query(
    "insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id) values($1,$2,'production',$3,'Existing client address','client-worker','baseline')",
    [id, target, `https://${id}.fixture.co.uk`],
  );
  return id;
}

it("keeps raw worker state and private control routines inaccessible to browser roles", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await expect(
      sql(
        "select * from builder_domains",
        [],
        role,
        role === "authenticated" ? alice : null,
      ),
    ).rejects.toThrow("permission denied");
  }
  for (const role of ["anon", "authenticated"]) {
    await expect(
      sql("select builder_domain_state($1,$2)", [project, alice], role, alice),
    ).rejects.toThrow("permission denied");
    await expect(
      sql(
        "select builder_domain_claim($1,$2,$3)",
        [randomUUID(), worker, randomUUID()],
        role,
        alice,
      ),
    ).rejects.toThrow("permission denied");
  }
  const summary = await add();
  expect(summary).toMatchObject({
    canManage: true,
    archived: false,
    domain: { status: "waiting_dns", bindingKind: "client-primary" },
  });
  for (const privateName of [
    "worker_id",
    "owner_token",
    "completed_token",
    "candidate_destination_id",
    "requested_by",
  ]) {
    expect(JSON.stringify(summary)).not.toContain(privateName);
  }
});

it("checks current membership, role, publishing permission and confirmed account", async () => {
  await expect(add({ actor: bob })).rejects.toThrow("membership");
  await sql(
    "select builder_set_project_member($1,$2,'editor',true)",
    [project, editor],
    "authenticated",
    alice,
  );
  expect((await state(project, editor)).canManage).toBe(false);
  await expect(add({ actor: editor })).rejects.toThrow(
    "owner with publishing permission",
  );
  await db.query(
    "update builder_project_members set can_publish=false where project_id=$1 and user_id=$2",
    [project, alice],
  );
  await expect(add()).rejects.toThrow("publishing permission");
  await db.query(
    "update builder_project_members set can_publish=true where project_id=$1 and user_id=$2",
    [project, alice],
  );
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    alice,
  ]);
  await expect(state()).rejects.toThrow("confirmed, active");
});

it("retries add without changing the challenge and refuses id reuse or a second current domain", async () => {
  const id = randomUUID();
  const original = await add({ id });
  const again = await add({ id, challenge: "b".repeat(64) });
  expect(again).toEqual(original);
  await expect(add({ id, host: "other.fixture.co.uk" })).rejects.toThrow(
    "request changed",
  );
  await expect(add({ host: "other.fixture.co.uk" })).rejects.toThrow(
    "Remove the current domain",
  );
  const other = await otherProject();
  await expect(add({ id, target: other, actor: bob })).rejects.toThrow(
    "request changed",
  );
});

it("does not allow an unverified request to reserve a hostname across projects", async () => {
  const first = (await add()).domain;
  const other = await otherProject();
  const second = (await add({ target: other, actor: bob })).domain;
  const firstJob = await claim((await request(first)).domain);
  expect((await dnsResult(firstJob)).status).toBe("provisioning");
  const secondJob = await claim((await request(second, "verify", bob)).domain);
  const denied = await dnsResult(secondJob);
  expect(denied).toMatchObject({
    status: "attention",
    reason: "domain_in_use",
    owner_token: null,
    claimed_at: null,
  });
  expect((await state()).domain.status).toBe("provisioning");
});

it("records immutable primary, existing-client and repository binding choices", async () => {
  const current = (await add()).domain;
  expect(current.bindingKind).toBe("client-primary");
  const primary = (
    await db.query<any>("select * from builder_domains where id=$1", [
      current.id,
    ])
  ).rows[0];
  expect(primary.candidate_destination_id).toMatch(/^[a-f0-9-]{36}$/);
  expect(primary.destination_id).toBeNull();
  const other = await otherProject();
  const existing = await destination(other);
  const alias = (
    await add({ target: other, actor: bob, host: "alias.fixture.co.uk" })
  ).domain;
  expect(alias.bindingKind).toBe("client-alias");
  expect(
    (
      await db.query<any>(
        "select destination_id,candidate_destination_id from builder_domains where id=$1",
        [alias.id],
      )
    ).rows[0],
  ).toEqual({ destination_id: existing, candidate_destination_id: existing });
  expect(
    (await add({ target: "kaizen", host: "native.fixture.co.uk" })).domain
      .bindingKind,
  ).toBe("repository-alias");
});

it("queues idempotently and rejects stale versions or a different worker", async () => {
  const original = (await add()).domain;
  const pending = (await request(original)).domain;
  expect((await request(original)).domain).toEqual(pending);
  await expect(request(original, "remove")).rejects.toThrow(
    "changed or is running",
  );
  await expect(
    claim(pending, randomUUID(), null, "wrong-worker"),
  ).rejects.toThrow("worker ownership");
  const job = await claim(pending);
  expect(job.status).toBe("checking_dns");
  expect(await claim(pending, job.owner_token)).toEqual(job);
  await expect(request((await state()).domain, "remove")).rejects.toThrow(
    "changed or is running",
  );
});

it("requires explicit previous-owner recovery and fences all callbacks from the old worker", async () => {
  const pending = await queued();
  const old = await claim(pending);
  await expect(claim(pending)).rejects.toThrow("already claimed");
  await expect(claim(pending, randomUUID(), randomUUID())).rejects.toThrow(
    "already claimed",
  );
  const recovered = await claim(pending, randomUUID(), old.owner_token);
  expect(recovered.owner_token).not.toBe(old.owner_token);
  await expect(dnsResult(old)).rejects.toThrow("no longer owns");
  await expect(
    rpc("builder_domain_worker_error", [
      old.id,
      old.owner_token,
      "provider_failed",
    ]),
  ).rejects.toThrow("no longer owns");
  expect((await dnsResult(recovered)).status).toBe("provisioning");
});

it.each([
  "ownership_missing",
  "routing_missing",
  "routing_mismatch",
  "lookup_failed",
])("records %s without claiming a connected website", async (result) => {
  const job = await claim(await queued());
  const value = await dnsResult(job, result);
  expect(value).toMatchObject({
    status: result === "lookup_failed" ? "attention" : "waiting_dns",
    reason: result,
    owner_token: null,
    claimed_at: null,
    connected_at: null,
  });
  expect(value.dns_checked_at).toBeTruthy();
  expect((await request((await state()).domain)).domain.status).toBe("queued");
});

it("rechecks access and archive state after queuing and before accepting DNS ownership", async () => {
  const pending = await queued();
  await db.query(
    "update builder_project_members set can_publish=false where project_id=$1 and user_id=$2",
    [project, alice],
  );
  await expect(claim(pending)).rejects.toThrow("publishing permission");
  await db.query(
    "update builder_project_members set can_publish=true where project_id=$1 and user_id=$2",
    [project, alice],
  );
  const job = await claim(pending);
  await db.query("update builder_projects set archived=true where id=$1", [
    project,
  ]);
  await expect(dnsResult(job)).rejects.toThrow("Restore the website");
  await rpc("builder_domain_worker_error", [
    job.id,
    job.owner_token,
    "access_changed",
  ]);
  await expect(request((await state()).domain)).rejects.toThrow(
    "Restore this website",
  );
  const removal = (await request((await state()).domain, "remove")).domain;
  expect((await claim(removal)).status).toBe("removing");
});

it("prevents removal while a publication or recovery is pending, without changing the destination", async () => {
  const existing = await destination();
  const domain = (await add()).domain;
  const job = randomUUID();
  await db.query(
    `insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,
    action,previous_artifact_id,artifact_id) select $1,project_id,id,builder_client_destination_public(d),version,worker_id,$2,'unpublish','baseline','next'
    from builder_client_destinations d where id=$3`,
    [job, alice, existing],
  );
  await expect(request(domain, "remove")).rejects.toThrow(
    "publication or recovery",
  );
  expect((await state()).domain).toEqual(domain);
  expect(
    (
      await db.query<any>(
        "select enabled from builder_client_destinations where id=$1",
        [existing],
      )
    ).rows[0].enabled,
  ).toBe(true);
  await db.query(
    "update builder_client_jobs set phase='recovery_required' where id=$1",
    [job],
  );
  await expect(request(domain, "remove")).rejects.toThrow(
    "publication or recovery",
  );
});

it("does not reflect arbitrary provider details or permit invalid worker transitions", async () => {
  const job = await claim(await queued());
  await expect(dnsResult(job, "connected")).rejects.toThrow(
    "Invalid domain DNS result",
  );
  await expect(
    rpc("builder_domain_worker_error", [
      job.id,
      job.owner_token,
      "private provider detail",
    ]),
  ).rejects.toThrow("Invalid domain worker failure");
  await rpc("builder_domain_worker_error", [
    job.id,
    job.owner_token,
    "tls_pending",
  ]);
  expect((await state()).domain).toMatchObject({
    status: "attention",
    reason: "tls_pending",
    connectedAt: null,
  });
});

// These are synthetic worker attestations for database rules, not live DNS/TLS evidence.
const connectionEvidence = (job: any, artifact = `domain-${job.id}`) => ({
  domainId: job.id,
  attemptId: job.owner_token,
  projectId: job.project_id,
  hostname: job.hostname,
  origin: `https://${job.hostname}`,
  bindingKind: job.binding_kind,
  destinationId: job.candidate_destination_id,
  artifactId: artifact,
  manifestSha256: "a".repeat(64),
  certificateSha256: "b".repeat(64),
  certificateNames: [job.hostname],
  certificateAutoRenew: true,
  certificateSelfSigned: false,
  certificateExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  verifiedAt: new Date(Date.now() + 100).toISOString(),
  providerOwned: true,
});
const removalEvidence = (job: any) => ({
  domainId: job.id,
  attemptId: job.owner_token,
  projectId: job.project_id,
  hostname: job.hostname,
  providerRemoved: true,
  routingRemoved: true,
  verifiedAt: new Date().toISOString(),
});
const finishConnect = (job: any, evidence = connectionEvidence(job)) =>
  rpc("builder_domain_connect_finish", [job.id, job.owner_token, evidence]);
const finishRemove = (job: any, evidence = removalEvidence(job)) =>
  rpc("builder_domain_remove_finish", [job.id, job.owner_token, evidence]);
const withdrawalEvidence = (job: any) => ({
  domainId: job.id,
  attemptId: job.owner_token,
  projectId: job.project_id,
  hostname: job.hostname,
  providerWithdrawn: true,
  routingRemoved: true,
  verifiedAt: new Date().toISOString(),
});
const due = (id: string) =>
  db.query(
    "update builder_domains set next_check_at=clock_timestamp()-interval '1 second' where id=$1",
    [id],
  );
const workerGet = (id: string) =>
  rpc("builder_domain_worker_get", [id, worker]);

it("requires matching attempt, hostname, certificate, renewal and fresh release proof", async () => {
  const job = await dnsResult(await claim(await queued()));
  const original = connectionEvidence(job);
  for (const incorrect of [
    { attemptId: randomUUID() },
    { projectId: "kaizen" },
    { hostname: "other.fixture.co.uk" },
    { origin: "https://other.fixture.co.uk" },
    { destinationId: randomUUID() },
    { manifestSha256: null },
    { certificateNames: [job.hostname, `www.${job.hostname}`] },
    { certificateNames: [`*.${job.hostname}`] },
    { certificateAutoRenew: false },
    { certificateSelfSigned: true },
    { certificateSha256: "invalid" },
    { providerOwned: false },
    { arbitraryProviderField: "not accepted" },
  ])
    await expect(
      finishConnect(job, { ...original, ...incorrect }),
    ).rejects.toThrow("evidence required");
  for (const incorrect of [
    { certificateExpiresAt: new Date(Date.now() - 1000).toISOString() },
    { certificateExpiresAt: "infinity" },
    { verifiedAt: new Date(Date.now() - 600000).toISOString() },
    { verifiedAt: new Date(Date.now() + 600000).toISOString() },
  ])
    await expect(
      finishConnect(job, { ...original, ...incorrect }),
    ).rejects.toThrow("fresh DNS");
  expect((await state()).domain.status).toBe("provisioning");
  await db.query(
    "update builder_domains set dns_checked_at=now()-interval '10 minutes' where id=$1",
    [job.id],
  );
  await expect(finishConnect(job, original)).rejects.toThrow("fresh DNS");
});

it("connects and removes a primary domain idempotently, retaining destinations and drafts when re-added", async () => {
  const before = (
    await db.query<any>(
      "select payload from builder_project_workspaces where project_id=$1",
      [project],
    )
  ).rows[0].payload;
  const job = await dnsResult(await claim(await queued()));
  const proof = connectionEvidence(job);
  const connected = await finishConnect(job, proof);
  expect(await finishConnect(job, proof)).toEqual(connected);
  expect(connected.status).toBe("connected");
  const firstDestination = (
    await db.query<any>(
      "select * from builder_client_destinations where project_id=$1",
      [project],
    )
  ).rows[0];
  expect(firstDestination).toMatchObject({
    id: job.candidate_destination_id,
    enabled: true,
    origin: `https://${hostname}`,
    active_artifact_id: `domain-${job.id}`,
  });
  const removing = (await request((await state()).domain, "remove")).domain;
  expect(
    (
      await db.query<any>(
        "select enabled from builder_client_destinations where id=$1",
        [firstDestination.id],
      )
    ).rows[0].enabled,
  ).toBe(false);
  const removalJob = await claim(removing);
  const removalProof = removalEvidence(removalJob);
  const removed = await finishRemove(removalJob, removalProof);
  expect(await finishRemove(removalJob, removalProof)).toEqual(removed);
  expect((await state()).domain).toBeNull();
  expect((await state()).history).toHaveLength(1);
  const next = (await add({ challenge: "c".repeat(64) })).domain;
  const nextJob = await dnsResult(await claim((await request(next)).domain));
  await finishConnect(nextJob);
  expect(nextJob.candidate_destination_id).not.toBe(firstDestination.id);
  const destinations = (
    await db.query<any>(
      "select id,origin,enabled from builder_client_destinations where project_id=$1",
      [project],
    )
  ).rows;
  expect(destinations).toHaveLength(2);
  expect(destinations.filter((row) => row.enabled)).toEqual([
    {
      id: nextJob.candidate_destination_id,
      origin: `https://${hostname}`,
      enabled: true,
    },
  ]);
  expect(
    (
      await db.query<any>(
        "select payload from builder_project_workspaces where project_id=$1",
        [project],
      )
    ).rows[0].payload,
  ).toEqual(before);
  await expect(finishConnect(job, proof)).rejects.toThrow("no longer owns");
});

it("requires explicit removal confirmation evidence and preserves an existing manual destination", async () => {
  const existing = await destination();
  const job = await dnsResult(await claim(await queued()));
  await expect(finishConnect(job)).rejects.toThrow("destination changed");
  await finishConnect(job, connectionEvidence(job, "baseline"));
  const removalJob = await claim(
    (await request((await state()).domain, "remove")).domain,
  );
  const proof = removalEvidence(removalJob);
  for (const incorrect of [
    { providerRemoved: false },
    { routingRemoved: false },
    { attemptId: randomUUID() },
    { hostname: "other.fixture.co.uk" },
  ]) {
    await expect(
      finishRemove(removalJob, { ...proof, ...incorrect }),
    ).rejects.toThrow("Verified removal");
  }
  await finishRemove(removalJob, proof);
  expect(
    (
      await db.query<any>(
        "select enabled,active_artifact_id from builder_client_destinations where id=$1",
        [existing],
      )
    ).rows[0],
  ).toEqual({ enabled: true, active_artifact_id: "baseline" });
});

it("serializes new publication against a claimed domain operation and exposes only the configured worker queue", async () => {
  const existing = await destination();
  const job = await claim(await queued());
  expect(await rpc("builder_domain_worker_queue", ["other-worker"])).toEqual(
    [],
  );
  expect(
    (await rpc("builder_domain_worker_queue", [worker])).map(
      (value: any) => value.id,
    ),
  ).toEqual([job.id]);
  await expect(
    sql(
      `insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,
    action,previous_artifact_id,artifact_id) select $1,project_id,id,builder_client_destination_public(d),version,worker_id,$2,'unpublish','baseline','next'
    from builder_client_destinations d where id=$3`,
      [randomUUID(), alice, existing],
      "postgres",
    ),
  ).rejects.toThrow("Domain setup is running");
});

it("finishes an already-authorized removal after the requester loses access, without allowing reconnection", async () => {
  const queuedRemoval = (await request((await add()).domain, "remove")).domain;
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    alice,
  ]);
  const job = await claim(queuedRemoval);
  expect((await finishRemove(job)).status).toBe("removed");
  await expect(add()).rejects.toThrow("confirmed, active");
});

it("keeps disabled destination jobs in history without reporting them as current", async () => {
  const job = await dnsResult(await claim(await queued()));
  await finishConnect(job);
  const releaseId = randomUUID();
  await db.query(
    `insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,
    action,phase,previous_artifact_id,artifact_id) select $1,project_id,id,builder_client_destination_public(d),version,worker_id,$2,'unpublish','live','baseline',active_artifact_id
    from builder_client_destinations d where id=$3`,
    [releaseId, alice, job.candidate_destination_id],
  );
  await db.query(
    "update builder_client_destinations set active_job_id=$1 where id=$2",
    [releaseId, job.candidate_destination_id],
  );
  const history = async () =>
    (
      await sql(
        "select builder_client_history($1) as value",
        [project],
        "authenticated",
        alice,
      )
    )[0].value;
  expect((await history()).currentRows.map((row: any) => row.id)).toEqual([
    releaseId,
  ]);
  await finishRemove(
    await claim((await request((await state()).domain, "remove")).domain),
  );
  const retired = await history();
  expect(retired.currentRows).toEqual([]);
  expect(retired.rows.map((row: any) => row.id)).toEqual([releaseId]);
  expect(retired.destinations).toHaveLength(1);
  expect(retired.destinations[0].enabled).toBe(false);
});

it("binds a repository alias to the current original-site release without rewriting its identity", async () => {
  const releaseId = randomUUID();
  await db.query(
    "insert into builder_releases(id,requested_by,request,snapshot,baseline,status,artifact_id) values($1,$2,'{\"action\":\"unpublish\"}','{}','{}','live','native-baseline')",
    [releaseId, alice],
  );
  await db.query(
    "update builder_release_head set release_id=$1 where id='site'",
    [releaseId],
  );
  const initial = (
    await add({ target: "kaizen", host: "native.fixture.co.uk" })
  ).domain;
  const job = await dnsResult(await claim((await request(initial)).domain));
  await expect(
    finishConnect(job, connectionEvidence(job, "foreign-baseline")),
  ).rejects.toThrow("live website changed");
  expect(
    (await finishConnect(job, connectionEvidence(job, "native-baseline")))
      .bindingKind,
  ).toBe("repository-alias");
  const removing = (await request((await state("kaizen")).domain, "remove"))
    .domain;
  await finishRemove(await claim(removing));
  expect(
    (
      await db.query<any>(
        "select release_id from builder_release_head where id='site'",
      )
    ).rows[0].release_id,
  ).toBe(releaseId);
  expect(
    (
      await db.query<any>(
        "select artifact_id from builder_releases where id=$1",
        [releaseId],
      )
    ).rows[0].artifact_id,
  ).toBe("native-baseline");
});

it("schedules initial and recurring checks with bounded retries and fresh attempt tokens", async () => {
  const initial = (await add()).domain;
  expect(
    (await rpc("builder_domain_worker_queue", [worker])).map((j: any) => j.id),
  ).toEqual([initial.id]);
  const first = await claim(initial);
  await dnsResult(first, "ownership_missing");
  expect(await rpc("builder_domain_worker_queue", [worker])).toEqual([]);
  await expect(claim(initial)).rejects.toThrow("not due");
  await due(initial.id);
  const second = await dnsResult(await claim(initial));
  expect(second.owner_token).not.toBe(first.owner_token);
  await finishConnect(second);
  const connected = await workerGet(initial.id);
  expect(connected.attempt_count).toBe(0);
  expect(Date.parse(connected.next_check_at)).toBeGreaterThan(Date.now());
  expect(await rpc("builder_domain_worker_queue", [worker])).toEqual([]);
  await due(initial.id);
  expect((await claim(initial)).status).toBe("provisioning");
});

it("requires withdrawal before suspending a primary and restores readiness without changing enabled", async () => {
  const first = await dnsResult(await claim(await queued()));
  await finishConnect(first);
  await due(first.id);
  const maintenance = await claim({ id: first.id });
  await expect(dnsResult(maintenance, "routing_mismatch")).rejects.toThrow(
    "withdrawal required",
  );
  await expect(
    rpc("builder_domain_worker_error", [
      maintenance.id,
      maintenance.owner_token,
      "routing_failed",
    ]),
  ).rejects.toThrow("withdrawal required");
  await rpc("builder_domain_dns_result", [
    maintenance.id,
    maintenance.owner_token,
    "routing_mismatch",
    withdrawalEvidence(maintenance),
  ]);
  const destinationId = first.candidate_destination_id;
  expect(
    (
      await db.query(
        "select enabled,domain_ready from builder_client_destinations where id=$1",
        [destinationId],
      )
    ).rows[0],
  ).toEqual({ enabled: true, domain_ready: false });
  expect(
    (
      await sql(
        "select builder_client_history($1) as value",
        [project],
        "authenticated",
        alice,
      )
    )[0].value.destinations[0].enabled,
  ).toBe(false);
  await expect(
    sql(
      `insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,
    action,previous_artifact_id,artifact_id) select $1,project_id,id,builder_client_destination_public(d),version,worker_id,$2,'unpublish',active_artifact_id,'next'
    from builder_client_destinations d where id=$3`,
      [randomUUID(), alice, destinationId],
      "postgres",
    ),
  ).rejects.toThrow("domain is unavailable");
  await due(first.id);
  const resumed = await dnsResult(await claim({ id: first.id }));
  await finishConnect(resumed);
  expect(
    (
      await db.query(
        "select enabled,domain_ready from builder_client_destinations where id=$1",
        [destinationId],
      )
    ).rows[0],
  ).toEqual({ enabled: true, domain_ready: true });
  await due(first.id);
  const suspended = await dnsResult(await claim({ id: first.id }));
  await db.query(
    "update builder_client_destinations set enabled=false where id=$1",
    [destinationId],
  );
  await expect(finishConnect(suspended)).rejects.toThrow("destination changed");
  await expect(
    rpc("builder_domain_worker_assert", [
      first.id,
      worker,
      suspended.owner_token,
      false,
    ]),
  ).rejects.toThrow("disabled");
  await expect(
    rpc("builder_domain_worker_assert", [
      first.id,
      worker,
      suspended.owner_token,
      true,
    ]),
  ).resolves.toMatchObject({ owner_token: suspended.owner_token });
});

it("maintains existing hosting after ownership transfer and archive", async () => {
  const first = await dnsResult(await claim(await queued()));
  await finishConnect(first);
  await db.query(
    "insert into builder_project_members(project_id,user_id,role,can_publish) values($1,$2,'owner',true)",
    [project, bob],
  );
  await rpc("builder_take_project_billing", [project, bob]);
  await db.query(
    "delete from builder_project_members where project_id=$1 and user_id=$2",
    [project, alice],
  );
  await db.query("update builder_projects set archived=true where id=$1", [
    project,
  ]);
  await due(first.id);
  const maintenance = await dnsResult(await claim({ id: first.id }));
  await expect(
    rpc("builder_domain_worker_assert", [
      first.id,
      worker,
      maintenance.owner_token,
    ]),
  ).resolves.toMatchObject({ owner_token: maintenance.owner_token });
  await finishConnect(maintenance);
  expect((await state(project, bob)).domain.status).toBe("connected");
});

it("restricts cleanup claims to withdrawal after the original owner loses access", async () => {
  const pending = await queued();
  await db.query(
    "update builder_project_members set can_publish=false where project_id=$1",
    [project],
  );
  await expect(claim(pending)).rejects.toThrow("publishing permission");
  const token = randomUUID(),
    cleanup = await rpc("builder_domain_claim", [
      pending.id,
      worker,
      token,
      null,
      true,
    ]);
  await expect(
    rpc("builder_domain_worker_assert", [pending.id, worker, token, false]),
  ).rejects.toThrow("withdrawal claim");
  await expect(
    rpc("builder_domain_worker_assert", [pending.id, worker, token, true]),
  ).resolves.toMatchObject({ withdrawal_only: true });
  await expect(dnsResult(cleanup)).rejects.toThrow("withdrawal claim");
  await expect(claim(pending, token)).rejects.toThrow();
  await expect(finishConnect(cleanup)).rejects.toThrow("no longer owns");
  await rpc("builder_domain_worker_error", [
    pending.id,
    token,
    "access_changed",
  ]);
  expect((await workerGet(pending.id)).reason).toBe("access_changed");
});

it("keeps new worker routines private and rejects mismatched workers and tokens", async () => {
  const initial = await claim(await queued());
  for (const role of ["anon", "authenticated"])
    for (const [name, args] of [
      ["builder_domain_worker_get", [initial.id, worker]],
      [
        "builder_domain_worker_assert",
        [initial.id, worker, initial.owner_token],
      ],
      ["builder_domain_fail_queued", [initial.id, worker, "access_changed"]],
    ] as const) {
      await expect(
        sql(
          `select ${name}(${args.map((_, i) => `$${i + 1}`).join(",")})`,
          [...args],
          role,
          alice,
        ),
      ).rejects.toThrow("permission denied");
    }
  await expect(
    rpc("builder_domain_worker_get", [initial.id, "other-worker"]),
  ).rejects.toThrow("Configured domain worker");
  await expect(
    rpc("builder_domain_worker_assert", [
      initial.id,
      worker,
      randomUUID(),
      true,
    ]),
  ).rejects.toThrow("no longer owns");
  await expect(
    rpc("builder_domain_fail_queued", [initial.id, worker, "access_changed"]),
  ).rejects.toThrow("Retain the existing");
});

/** Actual database and retained release engine; DNS/provider/TLS are explicit fixtures.
 * Network proof for those adapters is recorded in their separate integration suites. */
async function lifecycleFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "kaizen-domain-worker-"));
  workerRoots.push(root);
  const jobsRoot = path.join(root, "jobs"),
    journalRoot = path.join(root, "routing"),
    stores = path.join(root, "stores"),
    configuration = path.join(root, "configuration");
  await mkdir(jobsRoot, { mode: 0o700 });
  await mkdir(journalRoot, { mode: 0o700 });
  await mkdir(stores, { mode: 0o755 });
  await mkdir(configuration, { mode: 0o755 });
  const registryFile = path.join(configuration, "destinations.json"),
    nginxFile = path.join(configuration, "domains.conf");
  await writeFile(registryFile, '{"schemaVersion":1,"destinations":[]}\n', {
    mode: 0o644,
  });
  const events: string[] = [],
    hosts = new Map<string, { present: boolean; enabled: boolean }>();
  let missingDns = false,
    mismatchCertificate = false,
    pendingCertificate = false,
    withdrawFails = false;
  const expiry = new Date(Date.now() + 86400000).toISOString();
  const serviceRpc = async (name: string, args: Record<string, unknown>) => {
    events.push(name);
    const entries = Object.entries(args);
    return (
      await sql(
        `select ${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")}) as value`,
        entries.map(([, value]) => value),
      )
    )[0].value;
  };
  const services: DomainWorkerServices = {
    workerId: worker,
    jobsRoot,
    ingress: { ipv4: ["192.0.2.44"], ipv6: [] },
    reservedHostnames: [],
    client: { rpc: serviceRpc },
    dns: {
      txt: async () =>
        missingDns ? [] : [["kaizen-domain-verification=" + "a".repeat(64)]],
      ipv4: async () => [{ address: "192.0.2.44", ttl: 60 }],
      ipv6: async () => [],
    },
    provider: {
      ensure: async (item, guard) => {
        await guard();
        events.push("provider.ensure");
        hosts.set(item.hostname, {
          present: true,
          enabled: hosts.get(item.hostname)?.enabled ?? false,
        });
        return { providerOwned: true, domainId: item.domainId };
      },
      route: async (item, enabled, guard) => {
        await guard();
        events.push(`provider.route:${enabled}`);
        hosts.set(item.hostname, { present: true, enabled });
        return { routingEnabled: enabled };
      },
      withdraw: async (item, disable, guard) => {
        await guard();
        events.push(`provider.withdraw:${disable}`);
        if (withdrawFails) throw new Error("Unconfirmed hosting withdrawal");
        const prior = hosts.get(item.hostname);
        if (prior) hosts.set(item.hostname, { ...prior, enabled: false });
        return { providerWithdrawn: true };
      },
      remove: async (item, guard) => {
        await guard();
        events.push("provider.remove");
        hosts.delete(item.hostname);
        return { providerRemoved: true, routingRemoved: true };
      },
      withOwned: async (_item, guard, operation) => {
        await guard();
        return operation(async () => ({}));
      },
    },
    releases: domainReleases({
      journalRoot,
      primaryStoresRoot: stores,
      registryFile,
      nginxFile,
      proxyPort: 8094,
      publicationUid: process.getuid!(),
      publicationGid: process.getgid!(),
      reload: async () => {
        events.push("nginx.reload");
      },
      observe: async () => {},
    }),
    certificate: async (host, _api, guard) => {
      await guard();
      events.push("certificate");
      if (pendingCertificate)
        throw Object.assign(new Error("Pending exact-name issuance"), {
          reason: "tls_pending",
        });
      return {
        certificateAutoRenew: true,
        certificateSerialNumber: "1a",
        certificateNames: [host],
        certificateExpiresAt: expiry,
      };
    },
    https: async ({ hostname: host, manifest }) => {
      events.push("https");
      return {
        certificateSha256: "b".repeat(64),
        certificateSerialNumber: mismatchCertificate ? "2b" : "1a",
        certificateNames: [host],
        certificateSelfSigned: false,
        certificateExpiresAt: expiry,
        verifiedAt: new Date().toISOString(),
        checked: manifest.checks.length + 1,
      };
    },
  };
  return {
    root,
    services,
    events,
    hosts,
    registryFile,
    nginxFile,
    options: (value: {
      missingDns?: boolean;
      mismatchCertificate?: boolean;
      pendingCertificate?: boolean;
      withdrawFails?: boolean;
    }) => {
      if (value.missingDns !== undefined) missingDns = value.missingDns;
      if (value.mismatchCertificate !== undefined)
        mismatchCertificate = value.mismatchCertificate;
      if (value.pendingCertificate !== undefined)
        pendingCertificate = value.pendingCertificate;
      if (value.withdrawFails !== undefined)
        withdrawFails = value.withdrawFails;
    },
  };
}

it("runs primary setup, DNS withdrawal, restoration and removal through the real database and release engine", async () => {
  const f = await lifecycleFixture(),
    initial = (await add()).domain;
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "connected",
  });
  const connected = await workerGet(initial.id);
  expect(connected.last_evidence.artifactId).toBe(`domain-${initial.id}`);
  expect(connected.last_evidence).not.toHaveProperty("certificateSerialNumber");
  expect(f.hosts.get(hostname)?.enabled).toBe(true);
  const store = JSON.parse(await readFile(f.registryFile, "utf8"))
    .destinations[0].store;
  const retained = await readFile(path.join(store, "active.conf"), "utf8");
  f.options({ missingDns: true });
  await due(initial.id);
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "waiting_dns",
    reason: "ownership_missing",
  });
  expect(f.hosts.get(hostname)?.enabled).toBe(false);
  expect(await readFile(f.nginxFile, "utf8")).not.toContain(hostname);
  expect(
    (
      await db.query(
        "select enabled,domain_ready from builder_client_destinations where id=$1",
        [connected.destination_id],
      )
    ).rows[0],
  ).toEqual({ enabled: true, domain_ready: false });
  f.options({ missingDns: false });
  await due(initial.id);
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "connected",
  });
  await request((await state()).domain, "remove");
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "removed",
  });
  expect(f.hosts.has(hostname)).toBe(false);
  expect(await readFile(path.join(store, "active.conf"), "utf8")).toBe(
    retained,
  );
});

it("handles missing initial DNS without hosting changes and refuses mismatched certificate evidence", async () => {
  const f = await lifecycleFixture(),
    initial = (await add()).domain;
  f.options({ missingDns: true });
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "waiting_dns",
  });
  expect(f.events).not.toContain("provider.ensure");
  f.options({ missingDns: false, mismatchCertificate: true });
  await due(initial.id);
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "attention",
  });
  expect(f.hosts.get(hostname)?.enabled).toBe(false);
  expect((await workerGet(initial.id)).destination_id).toBeNull();
});

it("retains pending certificate issuance while withdrawing routing and retries automatically", async () => {
  const f = await lifecycleFixture(),
    initial = (await add()).domain;
  f.options({ pendingCertificate: true });
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "attention",
    reason: "tls_pending",
  });
  expect(f.events).toContain("provider.withdraw:false");
  expect(f.events).not.toContain("provider.route:true");
  f.options({ pendingCertificate: false });
  await due(initial.id);
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "connected",
  });
});

it("reconciles lost claim and committed connection replies without withdrawing a connected website", async () => {
  const f = await lifecycleFixture(),
    initial = (await add()).domain,
    original = f.services.client.rpc;
  f.services.client.rpc = async (name, args) => {
    const result = await original(name, args);
    if (
      ["builder_domain_claim", "builder_domain_connect_finish"].includes(name)
    )
      throw new Error("Reply lost after commit");
    return result;
  };
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "connected",
  });
  expect(
    f.events.filter((event) => event.startsWith("provider.withdraw")),
  ).toEqual([]);
  expect(f.hosts.get(hostname)?.enabled).toBe(true);
});

it("preserves uncertain finalization for stopped-process recovery", async () => {
  const f = await lifecycleFixture(),
    initial = (await add()).domain,
    original = f.services.client.rpc;
  f.services.client.rpc = async (name, args) => {
    if (name === "builder_domain_connect_finish")
      throw new Error("No finalization reply");
    return original(name, args);
  };
  await expect(runDomainJob(initial.id, f.services)).rejects.toMatchObject({
    reason: "recovery_required",
  });
  const current = await workerGet(initial.id);
  expect(current.owner_token).not.toBeNull();
  expect(f.hosts.get(hostname)?.enabled).toBe(true);
  expect(
    f.events.filter((event) => event.startsWith("provider.withdraw")),
  ).toEqual([]);
  await expect(runDomainJob(initial.id, f.services)).rejects.toMatchObject({
    reason: "recovery_required",
  });
  const attempt = JSON.parse(
    await readFile(
      path.join(
        f.services.jobsRoot,
        initial.id,
        `attempt-${current.owner_token}.json`,
      ),
      "utf8",
    ),
  );
  expect(attempt.finish.name).toBe("builder_domain_connect_finish");
});

it("replaces a database claim only after its recorded real process exits", async () => {
  const f = await lifecycleFixture(),
    initial = await queued(),
    claimed = await claim(initial);
  const child = spawn(process.execPath, ["-e", "process.stdin.resume()"], {
    stdio: ["pipe", "ignore", "ignore"],
  });
  workerChildren.push(child);
  await once(child, "spawn");
  const root = path.join(f.services.jobsRoot, initial.id);
  await mkdir(root, { mode: 0o700 });
  await writeFile(
    path.join(root, `attempt-${claimed.owner_token}.json`),
    JSON.stringify({
      schemaVersion: 1,
      domainId: initial.id,
      workerId: worker,
      token: claimed.owner_token,
      pid: child.pid,
      host: os.hostname(),
      finish: null,
    }),
    { mode: 0o600 },
  );
  await expect(runDomainJob(initial.id, f.services)).rejects.toMatchObject({
    reason: "recovery_required",
  });
  expect((await workerGet(initial.id)).owner_token).toBe(claimed.owner_token);
  const closed = once(child, "exit");
  child.stdin!.end();
  await closed;
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "connected",
  });
  expect((await workerGet(initial.id)).completed_token).not.toBe(
    claimed.owner_token,
  );
  await expect(dnsResult(claimed)).rejects.toThrow("no longer owns");
});

it("withdraws an operator-disabled destination without re-enabling it", async () => {
  const f = await lifecycleFixture(),
    initial = (await add()).domain;
  await runDomainJob(initial.id, f.services);
  const connected = await workerGet(initial.id);
  await db.query(
    "update builder_client_destinations set enabled=false where id=$1",
    [connected.destination_id],
  );
  await due(initial.id);
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "attention",
    reason: "configuration_changed",
  });
  expect(f.hosts.get(hostname)?.enabled).toBe(false);
  expect(
    (
      await db.query(
        "select enabled,domain_ready from builder_client_destinations where id=$1",
        [connected.destination_id],
      )
    ).rows[0],
  ).toEqual({ enabled: false, domain_ready: false });
});

it("retains a claim when withdrawal fails so publishing cannot race an unconfirmed route", async () => {
  const f = await lifecycleFixture(),
    initial = (await add()).domain;
  await runDomainJob(initial.id, f.services);
  f.options({ missingDns: true, withdrawFails: true });
  await due(initial.id);
  await expect(runDomainJob(initial.id, f.services)).rejects.toThrow(
    "Unconfirmed hosting withdrawal",
  );
  expect((await workerGet(initial.id)).owner_token).not.toBeNull();
  expect((await workerGet(initial.id)).status).toBe("provisioning");
});

it("fails revoked unclaimed requests and uses a restricted cleanup claim for previously prepared hosting", async () => {
  const f = await lifecycleFixture(),
    initial = (await add()).domain;
  f.options({ pendingCertificate: true });
  await runDomainJob(initial.id, f.services);
  await db.query(
    "update builder_project_members set can_publish=false where project_id=$1",
    [project],
  );
  await due(initial.id);
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "attention",
    reason: "access_changed",
  });
  expect(f.events).toContain("provider.withdraw:true");
  expect(f.hosts.get(hostname)?.enabled).toBe(false);
  const other = await otherProject();
  const second = (
    await add({ target: other, actor: bob, host: "second.fixture.co.uk" })
  ).domain;
  await db.query(
    "update builder_project_members set can_publish=false where project_id=$1",
    [other],
  );
  expect(await runDomainJob(second.id, f.services)).toMatchObject({
    status: "attention",
    reason: "access_changed",
  });
  expect(f.hosts.has(second.hostname)).toBe(false);
});

it("withdraws when DNS changes between initial setup and final HTTPS verification", async () => {
  const f = await lifecycleFixture(),
    initial = (await add()).domain;
  let lookups = 0;
  f.services.dns!.txt = async () =>
    ++lookups === 1 ? [["kaizen-domain-verification=" + "a".repeat(64)]] : [];
  expect(await runDomainJob(initial.id, f.services)).toMatchObject({
    status: "waiting_dns",
    reason: "ownership_missing",
  });
  expect(f.events).toContain("provider.route:true");
  expect(f.events).toContain("provider.withdraw:true");
  expect(f.events).not.toContain("https");
  expect((await workerGet(initial.id)).destination_id).toBeNull();
});

it("keeps processing other domains when one queued job cannot be confirmed", async () => {
  const f = await lifecycleFixture(),
    first = (await add()).domain,
    other = await otherProject();
  const second = (
    await add({ target: other, actor: bob, host: "second.fixture.co.uk" })
  ).domain;
  const original = f.services.client.rpc;
  f.services.client.rpc = async (name, args) => {
    if (name === "builder_domain_worker_get" && args.request_id === first.id)
      throw new Error("Unconfirmed first job");
    return original(name, args);
  };
  const result = await runDomainQueue(f.services);
  expect(result).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        domainId: first.id,
        status: "recovery_required",
      }),
      expect.objectContaining({ domainId: second.id, status: "connected" }),
    ]),
  );
});

it("refuses to recover a database claim without its matching private process record", async () => {
  const f = await lifecycleFixture(),
    initial = await queued(),
    current = await claim(initial);
  await expect(runDomainJob(initial.id, f.services)).rejects.toMatchObject({
    reason: "recovery_required",
  });
  expect((await workerGet(initial.id)).owner_token).toBe(current.owner_token);
  expect(f.events).not.toContain("provider.ensure");
});

it("keeps the original manual destination ready when only its alias loses DNS", async () => {
  const existing = await destination(),
    initial = await dnsResult(await claim(await queued()));
  await finishConnect(initial, connectionEvidence(initial, "baseline"));
  await due(initial.id);
  const current = await claim({ id: initial.id });
  await rpc("builder_domain_dns_result", [
    current.id,
    current.owner_token,
    "routing_missing",
    withdrawalEvidence(current),
  ]);
  expect(
    (
      await db.query(
        "select enabled,domain_ready from builder_client_destinations where id=$1",
        [existing],
      )
    ).rows[0],
  ).toEqual({ enabled: true, domain_ready: true });
});

it("refuses stale, mismatched or incomplete withdrawal attestations", async () => {
  const initial = await dnsResult(await claim(await queued()));
  await finishConnect(initial);
  await due(initial.id);
  const current = await claim({ id: initial.id });
  for (const change of [
    { attemptId: randomUUID() },
    { hostname: "other.fixture.co.uk" },
    { providerWithdrawn: false },
    { routingRemoved: false },
    { extra: true },
    { verifiedAt: new Date(Date.now() - 600000).toISOString() },
    { verifiedAt: new Date(Date.now() + 60000).toISOString() },
  ]) {
    await expect(
      rpc("builder_domain_dns_result", [
        current.id,
        current.owner_token,
        "routing_missing",
        { ...withdrawalEvidence(current), ...change },
      ]),
    ).rejects.toThrow();
    expect((await workerGet(current.id)).owner_token).toBe(current.owner_token);
  }
});

it("retains a bounded database error code for worker decisions without exposing provider text", async () => {
  const client = createReleaseClient({
    url: "https://database.fixture.co.uk",
    key: "fixture-service-key",
    fetcher: async () =>
      Response.json(
        { code: "P0403", message: "Private upstream fixture detail" },
        { status: 403 },
      ),
  });
  await expect(client.rpc("builder_domain_claim", {})).rejects.toMatchObject({
    code: "P0403",
    definitive: true,
  });
  await expect(client.rpc("builder_domain_claim", {})).rejects.not.toThrow(
    "Private upstream fixture detail",
  );
});
