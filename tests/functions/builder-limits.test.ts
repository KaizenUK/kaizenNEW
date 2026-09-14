import assert from "node:assert/strict";
import {
  readJsonObject,
  RequestBodyError,
} from "../../supabase/functions/_shared/requestBody.ts";

const actor = "11111111-1111-4111-8111-111111111111";
const origin = "https://editor.example.test";
const api = "https://supabase.example.test";
type Handler = (request: Request) => Response | Promise<Response>;

Deno.test(
  "actual hosted entry points stop denied work at the global and verified-user boundaries",
  async (test) => {
    const originalFetch = globalThis.fetch;
    const env = {
      SUPABASE_URL: api,
      SUPABASE_ANON_KEY: "fixture-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
      ALLOWED_STUDIO_ORIGINS: origin,
      GITHUB_DEPLOY_TOKEN: "fixture-deployment-credential",
      GITHUB_DEPLOY_REPO: "fixture/website",
      BUILDER_RELEASE_COORDINATOR: "1",
    };
    const oldEnv = new Map(
      Object.keys(env).map((key) => [key, Deno.env.get(key)]),
    );
    let handler: Handler | undefined;
    let mode: "global" | "user" | "outage" | "allowed" | "expired" = "global";
    let calls: { path: string; body: Record<string, unknown> | null }[] = [];
    let allowPublication = false;
    const serveDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve")!;
    try {
      for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
      // Only the server startup and HTTP transport are replaced. Imports execute
      // the real handler, shared limiter and pinned Supabase SDK. Network access
      // is absent from this test's Deno permissions.
      Object.defineProperty(Deno, "serve", {
        configurable: serveDescriptor.configurable,
        enumerable: serveDescriptor.enumerable,
        writable: true,
        value: (value: Handler) => {
          handler = value;
        },
      });
      globalThis.fetch = async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        assert.equal(
          url.origin,
          api,
          "No external email, provider or publication call is permitted",
        );
        const body = request.body ? await request.json() : null;
        calls.push({ path: url.pathname, body });
        if (url.pathname === "/rest/v1/rpc/builder_consume_function_limit") {
          if (mode === "outage")
            return Response.json(
              { message: "fixture private database detail" },
              { status: 503 },
            );
          const allowed =
            mode !== "global" && !(mode === "user" && body.actor_id);
          return Response.json({ allowed, retryAfter: allowed ? 0 : 17 });
        }
        if (url.pathname === "/auth/v1/user") {
          assert.equal(
            request.headers.get("authorization"),
            "Bearer fixture-session",
          );
          if (mode === "expired")
            return Response.json(
              { message: "Expired fixture session" },
              { status: 401 },
            );
          return Response.json({
            id: actor,
            aud: "authenticated",
            email: "fixture@example.test",
            created_at: "2026-01-01T00:00:00Z",
          });
        }
        if (
          allowPublication &&
          url.pathname === "/rest/v1/builder_project_members"
        )
          return Response.json({ can_publish: true });
        if (allowPublication && url.pathname === "/rest/v1/builder_projects")
          return Response.json({
            id: "kaizen",
            archived: false,
            capabilities: {
              legacyWorkspace: true,
              hasInventory: true,
              publishPath: "github",
            },
          });
        if (
          url.pathname === "/rest/v1/builder_project_members" ||
          url.pathname === "/rest/v1/builder_editors"
        )
          return Response.json(null);
        throw new Error(`Unexpected fixture operation: ${url.pathname}`);
      };
      for (const endpoint of [
        "builder-projects",
        "builder-publish",
        "builder-content",
      ]) {
        handler = undefined;
        await import(`../../supabase/functions/${endpoint}/index.ts`);
        assert.ok(handler, `${endpoint} registers its real handler`);
        const handle = handler as Handler;
        const makeRequest = (change: RequestInit = {}) =>
          new Request(`${api}/functions/v1/${endpoint}`, {
            method: "POST",
            headers: {
              origin,
              authorization: "Bearer fixture-session",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              projectId: "kaizen",
              action: "fixture-invalid-action",
              actor: "forged-user",
            }),
            ...change,
          });
        for (const denied of ["global", "user", "outage"] as const)
          await test.step(`${endpoint}: ${denied} denial never reaches body or business work`, async () => {
            mode = denied;
            calls = [];
            const request = makeRequest();
            const response = await handle(request);
            assert.equal(response.status, mode === "outage" ? 503 : 429);
            assert.equal(
              response.headers.get("retry-after"),
              mode === "outage" ? "30" : "17",
            );
            assert.equal(
              response.headers.get("access-control-allow-origin"),
              origin,
            );
            assert.equal(request.bodyUsed, false);
            assert.ok(!(await response.text()).includes("fixture private"));
            assert.deepEqual(
              calls.map((call) => call.path),
              mode === "user"
                ? [
                    "/rest/v1/rpc/builder_consume_function_limit",
                    "/auth/v1/user",
                    "/rest/v1/rpc/builder_consume_function_limit",
                  ]
                : ["/rest/v1/rpc/builder_consume_function_limit"],
            );
            assert.equal(calls[0].body?.target_function, endpoint);
            assert.equal(calls[0].body?.actor_id, null);
            if (mode === "user") assert.equal(calls[2].body?.actor_id, actor);
          });
        await test.step(`${endpoint}: missing, malformed and expired credentials cannot reach project work`, async () => {
          mode = "allowed";
          for (const authorization of [
            "",
            "Basic fixture-session",
            "Bearer with spaces",
            `Bearer ${"x".repeat(8193)}`,
          ]) {
            calls = [];
            const response = await handle(
              makeRequest({ headers: { origin, authorization } }),
            );
            assert.equal(response.status, 401);
            assert.deepEqual(calls, []);
          }
          calls = [];
          mode = "expired";
          assert.equal((await handle(makeRequest())).status, 401);
          assert.deepEqual(
            calls.map((call) => call.path),
            ["/rest/v1/rpc/builder_consume_function_limit", "/auth/v1/user"],
          );
        });
        await test.step(`${endpoint}: a rejected origin performs no authentication or database work`, async () => {
          calls = [];
          mode = "allowed";
          assert.equal(
            (
              await handle(
                makeRequest({
                  headers: { origin: "https://hostile.example.test" },
                }),
              )
            ).status,
            403,
          );
          assert.deepEqual(calls, []);
        });
        if (endpoint === "builder-publish") {
          await test.step("publication counts streamed bytes and rejects malformed requests before permission or GitHub calls", async () => {
            mode = "allowed";
            for (const [body, headers, status] of [
              [
                JSON.stringify({ text: "x".repeat(65536) }),
                { "content-type": "application/json" },
                413,
              ],
              ["not JSON", { "content-type": "application/json" }, 400],
              ["{}", { "content-type": "text/plain" }, 415],
              ["[]", { "content-type": "application/json" }, 400],
            ] as const) {
              calls = [];
              const response = await handle(
                makeRequest({
                  body,
                  headers: {
                    origin,
                    authorization: "Bearer fixture-session",
                    ...headers,
                  },
                }),
              );
              assert.equal(response.status, status);
              assert.equal(calls.length, 3);
            }
          });
          await test.step("publication validates action and redirect version types without queueing or dispatching", async () => {
            mode = "allowed";
            allowPublication = true;
            try {
              for (const input of [
                { action: {} },
                { action: ["redirects"] },
                ...[null, [], "1", -1, 0.5, Number.MAX_SAFE_INTEGER + 1].map(
                  (version) => ({ action: "redirects", version }),
                ),
              ]) {
                calls = [];
                const response = await handle(
                  makeRequest({
                    body: JSON.stringify({ projectId: "kaizen", ...input }),
                  }),
                );
                assert.equal(response.status, 400);
                assert.equal(calls.length, 5);
                assert.equal(calls.at(-1)?.path, "/rest/v1/builder_projects");
              }
            } finally {
              allowPublication = false;
            }
          });
        }
      }
    } finally {
      Object.defineProperty(Deno, "serve", serveDescriptor);
      globalThis.fetch = originalFetch;
      for (const [key, value] of oldEnv)
        value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
    }
  },
);

