import { afterEach, expect, it } from "vitest";
import {
  mkdtemp,
  readdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir, hostname } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { gzipSync, brotliCompressSync } from "node:zlib";
import {
  NativeOperationJournal,
  NativeFileProtection,
} from "../../scripts/builder-native-operations";
import { HostedRepositoryBilling } from "../../scripts/builder-hosted-billing";
import type { NativeOperationController } from "../../scripts/builder-native-controller";
import {
  helperSignatureKey,
  verifyHelperBilling,
} from "../../shared/builderHelperSignature";
import type {
  NativeOperationInput,
  NativeOperationIdentity,
  NativeRetiredAsset,
} from "../../shared/builderNativeOperations";

const roots: string[] = [],
  projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const configuration = "7".repeat(64),
  workerId = "fixture-native-helper";
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
const deferred = <T = void>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
const identityOnly = (input: NativeOperationInput) => {
  const { action, afterKey, ...identity } = input;
  return identity;
};
async function fixture() {
  const directory = await mkdtemp(
    path.join(tmpdir(), "kaizen-native-operations-"),
  );
  roots.push(directory);
  const states = new Map<
      string,
      { identity: NativeOperationIdentity; phase: "active" | "complete" }
    >(),
    calls: { token: string; input: NativeOperationInput }[] = [];
  let lostBegin = false,
    failEnd = false,
    files: NativeRetiredAsset[] = [],
    pageOverride: ((input: NativeOperationInput) => unknown) | undefined;
  const connection = {
    nativeOperation: async (token: string, input: NativeOperationInput) => {
      calls.push({ token, input });
      if (input.action === "native-operation-assets") {
        if (pageOverride) return pageOverride(input);
        const remaining = files.filter(
            (file) =>
              `${file.projectId}:${file.assetId}` > (input.afterKey || ""),
          ),
          assets = remaining.slice(0, 100);
        return {
          id: input.id,
          assets,
          cursor:
            assets.length === 100
              ? `${assets[99].projectId}:${assets[99].assetId}`
              : null,
        };
      }
      const state = states.get(input.id) || {
        identity: identityOnly(input),
        phase: "active" as const,
      };
      expect(identityOnly(input)).toEqual(state.identity);
      if (input.action === "native-operation-end") {
        if (failEnd) throw new Error("Database connection interrupted");
        state.phase = "complete";
      }
      states.set(input.id, state);
      if (input.action === "native-operation-begin" && lostBegin)
        throw new Error("Begin reply was lost");
      return { ...state.identity, phase: state.phase };
    },
  };
  const options = { directory, workerId, configuration, connection };
  return {
    directory,
    states,
    calls,
    options,
    journal: new NativeOperationJournal(options),
    setFiles: (value: NativeRetiredAsset[]) => {
      files = value;
    },
    setLostBegin: (value: boolean) => {
      lostBegin = value;
    },
    setFailEnd: (value: boolean) => {
      failEnd = value;
    },
    setPage: (value: typeof pageOverride) => {
      pageOverride = value;
    },
  };
}

it("holds durable native protection for the complete asynchronous operation and records no user bearer", async () => {
  const api = await fixture(),
    entered = deferred(),
    finish = deferred();
  const running = api.journal.run(
    "private-fixture-bearer",
    projectId,
    async (protection) => {
      protection.assertBytes(Buffer.from("Ordinary changes"));
      entered.resolve();
      await finish.promise;
      return "saved";
    },
  );
  await entered.promise;
  expect([...api.states.values()].map((s) => s.phase)).toEqual(["active"]);
  const files = await readdir(api.directory);
  expect(files).toHaveLength(1);
  const saved = await readFile(path.join(api.directory, files[0]), "utf8");
  expect(saved).not.toContain("private-fixture-bearer");
  expect(JSON.parse(saved).localPhase).toBe("intent");
  expect(await api.journal.recover()).toEqual({ completed: 0, deferred: 1 });
  finish.resolve();
  expect(await running).toBe("saved");
  expect([...api.states.values()].map((s) => s.phase)).toEqual(["complete"]);
  expect(await readdir(api.directory)).toEqual([]);
  expect(api.calls[api.calls.length - 1]?.token).toBe("");
});

