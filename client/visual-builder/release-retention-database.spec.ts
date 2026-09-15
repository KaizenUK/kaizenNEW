import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

let db: PGlite;
const actor = "22222222-2222-4222-8222-222222222222";
const fingerprint = "a".repeat(64),
  manifest = "b".repeat(64);
let project: string, destination: string, scope: string;

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
    insert into auth.users(id,email,email_confirmed_at) values('${actor}','retention@example.test',now());`);
  const schedules = new Set([
    "202609120003_builder_error_retention.sql",
    "202609140002_builder_function_limit_retention.sql",
    "202609140005_builder_privacy_retention.sql",
    "202609150008_builder_billing_retention.sql",
  ]);
  for (const file of (await readdir("supabase/migrations")).sort()) {
    if (
      !/^\d+_(?:visual_builder|builder_.*)\.sql$/.test(file) ||
      schedules.has(file)
    )
      continue;
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    if (file === "202609100001_visual_builder.sql")
      await db.query("insert into builder_editors(user_id) values($1)", [
        actor,
      ]);
  }
  await db.query(
    "insert into builder_legal_acceptances(user_id,version) values($1,'2026-09-14')",
    [actor],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("begin");
  project = (
    await query(
      "select builder_create_project('Retained website') as value",
      [],
      "authenticated",
    )
  )[0].value;
  destination = randomUUID();
  scope = `client:${destination}`;
  await db.query(
    `insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id)
    values($1,$2,'production',$3,'Retention fixture','retention-worker','initial')`,
    [destination, project, `https://${destination}.example`],
  );
});
afterEach(async () => {
  await db.exec("rollback");
});

async function query(sql: string, args: unknown[] = [], role = "service_role") {
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",
    [actor, role],
  );
  await db.exec(`set role ${role};savepoint retention_action`);
  try {
    return (await db.query<any>(sql, args)).rows;
  } catch (error) {
    await db.exec("rollback to savepoint retention_action");
    throw error;
  } finally {
    await db.exec("release savepoint retention_action;reset role");
  }
}
async function rpc(name: string, args: unknown[]) {
  return (
    await query(
      `select ${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
      args,
    )
  )[0].value;
}
const observe = (artifact: string, target = project, channel = scope) =>
  rpc("builder_release_retention_observe", [
    target,
    channel,
    artifact,
    "retention-worker",
    fingerprint,
    manifest,
    100,
  ]);
const claim = (
  artifact: string,
  token: string,
  target = project,
  channel = scope,
) =>
  rpc("builder_release_retention_claim", [
    target,
    channel,
    artifact,
    "retention-worker",
    fingerprint,
    manifest,
    token,
  ]);
const proof = (artifact: string) => ({
  artifactId: artifact,
  storeFingerprint: fingerprint,
  manifestSha256: manifest,
  artifactAbsent: true,
});
const finish = (
  artifact: string,
  token: string,
  value: unknown = proof(artifact),
  target = project,
  channel = scope,
) =>
  rpc("builder_release_retention_finish", [
    target,
    channel,
    artifact,
    "retention-worker",
    fingerprint,
    manifest,
    token,
    value,
  ]);
async function mature(artifact: string, target = project, channel = scope) {
  await db.query(
    "update builder_release_retirements set eligible_at=clock_timestamp()-interval '1 day' where project_id=$1 and scope=$2 and artifact_id=$3",
    [target, channel, artifact],
  );
}
async function retiring(artifact: string, target = project, channel = scope) {
  expect((await observe(artifact, target, channel)).phase).toBe("pending");
  await mature(artifact, target, channel);
  const token = randomUUID();
  expect((await claim(artifact, token, target, channel)).phase).toBe(
    "removing",
  );
  return token;
}
async function native(
  artifact: string | null,
  previous: string | null = null,
  status = "live",
) {
  const id = randomUUID();
  await db.query(
    `insert into builder_releases(id,request,snapshot,baseline,artifact_id,previous_release_id,status)
    values($1,'{"action":"deploy"}',builder_live_snapshot(),builder_live_snapshot(),$2,$3,$4)`,
    [id, artifact, previous, status],
  );
  return id;
}
async function clientJob(
  artifact: string,
  previous = "initial",
  phase = "live",
) {
  const id = randomUUID();
  await db.query(
    `insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,previous_artifact_id,artifact_id,phase)
    select $1,$2,d.id,builder_client_destination_public(d),d.version,d.worker_id,$3,'unpublish',$4,$5,$6 from builder_client_destinations d where id=$7`,
    [id, project, actor, previous, artifact, phase, destination],
  );
  return id;
}
const sample = {
  bytes: 100,
  pages: 1,
  sourceBytes: 100,
  sourceRevision: "c".repeat(64),
  manifestSha256: manifest,
};
async function output(
  artifact: string,
  previous: string | null = null,
  phase = "live",
  channel = "production",
) {
  const id = randomUUID();
  await db.query(
    `insert into builder_repository_output_jobs(id,project_id,channel,artifact_id,commit_hash,measurement,previous_job,phase)
    values($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, project, channel, artifact, "d".repeat(40), sample, previous, phase],
  );
  return id;
}

