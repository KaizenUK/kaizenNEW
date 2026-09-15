import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { BUILDER_LEGAL } from "../../shared/builderLegal";

let db: PGlite;
const beta = "11111111-1111-4111-8111-111111111111";
const alice = "22222222-2222-4222-8222-222222222222";
const bob = "33333333-3333-4333-8333-333333333333";
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id)); alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
    insert into auth.users(id,email,email_confirmed_at) values('${beta}','beta@example.test',now());`);
  for (const file of [
    "202609100001_visual_builder.sql",
    "202609100002_builder_site_design.sql",
    "202609100008_builder_releases.sql",
    "202609110001_builder_projects.sql",
    "202609120001_builder_project_capabilities.sql",
    "202609130001_builder_invitations.sql",
    "202609130002_builder_accounts.sql",
    "202609140001_builder_function_limits.sql",
    "202609140004_builder_legal_privacy.sql",
    "202609150001_builder_signup.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.exec(
    `insert into builder_project_members(project_id,user_id,role,can_publish) values('kaizen','${beta}','owner',true)`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202609150002_builder_billing.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`begin;
    insert into auth.users(id,email,email_confirmed_at) values('${alice}','alice@example.test',now()),('${bob}','bob@example.test',now());
    insert into builder_legal_acceptances(user_id,version) select id,'${BUILDER_LEGAL.version}' from auth.users;`);
});
afterEach(async () => {
  await db.exec("rollback");
});
async function as(role: string, sql: string, args: unknown[] = []) {
  await db.exec(`set role ${role}; savepoint billing_action`);
  try {
    return (await db.query<any>(sql, args)).rows;
  } catch (error) {
    await db.exec("rollback to savepoint billing_action");
    throw error;
  } finally {
    await db.exec("release savepoint billing_action; reset role");
  }
}
const rpc = async (sql: string, args: unknown[] = []) =>
  (await as("service_role", sql, args))[0]?.result;
const bind = (actor = alice, customer = "cus_alice") =>
  rpc("select builder_billing_bind_customer($1,$2)", [actor, customer]);
const summary = (actor = alice) =>
  rpc("select builder_billing_summary($1) as result", [actor]);
const claim = (
  event = "evt_one",
  customer = "cus_alice",
  kind = "customer.subscription.updated",
) =>
  rpc("select builder_billing_claim($1,$2,$3) as result", [
    customer,
    event,
    kind,
  ]);
const subscription = (overrides = {}) => ({
  id: "sub_alice",
  customerId: "cus_alice",
  status: "active",
  planId: "plus",
  priceId: "price_plus",
  periodEnd: new Date(Date.now() + 86400000).toISOString(),
  cancelAtPeriodEnd: false,
  ...overrides,
});
const finish = (
  lease: any,
  event = "evt_one",
  items: any[] = [subscription()],
  checkouts: any[] = [],
  customer = "cus_alice",
) =>
  rpc("select builder_billing_finish($1,$2,$3,$4,$5::jsonb,$6::jsonb)", [
    lease.accountId,
    customer,
    lease.token,
    event,
    JSON.stringify(items),
    JSON.stringify(checkouts),
  ]);
const checkout = (plan = "plus", price = "price_plus", actor = alice) =>
  rpc("select builder_billing_checkout_begin($1,$2,$3) as result", [
    actor,
    plan,
    price,
  ]);
async function fresh() {
  await bind();
  await finish(await claim(), "evt_one", []);
}

it("preserves granted beta access, creates Free accounts and exposes no Stripe or lease identifiers in summaries", async () => {
  expect((await summary(beta)).plan.id).toBe("beta");
  await bind();
  const result = await summary();
  expect(result.plan).toMatchObject({
    id: "free",
    projects: 1,
    pages_per_project: 5,
    storage_bytes: 104857600,
    publishes_per_month: 10,
  });
  expect(JSON.stringify(result)).not.toMatch(
    /cus_alice|sync_token|customer_attempt|user_id/,
  );
  expect(result.plans.map((p: any) => p.id)).toEqual([
    "free",
    "plus",
    "agency",
  ]);
});
it.each(["unconfirmed", "deleted", "missing-email", "processing"])(
  "refuses billing for an %s account",
  async (state) => {
    if (state === "unconfirmed")
      await db.query(
        "update auth.users set email_confirmed_at=null where id=$1",
        [alice],
      );
    if (state === "deleted")
      await db.query("update auth.users set deleted_at=now() where id=$1", [
        alice,
      ]);
    if (state === "missing-email")
      await db.query("update auth.users set email='' where id=$1", [alice]);
    if (state === "processing")
      await db.query(
        "insert into builder_account_deletions(user_id,status) values($1,'processing')",
        [alice],
      );
    await expect(summary()).rejects.toThrow(
      /active account|deletion has started/,
    );
    expect(
      (
        await db.query(
          "select * from builder_billing_accounts where user_id=$1",
          [alice],
        )
      ).rows,
    ).toEqual([]);
  },
);
it("binds customers idempotently and rejects reassignment or a customer shared by two accounts", async () => {
  await bind();
  await bind();
  await expect(bind(alice, "cus_changed")).rejects.toThrow(/already linked/);
  await expect(bind(bob, "cus_alice")).rejects.toThrow(/unique constraint/);
  await expect(bind(bob, "bad_customer")).rejects.toThrow(/Invalid billing/);
});
it("starts a durable customer attempt only when billing setup is explicitly requested", async () => {
  await summary();
  const before = (
    await db.query<any>(
      "select * from builder_billing_accounts where user_id=$1",
      [alice],
    )
  ).rows[0];
  expect(before.customer_attempt_at).toBeNull();
  const first = await rpc(
    "select builder_billing_customer_begin($1) as result",
    [alice],
  );
  const retry = await rpc(
    "select builder_billing_customer_begin($1) as result",
    [alice],
  );
  expect(first.customer_attempt_at).toBeTruthy();
  expect(retry.customer_attempt_at).toBe(first.customer_attempt_at);
  expect(retry.customer_attempt).toBe(first.customer_attempt);
});
it("binds each processing lease to the exact delivery as well as the account", async () => {
  await bind();
  const first = await claim();
  expect(await claim("evt_other")).toEqual({ status: "busy" });
  await expect(finish(first, "evt_other")).rejects.toThrow(/expired/);
  expect((await summary()).plan.id).toBe("free");
  await finish(first);
  expect((await summary()).plan.id).toBe("plus");
});
it("serializes provider reads, deduplicates completed deliveries and refreshes from provider state regardless of delivery order", async () => {
  await bind();
  const first = await claim("evt_later");
  expect(first.status).toBe("claimed");
  expect(await claim("evt_earlier")).toEqual({ status: "busy" });
  await finish(first, "evt_later", [
    subscription({ planId: "agency", priceId: "price_agency" }),
  ]);
  expect(await claim("evt_later")).toEqual({ status: "done" });
  const older = await claim("evt_earlier");
  // The late event causes another current provider read, never its old payload.
  await finish(older, "evt_earlier", [subscription({ status: "canceled" })]);
  expect((await summary()).plan.id).toBe("free");
  expect(
    (
      await db.query(
        "select * from builder_billing_events where processed_at is null",
      )
    ).rows,
  ).toEqual([]);
});
it("fences an expired worker from a later claim and from releasing its lease", async () => {
  await bind();
  const old = await claim();
  await db.query(
    "update builder_billing_accounts set sync_until=clock_timestamp()-interval '1 second' where user_id=$1",
    [alice],
  );
  const current = await claim("evt_two");
  await expect(finish(old)).rejects.toThrow(/expired/);
  await rpc("select builder_billing_release($1,$2)", [alice, old.token]);
  expect(await claim("evt_three")).toEqual({ status: "busy" });
  await finish(current, "evt_two");
  expect((await summary()).plan.id).toBe("plus");
});
it("rejects forged customer, cross-account subscription IDs, malformed snapshots and duplicate subscription IDs atomically", async () => {
  await bind();
  const first = await claim();
  await finish(first);
  await bind(bob, "cus_bob");
  const other = await claim("evt_bob", "cus_bob");
  await expect(
    finish(
      other,
      "evt_bob",
      [subscription({ customerId: "cus_bob" })],
      [],
      "cus_bob",
    ),
  ).rejects.toThrow(/identity changed/);
  const current = await claim("evt_two");
  await expect(
    finish(current, "evt_two", [subscription({ customerId: "cus_bob" })]),
  ).rejects.toThrow(/customer mismatch/);
  await expect(
    finish(current, "evt_two", [subscription(), subscription()]),
  ).rejects.toThrow(/identity changed/);
  await expect(
    finish(current, "evt_two", [subscription({ planId: "beta" })]),
  ).rejects.toThrow(/check constraint/);
  expect((await summary()).plan.id).toBe("plus");
  expect(
    (
      await db.query<{ processed_at: string | null }>(
        "select processed_at from builder_billing_events where id='evt_two'",
      )
    ).rows[0].processed_at,
  ).toBeNull();
});
it.each([
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
  "incomplete_expired",
  "canceled",
])(
  "preserves content and restricts %s subscriptions to Free",
  async (status) => {
    await bind();
    await finish(await claim(), "evt_one", [subscription({ status })]);
    expect((await summary()).plan.id).toBe("free");
    expect(
      (await db.query("select * from builder_projects where id='kaizen'")).rows,
    ).toHaveLength(1);
  },
);
it("keeps an active cancelled-at-period-end plan until expiry, and never grants an unrecognised price", async () => {
  await bind();
  await finish(await claim(), "evt_one", [
    subscription({ cancelAtPeriodEnd: true }),
  ]);
  expect((await summary()).plan.id).toBe("plus");
  await db.query(
    "update builder_subscriptions set period_end=clock_timestamp()-interval '1 second'",
  );
  expect((await summary()).plan.id).toBe("free");
  await finish(await claim("evt_unknown"), "evt_unknown", [
    subscription({ planId: null, priceId: "price_unrecognised" }),
  ]);
  expect((await summary()).plan.id).toBe("free");
});
it("persists one Checkout attempt and price through retries, timeouts and plan-change requests", async () => {
  await fresh();
  const first = await checkout();
  expect((await checkout()).id).toBe(first.id);
  await expect(checkout("agency", "price_agency")).rejects.toThrow(
    /Close your current Checkout/,
  );
  // A local clock deadline does not prove that a remote Checkout has expired.
  await db.query(
    "update builder_billing_checkouts set expires_at=clock_timestamp()-interval '1 second'",
  );
  expect((await checkout()).id).toBe(first.id);
  await rpc("select builder_billing_checkout_record($1,$2,$3,$4)", [
    alice,
    first.id,
    "cs_test_fixture",
    "expired",
  ]);
  await expect(
    rpc("select builder_billing_checkout_record($1,$2,$3,$4)", [
      alice,
      first.id,
      "cs_test_fixture",
      "open",
    ]),
  ).rejects.toThrow(/already finished/);
  const next = await checkout("agency", "price_agency");
  expect(next.id).not.toBe(first.id);
});
it("blocks Checkout without fresh provider state, legal acceptance, or with an existing subscription", async () => {
  await bind();
  await expect(checkout()).rejects.toThrow(/Refresh billing/);
  await finish(await claim(), "evt_one", []);
  await db.query("delete from builder_legal_acceptances where user_id=$1", [
    alice,
  ]);
  await expect(checkout()).rejects.toThrow(/Accept the current/);
  await db.query(
    "insert into builder_legal_acceptances(user_id,version) values($1,$2)",
    [alice, BUILDER_LEGAL.version],
  );
  await finish(await claim("evt_paid"), "evt_paid");
  await expect(checkout()).rejects.toThrow(/Manage billing/);
  await expect(checkout("plus", "price_plus", beta)).rejects.toThrow(
    /private beta/,
  );
});
it("isolates Checkout attempts from other accounts and rejects changing a bound session", async () => {
  await fresh();
  const attempt = await checkout();
  await bind(bob, "cus_bob");
  await expect(
    rpc("select builder_billing_checkout_record($1,$2,$3,$4)", [
      bob,
      attempt.id,
      "cs_test_fixture",
      "open",
    ]),
  ).rejects.toThrow(/Invalid Checkout/);
  await rpc("select builder_billing_checkout_record($1,$2,$3,$4)", [
    alice,
    attempt.id,
    "cs_test_fixture",
    "open",
  ]);
  await expect(
    rpc("select builder_billing_checkout_record($1,$2,$3,$4)", [
      alice,
      attempt.id,
      "cs_test_different",
      "open",
    ]),
  ).rejects.toThrow(/identity changed/);
});
it("only abandons an unbound Checkout after its fixed provider deadline", async () => {
  await fresh();
  const attempt = await checkout();
  await expect(
    rpc("select builder_billing_checkout_expire_empty($1,$2)", [
      alice,
      attempt.id,
    ]),
  ).rejects.toThrow(/Refresh billing/);
  await db.query(
    "update builder_billing_checkouts set expires_at=clock_timestamp()-interval '1 second'",
  );
  await expect(
    rpc("select builder_billing_checkout_expire_empty($1,$2)", [
      bob,
      attempt.id,
    ]),
  ).rejects.toThrow(/Refresh billing/);
  await rpc("select builder_billing_checkout_record($1,$2,$3,$4)", [
    alice,
    attempt.id,
    "cs_test_fixture",
    "open",
  ]);
  await expect(
    rpc("select builder_billing_checkout_expire_empty($1,$2)", [
      alice,
      attempt.id,
    ]),
  ).rejects.toThrow(/Refresh billing/);
  await rpc("select builder_billing_checkout_record($1,$2,$3,$4)", [
    alice,
    attempt.id,
    "cs_test_fixture",
    "expired",
  ]);
  const next = await checkout();
  await db.query(
    "update builder_billing_checkouts set expires_at=clock_timestamp()-interval '1 second' where id=$1",
    [next.id],
  );
  await rpc("select builder_billing_checkout_expire_empty($1,$2)", [
    alice,
    next.id,
  ]);
  expect((await summary()).pendingCheckout).toBeNull();
});
it("keeps account deletion pending until provider state is fresh and payments/Checkout have ended", async () => {
  await bind();
  const request = await rpc(
    "select builder_account_deletion_request($1) as result",
    [alice],
  );
  const prepare = () =>
    rpc("select builder_account_deletion_prepare(null,$1,null) as result", [
      request,
    ]);
  await expect(prepare()).rejects.toThrow(/Refresh billing/);
  await finish(await claim());
  await expect(prepare()).rejects.toThrow(/end paid subscriptions/);
  await finish(await claim("evt_cancelled"), "evt_cancelled", [
    subscription({ status: "canceled" }),
  ]);
  const attempt = await checkout();
  await expect(prepare()).rejects.toThrow(/Close unfinished Checkout/);
  await rpc("select builder_billing_checkout_record($1,$2,$3,$4)", [
    alice,
    attempt.id,
    "cs_test_fixture",
    "expired",
  ]);
  expect(await prepare()).toEqual({ status: "processing", userId: alice });
  await expect(checkout()).rejects.toThrow(/deletion has started/);
});
it("does not consume leases for unrelated customers and prevents changing delivery identity", async () => {
  expect(await claim()).toEqual({ status: "unrelated" });
  await bind();
  await claim();
  await expect(
    claim("evt_one", "cus_alice", "checkout.session.completed"),
  ).rejects.toThrow(/identity changed/);
});
it.each(["anon", "authenticated", "service_role"])(
  "denies %s direct billing table access and browser execution of private RPCs",
  async (role) => {
    for (const table of [
      "builder_plans",
      "builder_billing_accounts",
      "builder_subscriptions",
      "builder_billing_events",
      "builder_billing_checkouts",
    ]) {
      for (const verb of ["select * from", "delete from", "truncate"])
        await expect(as(role, `${verb} ${table}`)).rejects.toThrow(
          /permission denied/,
        );
    }
    await expect(
      as(role, "select builder_billing_plan($1)", [alice]),
    ).rejects.toThrow(/permission denied/);
    if (role !== "service_role") {
      const functions = (
        await db.query<any>(
          "select oid::regprocedure::text as signature from pg_proc where proname like 'builder_billing_%' or proname='builder_prune_billing_events'",
        )
      ).rows;
      for (const fn of functions)
        expect(
          (
            await db.query<any>(
              "select has_function_privilege($1,$2,'EXECUTE') as allowed",
              [role, fn.signature],
            )
          ).rows[0].allowed,
        ).toBe(false);
    }
  },
);