it("closes an uncertain begin without running work and refuses to forget an uncertain end", async () => {
  const api = await fixture();
  api.setLostBegin(true);
  api.setFailEnd(true);
  let worked = false;
  await expect(
    api.journal.run("session", projectId, async () => {
      worked = true;
    }),
  ).rejects.toThrow("interrupted");
  expect(worked).toBe(false);
  expect([...api.states.values()][0].phase).toBe("active");
  const [file] = await readdir(api.directory);
  expect(
    JSON.parse(await readFile(path.join(api.directory, file), "utf8"))
      .localPhase,
  ).toBe("finished");
  const restarted = new NativeOperationJournal({
    ...api.options,
    stopped: async () => {
      throw new Error("Finished work needs no PID assumption");
    },
  });
  expect(await restarted.recover()).toEqual({ completed: 0, deferred: 1 });
  api.setFailEnd(false);
  expect(await restarted.recover()).toEqual({ completed: 1, deferred: 0 });
  expect([...api.states.values()][0].phase).toBe("complete");
  expect(await readdir(api.directory)).toEqual([]);
});

it("keeps an unfinished intent when its controller cannot confirm child cleanup or recovery", async () => {
  const api = await fixture();
  await expect(
    api.journal.run("session", projectId, async (protection) => {
      protection.retainOperation();
      throw new Error("Child cleanup remains uncertain");
    }),
  ).rejects.toThrow("reconciliation");
  expect([...api.states.values()][0].phase).toBe("active");
  const [file] = await readdir(api.directory);
  expect(
    JSON.parse(await readFile(path.join(api.directory, file), "utf8"))
      .localPhase,
  ).toBe("intent");
  expect(
    api.calls.some((call) => call.input.action === "native-operation-end"),
  ).toBe(false);
  expect(await api.journal.recover()).toEqual({ completed: 0, deferred: 1 });
});

it("retains a crashed operation until its actual controller confirms all work stopped, regardless of age", async () => {
  const api = await fixture(),
    identity: NativeOperationIdentity = {
      id: randomUUID(),
      workerId,
      configuration,
      projectId,
      host: hostname(),
      processId: process.pid,
      instanceId: randomUUID(),
    };
  api.states.set(identity.id, { identity, phase: "active" });
  const file = path.join(api.directory, `${identity.id}.json`);
  await writeFile(file, JSON.stringify({ ...identity, localPhase: "intent" }), {
    mode: 0o600,
  });
  expect(await api.journal.recover()).toEqual({ completed: 0, deferred: 1 });
  let stopped = false;
  const recovering = new NativeOperationJournal({
    ...api.options,
    stopped: async (found) => {
      expect(found.id).toBe(identity.id);
      return stopped;
    },
  });
  expect(await recovering.recover()).toEqual({ completed: 0, deferred: 1 });
  stopped = true;
  expect(await recovering.recover()).toEqual({ completed: 1, deferred: 0 });
  expect(api.states.get(identity.id)?.phase).toBe("complete");
});

it("persists the service identity before work and never falls back to a PID test for stamped intents", async () => {
  const api = await fixture();
  let stopped = false;
  const controller: NativeOperationController = {
    identity: {
      kind: "systemd",
      unit: "fixture-helper.service",
      invocationId: "a".repeat(32),
    },
    stopped: async (_identity, prior) => {
      expect(prior).toEqual(controller.identity);
      return stopped;
    },
  };
  const journal = new NativeOperationJournal({
    ...api.options,
    controller,
    stopped: async () => true,
  });
  await expect(
    journal.run("session", projectId, async (protection) => {
      const [file] = await readdir(api.directory);
      expect(
        JSON.parse(await readFile(path.join(api.directory, file), "utf8"))
          .controller,
      ).toEqual(controller.identity);
      protection.retainOperation();
    }),
  ).rejects.toThrow("reconciliation");
  expect(await journal.recover()).toEqual({ completed: 0, deferred: 1 });
  expect(
    await new NativeOperationJournal({
      ...api.options,
      stopped: async () => true,
    }).recover(),
  ).toEqual({ completed: 0, deferred: 1 });
  stopped = true;
  expect(await journal.recover()).toEqual({ completed: 1, deferred: 0 });
  expect(api.calls.every(({ input }) => !("controller" in input))).toBe(true);
});

it("does not reconcile foreign hosts, linked records, changed identities or malformed private state", async () => {
  const api = await fixture(),
    identity = {
      id: randomUUID(),
      workerId,
      configuration,
      projectId,
      host: "different-host",
      processId: process.pid,
      instanceId: randomUUID(),
      localPhase: "finished",
    };
  const foreign = path.join(api.directory, `${identity.id}.json`);
  await writeFile(foreign, JSON.stringify(identity), { mode: 0o600 });
  await symlink(foreign, path.join(api.directory, `${randomUUID()}.json`));
  const changedId = randomUUID();
  await writeFile(
    path.join(api.directory, `${changedId}.json`),
    JSON.stringify({ ...identity, host: hostname() }),
    { mode: 0o600 },
  );
  await writeFile(path.join(api.directory, `${randomUUID()}.json`), "broken", {
    mode: 0o600,
  });
  expect(await api.journal.recover()).toEqual({ completed: 0, deferred: 4 });
  expect(api.calls).toEqual([]);
});

