import assert from "node:assert/strict";

Deno.test(
  "first-project HTTP requests bind the actor to verified Auth and retain confirmation/legal denials",
  async (test) => {
    const actor = "11111111-1111-4111-8111-111111111111";
    const project = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const api = "https://signup-fixture.supabase.test";
    const origin = "https://builder.example.test";
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
    let errorCode = "",
      expired = false;
    const actors: unknown[] = [];
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
        assert.equal(
          url.origin,
          api,
          "Only the fixture provider may be called",
        );
        if (url.pathname === "/auth/v1/user") {
          assert.equal(
            request.headers.get("authorization"),
            "Bearer fixture-session",
          );
          return expired
            ? Response.json({ message: "Fixture expired" }, { status: 401 })
            : Response.json({
                id: actor,
                email: "fixture@example.test",
                aud: "authenticated",
                created_at: "2026-09-15T00:00:00Z",
              });
        }
        const body = await request.json();
        if (url.pathname === "/rest/v1/rpc/builder_consume_function_limit")
          return Response.json({ allowed: true, retryAfter: 0 });
        assert.equal(url.pathname, "/rest/v1/rpc/builder_bootstrap_account");
        assert.equal(
          request.headers.get("authorization"),
          "Bearer fixture-service-key",
        );
        actors.push(body.actor);
        assert.deepEqual(body, { actor });
        return errorCode
          ? Response.json(
              { code: errorCode, message: "Private database detail" },
              { status: 400 },
            )
          : Response.json({ created: false, projectId: project });
      };
      await import("../../supabase/functions/builder-projects/index.ts");
      const send = (headers: Record<string, string> = {}) =>
        handler(
          new Request(api + "/functions/v1/builder-projects", {
            method: "POST",
            headers: {
              Origin: origin,
              Authorization: "Bearer fixture-session",
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify({
              action: "bootstrap",
              actor: "forged-user",
              projectId: "kaizen",
              accepted: true,
              email_confirmed_at: "forged",
            }),
          }),
        );
      await test.step("ignores browser actor and acceptance claims", async () => {
        const response = await send();
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
          created: false,
          projectId: project,
        });
        assert.deepEqual(actors, [actor]);
      });
      for (const code of ["P0401", "P0403", "unexpected"]) {
        await test.step(`preserves database denial ${code} without private details`, async () => {
          errorCode = code;
          const response = await send();
          assert.equal(response.status, code === "unexpected" ? 503 : 403);
          assert.doesNotMatch(await response.text(), /Private database detail/);
        });
      }
      await test.step("rejects hostile origins, missing tokens and expired sessions before initialization", async () => {
        const before = actors.length;
        assert.equal(
          (await send({ Origin: "https://hostile.example.test" })).status,
          403,
        );
        assert.equal((await send({ Authorization: "" })).status, 401);
        expired = true;
        assert.equal((await send()).status, 401);
        assert.equal(actors.length, before);
      });
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(Deno, "serve", descriptor);
      for (const [key, value] of prior) {
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      }
    }
  },
);
