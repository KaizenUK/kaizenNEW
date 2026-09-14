import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { checkFunctionLimit } from "../../supabase/functions/_shared/functionLimits";

describe("durable builder request limits", () => {
  let db: PGlite;
  const actor = "11111111-1111-4111-8111-111111111111";
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
    await db.exec(
      await readFile(
        "supabase/migrations/202609140001_builder_function_limits.sql",
        "utf8",
      ),
    );
  });
  afterAll(async () => {
    await db?.close();
  });
  beforeEach(async () => {
    await db.exec("truncate builder_function_limits");
  });
  async function as<T>(role: string, operation: () => Promise<T>) {
    await db.exec(`set role ${role}`);
    try {
      return await operation();
    } finally {
      await db.exec("reset role");
    }
  }
  async function consume(endpoint: string, id: string | null, count = 1) {
    return as("service_role", async () =>
      (
        await db.query<{ result: { allowed: boolean; retryAfter: number } }>(
          "select builder_consume_function_limit($1,$2) as result from generate_series(1,$3)",
          [endpoint, id, count],
        )
      ).rows.map((row) => row.result),
    );
  }
  it("shares atomic global buckets across calls and caps rejected attempts", async () => {
    const results = await consume("builder-contact", null, 130);
    expect(results.filter((r) => r.allowed)).toHaveLength(120);
    expect(
      results.slice(120).every((r) => r.retryAfter >= 1 && r.retryAfter <= 60),
    ).toBe(true);
    expect(
      (
        await db.query<{ attempts: number }>(
          "select attempts from builder_function_limits",
        )
      ).rows,
    ).toEqual([{ attempts: 121 }]);
  });
  it("keeps verified users and endpoints separate while global limits remain independent", async () => {
    const results = await consume("builder-publish", actor, 14);
    expect(results.filter((r) => r.allowed)).toHaveLength(12);
    expect(
      (
        await consume("builder-publish", "22222222-2222-4222-8222-222222222222")
      )[0].allowed,
    ).toBe(true);
    expect((await consume("builder-invite", actor))[0].allowed).toBe(true);
    expect((await consume("builder-publish", null))[0].allowed).toBe(true);
  });
  it("opens a new minute without retaining unbounded historic rows", async () => {
    await consume("builder-publish", actor, 13);
    await db.exec(
      "update builder_function_limits set window_start=date_trunc('minute',clock_timestamp())-interval '1 minute'",
    );
    expect(await consume("builder-publish", actor)).toEqual([
      { allowed: true, retryAfter: 0 },
    ]);
    expect(
      (
        await db.query<{ attempts: number }>(
          "select attempts from builder_function_limits",
        )
      ).rows,
    ).toEqual([{ attempts: 1 }]);
  });
  it("prunes idle counters and preserves current ones", async () => {
    await consume("builder-publish", actor);
    await consume("builder-contact", null);
    await db.exec(
      "update builder_function_limits set window_start=clock_timestamp()-interval '2 days' where function_name='builder-contact'",
    );
    expect(
      await as(
        "service_role",
        async () =>
          (
            await db.query<{ removed: number }>(
              "select builder_prune_function_limits() as removed",
            )
          ).rows[0].removed,
      ),
    ).toBe(1);
    expect(
      (
        await db.query<{ function_name: string }>(
          "select function_name from builder_function_limits",
        )
      ).rows,
    ).toEqual([{ function_name: "builder-publish" }]);
  });
  for (const role of ["anon", "authenticated"])
    it(`${role} cannot consume, reset, prune or inspect another request's bucket`, async () => {
      await consume("builder-publish", actor);
      for (const sql of [
        "select * from builder_function_limits",
        "update builder_function_limits set attempts=1",
        "delete from builder_function_limits",
        "select builder_consume_function_limit('builder-publish',null)",
        "select builder_prune_function_limits()",
      ])
        await as(role, async () => {
          await expect(db.exec(sql)).rejects.toThrow(/permission denied/);
        });
    });
  it("rejects arbitrary endpoint keys and never grants direct service table access", async () => {
    await expect(consume("an-arbitrary-key", actor)).rejects.toThrow(
      /Unknown builder function/,
    );
    await as("service_role", async () => {
      await expect(
        db.exec("select * from builder_function_limits"),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

describe("Edge Function request limit responses", () => {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "https://editor.example.test",
  });
  it("uses only the supplied verified actor and preserves caller headers", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: true, retryAfter: 0 },
      error: null,
    });
    expect(
      await checkFunctionLimit({ rpc }, "builder-projects", headers),
    ).toBeUndefined();
    expect(
      await checkFunctionLimit(
        { rpc },
        "builder-projects",
        headers,
        "11111111-1111-4111-8111-111111111111",
      ),
    ).toBeUndefined();
    expect(rpc.mock.calls.map((call) => call[1])).toEqual([
      { target_function: "builder-projects", actor_id: null },
      {
        target_function: "builder-projects",
        actor_id: "11111111-1111-4111-8111-111111111111",
      },
    ]);
    expect(headers.has("Retry-After")).toBe(false);
  });
  it("returns a readable 429 with a bounded Retry-After and CORS", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: false, retryAfter: 17 },
      error: null,
    });
    const result = await checkFunctionLimit(
      { rpc },
      "builder-projects",
      headers,
    );
    expect(result!.status).toBe(429);
    expect(result!.headers.get("Retry-After")).toBe("17");
    expect(result!.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://editor.example.test",
    );
    expect(result!.headers.get("Cache-Control")).toBe("no-store");
    expect(await result!.json()).toEqual({
      error: "Too many requests. Wait a moment, then try again.",
    });
  });
  for (const data of [
    null,
    {},
    { allowed: "yes", retryAfter: 0 },
    { allowed: false, retryAfter: 0 },
    { allowed: true, retryAfter: 1 },
    { allowed: false, retryAfter: 100000 },
    { allowed: false, retryAfter: 1.5 },
  ])
    it(`fails closed on an invalid limiter response ${JSON.stringify(data)}`, async () => {
      const rpc = vi.fn().mockResolvedValue({ data, error: null });
      expect(
        (await checkFunctionLimit({ rpc }, "builder-account", headers))!.status,
      ).toBe(503);
    });
  it("fails closed without exposing database errors", async () => {
    for (const rpc of [
      vi.fn().mockRejectedValue(new Error("fixture-private-value")),
      vi.fn().mockResolvedValue({
        data: null,
        error: { message: "fixture-private-value" },
      }),
    ]) {
      const result = await checkFunctionLimit(
        { rpc },
        "builder-invite",
        headers,
      );
      expect(result!.status).toBe(503);
      expect(result!.headers.get("Retry-After")).toBe("30");
      expect(await result!.text()).not.toContain("fixture-private-value");
    }
  });
});
