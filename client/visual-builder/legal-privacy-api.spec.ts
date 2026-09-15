import { it, expect, vi } from "vitest";
import { createAccountHandler } from "../../supabase/functions/_shared/builderAccounts";
import { BUILDER_LEGAL } from "../../shared/builderLegal";
const actor = "11111111-1111-4111-8111-111111111111",
  stranger = "22222222-2222-4222-8222-222222222222";
const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function fixture() {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let errorCode = "";
  const getUser = vi.fn(async () => ({
    data: { user: { id: actor } },
    error: null as any,
  }));
  const deleteUser = vi.fn();
  const handler = createAccountHandler({
    headers: () => new Headers(),
    originAllowed: (request) =>
      request.headers.get("Origin") === "https://fixture.invalid",
    service: {
      auth: { getUser, admin: { deleteUser } },
      rpc: async (name, args) => {
        if (name === "builder_consume_function_limit")
          return { data: { allowed: true, retryAfter: 0 }, error: null };
        calls.push({ name, args });
        if (errorCode) return { data: null, error: { code: errorCode } };
        if (name.startsWith("builder_legal_"))
          return {
            data: {
              ...BUILDER_LEGAL,
              acceptedAt:
                name === "builder_legal_accept" ? "2026-09-14T00:00:00Z" : null,
            },
            error: null,
          };
        return {
          data:
            name === "builder_privacy_projects"
              ? []
              : name === "builder_privacy_list"
                ? { items: [], nextCursor: null }
                : requestId,
          error: null,
        };
      },
    },
  });
  const send = (input: unknown, headers: Record<string, string> = {}) =>
    handler(
      new Request("https://api.fixture.invalid/builder-account", {
        method: "POST",
        headers: {
          Origin: "https://fixture.invalid",
          Authorization: "Bearer fixture-token",
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(input),
      }),
    );
  return {
    send,
    calls,
    getUser,
    deleteUser,
    fail: (code: string) => {
      errorCode = code;
    },
  };
}
it("binds legal acceptance to the verified JWT caller and current submitted document hashes", async () => {
  const f = fixture();
  const result = await f.send({
    action: "legal-accept",
    ...BUILDER_LEGAL,
    confirmed: true,
    actor: stranger,
  });
  expect(result.status).toBe(200);
  expect(f.getUser).toHaveBeenCalledWith("fixture-token");
  expect(f.calls).toEqual([
    {
      name: "builder_legal_accept",
      args: {
        actor,
        expected_version: BUILDER_LEGAL.version,
        terms_hash: BUILDER_LEGAL.termsHash,
        privacy_hash: BUILDER_LEGAL.privacyHash,
        confirmed: true,
      },
    },
  ]);
  expect(f.deleteUser).not.toHaveBeenCalled();
});
it.each([
  {},
  { confirmed: false },
  { confirmed: "true" },
  { termsHash: "changed" },
  { version: "../untrusted" },
])(
  "refuses incomplete or unconfirmed acceptance before a write: %j",
  async (changes) => {
    const f = fixture();
    const body = Object.keys(changes).length
      ? {
          action: "legal-accept",
          ...BUILDER_LEGAL,
          confirmed: true,
          ...changes,
        }
      : { action: "legal-accept" };
    expect((await f.send(body)).status).toBe(400);
    expect(f.calls).toEqual([]);
  },
);
it("binds privacy requests to the verified requester and never accepts the operator override", async () => {
  const f = fixture();
  expect(
    (
      await f.send({
        action: "privacy-request",
        actor: null,
        userId: stranger,
        requestId,
        projectId: null,
        kind: "erasure",
        details: "Remove my personal information.",
      })
    ).status,
  ).toBe(200);
  expect(f.calls[0]).toEqual({
    name: "builder_privacy_request",
    args: {
      actor,
      target: null,
      request_kind: "erasure",
      request_details: "Remove my personal information.",
      request_id: requestId,
    },
  });
  expect(
    f.calls
      .filter((call) => call.name === "builder_privacy_list")
      .every((call) => call.args.actor === actor),
  ).toBe(true);
  expect(f.deleteUser).not.toHaveBeenCalled();
});
it("requires a current version, response and handled confirmation before closing a request", async () => {
  const f = fixture();
  const input = {
    action: "privacy-update",
    requestId,
    version: 1,
    status: "fulfilled",
    response: "The copy was delivered securely.",
  };
  expect((await f.send(input)).status).toBe(400);
  expect(f.calls).toEqual([]);
  expect((await f.send({ ...input, handled: true, actor: null })).status).toBe(
    200,
  );
  expect(f.calls[0]).toMatchObject({
    name: "builder_privacy_update",
    args: {
      actor,
      request_id: requestId,
      expected_version: 1,
      next_status: "fulfilled",
    },
  });
});
it.each([
  ["42501", 403],
  ["40001", 409],
  ["P0429", 429],
  ["22023", 400],
  ["unknown-private-error", 503],
])("maps database failures to bounded errors: %s", async (code, status) => {
  const f = fixture();
  f.fail(String(code));
  const response = await f.send({ action: "legal-state" });
  expect(response.status).toBe(status);
  expect(await response.text()).not.toContain(String(code));
});
it("retains origin, identity and body limits for the added actions", async () => {
  const f = fixture();
  expect(
    (
      await f.send(
        { action: "privacy-state" },
        { Origin: "https://unrelated.invalid" },
      )
    ).status,
  ).toBe(403);
  expect(
    (await f.send({ action: "privacy-state" }, { Authorization: "" })).status,
  ).toBe(401);
  expect(
    (await f.send({ action: "privacy-request", details: "x".repeat(8193) }))
      .status,
  ).toBe(413);
  expect(f.calls).toEqual([]);
});
it("supports the full response length in UTF-8 while retaining the smaller account-deletion envelope", async () => {
  const f = fixture();
  const response = "例".repeat(2000);
  expect(
    (
      await f.send({
        action: "privacy-update",
        requestId,
        version: 1,
        status: "fulfilled",
        response,
        handled: true,
      })
    ).status,
  ).toBe(200);
  expect(f.calls[0]).toEqual({
    name: "builder_privacy_update",
    args: {
      actor,
      request_id: requestId,
      expected_version: 1,
      next_status: "fulfilled",
      owner_response: response,
    },
  });
  f.calls.length = 0;
  expect(
    (await f.send({ action: "state", padding: "x".repeat(4097) })).status,
  ).toBe(413);
  expect(f.calls).toEqual([]);
});
it("only paginates a validated personal or owner request queue", async () => {
  const f = fixture();
  expect(
    (await f.send({ action: "privacy-list", scope: "operator", actor: null }))
      .status,
  ).toBe(400);
  expect(
    (
      await f.send({
        action: "privacy-list",
        scope: "reviews",
        beforeId: requestId,
      })
    ).status,
  ).toBe(200);
  expect(f.calls).toEqual([
    {
      name: "builder_privacy_list",
      args: { actor, inbox: true, before_id: requestId },
    },
  ]);
});