it("reads every retired-file page before work and checks duplicate IDs with different historical URLs", async () => {
  const api = await fixture();
  const files: NativeRetiredAsset[] = Array.from({ length: 101 }, () => ({
    projectId,
    assetId: randomUUID(),
    url: null,
  }));
  files.sort((a, b) => a.assetId.localeCompare(b.assetId));
  const id = files[0].assetId;
  files[0].url = "https://fixture.test/old image.png";
  files.push({
    projectId: "kaizen",
    assetId: id,
    url: "https://fixture.test/original image.png",
  });
  api.setFiles(files);
  await api.journal.run("session", projectId, async (protection) => {
    expect(() =>
      protection.assertBytes(Buffer.from(files[files.length - 1].url!)),
    ).toThrow("no longer available");
    expect(() => protection.assertBytes(Buffer.from(files[0].url!))).toThrow(
      "no longer available",
    );
    expect(() =>
      protection.assertBytes(Buffer.from(files[100].assetId)),
    ).toThrow("no longer available");
  });
  expect(
    api.calls.filter((call) => call.input.action === "native-operation-assets"),
  ).toHaveLength(2);
});

it("does not start writes after malformed, reordered or foreign retired-file pages", async () => {
  for (const body of [
    {
      assets: [{ projectId: randomUUID(), assetId: randomUUID(), url: null }],
      cursor: null,
    },
    { assets: [], cursor: "repeated" },
    {
      assets: [{ projectId, assetId: randomUUID(), url: "\u0000private" }],
      cursor: null,
    },
  ]) {
    const api = await fixture();
    api.setPage((input) => ({ id: input.id, ...body }));
    let worked = false;
    await expect(
      api.journal.run("session", projectId, async () => {
        worked = true;
      }),
    ).rejects.toThrow("reconciliation");
    expect(worked).toBe(false);
    expect([...api.states.values()][0].phase).toBe("complete");
  }
});

it("checks compressed replacement content and still closes the producer after a refused write", async () => {
  const api = await fixture(),
    asset = {
      projectId,
      assetId: randomUUID(),
      url: "https://fixture.test/image?x=1&y=2",
    };
  api.setFiles([asset]);
  for (const [bytes, name] of [
    [gzipSync(asset.url), "backup.gz"],
    [brotliCompressSync(Buffer.from(asset.url)), "content.br"],
  ] as const) {
    let wrote = false;
    await expect(
      api.journal.run("session", projectId, async (protection) => {
        protection.assertBytes(bytes, name);
        wrote = true;
      }),
    ).rejects.toThrow("no longer available");
    expect(wrote).toBe(false);
  }
  const protection = new NativeFileProtection([asset]);
  expect(() =>
    protection.assertBytes(Buffer.from(asset.url.replace(/&/g, "&amp;"))),
  ).toThrow("no longer available");
  expect(
    [...api.states.values()].every((state) => state.phase === "complete"),
  ).toBe(true);
});

it("uses the existing signed helper connection and a recovery capability that does not retain expired Auth", async () => {
  const secret = "ab".repeat(32),
    key = await helperSignatureKey(secret),
    requests: { input: NativeOperationInput; token: string }[] = [];
  const billing = new HostedRepositoryBilling({
    url: "https://fixture.supabase.test",
    anonKey: "public-fixture-key",
    secret,
    fetch: async (url, init) => {
      expect(String(url)).toBe(
        "https://fixture.supabase.test/functions/v1/builder-billing",
      );
      const request = new Request(url, init),
        input = (await request.json()) as NativeOperationInput,
        token = request.headers.get("authorization")!.slice(7);
      expect(
        await verifyHelperBilling(
          key,
          request.headers.get("x-kaizen-helper-signature")!,
          input,
          token,
        ),
      ).toBe(true);
      requests.push({ input, token });
      return Response.json({
        ...identityOnly(input),
        phase: input.action === "native-operation-end" ? "complete" : "active",
      });
    },
  });
  const identity = {
    id: randomUUID(),
    workerId,
    configuration,
    projectId,
    processId: process.pid,
    host: hostname(),
    instanceId: randomUUID(),
  };
  await billing.nativeOperation("real-user-fixture", {
    ...identity,
    action: "native-operation-begin",
  });
  await billing.nativeOperation("expired-user-fixture", {
    ...identity,
    action: "native-operation-end",
  });
  expect(requests.map((request) => request.token)).toEqual([
    "real-user-fixture",
    "native-operation-recovery",
  ]);
});