Deno.test(
  "bounded JSON reader cancels oversized streams and handles invalid framing safely",
  async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value":"oversized"}'));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://fixture.test", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "1" },
      body: stream,
    });
    await assert.rejects(
      readJsonObject(request, 10),
      (error: unknown) =>
        error instanceof RequestBodyError && error.status === 413,
    );
    assert.equal(cancelled, true);
    for (const [headers, body, status] of [
      [
        { "content-type": "application/json", "content-encoding": "gzip" },
        "{}",
        415,
      ],
      [
        { "content-type": "application/json", "content-length": "-2" },
        "{}",
        400,
      ],
      [
        { "content-type": "application/json", "content-length": "100" },
        "{}",
        413,
      ],
      [{ "content-type": "application/json" }, new Uint8Array([0xff]), 400],
      [{ "content-type": "application/json" }, "null", 400],
    ] as const)
      await assert.rejects(
        readJsonObject(
          new Request("https://fixture.test", {
            method: "POST",
            headers,
            body,
          }),
          20,
        ),
        (error: unknown) =>
          error instanceof RequestBodyError && error.status === status,
      );
    const value = { value: "£" };
    assert.deepEqual(
      await readJsonObject(
        new Request("https://fixture.test", {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify(value),
        }),
        20,
      ),
      value,
    );
  },
);
