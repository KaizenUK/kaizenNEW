import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

Deno.test(
  "repository billing accepts only signed helper observations bound to verified Auth",
  async (test) => {
    const api = "https://repository-billing.supabase.test",
      actor = "11111111-1111-4111-8111-111111111111",
      secret = "ab".repeat(32);
    const input = {
      action: "repository-reserve",
      projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      reviewId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      binding: "a".repeat(64),
      commit: "b".repeat(40),
      base: "c".repeat(40),
      stagingArtifact: "fixture-staged",
      attempt: 1,
    };
    const environment = {
      SUPABASE_URL: api,
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
      BUILDER_HOSTED_BILLING_KEY: secret,
    };
    const prior = new Map(
      Object.keys(environment).map((key) => [key, Deno.env.get(key)]),
    );
    const descriptor = Object.getOwnPropertyDescriptor(Deno, "serve")!,
      originalFetch = globalThis.fetch;
    let handler!: (request: Request) => Promise<Response>,
      denied = false;
    const calls: { name: string; body: unknown }[] = [];
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
      globalThis.fetch = async (url, init) => {
        const request = new Request(url, init),
          parsed = new URL(request.url);
        assert.equal(parsed.origin, api, "No real provider may be called");
        if (parsed.pathname === "/auth/v1/user")
          return Response.json({
            id: actor,
            email: "fixture@example.test",
            email_confirmed_at: "2026-09-15T00:00:00Z",
            aud: "authenticated",
          });
        const body = await request.json(),
          name = parsed.pathname.split("/").at(-1)!;
        if (name === "builder_consume_function_limit")
          return Response.json({ allowed: true, retryAfter: 0 });
        assert.equal(
          request.headers.get("authorization"),
          "Bearer fixture-service-key",
        );
        assert.ok(
          [
            "builder_repository_publish_begin",
            "builder_repository_publish_settle",
            "builder_repository_usage_read",
            "builder_repository_usage_write",
          ].includes(name),
        );
        calls.push({ name, body });
        if (name === "builder_repository_usage_read")
          return Response.json({ version: 3, measurements: {} });
        if (name === "builder_repository_usage_write")
          return Response.json({
            version: body.expected_version + 1,
            measurements: { [body.channel]: body.sample },
          });
        if (denied)
          return Response.json(
            {
              code: "P0429",
              message:
                "The monthly publishing limit is reached. Ask the billing owner to upgrade or wait for the next calendar month",
            },
            { status: 400 },
          );
        return Response.json({
          attempt: body.expected_attempt,
          phase: name.endsWith("begin") ? "reserved" : body.outcome,
        });
      };
      await import("../../supabase/functions/builder-billing/index.ts");
      const signature = (
        body: Record<string, unknown>,
        token = "fixture-session",
      ) =>
        createHmac("sha256", Buffer.from(secret, "hex"))
          .update(JSON.stringify(body) + "\n" + token)
          .digest("hex");
      const send = (
        body: Record<string, unknown>,
        sig = signature(body),
        token = "fixture-session",
      ) =>
        handler(
          new Request(api + "/functions/v1/builder-billing", {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
              "x-kaizen-helper-signature": sig,
            },
            body: JSON.stringify(body),
          }),
        );
      await test.step("unsigned browser bodies, wrong keys, changed bytes and changed bearers never reach the ledger", async () => {
        assert.equal((await send(input, "")).status, 403);
        assert.equal((await send(input, "00".repeat(32))).status, 403);
        assert.equal(
          (await send({ ...input, attempt: 2 }, signature(input))).status,
          403,
        );
        assert.equal(
          (await send(input, signature(input), "another-session")).status,
          403,
        );
        assert.equal(calls.length, 0);
      });
      await test.step("a valid helper reserve uses the actual Auth actor and fixed review identity without Stripe configuration", async () => {
        const result = await send(input);
        assert.equal(result.status, 200);
        assert.deepEqual(await result.json(), {
          attempt: 1,
          phase: "reserved",
        });
        assert.deepEqual(calls[0], {
          name: "builder_repository_publish_begin",
          body: {
            target: input.projectId,
            actor,
            request_id: input.reviewId,
            binding: input.binding,
            commit_hash: input.commit,
            expected_attempt: 1,
            base_hash: input.base,
            staged_artifact: input.stagingArtifact,
          },
        });
      });
      await test.step("signed extra identities and malformed or ambiguous operations are rejected", async () => {
        const before = calls.length;
        for (const override of [
          { actor: "forged" },
          { attempt: 0 },
          { attempt: 1.5 },
          { binding: "short" },
          { projectId: "../other" },
          { outcome: "live" },
          { action: "repository-settle", outcome: "unknown" },
        ])
          assert.equal((await send({ ...input, ...override })).status, 400);
        assert.equal(calls.length, before);
      });
      await test.step("definitive settlement retains the attempt fence and never accepts a browser-selected payer", async () => {
        const response = await send({
          ...input,
          action: "repository-settle",
          outcome: "live",
          attempt: 2,
        });
        assert.equal(response.status, 200);
        assert.deepEqual(calls.at(-1), {
          name: "builder_repository_publish_settle",
          body: {
            target: input.projectId,
            actor,
            request_id: input.reviewId,
            binding: input.binding,
            commit_hash: input.commit,
            expected_attempt: 2,
            base_hash: input.base,
            staged_artifact: input.stagingArtifact,
            outcome: "live",
          },
        });
      });
      await test.step("trusted usage binds the current editor and cannot choose a deployment destination", async () => {
        const read = {
          action: "repository-usage-read",
          projectId: input.projectId,
        };
        assert.equal((await send(read, "")).status, 403);
        assert.equal((await send(read)).status, 200);
        assert.deepEqual(calls.at(-1), {
          name: "builder_repository_usage_read",
          body: { target: input.projectId, actor },
        });
        const sample = { bytes: 100, revision: "d".repeat(64) };
        const write = {
          action: "repository-usage-write",
          projectId: input.projectId,
          version: 3,
          channel: "source",
          sample,
          operation: "reserve",
        };
        const response = await send(write);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
          version: 4,
          measurements: { source: sample },
        });
        assert.deepEqual(calls.at(-1), {
          name: "builder_repository_usage_write",
          body: {
            target: input.projectId,
            actor,
            expected_version: 3,
            channel: "source",
            sample,
            operation: "reserve",
          },
        });
        const before = calls.length;
        for (const override of [
          { actor: null },
          { version: -1 },
          { version: 0.5 },
          { sample: { ...sample, bytes: -1 } },
          { sample: { ...sample, pages: 0 } },
          { channel: "production", sample: { ...sample, pages: 1 } },
          { channel: "preview", sample: { ...sample, pages: 1, bypass: true } },
        ])
          assert.equal((await send({ ...write, ...override })).status, 400);
        assert.equal(calls.length, before);
      });
      await test.step("quota denial and missing helper setup are explicit and do not call Stripe", async () => {
        denied = true;
        const result = await send(input);
        assert.equal(result.status, 429);
        assert.match((await result.json()).error, /monthly publishing limit/);
        const before = calls.length;
        Deno.env.delete("BUILDER_HOSTED_BILLING_KEY");
        assert.equal((await send(input)).status, 503);
        assert.equal(calls.length, before);
      });
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(Deno, "serve", descriptor);
      for (const [key, value] of prior)
        value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
    }
  },
);
