import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { createBillingHandler } from "../../supabase/functions/_shared/builderBilling.ts";

Deno.test(
  "native operation recovery requires a helper signature and exact identity, while begin requires current Auth",
  async (test) => {
    const api = "https://native-operations.supabase.test",
      secret = "ab".repeat(32),
      actor = "11111111-1111-4111-8111-111111111111";
    const identity = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      workerId: "fixture-helper",
      configuration: "7".repeat(64),
      projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      processId: 123,
      host: "fixture-host",
      instanceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    };
    const calls: { path: string; body: any }[] = [];
    let malformed = false,
      denied = false,
      limited = false,
      rejectSql = false;
    const service = createClient(api, "fixture-service-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (url, init) => {
          const request = new Request(url, init),
            parsed = new URL(request.url),
            body = request.body ? await request.json() : null;
          assert.equal(parsed.origin, api);
          calls.push({ path: parsed.pathname, body });
          if (parsed.pathname === "/auth/v1/user") {
            if (denied)
              return Response.json(
                { message: "Expired fixture Auth" },
                { status: 401 },
              );
            return Response.json({
              id: actor,
              email: "native@example.test",
              email_confirmed_at: "2026-09-15T00:00:00Z",
            });
          }
          const name = parsed.pathname.replace("/rest/v1/rpc/", "");
          if (name === "builder_consume_function_limit")
            return Response.json({
              allowed: !limited,
              retryAfter: limited ? 5 : 0,
            });
          assert.ok(
            [
              "builder_native_operation_begin",
              "builder_native_operation_end",
              "builder_native_operation_assets",
            ].includes(name),
          );
          if (rejectSql)
            return Response.json(
              { code: "P0409", message: "private database path and details" },
              { status: 400 },
            );
          if (name === "builder_native_operation_assets")
            return Response.json({ id: identity.id, assets: [], cursor: null });
          return Response.json({
            ...identity,
            ...(malformed ? { processId: 999 } : {}),
            phase: name.endsWith("_end") ? "complete" : "active",
          });
        },
      },
    });
    const handler = createBillingHandler({
      service,
      env: (key) => (key === "BUILDER_HOSTED_BILLING_KEY" ? secret : undefined),
      headers: () => new Headers(),
      originAllowed: () => true,
    });
    const sign = (input: unknown, token: string) =>
      createHmac("sha256", Buffer.from(secret, "hex"))
        .update(JSON.stringify(input) + "\n" + token)
        .digest("hex");
    const send = (
      action: string,
      token = "fixture-auth",
      signature?: string,
      extra: Record<string, unknown> = {},
    ) => {
      const input = { ...identity, action, ...extra };
      return handler(
        new Request(`${api}/functions/v1/builder-billing`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-kaizen-helper-signature": signature ?? sign(input, token),
          },
          body: JSON.stringify(input),
        }),
      );
    };
    await test.step("unsigned recovery and changed signed bodies cannot release a producer", async () => {
      assert.equal(
        (await send("native-operation-end", "expired-auth", "")).status,
        403,
      );
      assert.equal(
        (
          await send(
            "native-operation-end",
            "expired-auth",
            sign({ ...identity, action: "native-operation-end" }, "other-auth"),
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await send(
            "native-operation-end",
            "expired-auth",
            sign(
              { ...identity, action: "native-operation-end" },
              "expired-auth",
            ),
            { processId: 321 },
          )
        ).status,
        403,
      );
      assert.ok(
        calls.every(
          (call) => !call.path.endsWith("builder_native_operation_end"),
        ),
      );
    });
    await test.step("signed begin checks Auth and passes the verified actor, never a supplied account", async () => {
      calls.length = 0;
      assert.equal((await send("native-operation-begin")).status, 200);
      assert.ok(calls.some((call) => call.path === "/auth/v1/user"));
      assert.equal(
        calls.find((call) =>
          call.path.endsWith("builder_native_operation_begin"),
        )?.body.actor,
        actor,
      );
      assert.equal(
        (
          await send("native-operation-begin", "fixture-auth", undefined, {
            actor: "forged",
          })
        ).status,
        400,
      );
      denied = true;
      assert.equal(
        (await send("native-operation-begin", "expired-auth")).status,
        401,
      );
    });
    await test.step("signed end works after Auth expiry without consulting Auth or accepting a different action", async () => {
      calls.length = 0;
      const response = await send(
        "native-operation-end",
        "native-operation-recovery",
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).phase, "complete");
      assert.ok(calls.every((call) => call.path !== "/auth/v1/user"));
      const body = calls.find((call) =>
        call.path.endsWith("builder_native_operation_end"),
      )!.body;
      assert.deepEqual(body, {
        request_id: identity.id,
        worker: identity.workerId,
        fingerprint: identity.configuration,
        target: identity.projectId,
        process_id: identity.processId,
        host: identity.host,
        instance: identity.instanceId,
      });
      assert.equal(
        (await send("native-operation-assets", "native-operation-recovery"))
          .status,
        401,
      );
      denied = false;
    });
    await test.step("global rate limits still apply to recovery and malformed receipts retain uncertainty", async () => {
      limited = true;
      assert.equal((await send("native-operation-end")).status, 429);
      limited = false;
      malformed = true;
      assert.equal((await send("native-operation-end")).status, 503);
      malformed = false;
      rejectSql = true;
      const response = await send("native-operation-end");
      assert.equal(response.status, 409);
      assert.ok(!(await response.text()).includes("private database"));
      rejectSql = false;
      assert.equal((await send("native-operation-assets")).status, 200);
    });
  },
);