it("binds observations to exact identities, uses database grace, and reconciles completion without reopening removal", async () => {
  const first = await observe("old");
  expect((await observe("old")).eligible_at).toBe(first.eligible_at);
  expect(
    Date.parse(first.eligible_at) - Date.parse(first.created_at),
  ).toBeGreaterThan(6 * 86400000);
  const token = randomUUID();
  expect((await claim("old", token)).phase).toBe("pending");
  for (const [index, replacement] of [
    [3, "other-worker"],
    [4, "e".repeat(64)],
    [5, "f".repeat(64)],
    [6, 101],
  ] as const) {
    const args: unknown[] = [
      project,
      scope,
      "old",
      "retention-worker",
      fingerprint,
      manifest,
      100,
    ];
    args[index] = replacement;
    await expect(
      rpc("builder_release_retention_observe", args),
    ).rejects.toThrow(/different worker, store or artifact/);
  }
  await mature("old");
  const claimed = await claim("old", token);
  expect(claimed.phase).toBe("removing");
  expect(await claim("old", token)).toEqual(claimed);
  await expect(claim("old", randomUUID())).rejects.toThrow(/Another attempt/);
  await expect(
    finish("old", token, { ...proof("old"), artifactAbsent: false }),
  ).rejects.toThrow(/Verify/);
  await expect(finish("old", token, { ...proof("other") })).rejects.toThrow(
    /Verify/,
  );
  const completed = await finish("old", token);
  expect(completed.phase).toBe("removed");
  expect(await finish("old", token)).toEqual(completed);
  expect(await observe("old")).toEqual(completed);
});

