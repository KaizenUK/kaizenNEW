import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  session: null as any,
  invoke: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: { getSession: fake.getSession },
    functions: { invoke: fake.invoke },
  }),
}));
import { inviteProjectMember } from "./invitations";
const request = {
  action: "invite" as const,
  projectId: "kaizen",
  email: "person@example.test",
  role: "editor" as const,
  canPublish: false,
};
beforeEach(() => {
  fake.session = { user: { id: "owner" }, access_token: "fixture-owner-token" };
  fake.getSession.mockReset().mockImplementation(async () => ({
    data: { session: fake.session },
    error: null,
  }));
  fake.invoke.mockReset().mockResolvedValue({
    data: { kind: "invited", emailRequested: true },
    error: null,
  });
});
it("pins the invitation to the initiating account's bearer token", async () => {
  await expect(inviteProjectMember(request)).resolves.toEqual({
    kind: "invited",
    emailRequested: true,
  });
  expect(fake.invoke).toHaveBeenCalledWith("builder-invite", {
    body: request,
    headers: { Authorization: "Bearer fixture-owner-token" },
  });
});
it("does not send an invitation without a session", async () => {
  fake.session = null;
  await expect(inviteProjectMember(request)).rejects.toThrow(/Sign in/);
  expect(fake.invoke).not.toHaveBeenCalled();
});
it("rejects a late response after sign-out or an account switch", async () => {
  for (const session of [
    null,
    { user: { id: "other" }, access_token: "other-token" },
  ]) {
    fake.session = {
      user: { id: "owner" },
      access_token: "fixture-owner-token",
    };
    let resolve!: (result: any) => void;
    fake.invoke.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const promise = inviteProjectMember(request);
    await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
    fake.session = session;
    resolve({ data: { kind: "invited", emailRequested: true }, error: null });
    await expect(promise).rejects.toThrow(/account changed/);
  }
});
it("keeps a structured partial-result message but never retries an unknown request", async () => {
  const message =
    "An email may already have been sent. Project access has not been confirmed.";
  fake.invoke.mockResolvedValueOnce({
    data: null,
    error: {
      context: new Response(JSON.stringify({ error: message }), {
        status: 409,
      }),
    },
  });
  await expect(inviteProjectMember(request)).rejects.toThrow(message);
  fake.invoke.mockRejectedValueOnce(new Error("private-provider-detail"));
  await expect(inviteProjectMember(request)).rejects.toThrow(
    "The invitation could not be confirmed",
  );
  expect(fake.invoke).toHaveBeenCalledTimes(2);
});
it("refuses malformed success responses instead of claiming access was granted", async () => {
  fake.invoke.mockResolvedValueOnce({
    data: { kind: "invented", token: "not-a-result" },
    error: null,
  });
  await expect(inviteProjectMember(request)).rejects.toThrow(
    /could not be confirmed/,
  );
});
