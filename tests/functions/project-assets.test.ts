import assert from "node:assert/strict";

Deno.test(
  "asset registration uses verified membership, the file ledger and a server-selected address",
  async (test) => {
    const actor = "11111111-1111-4111-8111-111111111111",
      projectId = "22222222-2222-4222-8222-222222222222";
    const api = "https://asset-fixture.supabase.test",
      origin = "https://builder.example.test";
    const environment = {
      SUPABASE_URL: api,
      SUPABASE_ANON_KEY: "fixture-public",
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
      ALLOWED_STUDIO_ORIGINS: origin,
    };
    const prior = new Map(
      Object.keys(environment).map((key) => [key, Deno.env.get(key)]),
    );
    const originalFetch = globalThis.fetch,
      descriptor = Object.getOwnPropertyDescriptor(Deno, "serve")!;
    let handler!: (request: Request) => Promise<Response>;
    let membership = true,
      legacy = false,
      verified = true;
    const registrations: any[] = [];
    const asset = {
      id: "33333333-3333-4333-8333-333333333333",
      hash: "a".repeat(64),
      size: 3,
      mime: "image/png",
      kind: "image",
      url: "https://untrusted.example.test/file",
      name: "Fixture",
      pack: "Fixture",
      path: "fixture.png",
    };
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
          return Response.json(
            membership ? { role: "editor", can_publish: false } : null,
          );
        }
        if (url.pathname === "/rest/v1/builder_projects")
          return Response.json({
            id: legacy ? "kaizen" : projectId,
            capabilities: {
              legacyWorkspace: legacy,
              hasInventory: legacy,
              publishPath: legacy ? "github" : "worker",
            },
          });
        const body = await request.json();
        if (url.pathname === "/rest/v1/rpc/builder_consume_function_limit")
          return Response.json({ allowed: true, retryAfter: 0 });
        assert.equal(
          url.pathname,
          "/rest/v1/rpc/builder_register_asset",
          "No direct asset-table or Storage write is allowed",
        );
        assert.equal(
          request.headers.get("authorization"),
          "Bearer fixture-service",
        );
        assert.equal(body.actor, actor);
        assert.equal(body.public_origin, api);
        assert.equal(body.target, legacy ? "kaizen" : projectId);
        registrations.push(body);
        return verified
          ? Response.json({
              ...body.asset,
              url: legacy
                ? `${api}/storage/v1/object/public/builder-media/${asset.id}`
                : `/builder-project-media/${projectId}/${asset.id}`,
            })
          : Response.json(
              {
                code: "P0409",
                message:
                  "Verify this file through the upload service before adding it to the library",
              },
              { status: 400 },
            );
      };
      await import("../../supabase/functions/builder-projects/index.ts");
      const send = (value: any = asset) =>
        handler(
          new Request(api + "/functions/v1/builder-projects", {
            method: "POST",
            headers: {
              origin,
              authorization: "Bearer fixture-session",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              action: "register-asset",
              projectId: legacy ? "kaizen" : projectId,
              actor: "forged",
              public_origin: "https://untrusted.example.test",
              asset: value,
            }),
          }),
        );
      await test.step("non-members cannot reach registration", async () => {
        membership = false;
        assert.equal((await send()).status, 403);
        assert.equal(registrations.length, 0);
        membership = true;
      });
      await test.step("client registration uses the actual account and database-selected project address", async () => {
        const response = await send();
        assert.equal(response.status, 200);
        assert.equal(
          (await response.json()).url,
          `/builder-project-media/${projectId}/${asset.id}`,
        );
        assert.equal(registrations.length, 1);
      });
      await test.step("the original Kaizen workspace uses the same ledger-gated registration", async () => {
        legacy = true;
        const response = await send();
        assert.equal(response.status, 200);
        assert.equal(
          (await response.json()).url,
          `${api}/storage/v1/object/public/builder-media/${asset.id}`,
        );
      });
      await test.step("an unverified file retains recovery instructions without a fallback direct write", async () => {
        verified = false;
        const response = await send();
        assert.equal(response.status, 409);
        assert.match((await response.json()).error, /Verify this file/);
        verified = true;
      });
      await test.step("malformed file metadata is refused before the privileged RPC", async () => {
        const count = registrations.length;
        for (const change of [
          { id: "bad-id" },
          { size: 0 },
          { size: 52428801 },
          { hash: "forged" },
          { mime: "image/png\nheader" },
          { kind: "unknown" },
        ]) {
          assert.equal((await send({ ...asset, ...change })).status, 409);
        }
        assert.equal(registrations.length, count);
      });
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(Deno, "serve", descriptor);
      for (const [key, value] of prior)
        value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
    }
  },
);