it("keeps retirement RPCs and records private, including under permissive platform defaults", async () => {
  await observe("old");
  for (const role of ["anon", "authenticated"]) {
    await expect(
      query(
        "select builder_release_retention_observe($1,$2,'old','retention-worker',$3,$4,100)",
        [project, scope, fingerprint, manifest],
        role,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      query(
        "select builder_release_retention_claim($1,$2,'old','retention-worker',$3,$4,$5)",
        [project, scope, fingerprint, manifest, randomUUID()],
        role,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      query(
        "select builder_release_retention_finish($1,$2,'old','retention-worker',$3,$4,$5,$6)",
        [project, scope, fingerprint, manifest, randomUUID(), proof("old")],
        role,
      ),
    ).rejects.toThrow(/permission denied/);
  }
  for (const role of ["anon", "authenticated", "service_role"]) {
    await expect(
      query("select * from builder_release_retirements", [], role),
    ).rejects.toThrow(/permission denied/);
    await expect(
      query("truncate builder_release_retirements", [], role),
    ).rejects.toThrow(/permission denied/);
    await expect(
      query(
        "select builder_release_retention_reference($1,$2,'old')",
        [project, scope],
        role,
      ),
    ).rejects.toThrow(/permission denied/);
  }
});

it("rejects missing, malformed and cross-destination identities without creating a retirement", async () => {
  for (const [target, channel, artifact] of [
    [project, scope, "../old"],
    [project, scope, "x".repeat(97)],
    [project, `client:${randomUUID()}`, "old"],
    [randomUUID(), scope, "old"],
    [project, "repository:other", "old"],
  ])
    await expect(observe(artifact, target, channel)).rejects.toThrow(
      /Invalid|unavailable/,
    );
  await expect(claim("missing", randomUUID())).rejects.toThrow(
    /identity is required/,
  );
  expect(
    (await db.query("select * from builder_release_retirements")).rows,
  ).toHaveLength(0);
});

it.each(["repeatable read", "serializable"])(
  "refuses a retained %s snapshot at the lock boundary",
  async (isolation) => {
    // Start a fresh isolated transaction; these cases do not use the project
    // fixture discarded by the rollback. Normal PostgREST uses READ COMMITTED.
    await db.exec(`rollback;begin isolation level ${isolation}`);
    await expect(
      query("select builder_release_retention_lock()", [], "postgres"),
    ).rejects.toThrow(/fresh database snapshot/);
  },
);

it("protects the native head and its immediate rollback while allowing unrelated older history to age", async () => {
  const oldest = await native("oldest"),
    previous = await native("previous", oldest),
    head = await native("current", previous);
  await db.query(
    "update builder_release_head set release_id=$1 where id='site'",
    [head],
  );
  for (const artifact of ["current", "previous"])
    expect(
      (await observe(artifact, "kaizen", "repository:production")).phase,
    ).toBe("protected");
  expect(
    (await observe("oldest", "kaizen", "repository:production")).phase,
  ).toBe("pending");
  const rollback = randomUUID();
  await rpc("builder_queue_rollback", [rollback, actor, oldest]);
  expect(
    (await claim("oldest", randomUUID(), "kaizen", "repository:production"))
      .phase,
  ).toBe("pending");
  await mature("oldest", "kaizen", "repository:production");
  expect(
    (await claim("oldest", randomUUID(), "kaizen", "repository:production"))
      .phase,
  ).toBe("pending");
  expect(
    (await observe("oldest", "kaizen", "repository:production")).phase,
  ).toBe("protected");
  await rpc("builder_claim_release", [rollback, randomUUID(), "oldest"]);
});

it("refuses a native rollback or head change after the target was claimed, while keeping history readable and annotatable", async () => {
  const old = await native("old"),
    current = await native("current");
  await db.query(
    "update builder_release_head set release_id=$1 where id='site'",
    [current],
  );
  await retiring("old", "kaizen", "repository:production");
  await expect(
    rpc("builder_queue_rollback", [randomUUID(), actor, old]),
  ).rejects.toThrow(/no longer retained/);
  await expect(
    query(
      "update builder_release_head set release_id=$1 where id='site'",
      [old],
      "postgres",
    ),
  ).rejects.toThrow(/no longer retained/);
  await query(
    "update builder_releases set error='Operator history note' where id=$1",
    [old],
    "postgres",
  );
  await expect(
    query(
      "update builder_releases set artifact_id='different' where id=$1",
      [old],
      "postgres",
    ),
  ).rejects.toThrow(/first worker claim/);
});

it("fences native first-claim assignment and all active recovery artifacts", async () => {
  await retiring("already-retired", "kaizen", "repository:production");
  const id = await native(null, null, "queued"),
    owner = randomUUID();
  await expect(
    rpc("builder_claim_release", [id, owner, "already-retired"]),
  ).rejects.toThrow(/no longer retained/);
  const claimed = await rpc("builder_claim_release", [id, owner, "candidate"]);
  expect(await rpc("builder_claim_release", [id, owner, "candidate"])).toEqual(
    claimed,
  );
  await query(
    "update builder_releases set status='recovery_required',recovery_artifact='recovery',recovery_baseline_artifact='baseline' where id=$1",
    [id],
    "postgres",
  );
  for (const artifact of ["candidate", "recovery", "baseline"])
    expect(
      (await observe(artifact, "kaizen", "repository:production")).phase,
    ).toBe("protected");
});

it("protects client serving and rollback baselines independently of native and repository scopes", async () => {
  const job = await clientJob("current", "previous");
  await db.query(
    "update builder_client_destinations set active_artifact_id='current',active_job_id=$1 where id=$2",
    [job, destination],
  );
  for (const artifact of ["current", "previous"])
    expect((await observe(artifact)).phase).toBe("protected");
  expect(
    (await observe("previous", project, "repository:production")).phase,
  ).toBe("pending");
  await expect(
    query(
      "update builder_client_jobs set previous_artifact_id='rewritten' where id=$1",
      [job],
    ),
  ).rejects.toThrow(/identity is immutable/);
  await query(
    "update builder_client_jobs set log='History annotation' where id=$1",
    [job],
  );
  await query(
    "update builder_client_destinations set label='Renamed destination' where id=$1",
    [destination],
  );
});

it("a renewed native recovery owner cannot reuse a retired terminal artifact", async () => {
  const id = await native("old-recovery", null, "rolled_back");
  await query(
    "update builder_releases set worker_id=$2,recovery_artifact='baseline',recovery_baseline_artifact='baseline' where id=$1",
    [id, randomUUID()],
    "postgres",
  );
  await retiring("old-recovery", "kaizen", "repository:production");
  await expect(
    query(
      "update builder_releases set worker_id=$2 where id=$1",
      [id, randomUUID()],
      "postgres",
    ),
  ).rejects.toThrow(/no longer retained/);
  await query(
    "update builder_releases set error='Recovery history note' where id=$1",
    [id],
    "postgres",
  );
});

it("an actual client rollback review resets grace, expires safely, and cannot be recreated after claim", async () => {
  const old = await clientJob("old");
  await observe("old");
  await mature("old");
  const review = randomUUID();
  await rpc("builder_client_review", [
    review,
    project,
    actor,
    destination,
    0,
    1,
    "rollback",
    null,
    old,
  ]);
  expect((await observe("old")).phase).toBe("protected");
  await query(
    "update builder_client_reviews set expires_at=clock_timestamp()-interval '1 second' where id=$1",
    [review],
  );
  const pending = await claim("old", randomUUID());
  expect(pending.phase).toBe("pending");
  expect(Date.parse(pending.eligible_at)).toBeGreaterThan(
    Date.now() + 6 * 86400000,
  );
  await mature("old");
  expect((await claim("old", randomUUID())).phase).toBe("removing");
  await expect(
    rpc("builder_client_review", [
      randomUUID(),
      project,
      actor,
      destination,
      0,
      1,
      "rollback",
      null,
      old,
    ]),
  ).rejects.toThrow(/no longer retained/);
  await expect(
    query(
      "update builder_client_reviews set expires_at=clock_timestamp()+interval '1 hour' where id=$1",
      [review],
    ),
  ).rejects.toThrow(/no longer retained/);
});

it("actual client start, claim retries and recovery phases retain both target and baseline", async () => {
  const review = randomUUID();
  await rpc("builder_client_review", [
    review,
    project,
    actor,
    destination,
    0,
    1,
    "unpublish",
    null,
    null,
  ]);
  await rpc("builder_client_start", [project, actor, review]);
  for (const artifact of [review, "initial"])
    expect((await observe(artifact)).phase).toBe("protected");
  const token = randomUUID();
  const owned = await rpc("builder_client_claim", [
    review,
    "retention-worker",
    token,
  ]);
  expect(
    await rpc("builder_client_claim", [review, "retention-worker", token]),
  ).toEqual(owned);
  await query(
    "update builder_client_jobs set phase='recovery_required',recovery_target='recovering' where id=$1",
    [review],
  );
  expect((await observe("recovering")).phase).toBe("protected");
  await query(
    "update builder_client_jobs set phase='rolled_back' where id=$1",
    [review],
  );
  expect((await observe(review)).phase).toBe("pending");
});

it("fences late client destination pointers, queued work and resurrection without blocking failed history", async () => {
  const old = await clientJob("old");
  await retiring("old");
  await expect(
    query(
      "update builder_client_destinations set active_artifact_id='old',active_job_id=$1 where id=$2",
      [old, destination],
    ),
  ).rejects.toThrow(/no longer retained/);
  await expect(
    query("update builder_client_jobs set phase='queued' where id=$1", [old]),
  ).rejects.toThrow(/no longer retained/);
  await query(
    "update builder_client_jobs set phase='failed',error='Retained history' where id=$1",
    [old],
  );
  await query(
    "update builder_client_jobs set error='More context' where id=$1",
    [old],
  );
});

it("protects repository current, previous and held output while preserving byte-accounting ownership", async () => {
  const previous = await output("previous"),
    current = await output("current", previous);
  await db.query(
    "update builder_project_billing set repository_production_job=$1 where project_id=$2",
    [current, project],
  );
  await output("held", previous, "held");
  for (const artifact of ["current", "previous", "held"])
    expect(
      (await observe(artifact, project, "repository:production")).phase,
    ).toBe("protected");
  expect((await observe("held", project, "repository:staging")).phase).toBe(
    "pending",
  );
  await expect(
    query(
      "update builder_repository_output_jobs set previous_job=null where id=$1",
      [current],
      "postgres",
    ),
  ).rejects.toThrow(/identity is immutable/);
});

it("fences new repository reservations and delayed promotion but still accepts failed-output receipts", async () => {
  const channel = "repository:production",
    old = await output("old");
  await retiring("old", project, channel);
  await expect(
    rpc("builder_repository_output_begin", [
      project,
      randomUUID(),
      "production",
      "old",
      "d".repeat(40),
      sample,
      true,
    ]),
  ).rejects.toThrow(/no longer retained/);
  await expect(
    query(
      "update builder_project_billing set repository_production_job=$1 where project_id=$2",
      [old, project],
      "postgres",
    ),
  ).rejects.toThrow(/no longer retained/);
  const failed = randomUUID();
  expect(
    (
      await rpc("builder_repository_output_settle", [
        project,
        failed,
        "production",
        "old",
        "d".repeat(40),
        sample,
        "failed",
      ])
    ).phase,
  ).toBe("failed");
  expect(
    (
      await rpc("builder_repository_output_begin", [
        project,
        failed,
        "production",
        "old",
        "d".repeat(40),
        sample,
        true,
      ])
    ).phase,
  ).toBe("failed");
});

it.each(["client-alias", "repository-alias"])(
  "protects %s domain evidence until removal and fences reconnection",
  async (kind) => {
    const id = randomUUID(),
      channel = kind === "client-alias" ? scope : "repository:production";
    await db.query(
      `insert into builder_domains(id,project_id,hostname,verification_token,worker_id,binding_kind,candidate_destination_id,destination_id,last_evidence)
    values($1,$2,'retention.example',repeat('a',64),'domain-worker',$3,$4,$4,'{"artifactId":"domain-release"}')`,
      [id, project, kind, kind === "client-alias" ? destination : null],
    );
    expect((await observe("domain-release", project, channel)).phase).toBe(
      "protected",
    );
    await query(
      "update builder_domains set status='removed',removed_at=clock_timestamp() where id=$1",
      [id],
      "postgres",
    );
    await retiring("domain-release", project, channel);
    await expect(
      query(
        "update builder_domains set status='waiting_dns',removed_at=null where id=$1",
        [id],
        "postgres",
      ),
    ).rejects.toThrow(/no longer retained/);
  },
);

it("keeps completion fences after related project/destination deletion and refuses ID reuse", async () => {
  const token = await retiring("old");
  await query("delete from builder_client_destinations where id=$1", [
    destination,
  ]);
  await query("delete from builder_projects where id=$1", [project]);
  expect((await finish("old", token)).phase).toBe("removed");
  expect((await observe("old")).phase).toBe("removed");
  await expect(observe("new")).rejects.toThrow(/unavailable/);
  await expect(
    query(
      `insert into builder_projects(id,name) values($1,'Recreated');
    `,
      [project],
    ),
  ).resolves.toBeDefined();
  await expect(
    query(
      `insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id)
    values($1,$2,'production',$3,'Recreated','retention-worker','old')`,
      [destination, project, `https://${destination}.example`],
    ),
  ).rejects.toThrow(/no longer retained/);
});

it("cancels an unclaimed generation permanently, including delayed requests and lost cancellation replies", async () => {
  const old = randomUUID(),
    next = randomUUID();
  await observe("cancel-old");
  await mature("cancel-old");
  const args = [
    project,
    scope,
    "cancel-old",
    "retention-worker",
    fingerprint,
    manifest,
    old,
    0,
  ];
  const cancelled = await rpc("builder_release_retention_cancel", args);
  expect(cancelled).toMatchObject({
    phase: "cancelled",
    cancelled_token: old,
    cancelled_generation: 0,
    attempt_generation: 1,
    retirement_phase: "pending",
  });
  expect(await rpc("builder_release_retention_cancel", args)).toEqual(
    cancelled,
  );
  await expect(claim("cancel-old", old)).rejects.toThrow(/cancelled/);
  expect(
    (
      await rpc("builder_release_retention_claim", [
        ...args.slice(0, 6),
        next,
        1,
      ])
    ).phase,
  ).toBe("removing");
  await expect(finish("cancel-old", next)).rejects.toThrow(
    /recorded release retirement attempt/,
  );
  expect(
    (
      await rpc("builder_release_retention_finish", [
        ...args.slice(0, 6),
        next,
        proof("cancel-old"),
        1,
      ])
    ).phase,
  ).toBe("removed");
  expect((await rpc("builder_release_retention_cancel", args)).phase).toBe(
    "cancelled",
  );
  await expect(claim("cancel-old", old)).rejects.toThrow(/cancelled/);
  await expect(
    rpc("builder_release_retention_cancel", [...args.slice(0, 7), 2]),
  ).rejects.toThrow(/newer than/);
});

it("preserves a claim that wins cancellation and denies cancellation to browser roles", async () => {
  const token = await retiring("claimed-first");
  const args = [
    project,
    scope,
    "claimed-first",
    "retention-worker",
    fingerprint,
    manifest,
    token,
    0,
  ];
  expect((await rpc("builder_release_retention_cancel", args)).phase).toBe(
    "removing",
  );
  await expect(
    rpc("builder_release_retention_cancel", [
      ...args.slice(0, 6),
      randomUUID(),
      0,
    ]),
  ).rejects.toThrow(/Another attempt/);
  for (const role of ["anon", "authenticated"])
    await expect(
      query(
        "select builder_release_retention_cancel($1,$2,$3,$4,$5,$6,$7,$8)",
        args,
        role,
      ),
    ).rejects.toThrow(/permission denied/);
  expect((await finish("claimed-first", token)).phase).toBe("removed");
  expect((await rpc("builder_release_retention_cancel", args)).phase).toBe(
    "removed",
  );
});
