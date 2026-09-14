import { it, expect, vi } from "vitest";
import { createAccountHandler } from "../../supabase/functions/_shared/builderAccounts";
const owner = "11111111-1111-4111-8111-111111111111",
  person = "22222222-2222-4222-8222-222222222222",
  requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  projectId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function fixture() {
  const state = {
    prepared: { status: "pending" } as any,
    calls: [] as { name: string; args: Record<string, unknown> }[],
    errorCode: "",
    failComplete: false,
    failDelete: false,
    deleted: [] as unknown[],
  };
  const getUser = vi.fn(async (_token: string) => ({
    data: { user: { id: owner } },
    error: null as any,
  }));
  const deleteUser = vi.fn(async (id: string, soft: boolean) => {
    state.deleted.push([id, soft]);
    return {
      error: state.failDelete ? new Error("private Auth removal detail") : null,
    };
  });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    state.calls.push({ name, args });
    if (state.errorCode)
      return { data: null, error: { code: state.errorCode } };
    if (name === "builder_account_deletion_prepare")
      return { data: state.prepared, error: null };
    if (name === "builder_account_deletion_complete" && state.failComplete)
      return { data: null, error: { code: "40001" } };
    return {
      data:
        name === "builder_account_deletion_state"
          ? { request: null, reviews: [] }
          : requestId,
      error: null,
    };
  });
  const limitRpc = vi.fn(
    async (_name: string, _args: Record<string, unknown>) => ({
      data: { allowed: true, retryAfter: 0 },
      error: null as { code?: string; status?: number } | null,
    }),
  );
  const handler = createAccountHandler({
    service: {
      auth: { getUser, admin: { deleteUser } },
      rpc: (name, args) =>
        name === "builder_consume_function_limit"
          ? limitRpc(name, args)
          : rpc(name, args),
    },
    headers: () => new Headers(),
    originAllowed: (r) =>
      [null, "https://builder.example.test"].includes(r.headers.get("origin")),
  });
  const send = (
    body: unknown = { action: "state" },
    options: {
      method?: string;
      headers?: Record<string, string>;
      raw?: string | Uint8Array<ArrayBuffer>;
    } = {},
  ) =>
    handler(
      new Request("https://api.example.test/builder-account", {
        method: options.method || "POST",
        headers: {
          authorization: "Bearer fixture-token",
          "content-type": "application/json",
          ...options.headers,
        },
        ...(["GET", "OPTIONS"].includes(options.method || "")
          ? {}
          : { body: options.raw ?? JSON.stringify(body) }),
      }),
    );
  return { state, getUser, deleteUser, rpc, limitRpc, send };
}
it("requests and reads only the verified caller's account, ignoring caller-supplied identities", async () => {
  const f = fixture();
  const response = await f.send({
    action: "request",
    confirmation: "DELETE MY ACCOUNT",
    actor: null,
    userId: person,
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(f.state.calls).toEqual([
    { name: "builder_account_deletion_request", args: { actor: owner } },
    { name: "builder_account_deletion_state", args: { actor: owner } },
  ]);
  expect(f.state.deleted).toEqual([]);
});
it("records one website owner's approval without removing an account while other owners are pending", async () => {
  const f = fixture();
  const response = await f.send({
    action: "confirm",
    requestId,
    projectId,
    confirmation: "CONFIRM DELETION",
  });
  expect((await response.json()).outcome).toBe("awaiting-owners");
  expect(f.deleteUser).not.toHaveBeenCalled();
  expect(f.state.calls[0]).toEqual({
    name: "builder_account_deletion_prepare",
    args: { actor: owner, request: requestId, target: projectId },
  });
});
it("removes only the database-authorized account through Auth and confirms database completion", async () => {
  const f = fixture();
  f.state.prepared = { status: "processing", userId: person };
  const response = await f.send({
    action: "confirm",
    requestId,
    projectId,
    userId: owner,
    confirmation: "CONFIRM DELETION",
  });
  expect(response.status).toBe(200);
  expect((await response.json()).outcome).toBe("deleted");
  expect(f.state.deleted).toEqual([[person, true]]);
  expect(f.state.calls.map((c) => c.name)).toEqual([
    "builder_account_deletion_prepare",
    "builder_account_deletion_complete",
    "builder_account_deletion_state",
  ]);
});
it("does not call Auth again for an already completed request", async () => {
  const f = fixture();
  f.state.prepared = { status: "completed", userId: person };
  expect(
    (
      await (
        await f.send({
          action: "finish",
          requestId,
          confirmation: "CONFIRM DELETION",
        })
      ).json()
    ).outcome,
  ).toBe("deleted");
  expect(f.deleteUser).not.toHaveBeenCalled();
  expect(f.state.calls[0].args.target).toBeNull();
});
it.each(["delete", "completion"])(
  "reports interrupted %s honestly, retaining an explicit retry instead of restoring access",
  async (failure) => {
    const f = fixture();
    f.state.prepared = { status: "processing", userId: person };
    f.state.failDelete = failure === "delete";
    f.state.failComplete = failure === "completion";
    const response = await f.send({
      action: "finish",
      requestId,
      confirmation: "CONFIRM DELETION",
    });
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("project access has ended");
    expect(f.deleteUser).toHaveBeenCalledTimes(1);
    f.state.failDelete = false;
    f.state.failComplete = false;
    expect(
      (
        await f.send({
          action: "finish",
          requestId,
          confirmation: "CONFIRM DELETION",
        })
      ).status,
    ).toBe(200);
  },
);
it("cancels only through the caller-bound transaction and never reaches Auth removal", async () => {
  const f = fixture();
  const response = await f.send({
    action: "cancel",
    requestId,
    userId: person,
  });
  expect((await response.json()).outcome).toBe("cancelled");
  expect(f.state.calls[0]).toEqual({
    name: "builder_account_deletion_cancel",
    args: { actor: owner, request: requestId },
  });
  expect(f.deleteUser).not.toHaveBeenCalled();
});
it.each([
  ["42501", 403],
  ["40001", 409],
  ["40P01", 409],
  ["P0409", 409],
  ["unknown", 503],
])(
  "refuses unauthorized or changed requests before Auth: %s",
  async (code, status) => {
    const f = fixture();
    f.state.errorCode = String(code);
    const response = await f.send({
      action: "confirm",
      requestId,
      projectId,
      confirmation: "CONFIRM DELETION",
    });
    expect(response.status).toBe(status);
    expect(f.deleteUser).not.toHaveBeenCalled();
  },
);
it.each([
  { action: "request" },
  { action: "request", confirmation: "yes" },
  { action: "confirm", requestId, projectId },
  {
    action: "confirm",
    requestId,
    projectId: "other",
    confirmation: "CONFIRM DELETION",
  },
  { action: "cancel", requestId: "other" },
  { action: "finish", requestId },
  { action: "operator-confirm", requestId },
  [],
  null,
])(
  "rejects malformed or unconfirmed actions before any database write %#",
  async (body) => {
    const f = fixture();
    expect((await f.send(body)).status).toBe(400);
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.deleteUser).not.toHaveBeenCalled();
  },
);
it("enforces origin, method, sign-in and body limits before dispatch", async () => {
  const f = fixture();
  expect(
    (await f.send({}, { headers: { origin: "https://foreign.example" } }))
      .status,
  ).toBe(403);
  expect((await f.send({}, { method: "GET" })).status).toBe(405);
  expect((await f.send({}, { headers: { authorization: "" } })).status).toBe(
    401,
  );
  expect(f.getUser).not.toHaveBeenCalled();
  expect(
    (await f.send({}, { headers: { "content-type": "text/plain" } })).status,
  ).toBe(415);
  expect(
    (await f.send({}, { headers: { "content-encoding": "gzip" } })).status,
  ).toBe(415);
  expect((await f.send({}, { raw: "x".repeat(4097) })).status).toBe(413);
  expect((await f.send({}, { raw: new Uint8Array([0xff]) })).status).toBe(400);
  f.getUser.mockResolvedValueOnce({
    data: { user: null } as any,
    error: { code: "bad_jwt" },
  });
  expect((await f.send()).status).toBe(401);
  expect(f.rpc).not.toHaveBeenCalled();
});
it("refuses malformed prepared identities and hides upstream failures", async () => {
  const f = fixture();
  f.state.prepared = { status: "processing", userId: "wrong" };
  const result = await f.send({
    action: "finish",
    requestId,
    confirmation: "CONFIRM DELETION",
  });
  expect(result.status).toBe(503);
  expect(f.deleteUser).not.toHaveBeenCalled();
  f.getUser.mockRejectedValueOnce(new Error("private upstream detail"));
  expect(await (await f.send()).text()).not.toContain(
    "private upstream detail",
  );
});

it("stops at global limits before Auth and at verified-user limits before account changes", async () => {
  const global = fixture();
  global.limitRpc.mockResolvedValueOnce({
    data: { allowed: false, retryAfter: 23 },
    error: null,
  });
  expect((await global.send()).status).toBe(429);
  expect(global.getUser).not.toHaveBeenCalled();
  expect(global.rpc).not.toHaveBeenCalled();
  const user = fixture();
  user.limitRpc.mockResolvedValueOnce({
    data: { allowed: true, retryAfter: 0 },
    error: null,
  });
  user.limitRpc.mockResolvedValueOnce({
    data: { allowed: false, retryAfter: 9 },
    error: null,
  });
  expect(
    (
      await user.send({
        action: "request",
        confirmation: "DELETE MY ACCOUNT",
        actor: person,
      })
    ).status,
  ).toBe(429);
  expect(user.limitRpc.mock.calls.map((call) => call[1].actor_id)).toEqual([
    null,
    owner,
  ]);
  expect(user.rpc).not.toHaveBeenCalled();
  expect(user.deleteUser).not.toHaveBeenCalled();
});
it("a failed request-limit check cannot delete an account", async () => {
  const f = fixture();
  f.limitRpc.mockRejectedValueOnce(new Error("fixture limiter outage"));
  expect(
    (
      await f.send({
        action: "finish",
        requestId,
        confirmation: "CONFIRM DELETION",
      })
    ).status,
  ).toBe(503);
  expect(f.getUser).not.toHaveBeenCalled();
  expect(f.deleteUser).not.toHaveBeenCalled();
});
