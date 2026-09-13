import { expect, it, vi } from "vitest";
import {
  accountDeletionCommand,
  runAccountDeletion,
} from "../../scripts/builder-account-delete";
const request = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  account = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function fixture() {
  return {
    rpc: vi.fn(async (name: string) => ({
      data: name.endsWith("prepare")
        ? { status: "processing", userId: account }
        : null,
      error: null as unknown,
    })),
    auth: {
      admin: { deleteUser: vi.fn(async () => ({ error: null as unknown })) },
    },
  };
}
it("requires an explicit matching request confirmation, without a bulk-delete command", () => {
  expect(accountDeletionCommand(["--list"])).toEqual({ action: "list" });
  expect(
    accountDeletionCommand(["--delete", request, "--confirm", request]),
  ).toEqual({ action: "delete", request });
  for (const args of [
    [],
    ["--delete", request],
    ["--delete", request, "--confirm", account],
    ["--delete-all"],
    ["--list", "--delete", request],
  ])
    expect(() => accountDeletionCommand(args)).toThrow(/Use --list/);
});
it("lists only the bounded operator queue fields without making changes", async () => {
  const f = fixture();
  f.rpc.mockResolvedValueOnce({
    data: [
      {
        request_id: request,
        user_id: account,
        status: "pending",
        requested_at: "2026-09-13T00:00:00Z",
        ignored: "private extra",
      },
    ] as any,
    error: null,
  });
  expect(await runAccountDeletion({ action: "list" }, f)).toEqual([
    {
      requestId: request,
      accountId: account,
      status: "pending",
      requestedAt: "2026-09-13T00:00:00Z",
    },
  ]);
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith(
    "builder_account_orphan_requests",
    {},
  );
  expect(f.auth.admin.deleteUser).not.toHaveBeenCalled();
});
it("removes only the database-authorized account, retaining its FK identity and checking completion", async () => {
  const f = fixture();
  expect(await runAccountDeletion({ action: "delete", request }, f)).toEqual({
    requestId: request,
    status: "completed",
  });
  expect(f.rpc).toHaveBeenNthCalledWith(1, "builder_account_deletion_prepare", {
    actor: null,
    request,
    target: null,
  });
  expect(f.auth.admin.deleteUser).toHaveBeenCalledExactlyOnceWith(
    account,
    true,
  );
  expect(f.rpc).toHaveBeenNthCalledWith(
    2,
    "builder_account_deletion_complete",
    { request },
  );
});
it.each(["owner-required", "cancelled", "malformed"])(
  "refuses %s preparation before Auth removal",
  async (state) => {
    const f = fixture();
    f.rpc.mockResolvedValueOnce({
      data:
        state === "malformed" ? { status: "processing", userId: "bad" } : null,
      error:
        state === "malformed" ? null : { message: "private database detail" },
    });
    await expect(
      runAccountDeletion({ action: "delete", request }, f),
    ).rejects.toThrow(/owner requirements/);
    expect(f.auth.admin.deleteUser).not.toHaveBeenCalled();
  },
);
it("leaves failed Auth removal pending for an explicit retry and suppresses provider details", async () => {
  const f = fixture();
  f.auth.admin.deleteUser.mockRejectedValueOnce(
    new Error("private provider detail"),
  );
  await expect(
    runAccountDeletion({ action: "delete", request }, f),
  ).rejects.toThrow(/explicitly retry this same request/);
  expect(f.auth.admin.deleteUser).toHaveBeenCalledTimes(1);
  expect(f.rpc).toHaveBeenCalledTimes(1);
});
it("does not call a lost completion response a confirmed deletion or retry it", async () => {
  const f = fixture();
  f.rpc
    .mockResolvedValueOnce({
      data: { status: "processing", userId: account },
      error: null,
    })
    .mockResolvedValueOnce({
      data: null,
      error: { message: "private database detail" },
    });
  await expect(
    runAccountDeletion({ action: "delete", request }, f),
  ).rejects.toThrow(/removal is not confirmed/);
  expect(f.auth.admin.deleteUser).toHaveBeenCalledTimes(1);
  expect(f.rpc).toHaveBeenCalledTimes(2);
});
it("recognizes an already-completed request without repeating removal", async () => {
  const f = fixture();
  f.rpc.mockResolvedValueOnce({
    data: { status: "completed" } as any,
    error: null,
  });
  expect(await runAccountDeletion({ action: "delete", request }, f)).toEqual({
    requestId: request,
    status: "completed",
  });
  expect(f.auth.admin.deleteUser).not.toHaveBeenCalled();
});
