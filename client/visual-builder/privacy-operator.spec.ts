import { mkdtemp, writeFile, chmod, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import {
  privacyCommand,
  runPrivacyOperator,
} from "../../scripts/builder-privacy-requests";
const requestId = "11111111-1111-4111-8111-111111111111";
let temporary: string | undefined;
afterEach(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true });
  temporary = undefined;
});
it("requires the exact request, version, terminal status and explicit matching confirmation", () => {
  const args = [
    "--respond",
    requestId,
    "--version",
    "2",
    "--status",
    "fulfilled",
    "--response-file",
    "/private/response.txt",
    "--confirm",
    requestId,
  ];
  expect(privacyCommand(args)).toMatchObject({
    action: "respond",
    requestId,
    version: 2,
    status: "fulfilled",
  });
  expect(() => privacyCommand(args.slice(0, -2))).toThrow(/--confirm/);
  expect(() =>
    privacyCommand([
      ...args.slice(0, -1),
      "22222222-2222-4222-8222-222222222222",
    ]),
  ).toThrow();
  expect(() =>
    privacyCommand(args.map((a, i) => (i === 3 ? "0" : a))),
  ).toThrow();
  expect(() =>
    privacyCommand(args.map((a, i) => (i === 7 ? "relative.txt" : a))),
  ).toThrow();
});
it("lists only the operator scope and carries the private queue cursor", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: { items: [], nextCursor: null }, error: null });
  await runPrivacyOperator(privacyCommand(["--list", "--before", requestId]), {
    rpc,
  });
  expect(rpc).toHaveBeenCalledWith("builder_privacy_list", {
    actor: null,
    inbox: true,
    before_id: requestId,
  });
});
it("reads a bounded private response file and records the result without echoing its text", async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "kaizen-privacy-fixture-"));
  const responseFile = path.join(temporary, "response.txt");
  await writeFile(responseFile, "Synthetic response delivered separately.\n", {
    mode: 0o600,
  });
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const command = {
    action: "respond",
    requestId,
    version: 2,
    status: "fulfilled",
    responseFile,
  } as const;
  expect(await runPrivacyOperator(command, { rpc })).toEqual({
    requestId,
    status: "fulfilled",
    responseRecorded: true,
  });
  expect(rpc).toHaveBeenCalledWith("builder_privacy_update", {
    actor: null,
    request_id: requestId,
    expected_version: 2,
    next_status: "fulfilled",
    owner_response: "Synthetic response delivered separately.",
  });
  rpc.mockClear();
  await chmod(responseFile, 0o644);
  await expect(runPrivacyOperator(command, { rpc })).rejects.toThrow(
    /could not be confirmed/,
  );
  await chmod(responseFile, 0o600);
  const link = path.join(temporary, "linked.txt");
  await symlink(responseFile, link);
  await expect(
    runPrivacyOperator({ ...command, responseFile: link }, { rpc }),
  ).rejects.toThrow();
  await writeFile(responseFile, "x".repeat(2001));
  await expect(runPrivacyOperator(command, { rpc })).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it("does not disclose service error details or call incomplete queue data successful", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValue({
      data: null,
      error: { message: "private provider detail" },
    });
  await expect(
    runPrivacyOperator({ action: "list", before: null }, { rpc }),
  ).rejects.toThrow(/^The privacy request could not be confirmed\./);
  rpc.mockResolvedValueOnce({ data: { items: [] }, error: null });
  await expect(
    runPrivacyOperator({ action: "list", before: null }, { rpc }),
  ).rejects.toThrow();
});
