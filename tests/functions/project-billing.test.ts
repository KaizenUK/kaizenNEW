import assert from "node:assert/strict";

Deno.test(
  "website billing uses verified membership, explicit confirmation and the authenticated actor",
  async (test) => {
    const actor = "11111111-1111-4111-8111-111111111111",
      project = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const api = "https://project-billing.supabase.test",
      origin = "https://builder.example.test";
    const environment = {
      SUPABASE_URL: api,
      SUPABASE_ANON_KEY: "fixture-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
      ALLOWED_STUDIO_ORIGINS: origin,
    };
    const prior = new Map(
      Object.keys(environment).map((key) => [key, Deno.env.get(key)]),
    );
    const originalFetch = globalThis.fetch,
      descriptor = Object.getOwnPropertyDescriptor(Deno, "serve")!;
    let handler!: (request: Request) => Promise<Response>;
    let role: "owner" | "editor" | null = "owner",
      quotaFailure = false;
    const calls: { name: string; body: unknown }[] = [];
    const summary = { isBillingOwner: true, canTakeBilling: false };
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
        if (url.pathname === "/auth/v1/user")
          return Response.json({
            id: actor,
            aud: "authenticated",
            email: "fixture@example.test",
          });
        if (url.pathname === "/rest/v1/builder_project_members") {
          assert.equal(
            request.headers.get("authorization"),
            "Bearer fixture-session",
          );
          assert.equal(url.searchParams.get("user_id"), `eq.${actor}`);
          return Response.json(role ? { role, can_publish: false } : null);
        }
        if (url.pathname === "/rest/v1/builder_projects")
          return Response.json({
            id: project,
            capabilities: { legacyWorkspace: true },
          });
        const body = await request.json(),
          name = url.pathname.split("/").at(-1)!;
        if (name === "builder_consume_function_limit")
          return Response.json({ allowed: true, retryAfter: 0 });
        assert.equal(
          request.headers.get("authorization"),
          "Bearer fixture-service-key",
        );
        assert.deepEqual(body, { target: project, actor });
        assert.ok(
          [
            "builder_take_project_billing",
            "builder_project_billing_summary",
          ].includes(name),
        );
        calls.push({ name, body });
        if (name === "builder_take_project_billing")
          return quotaFailure
            ? Response.json(
                {
                  code: "P0429",
                  message: "Your website limit is reached. Upgrade your plan.",
                },
                { status: 400 },
              )
            : new Response(null, { status: 204 });
        return Response.json(summary);
      };
      await import("../../supabase/functions/builder-projects/index.ts");
      const send = (action: string, confirm?: unknown) =>
        handler(
          new Request(api + "/functions/v1/builder-projects", {
            method: "POST",
            headers: {
              origin,
              authorization: "Bearer fixture-session",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              action,
              projectId: project,
              confirm,
              actor: "forged",
              userId: "forged",
              customerId: "forged",
            }),
          }),
        );
      await test.step("membership denial prevents billing reads and transfers", async () => {
        role = null;
        assert.equal((await send("project-billing")).status, 403);
        assert.equal((await send("take-billing", true)).status, 403);
        assert.equal(calls.length, 0);
      });
      await test.step("an editor may read the redacted summary but cannot take billing", async () => {
        role = "editor";
        assert.deepEqual(await (await send("project-billing")).json(), summary);
        assert.equal((await send("take-billing", true)).status, 403);
        assert.equal(calls.length, 1);
      });
      await test.step("an owner must explicitly confirm and cannot assign another account", async () => {
        role = "owner";
        calls.length = 0;
        for (const confirm of [undefined, false, "true", 1])
          assert.equal((await send("take-billing", confirm)).status, 403);
        assert.equal(calls.length, 0);
        assert.equal((await send("take-billing", true)).status, 200);
        assert.deepEqual(
          calls.map((c) => c.name),
          ["builder_take_project_billing", "builder_project_billing_summary"],
        );
      });
      await test.step("quota denial retains clear recovery wording without a success read", async () => {
        quotaFailure = true;
        calls.length = 0;
        const result = await send("take-billing", true);
        assert.equal(result.status, 409);
        assert.match((await result.json()).error, /website limit/);
        assert.equal(calls.length, 1);
      });
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(Deno, "serve", descriptor);
      for (const [key, value] of prior)
        value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
    }
  },
);
