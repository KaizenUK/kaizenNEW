import { afterEach, describe, expect, it } from "vitest";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { HostedWebsiteFolders } from "../../scripts/builder-hosted-folders";
import { HostedBuildQueue } from "../../scripts/builder-hosted-builds";
import type { RepositoryRunner, BuildPlan } from "../../scripts/builder-runner";
import {
  hostedHelperFixture,
  helperProject,
  helperOtherProject,
  helperEditor,
  helperOwner,
  helperToken,
} from "../../tests/builder/hosted-helper-fixture";
import {
  hostedBuildScript,
  buildMode,
  buildHome,
  buildCount,
} from "../../tests/builder/hosted-build-fixture";

type Fixture = Awaited<ReturnType<typeof hostedHelperFixture>>;
const fixtures: Fixture[] = [];
afterEach(async () => {
  for (const api of fixtures.splice(0).reverse()) await api.close();
});
async function fixture(ids = [helperProject, helperOtherProject]) {
  const api = await hostedHelperFixture(ids, hostedBuildScript);
  fixtures.push(api);
  for (const projectId of ids) {
    expect(
      (await api.send({ action: "repository-connect", projectId })).status,
    ).toBe(200);
    await mkdir(path.join(api.folders.root(projectId), ".kaizen"), {
      recursive: true,
    });
    await buildMode(api, projectId, "hold");
  }
  return api;
}
async function review(api: Fixture, projectId = helperProject) {
  const value = await api.send({
    action: "repository-build-review",
    projectId,
  });
  expect(value.status).toBe(200);
  return value.body;
}
async function enqueue(api: Fixture, projectId = helperProject) {
  const plan = await review(api, projectId);
  const response = await api.send({
    action: "repository-build-start",
    projectId,
    planId: plan.id,
  });
  expect(response).toMatchObject({
    status: 200,
    body: { status: "queued", projectId },
  });
  expect(response.body.startedAt).toBeUndefined();
  return response.body;
}
async function status(api: Fixture, job: any) {
  const response = await api.send({
    action: "repository-build-status",
    projectId: job.projectId,
    jobId: job.id,
  });
  expect(response.status).toBe(200);
  return response.body;
}
async function started(api: Fixture, job: any) {
  await expect
    .poll(async () => (await status(api, job)).log, { timeout: 15000 })
    .toContain("Fixture build started");
}
async function terminal(api: Fixture, job: any, expected: string) {
  await expect
    .poll(async () => (await status(api, job)).status, { timeout: 15000 })
    .toBe(expected);
  return status(api, job);
}
const stop = (api: Fixture, job: any) =>
  api.send({
    action: "repository-build-stop",
    projectId: job.projectId,
    jobId: job.id,
  });

