import assert from "node:assert/strict";

Deno.test(
  "abuse reports use the request limit, a keyed reporter hash and plain refusals",
  async (test) => {
    const api = "https://report.supabase.test",
      origin = "https://kaizen.example.test";
    const environment = {
      SUPABASE_URL: api,
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
      BUILDER_REPORT_ORIGINS: origin,
    };
    const prior = new Map(
      Object.keys(environment).map((key) => [key, Deno.env.get(key)]),
    );
    const originalFetch = globalThis.fetch,
      descriptor = Object.getOwnPropertyDescriptor(Deno, "serve")!;
    let handler!: (request: Request) => Promise<Response>;
    let limited = false,
      failure: { code: string; message: string } | null = null;
    const calls: { name: string; body: any }[] = [];
    try {
      for (const [key, value] of Object.entries(environment))
        Deno.env.set(key, value);
      Object.defineProperty(Deno, "serve", {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        writable: true,
        value: (next: typeof handler) => {
          handler = next;
        },
      });
      globalThis.fetch = async (input, init) => {
        const request = new Request(input, init),
          url = new URL(request.url);
        assert.equal(url.origin, api);
        const name = url.pathname.split("/").at(-1)!,
          body = await request.json();
        calls.push({ name, body });
        if (name === "builder_consume_function_limit")
          return Response.json(
            limited
              ? { allowed: false, retryAfter: 30 }
              : { allowed: true, retryAfter: 0 },
          );
        assert.equal(name, "builder_submit_abuse_report");
        if (failure) return Response.json(failure, { status: 400 });
        return Response.json({ id: body.request_id, status: "received" });
      };
      await import("../../supabase/functions/builder-report/index.ts");
      const report = {
        request_id: "11111111-1111-4111-8111-111111111111",
        website: "https://client.example.test/login?session=private",
        category: "phishing",
        details: "This page asks visitors for bank passwords.",
      };
      const send = (value: unknown = report, from = origin) =>
        handler(
          new Request(api + "/functions/v1/builder-report", {
            method: "POST",
            headers: {
              origin: from,
              "content-type": "application/json",
              "x-forwarded-for": "203.0.113.7",
            },
            body: JSON.stringify(value),
          }),
        );
      await test.step("a foreign page cannot submit and nothing is consumed", async () => {
        assert.equal(
          (await send(report, "https://evil.example.test")).status,
          403,
        );
        assert.equal(calls.length, 0);
      });
      await test.step("the durable request limit applies before submission", async () => {
        limited = true;
        const response = await send();
        assert.equal(response.status, 429);
        assert.deepEqual(
          calls.map((call) => call.name),
          ["builder_consume_function_limit"],
        );
        limited = false;
        calls.length = 0;
      });
      await test.step("only the origin and a keyed reporter hash are submitted", async () => {
        const response = await send();
        assert.equal(response.status, 200);
        const submitted = calls.find(
          (call) => call.name === "builder_submit_abuse_report",
        )!;
        assert.equal(
          submitted.body.report.origin,
          "https://client.example.test",
        );
        assert.match(submitted.body.reporter_hash, /^[a-f0-9]{64}$/);
        assert.match(submitted.body.request_fingerprint, /^[a-f0-9]{64}$/);
        assert.ok(!JSON.stringify(submitted.body).includes("203.0.113.7"));
        assert.ok(!JSON.stringify(submitted.body).includes("session=private"));
      });
      await test.step("database refusals become plain retryable or final messages", async () => {
        for (const [code, message, status, wording] of [
          ["P0429", "Report rate limit", 429, /wait an hour/],
          [
            "P0404",
            "This website is not hosted by Kaizen",
            404,
            /not a website hosted by Kaizen/,
          ],
          ["P0409", "Report request conflict", 409, /Reload the page/],
        ] as const) {
          failure = { code, message };
          const response = await send();
          assert.equal(response.status, status);
          assert.match((await response.json()).error, wording);
        }
        failure = { code: "XX000", message: "internal detail" };
        const hidden = await send();
        assert.equal(hidden.status, 503);
        assert.ok(!(await hidden.text()).includes("internal detail"));
      });
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(Deno, "serve", descriptor);
      for (const [key, value] of prior)
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
    }
  },
);
