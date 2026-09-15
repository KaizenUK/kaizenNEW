import assert from "node:assert/strict";

Deno.test(
  "domain project actions bind verified account, server configuration and explicit removal",
  async (test) => {
    const actor = "11111111-1111-4111-8111-111111111111";
    const project = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const domainId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const api = "https://domains.supabase.test",
      origin = "https://builder.example.test";
    const configuration = {
      workerId: "fixture-domains",
      ipv4: ["144.91.72.17"],
      ipv6: [],
      reservedHostnames: ["kaizenweb.co.uk"],
    };
    const environment = {
      SUPABASE_URL: api,
      SUPABASE_ANON_KEY: "fixture-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
      ALLOWED_STUDIO_ORIGINS: origin,
      BUILDER_DOMAIN_CONFIG: JSON.stringify(configuration),
    };
    const prior = new Map(
      Object.keys(environment).map((key) => [key, Deno.env.get(key)]),
    );
    const originalFetch = globalThis.fetch,
      descriptor = Object.getOwnPropertyDescriptor(Deno, "serve")!;
    let handler!: (request: Request) => Promise<Response>;
    let role: "owner" | "editor" | null = "owner",
      canPublish = true;
    let failure: { code: string; message: string } | null = null;
    const calls: { name: string; body: any }[] = [];
    const state = {
      projectId: project,
      canManage: true,
      archived: false,
      domain: null,
      history: [],
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
            role && url.searchParams.get("project_id") === `eq.${project}`
              ? { role, can_publish: canPublish }
              : null,
          );
        }
        if (url.pathname === "/rest/v1/builder_projects")
          return Response.json({
            id: project,
            capabilities: {
              legacyWorkspace: false,
              hasInventory: false,
              publishPath: "worker",
            },
          });
        const body = await request.json(),
          name = url.pathname.split("/").at(-1)!;
        if (name === "builder_consume_function_limit")
          return Response.json({ allowed: true, retryAfter: 0 });
        assert.equal(
          request.headers.get("authorization"),
          "Bearer fixture-service-key",
        );
        assert.ok(
          ["builder_domain_state", "builder_domain_request"].includes(name),
        );
        assert.equal(body.target, project);
        assert.equal(body.actor, actor);
        calls.push({ name, body });
        return failure
          ? Response.json(failure, { status: 400 })
          : Response.json(state);
      };
      await import("../../supabase/functions/builder-projects/index.ts");
      const send = (input: Record<string, unknown>) =>
        handler(
          new Request(api + "/functions/v1/builder-projects", {
            method: "POST",
            headers: {
              origin,
              authorization: "Bearer fixture-session",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              projectId: project,
              domainId,
              hostname: "WWW.Café.co.uk.",
              version: 1,
              ...input,
            }),
          }),
        );
      await test.step("lost membership denies all domain reads and mutations", async () => {
        role = null;
        calls.length = 0;
        for (const action of [
          "domain-state",
          "domain-add",
          "domain-verify",
          "domain-remove",
        ]) {
          assert.equal((await send({ action, confirm: true })).status, 403);
        }
        assert.equal(calls.length, 0);
      });
      await test.step("editors may read status but changes need an owner with publishing permission", async () => {
        role = "editor";
        assert.equal((await send({ action: "domain-state" })).status, 200);
        calls.length = 0;
        for (const action of ["domain-add", "domain-verify", "domain-remove"])
          assert.equal((await send({ action, confirm: true })).status, 403);
        role = "owner";
        canPublish = false;
        assert.equal((await send({ action: "domain-add" })).status, 403);
        assert.equal(calls.length, 0);
        canPublish = true;
      });
      await test.step("add normalizes the hostname and replaces forged routing, actor and challenge fields", async () => {
        const reply = await send({
          action: "domain-add",
          actor: "forged",
          worker: "forged",
          challenge: "forged",
          providerOwned: true,
        });
        assert.equal(reply.status, 200);
        const call = calls.at(-1)!;
        assert.equal(call.name, "builder_domain_request");
        assert.equal(call.body.domain_hostname, "www.xn--caf-dma.co.uk");
        assert.equal(call.body.worker, "fixture-domains");
        assert.match(call.body.challenge, /^[a-f0-9]{64}$/);
        assert.equal(call.body.request_id, domainId);
        assert.equal(call.body.command, "add");
        assert.equal("providerOwned" in call.body, false);
        const body = await reply.json();
        assert.deepEqual(body.hosting, { ipv4: configuration.ipv4, ipv6: [] });
        assert.equal(JSON.stringify(body).includes("workerId"), false);
        assert.equal(JSON.stringify(body).includes("reservedHostnames"), false);
      });
      await test.step("reserved names, URLs and malformed request identities fail before database mutation", async () => {
        calls.length = 0;
        for (const hostname of [
          "studio.kaizenweb.co.uk",
          "https://customer.co.uk",
          "127.0.0.1",
          "*.customer.co.uk",
        ]) {
          assert.equal(
            (await send({ action: "domain-add", hostname })).status,
            400,
          );
        }
        assert.equal(
          (await send({ action: "domain-add", domainId: "invalid" })).status,
          400,
        );
        assert.equal(calls.length, 0);
      });
      await test.step("verify requires an observed version and remove requires explicit confirmation", async () => {
        calls.length = 0;
        for (const version of [null, 0, "1", 1.5, 2147483648])
          assert.equal(
            (await send({ action: "domain-verify", version })).status,
            400,
          );
        for (const confirm of [undefined, false, "true", 1])
          assert.equal(
            (await send({ action: "domain-remove", confirm })).status,
            400,
          );
        assert.equal(calls.length, 0);
        assert.equal(
          (await send({ action: "domain-verify", version: 4 })).status,
          200,
        );
        assert.deepEqual(calls.at(-1)!.body, {
          target: project,
          actor,
          request_id: domainId,
          command: "verify",
          expected_version: 4,
        });
        assert.equal(
          (await send({ action: "domain-remove", version: 5, confirm: true }))
            .status,
          200,
        );
        assert.equal(calls.at(-1)!.body.command, "remove");
      });
      await test.step("missing hosting configuration keeps existing status readable and refuses new connections", async () => {
        Deno.env.delete("BUILDER_DOMAIN_CONFIG");
        calls.length = 0;
        assert.equal((await send({ action: "domain-add" })).status, 503);
        assert.equal(calls.length, 0);
        const reply = await send({ action: "domain-state" });
        assert.equal(reply.status, 200);
        assert.equal((await reply.json()).hosting, null);
        Deno.env.set(
          "BUILDER_DOMAIN_CONFIG",
          environment.BUILDER_DOMAIN_CONFIG,
        );
      });
      await test.step("database conflicts stay explicit and unexpected provider details are not reflected", async () => {
        failure = {
          code: "P0409",
          message: "Domain setup changed. Refresh its status.",
        };
        let reply = await send({ action: "domain-verify" });
        assert.equal(reply.status, 409);
        assert.equal((await reply.json()).error, failure.message);
        failure = { code: "XX000", message: "private provider detail" };
        reply = await send({ action: "domain-verify" });
        assert.equal(reply.status, 409);
        assert.equal(
          (await reply.text()).includes("private provider detail"),
          false,
        );
      });
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(Deno, "serve", descriptor);
      for (const [key, value] of prior)
        value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
    }
  },
);
