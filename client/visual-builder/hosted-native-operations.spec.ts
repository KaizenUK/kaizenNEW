import { afterEach, expect, it } from "vitest";
import {
  mkdtemp,
  readFile,
  readdir,
  writeFile,
  mkdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NativeOperationJournal } from "../../scripts/builder-native-operations";
import { HostedHelperError } from "../../scripts/builder-hosted-auth";
import { HostedBuildQueue } from "../../scripts/builder-hosted-builds";
import { RepositoryRunner, type BuildPlan } from "../../scripts/builder-runner";
import { SandboxCleanupError } from "../../scripts/builder-build-sandbox";
import type {
  NativeOperationInput,
  NativeRetiredAsset,
} from "../../shared/builderNativeOperations";
import {
  hostedHelperFixture,
  helperProject,
  helperOwner,
  helperToken,
} from "../../tests/builder/hosted-helper-fixture";
import {
  hostedBuildScript,
  buildMode,
  buildHome,
  buildCount,
} from "../../tests/builder/hosted-build-fixture";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const finalHtml =
  "<!doctype html><html><body><main><h1>Native fixture output</h1></main></body></html>";
const controlledBuild =
  hostedBuildScript +
  "\nwriteFileSync('dist/index.html', readFileSync(path.join(home, 'native-output.html')));\n";
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
};
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "kaizen-hosted-native-"));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const active = new Set<string>(),
    calls: NativeOperationInput[] = [];
  let retired: NativeRetiredAsset[] = [],
    failBegin = false,
    failEnd = false,
    endGate: Promise<void> | undefined,
    onEnd: (() => Promise<void>) | undefined;
  const journal = new NativeOperationJournal({
    directory,
    workerId: "fixture-helper",
    configuration: "7".repeat(64),
    connection: {
      nativeOperation: async (_token, input) => {
        calls.push(input);
        const { action, afterKey, ...identity } = input;
        if (action === "native-operation-assets")
          return { id: input.id, assets: retired, cursor: null };
        if (action === "native-operation-begin") {
          if (failBegin)
            throw new HostedHelperError(
              503,
              "Native coordination is temporarily unavailable.",
            );
          active.add(input.id);
          return { ...identity, phase: "active" };
        }
        if (failEnd)
          throw new HostedHelperError(
            503,
            "Native completion is temporarily unavailable.",
          );
        await endGate;
        await onEnd?.();
        active.delete(input.id);
        return { ...identity, phase: "complete" };
      },
    },
  });
  const api = await hostedHelperFixture(
    [helperProject],
    controlledBuild,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    journal,
  );
  cleanups.push(() => api.close());
  expect((await api.send({ action: "repository-connect" })).status).toBe(200);
  await mkdir(path.join(api.folders.root(helperProject), ".kaizen"), {
    recursive: true,
  });
  await buildMode(api, helperProject, "hold");
  await writeFile(
    path.join(buildHome(api, helperProject), "native-output.html"),
    finalHtml,
  );
  return {
    ...api,
    directory: api.directory,
    journalDirectory: directory,
    journal,
    active,
    nativeCalls: calls,
    retired: (value: NativeRetiredAsset[]) => {
      retired = value;
    },
    failBegin: (value: boolean) => {
      failBegin = value;
    },
    failEnd: (value: boolean) => {
      failEnd = value;
    },
    gateEnd: (value: Promise<void> | undefined) => {
      endGate = value;
    },
    onEnd: (value: typeof onEnd) => {
      onEnd = value;
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const inspect = async (api: Fixture) => {
  const response = await api.send({
    action: "repository-source-inspect",
    route: "src/pages/index.astro",
  });
  expect(response.status).toBe(200);
  return response.body;
};
const edits = (inspection: any, value: string) => ({
  inspection,
  values: {
    [inspection.fields.find((field: any) => field.value === "Hosted original")
      .id]: value,
  },
  orders: {},
});
const retiredFile = () => ({
  projectId: helperProject,
  assetId: randomUUID(),
  url: "https://fixture.test/retired image.png",
});
async function enqueue(api: Fixture) {
  const review = await api.send({ action: "repository-build-review" });
  expect(review.status).toBe(200);
  const response = await api.send({
    action: "repository-build-start",
    planId: review.body.id,
  });
  expect(response.status).toBe(200);
  return response.body;
}
const status = async (api: Fixture, job: any) =>
  (await api.send({ action: "repository-build-status", jobId: job.id })).body;

it("checks draft bytes before saving and keeps the real source unchanged after refusal", async () => {
  const api = await fixture(),
    inspection = await inspect(api),
    file = retiredFile();
  api.retired([file]);
  const before = await readFile(
    path.join(api.folders.root(helperProject), inspection.route),
    "utf8",
  );
  const response = await api.send({
    action: "repository-source-draft-save",
    route: inspection.route,
    version: 0,
    edits: edits(inspection, file.url!),
  });
  expect(response.status).toBe(409);
  expect(response.body.error).toContain("no longer available");
  const draft = await api.send({
    action: "repository-source-draft-read",
    route: inspection.route,
  });
  expect(draft.body).toMatchObject({ version: 0, edits: null });
  expect(
    await readFile(
      path.join(api.folders.root(helperProject), inspection.route),
      "utf8",
    ),
  ).toBe(before);
  expect(api.active.size).toBe(0);
});

it("rechecks the actual replacement bytes at apply even if removal began after the review", async () => {
  const api = await fixture(),
    inspection = await inspect(api),
    file = retiredFile();
  const plan = await api.send({
    action: "repository-source-prepare",
    edits: edits(inspection, file.assetId),
  });
  expect(plan.status).toBe(200);
  api.retired([file]);
  const response = await api.send({
    action: "repository-apply",
    planId: plan.body.id,
  });
  expect(response.status).toBe(409);
  expect(response.body.error).toContain("no longer available");
  expect(
    await readFile(
      path.join(api.folders.root(helperProject), inspection.route),
      "utf8",
    ),
  ).toContain("Hosted original");
  expect(
    await readdir(
      path.join(api.folders.root(helperProject), ".kaizen/recovery"),
    ).catch(() => []),
  ).toEqual([]);
  expect(api.active.size).toBe(0);
});

it("retains the producer through real source application and only finishes after the new bytes are durable", async () => {
  const api = await fixture(),
    inspection = await inspect(api);
  const plan = await api.send({
    action: "repository-source-prepare",
    edits: edits(inspection, "Native coordinated edit"),
  });
  expect(plan.status).toBe(200);
  let checked = false;
  api.onEnd(async () => {
    expect(api.active.size).toBe(1);
    expect(
      await readFile(
        path.join(api.folders.root(helperProject), inspection.route),
        "utf8",
      ),
    ).toContain("Native coordinated edit");
    checked = true;
  });
  const response = await api.send({
    action: "repository-apply",
    planId: plan.body.id,
  });
  expect(response.status).toBe(200);
  expect(checked).toBe(true);
  expect(api.active.size).toBe(0);
  api.onEnd(undefined);
});

it("keeps the full real build protected while polling, autosave and cancellation remain responsive", async () => {
  const api = await fixture(),
    inspection = await inspect(api),
    job = await enqueue(api);
  await expect.poll(() => buildCount(api, helperProject)).toBe(1);
  expect(api.active.size).toBe(1);
  const count = api.nativeCalls.length;
  expect((await status(api, job)).status).toBe("building");
  expect(api.nativeCalls.length).toBe(count);
  const draft = await api.send({
    action: "repository-source-draft-save",
    route: inspection.route,
    version: 0,
    edits: edits(inspection, "During the build"),
  });
  expect(draft.status).toBe(200);
  expect(api.active.size).toBe(1);
  api.failBegin(true);
  expect(
    (await api.send({ action: "repository-build-stop", jobId: job.id })).status,
  ).toBe(200);
  await expect
    .poll(async () => (await status(api, job)).status)
    .toBe("cancelled");
  expect(api.active.size).toBe(0);
});

it("checks generated bytes before serving a preview and restores the previous output after refusal", async () => {
  const api = await fixture(),
    file = retiredFile();
  api.retired([file]);
  const output = path.join(api.folders.root(helperProject), "dist");
  await mkdir(output);
  await writeFile(path.join(output, "index.html"), "Previous verified output");
  await writeFile(
    path.join(buildHome(api, helperProject), "native-output.html"),
    `<!doctype html><html><body><img src="${file.url}"></body></html>`,
  );
  await buildMode(api, helperProject, "success");
  const job = await enqueue(api);
  await expect.poll(async () => (await status(api, job)).status).toBe("failed");
  const done = await status(api, job);
  expect(done.error).toContain("no longer available");
  expect(done.previewUrl).toBeUndefined();
  expect(await readFile(path.join(output, "index.html"), "utf8")).toBe(
    "Previous verified output",
  );
  expect(api.active.size).toBe(0);
});

it("does not report a successful build while its native completion is still unconfirmed", async () => {
  const api = await fixture(),
    job = await enqueue(api);
  await expect.poll(() => buildCount(api, helperProject)).toBe(1);
  const gate = deferred();
  const producer = [...api.active][0];
  api.gateEnd(gate.promise);
  await buildMode(api, helperProject, "success");
  await expect
    .poll(() =>
      api.nativeCalls.some(
        (call) =>
          call.action === "native-operation-end" && call.id === producer,
      ),
    )
    .toBe(true);
  expect((await status(api, job)).status).toBe("building");
  expect(api.active.size).toBe(1);
  gate.resolve();
  api.gateEnd(undefined);
  await expect
    .poll(async () => (await status(api, job)).status)
    .toBe("succeeded");
  expect(api.active.size).toBe(0);
});

it("keeps a completed build's journal after a lost end and reconciles it without repeating the build", async () => {
  const api = await fixture(),
    job = await enqueue(api);
  await expect.poll(() => buildCount(api, helperProject)).toBe(1);
  api.failEnd(true);
  await buildMode(api, helperProject, "success");
  await expect.poll(async () => (await status(api, job)).status).toBe("failed");
  expect(api.active.size).toBe(1);
  const [record] = await readdir(api.journalDirectory);
  expect(
    JSON.parse(await readFile(path.join(api.journalDirectory, record), "utf8"))
      .localPhase,
  ).toBe("finished");
  api.failEnd(false);
  expect(await api.journal.recover()).toEqual({ completed: 1, deferred: 0 });
  expect(await buildCount(api, helperProject)).toBe(1);
  expect(api.active.size).toBe(0);
});

it("keeps native protection when the actual runner reports unresolved sandbox cleanup", async () => {
  const api = await fixture();
  const runner = new RepositoryRunner(undefined, undefined, {
    isolatedBuild: {
      command: async () => ({ cli: "/fixture/manager", manager: "pnpm" }),
      run: async () => {
        const output = path.join(api.folders.root(helperProject), "dist");
        await mkdir(output);
        await writeFile(path.join(output, "index.html"), "unsettled output");
        throw new SandboxCleanupError();
      },
    },
  });
  const originalOutput = path.join(api.folders.root(helperProject), "dist");
  await mkdir(originalOutput);
  await writeFile(path.join(originalOutput, "index.html"), "previous output");
  const queue = new HostedBuildQueue({
    folders: api.folders,
    authorize: async () => {},
    runner: () => runner,
    native: api.journal,
  });
  cleanups.push(async () => {
    await queue.close();
    await runner.close();
  });
  const plan = await runner.prepare(
    api.folders.root(helperProject),
    helperProject,
  );
  const job = queue.enqueue(
    plan,
    {
      id: helperOwner,
      name: "Fixture",
      email: "fixture@example.test",
      expiresAt: Date.now() + 60000,
    },
    helperToken(),
  );
  await expect
    .poll(() => queue.status(helperProject, helperOwner, job.id).status)
    .toBe("failed");
  expect(
    queue.status(helperProject, helperOwner, job.id).recoveryRequired,
  ).toBe(true);
  expect(api.active.size).toBe(1);
  expect(await readFile(path.join(originalOutput, "index.html"), "utf8")).toBe(
    "unsettled output",
  );
  expect(
    await readFile(
      path.join(
        queue.status(helperProject, helperOwner, job.id).recoveryDirectory,
        "previous-dist/index.html",
      ),
      "utf8",
    ),
  ).toBe("previous output");
  const [record] = await readdir(api.journalDirectory);
  expect(
    JSON.parse(await readFile(path.join(api.journalDirectory, record), "utf8"))
      .localPhase,
  ).toBe("intent");
  expect(await api.journal.recover()).toEqual({ completed: 0, deferred: 1 });
});
