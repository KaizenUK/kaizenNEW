import { describe, expect, it, vi } from "vitest";
import { createInvitationHandler } from "../../supabase/functions/_shared/builderInvitations";
const owner = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222";
const project = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = {
  action: "invite",
  projectId: project,
  email: " Member@Example.Test ",
  role: "editor",
  canPublish: false,
};
function fixture() {
  const record = {
    email: "member@example.test",
    accountId: null as string | null,
    confirmed: false,
    alreadyMember: false,
    version: 4,
  };
  const getUser = vi.fn(async (_token: string) => ({
    data: { user: { id: owner } },
    error: null as any,
  }));
  const invite = vi.fn(async (_email: string, _options: unknown) => ({
    data: { user: { id: member, email: "member@example.test" } },
    error: null as any,
  }));
  const rpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
    data: name === "builder_prepare_invitation" ? record : (true as any),
    error: null as any,
  }));
  const handler = createInvitationHandler({
    service: { auth: { getUser, admin: { inviteUserByEmail: invite } }, rpc },
    redirectOrigin: "https://builder.example.test",
    headers: () => new Headers(),
    originAllowed: (req) =>
      [null, "https://builder.example.test"].includes(
        req.headers.get("origin"),
      ),
  });
  const request = (
    body: unknown = input,
    options: {
      method?: string;
      headers?: Record<string, string>;
      raw?: string;
    } = {},
  ) =>
    handler(
      new Request("https://api.example.test/builder-invite", {
        method: options.method || "POST",
        headers: {
          authorization: "Bearer fixture-token",
          "content-type": "application/json",
          origin: "https://builder.example.test",
          ...options.headers,
        },
        ...(["GET", "HEAD"].includes(options.method || "")
          ? {}
          : { body: options.raw ?? JSON.stringify(body) }),
      }),
    );
  return { record, getUser, invite, rpc, request };
}
describe("owner invitation endpoint", () => {
  it("authenticates first, fixes redirect/metadata and creates only the returned email identity", async () => {
    const f = fixture();
    const res = await f.request({
      ...input,
      actor: "forged",
      redirectTo: "https://foreign.example",
      token: "do-not-return",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kind: "invited", emailRequested: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(f.getUser).toHaveBeenCalledTimes(2);
    expect(f.rpc.mock.calls[0]).toEqual([
      "builder_prepare_invitation",
      {
        target: project,
        actor: owner,
        address: "member@example.test",
        member_id: null,
      },
    ]);
    expect(f.invite).toHaveBeenCalledWith("member@example.test", {
      redirectTo:
        "https://builder.example.test/builder/?password=setup&project=" +
        project,
      data: { builder_password_set: false },
    });
    expect(f.rpc.mock.calls[1]).toEqual([
      "builder_complete_invitation",
      {
        target: project,
        actor: owner,
        address: "member@example.test",
        member_id: member,
        expected_access_version: 4,
        add_member: true,
        member_role: "editor",
        publish_permission: false,
      },
    ]);
    expect(f.getUser.mock.invocationCallOrder[0]).toBeLessThan(
      f.rpc.mock.invocationCallOrder[0],
    );
    expect(f.invite.mock.invocationCallOrder[0]).toBeLessThan(
      f.rpc.mock.invocationCallOrder[1],
    );
  });
  it.each([
    { confirmed: true, alreadyMember: false, kind: "added" },
    { confirmed: true, alreadyMember: true, kind: "already-member" },
    { confirmed: false, alreadyMember: true, kind: "resent" },
  ])(
    "handles known accounts without changing existing access: %j",
    async (value) => {
      const f = fixture();
      Object.assign(f.record, value, { accountId: member });
      const response = await f.request();
      expect(response.status).toBe(200);
      expect((await response.json()).kind).toBe(value.kind);
      expect(f.invite).toHaveBeenCalledTimes(value.confirmed ? 0 : 1);
      expect(f.rpc.mock.calls[1][1].add_member).toBe(!value.alreadyMember);
    },
  );
  it("resends only to the current member identity returned by the database", async () => {
    const f = fixture();
    Object.assign(f.record, { accountId: member, alreadyMember: true });
    const response = await f.request({
      action: "resend",
      projectId: project,
      userId: member,
      email: "forged@example.test",
      role: "owner",
      canPublish: true,
    });
    expect(response.status).toBe(200);
    expect(f.rpc.mock.calls[0][1]).toEqual({
      target: project,
      actor: owner,
      address: null,
      member_id: member,
    });
    expect(f.invite.mock.calls[0][0]).toBe("member@example.test");
    expect(f.rpc.mock.calls[1][1]).toMatchObject({
      add_member: false,
      member_role: "editor",
      publish_permission: false,
    });
  });
  it.each(["42501", "40001", "P0429"])(
    "refuses an unauthorized, changed or rate-limited request before Auth email: %s",
    async (code) => {
      const f = fixture();
      f.rpc.mockResolvedValueOnce({
        data: null,
        error: { code, message: "private-db-detail" },
      });
      const res = await f.request();
      expect(res.status).toBe({ "42501": 403, "40001": 409, P0429: 429 }[code]);
      expect(f.invite).not.toHaveBeenCalled();
      expect(await res.text()).not.toContain("private-db-detail");
    },
  );
  it.each([
    { code: "email_exists", status: 422, expected: 409 },
    { code: "over_email_send_rate_limit", status: 429, expected: 429 },
    { code: "smtp_failure", status: 500, expected: 503 },
  ])(
    "keeps email failure separate from granted membership: %j",
    async (error) => {
      const f = fixture();
      f.invite.mockResolvedValueOnce({
        data: { user: null } as any,
        error: { ...error, message: "private-mail-password" },
      });
      const res = await f.request();
      expect(res.status).toBe(error.expected);
      expect(f.rpc).toHaveBeenCalledTimes(1);
      const text = await res.text();
      expect(text).toContain("may already have been sent");
      expect(text).not.toContain("private-mail-password");
    },
  );
  it("does not repeat email or fabricate membership after a lost provider response", async () => {
    const f = fixture();
    f.invite.mockRejectedValueOnce(new Error("private-provider-token"));
    const res = await f.request();
    expect(res.status).toBe(503);
    expect(f.invite).toHaveBeenCalledTimes(1);
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(await res.text()).not.toContain("private-provider-token");
  });
  it("rechecks session and membership after sending, with an honest partial result", async () => {
    const f = fixture();
    f.rpc.mockImplementation(async (name) => ({
      data: name === "builder_prepare_invitation" ? f.record : null,
      error: name === "builder_complete_invitation" ? { code: "40001" } : null,
    }));
    const response = await f.request();
    expect(response.status).toBe(409);
    expect(await response.text()).toContain(
      "Project access has not been confirmed",
    );
    const g = fixture();
    g.getUser
      .mockResolvedValueOnce({ data: { user: { id: owner } }, error: null })
      .mockResolvedValueOnce({
        data: { user: null } as any,
        error: { status: 401 },
      });
    expect((await g.request()).status).toBe(401);
    expect(g.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([{ email: "other@example.test" }, { id: "invalid" }])(
    "does not grant access from a mismatched Auth response: %j",
    async (change) => {
      const f = fixture();
      f.invite.mockResolvedValueOnce({
        data: { user: { id: member, email: "member@example.test", ...change } },
        error: null,
      });
      expect((await f.request()).status).toBe(503);
      expect(f.rpc).toHaveBeenCalledTimes(1);
    },
  );
  it("refuses a mismatched existing account ID even with the right email", async () => {
    const f = fixture();
    Object.assign(f.record, { accountId: owner, alreadyMember: true });
    expect((await f.request()).status).toBe(503);
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("keeps foreign origins, missing sign-in and invalid methods away from Auth administration", async () => {
    const f = fixture();
    expect(
      (
        await f.request(input, {
          headers: { origin: "https://foreign.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (await f.request(input, { headers: { authorization: "" } })).status,
    ).toBe(401);
    expect((await f.request(input, { method: "GET" })).status).toBe(405);
    expect(f.getUser).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.invite).not.toHaveBeenCalled();
    f.getUser.mockResolvedValueOnce({
      data: { user: null } as any,
      error: { status: 401 },
    });
    expect((await f.request(undefined, { raw: "invalid json" })).status).toBe(
      401,
    );
  });
  it.each([
    { projectId: "../other" },
    { projectId: [project] },
    { email: "bad" },
    { role: "admin" },
    { canPublish: "true" },
    { action: "delete-user" },
  ])("refuses malformed input before lookup: %j", async (change) => {
    const f = fixture();
    expect((await f.request({ ...input, ...change })).status).toBe(400);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("bounds JSON and rejects encoded payloads", async () => {
    const f = fixture();
    expect((await f.request(input, { raw: "x".repeat(4097) })).status).toBe(
      413,
    );
    expect((await f.request(input, { raw: "{" })).status).toBe(400);
    expect(
      (await f.request(input, { headers: { "content-encoding": "gzip" } }))
        .status,
    ).toBe(415);
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
