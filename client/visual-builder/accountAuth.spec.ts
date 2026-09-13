import { it, expect, vi } from "vitest";
import { createClient, type Session, type User } from "@supabase/supabase-js";
vi.mock("./storage", () => ({ cloud: null }));
import {
  changeAccount,
  verifiedAccount,
  type AccountAction,
} from "./accountAuth";
import { accountEmail, accountName } from "../../shared/builderAccount";
const one = "11111111-1111-4111-8111-111111111111",
  two = "22222222-2222-4222-8222-222222222222";
const user = (id: string): User => ({
  id,
  aud: "authenticated",
  email: `${id === one ? "one" : "two"}@example.test`,
  role: "authenticated",
  app_metadata: {},
  user_metadata: { full_name: "Original name", keep: "metadata" },
  created_at: new Date().toISOString(),
});
const token = (id: string) =>
  [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: id,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    Buffer.from("fixture-signature").toString("base64url"),
  ].join(".");
const session = (id: string): Session => ({
  user: user(id),
  access_token: token(id),
  refresh_token: `fixture-refresh-${id}`,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
});
function fixture() {
  const state = {
    session: session(one) as Session | null,
    people: new Map([
      [one, user(one)],
      [two, user(two)],
    ]),
    requests: [] as {
      path: string;
      method: string;
      actor: string;
      body: any;
      redirect: string | null;
      scope: string | null;
    }[],
    error: "",
    failRead: false,
    failRefresh: false,
    unknown: false,
    beforeRead: undefined as (() => void) | undefined,
    beforeWrite: undefined as (() => void) | undefined,
  };
  const main = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: state.session },
        error: null,
      })),
      refreshSession: vi.fn(async () => {
        if (state.session)
          state.session.user = state.people.get(state.session.user.id)!;
        return {
          data: { session: state.session },
          error: state.failRefresh ? new Error("Fixture refresh failed") : null,
        };
      }),
      getUser: vi.fn(async (jwt: string) => ({
        data: {
          user: state.people.get(
            JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString())
              .sub,
          ),
        },
        error: null,
      })),
    },
  } as any;
  const network: typeof fetch = async (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => {
    const request = new Request(input, init),
      url = new URL(request.url);
    const jwt = request.headers.get("authorization")!.replace(/^Bearer /, "");
    const actor = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString(),
    ).sub;
    const body = request.method === "PUT" ? await request.json() : null;
    state.requests.push({
      path: url.pathname,
      method: request.method,
      actor,
      body,
      redirect: url.searchParams.get("redirect_to"),
      scope: url.searchParams.get("scope"),
    });
    const reply = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: {
          "content-type": "application/json",
          "x-supabase-api-version": "2024-01-01",
        },
      });
    if (request.method === "GET" && url.pathname.endsWith("/user")) {
      state.beforeRead?.();
      return state.failRead
        ? reply({ code: "bad_jwt", message: "private Auth detail" }, 401)
        : reply(state.people.get(actor));
    }
    state.beforeWrite?.();
    if (state.unknown) throw new TypeError("Private network detail");
    if (state.error)
      return reply({ code: state.error, message: "private Auth detail" }, 422);
    if (request.method === "PUT") {
      const person = state.people.get(actor)!;
      if (body.data)
        person.user_metadata = { ...person.user_metadata, ...body.data };
      if (body.email) person.new_email = body.email;
      return reply(person);
    }
    return reply({});
  };
  const dependencies = {
    main,
    isolated: () =>
      createClient("https://accounts.example.test", "fixture-public-key", {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: `fixture-${crypto.randomUUID()}`,
        },
        global: { fetch: network },
      }),
    redirectTo: "https://builder.example.test/builder/?view=account",
  };
  const change = (input: AccountAction, account = one) =>
    changeAccount(account, input, dependencies);
  return { state, main, change };
}
it("updates the submitting account's own name through real Auth SDK requests, preserving unrelated metadata", async () => {
  const f = fixture();
  const result = await f.change({ action: "name", name: " My chosen name " });
  expect(result.user?.user_metadata).toEqual({
    full_name: "My chosen name",
    keep: "metadata",
  });
  expect(f.state.requests.filter((r) => r.method === "PUT")).toEqual([
    expect.objectContaining({
      actor: one,
      body: {
        data: { full_name: "My chosen name" },
        code_challenge: null,
        code_challenge_method: null,
      },
    }),
  ]);
  expect(f.main.auth.refreshSession).toHaveBeenCalledWith();
});
it("keeps email changes pending and uses the fixed account return URL", async () => {
  const f = fixture();
  const result = await f.change({ action: "email", email: "new@example.test" });
  expect(result.user?.email).toBe("one@example.test");
  expect(result.user?.new_email).toBe("new@example.test");
  expect(result.notice).toContain("requested");
  expect(f.state.requests.find((r) => r.method === "PUT")).toMatchObject({
    body: { email: "new@example.test" },
    redirect: "https://builder.example.test/builder/?view=account",
  });
});
it("uses the provider's reauthentication code flow without changing the user's identity", async () => {
  const f = fixture();
  f.state.error = "reauthentication_needed";
  await expect(
    f.change({
      action: "password",
      password: "new-password-123",
      confirmation: "new-password-123",
    }),
  ).rejects.toMatchObject({ code: "reauthentication_needed" });
  f.state.error = "";
  await f.change({ action: "reauthenticate" });
  await f.change({
    action: "password",
    password: "new-password-123",
    confirmation: "new-password-123",
    nonce: "123456",
  });
  expect(f.state.requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: "/auth/v1/reauthenticate",
        method: "GET",
        actor: one,
      }),
      expect.objectContaining({
        method: "PUT",
        body: {
          password: "new-password-123",
          nonce: "123456",
          code_challenge: null,
          code_challenge_method: null,
        },
        actor: one,
      }),
    ]),
  );
});
it("signs out other sessions through the real SDK without signing out this one", async () => {
  const f = fixture();
  const result = await f.change({ action: "signout-others" });
  expect(
    f.state.requests.find((r) => r.path.endsWith("/logout")),
  ).toMatchObject({ method: "POST", actor: one, scope: "others" });
  expect(f.state.session?.user.id).toBe(one);
  expect(result.notice).toContain("may stay signed in");
  expect(f.main.auth.refreshSession).not.toHaveBeenCalled();
});
it.each([
  { action: "name", name: " " },
  { action: "name", name: "Name <email>" },
  { action: "email", email: "not an email" },
  { action: "password", password: "short", confirmation: "short" },
  {
    action: "password",
    password: "new-password-123",
    confirmation: "different-password",
  },
  {
    action: "password",
    password: "new-password-123",
    confirmation: "new-password-123",
    nonce: "invalid",
  },
] as AccountAction[])(
  "refuses invalid account input before Auth requests: $action",
  async (input) => {
    const f = fixture();
    await expect(f.change(input)).rejects.toThrow();
    expect(f.state.requests).toEqual([]);
  },
);
it("rejects a switched or expired account before making an isolated session", async () => {
  const f = fixture();
  f.state.session = session(two);
  await expect(
    f.change({ action: "name", name: "Wrong account" }),
  ).rejects.toThrow(/account changed/);
  f.state.session = { ...session(one), expires_at: 1 };
  await expect(f.change({ action: "name", name: "Expired" })).rejects.toThrow(
    /sign-in is being refreshed/,
  );
  expect(f.state.requests).toEqual([]);
});
it("refuses to submit when the shared account changes during isolated authentication", async () => {
  const f = fixture();
  f.state.beforeRead = () => {
    f.state.session = session(two);
  };
  await expect(
    f.change({ action: "name", name: "Do not submit" }),
  ).rejects.toThrow(/account changed/);
  expect(f.state.requests.some((r) => r.method === "PUT")).toBe(false);
});
it("pins a submitted edit to its original account and never refreshes over a newer account", async () => {
  const f = fixture();
  f.state.beforeWrite = () => {
    f.state.session = session(two);
  };
  await expect(
    f.change({ action: "name", name: "Original account only" }),
  ).rejects.toThrow(/previous account may have been updated/);
  expect(f.state.people.get(one)!.user_metadata.full_name).toBe(
    "Original account only",
  );
  expect(f.state.people.get(two)!.user_metadata.full_name).toBe(
    "Original name",
  );
  expect(f.main.auth.refreshSession).not.toHaveBeenCalled();
});
it("does not report a saved update as failed just because the workspace session cannot refresh", async () => {
  const f = fixture();
  f.state.failRefresh = true;
  const result = await f.change({ action: "name", name: "Saved name" });
  expect(result.user?.user_metadata.full_name).toBe("Saved name");
  expect(result.notice).toContain("could not refresh");
});
it("preserves a confirmed update when the workspace refresh throws", async () => {
  const f = fixture();
  f.main.auth.refreshSession.mockRejectedValueOnce(new TypeError("Offline"));
  const result = await f.change({ action: "name", name: "Already saved" });
  expect(result.notice).toContain("could not refresh");
  expect(result.user?.user_metadata.full_name).toBe("Already saved");
});
it.each([
  "weak_password",
  "email_exists",
  "over_email_send_rate_limit",
  "reauthentication_not_valid",
  "unexpected_provider_error",
])("turns provider errors into bounded account messages: %s", async (code) => {
  const f = fixture();
  f.state.error = code;
  await expect(
    f.change({ action: "name", name: "My name" }),
  ).rejects.not.toThrow(/private Auth detail/);
});
it("leaves a lost update response unknown and never retries it automatically", async () => {
  const f = fixture();
  f.state.unknown = true;
  await expect(f.change({ action: "name", name: "My name" })).rejects.toThrow(
    /could not be confirmed/,
  );
  expect(f.state.requests.filter((r) => r.method === "PUT")).toHaveLength(1);
});
it("uses server-verified account details and keeps the same name/email standard as website saves", async () => {
  const f = fixture();
  expect((await verifiedAccount(session(one), f.main)).id).toBe(one);
  expect(f.main.auth.getUser).toHaveBeenCalledWith(token(one));
  expect(accountName("Alex\nInjected")).toBeNull();
  expect(accountEmail("name\r\n@example.test")).toBeNull();
  expect(accountName(" Alex ")).toBe("Alex");
  expect(accountEmail(" name@example.test ")).toBe("name@example.test");
});

it("sets an invited account password and chosen name through its captured SDK session", async () => {
  const f = fixture();
  const result = await f.change({
    action: "setup-password",
    password: "new-fixture-password",
    confirmation: "new-fixture-password",
    name: "Invited person",
  });
  expect(result.user?.user_metadata.full_name).toBe("Invited person");
  expect(result.user?.user_metadata.builder_password_set).toBe(true);
  expect(f.state.people.get(two)!.user_metadata.full_name).toBe(
    "Original name",
  );
});
it("finishes password recovery without replacing an existing account name", async () => {
  const f = fixture();
  const result = await f.change({
    action: "setup-password",
    password: "new-fixture-password",
    confirmation: "new-fixture-password",
  });
  expect(result.user?.user_metadata.full_name).toBe("Original name");
  expect(result.user?.user_metadata.builder_password_set).toBe(true);
});
it("refuses an invalid setup name before a provider request", async () => {
  const f = fixture();
  await expect(
    f.change({
      action: "setup-password",
      password: "new-fixture-password",
      confirmation: "new-fixture-password",
      name: "<invalid>",
    }),
  ).rejects.toThrow(/Add your name/);
  expect(f.state.requests).toEqual([]);
});