describe("hosted build jobs", () => {
  it("refuses an unconfigured client sandbox without accepting a caller's trust override", async () => {
    const api = await hostedHelperFixture(
      [helperProject],
      hostedBuildScript,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {},
    );
    fixtures.push(api);
    expect(
      (
        await api.send({
          action: "repository-connect",
          projectId: helperProject,
        })
      ).status,
    ).toBe(200);
    const result = await api.send({
      action: "repository-build-review",
      projectId: helperProject,
      trustedBuildProjects: [helperProject],
      buildManager: process.env.npm_execpath,
    });
    expect(result.status).toBe(409);
    expect(result.body.error).toContain("isolated build is unavailable");
    expect(await buildCount(api, helperProject)).toBe(0);
  });
  it("keeps a cancellation during asynchronous startup pending until the child and recovery have finished", async () => {
    let unlockStart!: () => void, finishChild!: () => void;
    const starting = new Promise<void>((resolve) => {
      unlockStart = resolve;
    });
    const finished = new Promise<void>((resolve) => {
      finishChild = resolve;
    });
    let startEntered = false,
      released = false,
      stopped = false;
    const child = {
      id: "runner-job",
      projectId: helperProject,
      status: "building",
      log: "",
      root: "/fixture",
      command: "fixture",
      recoveryDirectory: "/fixture/recovery",
    };
    const queue = new HostedBuildQueue({
      folders: {
        locked: async (_id: string, work: () => Promise<unknown>) => work(),
        check: async () => {},
        claimBuild: async () => async () => {
          released = true;
        },
      } as unknown as HostedWebsiteFolders,
      authorize: async () => {},
      runner: () =>
        ({
          start: async () => {
            startEntered = true;
            await starting;
            return child;
          },
          status: () => child,
          cancel: async () => {
            stopped = true;
            await finished;
          },
          wait: async () => {
            await finished;
            return { ...child, status: "cancelled" };
          },
        }) as unknown as RepositoryRunner,
    });
    try {
      const job = queue.enqueue(
        {
          id: "plan",
          projectId: helperProject,
          root: "/fixture",
          command: "fixture",
          expiresAt: Date.now() + 60000,
        } as BuildPlan,
        { id: helperOwner, expiresAt: Date.now() + 60000 },
        "fixture-token",
      );
      await expect.poll(() => startEntered).toBe(true);
      expect(() => queue.assertIdle(helperProject)).toThrow("Finish or cancel");
      expect(() => queue.assertIdle(helperOtherProject)).not.toThrow();
      expect(queue.cancel(helperProject, helperOwner, job.id)).toMatchObject({
        status: "queued",
        cancelling: true,
      });
      expect(released).toBe(false);
      unlockStart();
      await expect.poll(() => stopped).toBe(true);
      expect(queue.status(helperProject, helperOwner, job.id)).toMatchObject({
        status: "building",
        cancelling: true,
      });
      expect(released).toBe(false);
      finishChild();
      await expect
        .poll(() => queue.status(helperProject, helperOwner, job.id).status)
        .toBe("cancelled");
      expect(released).toBe(true);
      expect(() => queue.assertIdle(helperProject)).not.toThrow();
    } finally {
      unlockStart();
      finishChild();
      await queue.close();
    }
  });
  it("does not start queued work after its captured sign-in expires", async () => {
    const api = await fixture();
    const first = await enqueue(api);
    await started(api, first);
    const plan = await review(api),
      expires = Math.floor(Date.now() / 1000) + 2;
    const queued = await api.send(
      { action: "repository-build-start", planId: plan.id },
      helperOwner,
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "https://builder.example",
          Authorization: `Bearer ${helperToken(helperOwner, expires)}`,
        },
      },
    );
    expect(queued.status).toBe(200);
    await expect
      .poll(() => Date.now() >= expires * 1000, { timeout: 5000 })
      .toBe(true);
    await stop(api, first);
    const result = await terminal(api, queued.body, "failed");
    expect(result.error).toMatch(/sign in|expired/i);
    expect(await buildCount(api, helperProject)).toBe(1);
  }, 30000);
  it("runs one build per project, polls bounded live logs, and starts the next reviewed build only after completion", async () => {
    const api = await fixture();
    const first = await enqueue(api);
    await started(api, first);
    const next = await enqueue(api);
    expect(await status(api, next)).toMatchObject({
      status: "queued",
      queuePosition: 2,
    });
    expect(await buildCount(api, helperProject)).toBe(1);
    const current = await status(api, first);
    expect(current.log.length).toBeLessThanOrEqual(100000);
    expect(current.log).toContain("Fixture build started 1");
    expect(current.previewUrl).toBeUndefined();
    await buildMode(api, helperProject, "success");
    const complete = await terminal(api, first, "succeeded");
    await terminal(api, next, "succeeded");
    expect(await buildCount(api, helperProject)).toBe(2);
    expect(Date.parse(complete.finishedAt)).toBeGreaterThanOrEqual(
      Date.parse(complete.startedAt),
    );
    expect(complete.previewUrl).toBeUndefined();
    await expect(
      api.folders.assertNotBuilding(helperProject),
    ).resolves.toBeUndefined();
  }, 30000);
  it("bounds concurrent projects and the per-project queue, and never runs cancelled queued work", async () => {
    const third = "55555555-5555-4555-8555-555555555555";
    const api = await fixture([helperProject, helperOtherProject, third]);
    const first = await enqueue(api),
      second = await enqueue(api, helperOtherProject);
    await started(api, first);
    await started(api, second);
    const waiting = await enqueue(api, third);
    expect((await status(api, waiting)).status).toBe("queued");
    for (let n = 0; n < 7; n++) await enqueue(api);
    const overflow = await review(api);
    expect(
      (
        await api.send({
          action: "repository-build-start",
          planId: overflow.id,
        })
      ).status,
    ).toBe(429);
    expect((await stop(api, waiting)).body.status).toBe("cancelled");
    await stop(api, first);
    await terminal(api, first, "cancelled");
    expect(await buildCount(api, third)).toBe(0);
  }, 30000);
  it("keeps autosave and cancellation responsive while excluding file changes through the build lock", async () => {
    const api = await fixture();
    const inspection = (
      await api.send({
        action: "repository-source-inspect",
        route: "src/pages/index.astro",
      })
    ).body;
    const edits = {
      inspection,
      values: { [inspection.fields[0].id]: "Changed while waiting" },
      orders: {},
    };
    const plan = (
      await api.send({ action: "repository-source-prepare", edits })
    ).body;
    const job = await enqueue(api);
    await started(api, job);
    expect(
      (
        await api.send({
          action: "repository-source-draft-save",
          route: inspection.route,
          version: 0,
          edits,
        })
      ).status,
    ).toBe(200);
    for (const action of [
      "repository-fetch",
      "repository-apply",
      "repository-native-backup-review",
    ])
      expect(await api.send({ action, planId: plan.id })).toMatchObject({
        status: 409,
        body: { error: expect.stringContaining("A build owns") },
      });
    const otherProcess = new HostedWebsiteFolders(
      api.folders.directory,
      api.credentials,
      api.configured,
    );
    await expect(
      otherProcess.locked(helperProject, () =>
        otherProcess.claimBuild(helperProject, "other"),
      ),
    ).rejects.toThrow("A build owns");
    await stop(api, job);
    await terminal(api, job, "cancelled");
    expect(
      (await api.send({ action: "repository-apply", planId: plan.id })).status,
    ).toBe(200);
  }, 30000);
  it.each(["fail", "cancel"])(
    "restores previous output after %s and releases the build lock only after recovery",
    async (mode) => {
      const api = await fixture();
      const root = api.folders.root(helperProject);
      await mkdir(path.join(root, "dist"));
      await writeFile(
        path.join(root, "dist/index.html"),
        "Previous good website",
      );
      const job = await enqueue(api);
      await started(api, job);
      expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe(
        "Partial fixture output",
      );
      if (mode === "cancel")
        expect((await stop(api, job)).body).toMatchObject({
          status: "building",
          cancelling: true,
        });
      else await buildMode(api, helperProject, "fail");
      const result = await terminal(
        api,
        job,
        mode === "cancel" ? "cancelled" : "failed",
      );
      expect(result.log).toContain(
        mode === "cancel"
          ? "Build cancelled"
          : "Deliberate fixture build failure",
      );
      expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe(
        "Previous good website",
      );
      await expect(
        api.folders.assertNotBuilding(helperProject),
      ).resolves.toBeUndefined();
      expect(result.previewUrl).toBeUndefined();
    },
    30000,
  );
  it("checks the reviewer and project for starts, status and cancellation, consumes a start once, and rechecks queued access", async () => {
    const api = await fixture();
    const plan = await review(api);
    expect(
      (
        await api.send(
          { action: "repository-build-start", planId: plan.id },
          helperEditor,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await api.send({
          action: "repository-build-start",
          projectId: helperOtherProject,
          planId: plan.id,
        })
      ).status,
    ).toBe(409);
    const job = (
      await api.send({ action: "repository-build-start", planId: plan.id })
    ).body;
    await started(api, job);
    expect(
      (await api.send({ action: "repository-build-start", planId: plan.id }))
        .status,
    ).toBe(409);
    for (const action of ["repository-build-status", "repository-build-stop"]) {
      expect(
        (await api.send({ action, jobId: job.id }, helperEditor)).status,
      ).toBe(410);
      expect(
        (
          await api.send({
            action,
            jobId: job.id,
            projectId: helperOtherProject,
          })
        ).status,
      ).toBe(410);
    }
    const queued = await enqueue(api);
    let deniedChecks = 0;
    api.beforeMembership(async () => {
      if (!api.members.get(helperProject)!.has(helperOwner)) deniedChecks++;
    });
    api.members.get(helperProject)!.delete(helperOwner);
    expect(
      (await api.send({ action: "repository-build-status", jobId: job.id }))
        .status,
    ).toBe(403);
    const previousChecks = deniedChecks;
    await buildMode(api, helperProject, "success");
    await expect
      .poll(() => deniedChecks, { timeout: 15000 })
      .toBeGreaterThan(previousChecks);
    api.members.get(helperProject)!.add(helperOwner);
    await terminal(api, queued, "failed");
    expect(await buildCount(api, helperProject)).toBe(1);
  }, 30000);
  it("rejects a queued command when its source changed, and preserves a stale build lock for operator review", async () => {
    const api = await fixture();
    const job = await enqueue(api);
    await started(api, job);
    const queued = await enqueue(api);
    await writeFile(
      path.join(api.folders.root(helperProject), "README.md"),
      "Externally changed source",
    );
    await stop(api, job);
    await terminal(api, queued, "failed");
    expect((await status(api, queued)).error).toContain(
      "changed since the command review",
    );
    expect(await buildCount(api, helperProject)).toBe(1);
    const lock = path.join(
      api.folders.directory,
      "locks",
      `${helperProject}.build.lock`,
    );
    await writeFile(lock, '{"pid":0}', { mode: 0o600 });
    const blocked = await enqueue(api);
    await terminal(api, blocked, "failed");
    expect((await status(api, blocked)).error).toContain("A build owns");
    expect(await readFile(lock, "utf8")).toBe('{"pid":0}');
    await unlink(lock);
  }, 30000);
  it("passes a restricted project environment to the real child process and cancels outstanding jobs on shutdown", async () => {
    const api = await fixture();
    const previousAgent = process.env.SSH_AUTH_SOCK;
    process.env.KAIZEN_FIXTURE_SERVICE_SECRET = "fixture-must-stay-in-parent";
    process.env.SSH_AUTH_SOCK = "/fixture/agent";
    try {
      const job = await enqueue(api);
      await started(api, job);
      await enqueue(api);
      const environment = JSON.parse(
        await readFile(
          path.join(buildHome(api, helperProject), "fixture-environment.json"),
          "utf8",
        ),
      );
      expect(environment.KAIZEN_FIXTURE_SERVICE_SECRET).toBeUndefined();
      expect(environment.SSH_AUTH_SOCK).toBeUndefined();
      expect(environment.HOME).toBe(buildHome(api, helperProject));
      expect(environment.GIT_CONFIG_GLOBAL).toBe("/dev/null");
      await api.service.close();
      expect(await buildCount(api, helperProject)).toBe(1);
      await expect(
        api.folders.assertNotBuilding(helperProject),
      ).resolves.toBeUndefined();
      expect(
        (await api.send({ action: "repository-build-status", jobId: job.id }))
          .status,
      ).toBe(503);
    } finally {
      delete process.env.KAIZEN_FIXTURE_SERVICE_SECRET;
      if (previousAgent === undefined) delete process.env.SSH_AUTH_SOCK;
      else process.env.SSH_AUTH_SOCK = previousAgent;
    }
  }, 30000);
});
