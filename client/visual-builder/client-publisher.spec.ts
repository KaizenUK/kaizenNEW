import { expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  lstat,
  rename,
  rm,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ClientPublisher } from "../../scripts/builder-client-publisher";
import {
  bindClientStore,
  stageRelease,
  initialiseStore,
  nginxConfig,
} from "../../scripts/kaizen-releases.mjs";
import { publicDestination } from "../../scripts/client-publication.mjs";
import { captureClientPublication } from "../../shared/builderClientPublication";
import { newDocument } from "./starters";
import { savePage, type Workspace } from "../../shared/visualBuilder";

async function fixture(environment: "staging" | "production" = "production") {
  const root = await mkdtemp(path.join(os.tmpdir(), "kaizen-publisher-test-"));
  const projectId = randomUUID(),
    destinationId = randomUUID();
  const destination = {
    projectId,
    destinationId,
    environment,
    origin: "https://client.example",
    label: "Test client",
    store: path.join(root, "store"),
  };
  const source = path.join(root, "initial");
  await mkdir(source);
  await writeFile(
    path.join(source, "index.html"),
    "<!doctype html><h1>Initial</h1>",
  );
  await bindClientStore({
    store: destination.store,
    client: {
      projectId,
      destinationId,
      environment,
      origin: destination.origin,
    },
  });
  await stageRelease({
    store: destination.store,
    source,
    id: "initial",
    client: {
      projectId,
      destinationId,
      environment,
      origin: destination.origin,
    },
  });
  await initialiseStore({ store: destination.store, id: "initial" });
  const registry = path.join(root, "destinations.json");
  await writeFile(
    registry,
    JSON.stringify({ schemaVersion: 1, destinations: [destination] }),
  );
  let workspace: Workspace = {
    pages: [
      savePage([], newDocument("Reviewed", "about", false), randomUUID(), 0),
    ],
    assets: [],
    saved: [],
  };
  let compileGate = Promise.resolve(),
    failHealth = false,
    writable = true;
  const services = {
    directory: (id: string) => path.join(root, "projects", id),
    require: async (id: string) => {
      if (id !== projectId || !writable)
        throw new Error("Project is not writable");
    },
    workspace: async () => structuredClone(workspace),
    registry: () => registry,
    samplesRoot: path.join(root, "samples"),
    compile: async () => {
      await compileGate;
      return {
        files: {
          "index.html": new TextEncoder().encode(
            "<!doctype html><h1>Reviewed release</h1>",
          ),
        },
        backup: new Uint8Array([1]),
        redirects: [],
        warnings: [],
      };
    },
    adapters: () => ({
      validateConfig: async () => {},
      reload: async () => {},
      checkLive: async (_origin: string, manifest: { id: string }) => {
        if (failHealth && manifest.id !== "initial")
          throw new Error("Wrong served bytes");
      },
    }),
  };
  return {
    projectId,
    destinationId,
    root,
    services,
    destination,
    get workspace() {
      return workspace;
    },
    edit(title: string) {
      workspace.pages[0] = savePage(
        workspace.pages,
        { ...workspace.pages[0].draft, title },
        workspace.pages[0].id,
        workspace.pages[0].version,
      );
    },
    pause() {
      let resume!: () => void;
      compileGate = new Promise<void>((resolve) => {
        resume = resolve;
      });
      return resume;
    },
    failHealth() {
      failHealth = true;
    },
    archive() {
      writable = false;
    },
  };
}

it("refuses stale and cross-project reviews before starting any job", async () => {
  const f = await fixture(),
    publisher = new ClientPublisher(f.services);
  try {
    const review = await publisher.review(
      f.projectId,
      f.destinationId,
      "publish",
    );
    await expect(publisher.start(randomUUID(), review.id)).rejects.toThrow(
      "review expired",
    );
    f.edit("Changed after review");
    await expect(publisher.start(f.projectId, review.id)).rejects.toThrow(
      "drafts changed",
    );
    expect(await publisher.jobs(f.projectId)).toEqual([]);
    const fresh = await publisher.review(
      f.projectId,
      f.destinationId,
      "publish",
    );
    f.archive();
    await expect(publisher.start(f.projectId, fresh.id)).rejects.toThrow(
      "not writable",
    );
  } finally {
    await publisher.close();
  }
});

it("refuses damaged publication history without changing files or the selected destination", async () => {
  const f = await fixture(),
    crash = await interrupted(f, true),
    publisher = new ClientPublisher(f.services);
  const file = path.join(
    f.services.directory(f.projectId),
    "publication",
    "index.json",
  );
  const valid = { schemaVersion: 1, jobs: [crash.job], active: {} };
  const selectedFile = path.join(f.destination.store, "active.conf");
  const selected = await readFile(selectedFile, "utf8");
  const variants = [
    "{unfinished",
    JSON.stringify({ ...valid, active: [] }),
    JSON.stringify({ ...valid, jobs: [null] }),
    JSON.stringify({ ...valid, jobs: [crash.job, crash.job] }),
    JSON.stringify({ ...valid, active: { [f.destinationId]: randomUUID() } }),
    JSON.stringify({ ...valid, active: { [randomUUID()]: crash.job.id } }),
    ...[
      { id: "../outside" },
      { destination: { ...crash.job.destination, projectId: randomUUID() } },
      {
        destination: { ...crash.job.destination, destinationId: "../outside" },
      },
      {
        destination: {
          ...crash.job.destination,
          origin: "https://user:password@client.example",
        },
      },
      { phase: "unknown" },
      { log: [] },
      { createdAt: "not a date" },
      { artifactId: "../outside" },
      { previousReleaseId: "../outside" },
      { action: "rollback", rollbackOf: randomUUID() },
    ].map((change) =>
      JSON.stringify({ ...valid, jobs: [{ ...crash.job, ...change }] }),
    ),
  ];
  try {
    for (const text of variants) {
      await writeFile(file, text);
      await expect(publisher.jobs(f.projectId)).rejects.toThrow(
        /publication history/i,
      );
      await expect(
        publisher.workspace(f.projectId, f.workspace),
      ).rejects.toThrow(/publication history/i);
      await expect(
        publisher.recover(f.projectId, crash.job.id),
      ).rejects.toThrow(/publication history/i);
      expect(await readFile(file, "utf8")).toBe(text);
      expect(await readFile(selectedFile, "utf8")).toBe(selected);
      for (const lock of crash.locks)
        expect((await lstat(lock)).isDirectory()).toBe(true);
    }
    await writeFile(file, JSON.stringify(valid));
    await publisher.recover(f.projectId, crash.job.id);
    expect((await publisher.jobs(f.projectId))[0]).toMatchObject({
      phase: "live",
      active: true,
    });
  } finally {
    await publisher.close();
  }
});

it("validates retained snapshots before recovery and preserves the original locks on failure", async () => {
  const f = await fixture(),
    crash = await interrupted(f, true),
    publisher = new ClientPublisher(f.services);
  const folder = path.join(f.services.directory(f.projectId), "publication"),
    file = path.join(folder, `${crash.job.id}.snapshot.json`),
    valid = await readFile(file, "utf8"),
    history = await readFile(path.join(folder, "index.json"), "utf8"),
    selected = await readFile(
      path.join(f.destination.store, "active.conf"),
      "utf8",
    );
  const snapshot = JSON.parse(valid);
  try {
    for (const broken of [
      "null",
      "{unfinished",
      JSON.stringify({ ...snapshot, projectId: randomUUID() }),
      JSON.stringify({ ...snapshot, capturedAt: "invalid" }),
      JSON.stringify({
        ...snapshot,
        workspace: { ...snapshot.workspace, pages: [null] },
      }),
      JSON.stringify({
        ...snapshot,
        workspace: {
          ...snapshot.workspace,
          pages: [...snapshot.workspace.pages, ...snapshot.workspace.pages],
        },
      }),
    ]) {
      await writeFile(file, broken);
      await expect(
        publisher.recover(f.projectId, crash.job.id),
      ).rejects.toThrow();
      expect(await readFile(file, "utf8")).toBe(broken);
      expect(await readFile(path.join(folder, "index.json"), "utf8")).toBe(
        history,
      );
      expect(
        await readFile(path.join(f.destination.store, "active.conf"), "utf8"),
      ).toBe(selected);
      for (const lock of crash.locks)
        expect((await lstat(lock)).isDirectory()).toBe(true);
    }
    await writeFile(file, valid);
    await publisher.recover(f.projectId, crash.job.id);
    expect((await publisher.jobs(f.projectId))[0]).toMatchObject({
      phase: "live",
      active: true,
    });
  } finally {
    await publisher.close();
  }
});

it("initializes an empty publication history safely across concurrent companions", async () => {
  const f = await fixture();
  const publishers = [
    new ClientPublisher(f.services),
    new ClientPublisher(f.services),
  ];
  try {
    const histories = await Promise.all(
      Array.from({ length: 16 }, (_, index) =>
        publishers[index % 2].jobs(f.projectId),
      ),
    );
    expect(histories).toEqual(Array.from({ length: 16 }, () => []));
    expect(
      JSON.parse(
        await readFile(
          path.join(
            f.services.directory(f.projectId),
            "publication",
            "index.json",
          ),
          "utf8",
        ),
      ),
    ).toEqual({ schemaVersion: 1, jobs: [], active: {} });
  } finally {
    await Promise.all(publishers.map((publisher) => publisher.close()));
  }
});

it("does not replace a missing index when publication artifacts remain", async () => {
  const f = await fixture(),
    crash = await interrupted(f, true),
    publisher = new ClientPublisher(f.services);
  const file = path.join(
    f.services.directory(f.projectId),
    "publication",
    "index.json",
  );
  const retained = await readFile(file, "utf8");
  await rename(file, `${file}.preserved`);
  try {
    await expect(publisher.jobs(f.projectId)).rejects.toThrow(
      /history is missing/,
    );
    await expect(publisher.workspace(f.projectId, f.workspace)).rejects.toThrow(
      /history is missing/,
    );
    await expect(lstat(file)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(`${file}.preserved`, "utf8")).toBe(retained);
    await rename(`${file}.preserved`, file);
    await publisher.recover(f.projectId, crash.job.id);
    expect((await publisher.jobs(f.projectId))[0].phase).toBe("live");
  } finally {
    await publisher.close();
  }
});

async function interrupted(
  f: Awaited<ReturnType<typeof fixture>>,
  selected: boolean,
  pid?: number,
  host = os.hostname(),
) {
  if (!pid) {
    const process = spawn(
      globalThis.process.execPath,
      ["-e", "process.exit(0)"],
      { windowsHide: true },
    );
    pid = process.pid!;
    await new Promise<void>((resolve, reject) => {
      process.once("exit", () => resolve());
      process.once("error", reject);
    });
  }
  const job = {
    id: randomUUID(),
    destination: publicDestination(f.destination),
    artifactId: randomUUID(),
    previousReleaseId: "initial",
    action: "publish",
    phase: "verifying",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    log: "Interrupted fixture",
    active: false,
  };
  const publication = path.join(
    f.services.directory(f.projectId),
    "publication",
  );
  await mkdir(publication, { recursive: true });
  await writeFile(
    path.join(publication, `${job.id}.snapshot.json`),
    JSON.stringify(captureClientPublication(f.projectId, f.workspace)),
  );
  await writeFile(
    path.join(publication, "index.json"),
    JSON.stringify({ schemaVersion: 1, jobs: [job], active: {} }),
  );
  if (selected) {
    await stageRelease({
      store: f.destination.store,
      source: path.join(f.root, "initial"),
      id: job.artifactId,
      client: {
        projectId: f.projectId,
        destinationId: f.destinationId,
        environment: f.destination.environment,
        origin: f.destination.origin,
      },
    });
    await writeFile(
      path.join(f.destination.store, "active.conf"),
      nginxConfig(f.destination.store, job.artifactId, true),
    );
  }
  const locks = [
    path.join(publication, `lock-${f.destinationId}`),
    path.join(f.destination.store, ".activation-lock"),
  ];
  for (const lock of locks) {
    await mkdir(lock);
    await writeFile(
      path.join(lock, "owner.json"),
      JSON.stringify({
        pid,
        host,
        jobId: job.id,
        createdAt: "2000-01-01T00:00:00Z",
      }),
    );
  }
  return { job, locks };
}

it("reconciles a stopped activation and its immutable snapshot while preserving newer drafts", async () => {
  const f = await fixture(),
    crash = await interrupted(f, true),
    publisher = new ClientPublisher(f.services);
  f.edit("Newer than interrupted release");
  try {
    expect((await publisher.jobs(f.projectId))[0]).toMatchObject({
      phase: "recovery_required",
      recoveryAvailable: true,
    });
    const review = await publisher.review(
      f.projectId,
      f.destinationId,
      "publish",
    );
    await expect(publisher.start(f.projectId, review.id)).rejects.toThrow(
      "Reconcile",
    );
    await publisher.recover(f.projectId, crash.job.id);
    const displayed = await publisher.workspace(f.projectId, f.workspace);
    expect(displayed.pages[0].published?.title).toBe("Reviewed");
    expect(displayed.pages[0].draft.title).toBe(
      "Newer than interrupted release",
    );
    expect((await publisher.jobs(f.projectId))[0]).toMatchObject({
      phase: "live",
      active: true,
    });
    for (const lock of crash.locks)
      await expect(lstat(lock)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await publisher.close();
  }
});

it("recovers a crash before selection without incorrectly promoting the new snapshot", async () => {
  const f = await fixture(),
    crash = await interrupted(f, false),
    publisher = new ClientPublisher(f.services);
  try {
    await publisher.recover(f.projectId, crash.job.id);
    expect((await publisher.jobs(f.projectId))[0]).toMatchObject({
      phase: "rolled_back",
      active: false,
    });
    expect(
      (await publisher.workspace(f.projectId, f.workspace)).pages[0].published,
    ).toBeNull();
  } finally {
    await publisher.close();
  }
});

it("preserves recovery locks and history when served output cannot be verified", async () => {
  const f = await fixture(),
    crash = await interrupted(f, true),
    publisher = new ClientPublisher(f.services);
  f.failHealth();
  try {
    await expect(publisher.recover(f.projectId, crash.job.id)).rejects.toThrow(
      "Wrong served bytes",
    );
    for (const lock of crash.locks)
      expect((await lstat(lock)).isDirectory()).toBe(true);
    expect((await publisher.jobs(f.projectId))[0]).toMatchObject({
      phase: "recovery_required",
      active: false,
    });
    expect(
      (await publisher.workspace(f.projectId, f.workspace)).pages[0].published,
    ).toBeNull();
  } finally {
    await publisher.close();
  }
}, 10000);

it("does not recover an old lock owned by a live process or an unrelated host", async () => {
  for (const host of [os.hostname(), "another-server"]) {
    const f = await fixture(),
      crash = await interrupted(f, true, process.pid, host),
      publisher = new ClientPublisher(f.services);
    try {
      expect((await publisher.jobs(f.projectId))[0].recoveryAvailable).not.toBe(
        true,
      );
      await expect(
        publisher.recover(f.projectId, crash.job.id),
      ).rejects.toThrow("proven stopped");
      for (const lock of crash.locks)
        expect((await lstat(lock)).isDirectory()).toBe(true);
    } finally {
      await publisher.close();
    }
  }
});

it("rejects recovery while the server activation owner is alive even when the companion owner has stopped", async () => {
  const f = await fixture(),
    crash = await interrupted(f, true),
    publisher = new ClientPublisher(f.services);
  await writeFile(
    path.join(crash.locks[1], "owner.json"),
    JSON.stringify({ pid: process.pid, host: os.hostname() }),
  );
  try {
    await expect(publisher.recover(f.projectId, crash.job.id)).rejects.toThrow(
      "still running",
    );
    for (const lock of crash.locks)
      expect((await lstat(lock)).isDirectory()).toBe(true);
    expect(
      (await publisher.workspace(f.projectId, f.workspace)).pages[0].published,
    ).toBeNull();
  } finally {
    await publisher.close();
  }
});

it("serializes recovery attempts without reclaiming the original stopped owner's lock early", async () => {
  const f = await fixture(),
    crash = await interrupted(f, true);
  let resume!: () => void, reached!: () => void;
  const entered = new Promise<void>((resolve) => {
      reached = resolve;
    }),
    gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
  const adapters = f.services.adapters;
  f.services.adapters = () => ({
    ...adapters(),
    reload: async () => {
      reached();
      await gate;
    },
  });
  const publisher = new ClientPublisher(f.services);
  const recovery = publisher.recover(f.projectId, crash.job.id);
  try {
    await entered;
    await expect(publisher.recover(f.projectId, crash.job.id)).rejects.toThrow(
      "recovery guard",
    );
    for (const lock of crash.locks)
      expect((await lstat(lock)).isDirectory()).toBe(true);
    resume();
    await recovery;
    expect((await publisher.jobs(f.projectId))[0]).toMatchObject({
      phase: "live",
      active: true,
    });
  } finally {
    resume();
    await recovery;
    await publisher.close();
  }
});

it("locks one destination during a build and persists the frozen baseline across companion restarts", async () => {
  const f = await fixture(),
    publisher = new ClientPublisher(f.services),
    resume = f.pause();
  try {
    const review = await publisher.review(
      f.projectId,
      f.destinationId,
      "publish",
    );
    const otherReview = await publisher.review(
      f.projectId,
      f.destinationId,
      "publish",
    );
    const job = await publisher.start(f.projectId, review.id);
    await expect(publisher.start(f.projectId, otherReview.id)).rejects.toThrow(
      "recovery lock",
    );
    f.edit("Newer saved draft");
    resume();
    await expect
      .poll(async () => (await publisher.jobs(f.projectId))[0].phase)
      .toBe("live");
    const restarted = new ClientPublisher(f.services);
    try {
      const current = await restarted.workspace(f.projectId, f.workspace);
      expect(current.pages[0].draft.title).toBe("Newer saved draft");
      expect(current.pages[0].published?.title).toBe("Reviewed");
      expect(current.pages[0].version).toBe(f.workspace.pages[0].version);
      expect((await restarted.jobs(f.projectId))[0]).toMatchObject({
        id: job.id,
        active: true,
        phase: "live",
      });
    } finally {
      await restarted.close();
    }
  } finally {
    resume();
    await publisher.close();
  }
});

it("keeps production page metadata unpublished when only staging is verified", async () => {
  const f = await fixture("staging"),
    publisher = new ClientPublisher(f.services);
  try {
    const review = await publisher.review(
      f.projectId,
      f.destinationId,
      "publish",
    );
    await publisher.start(f.projectId, review.id);
    await expect
      .poll(async () => (await publisher.jobs(f.projectId))[0].phase)
      .toBe("live");
    expect(
      (await publisher.workspace(f.projectId, f.workspace)).pages[0].published,
    ).toBeNull();
  } finally {
    await publisher.close();
  }
});

it("records failed served-output verification and restores the previous artifact without touching newer drafts", async () => {
  const f = await fixture(),
    publisher = new ClientPublisher(f.services),
    resume = f.pause();
  try {
    const review = await publisher.review(
      f.projectId,
      f.destinationId,
      "publish",
    );
    await publisher.start(f.projectId, review.id);
    f.edit("Draft kept after failed activation");
    f.failHealth();
    resume();
    await expect
      .poll(async () => (await publisher.jobs(f.projectId))[0].phase, {
        timeout: 10000,
      })
      .toBe("rolled_back");
    const current = await publisher.workspace(f.projectId, f.workspace);
    expect(current.pages[0].draft.title).toBe(
      "Draft kept after failed activation",
    );
    expect(current.pages[0].published).toBeNull();
    expect(
      await readFile(path.join(f.root, "store", "active.conf"), "utf8"),
    ).toContain("initial");
    expect((await publisher.jobs(f.projectId))[0].active).toBe(false);
  } finally {
    resume();
    await publisher.close();
  }
}, 15000);

it("marks an earlier local release that is no longer kept and refuses reviewing its restoration", async () => {
  const f = await fixture(),
    publisher = new ClientPublisher(f.services);
  const find = async (id: string) =>
    (await publisher.jobs(f.projectId)).find((job) => job.id === id);
  try {
    const first = await publisher.start(
      f.projectId,
      (await publisher.review(f.projectId, f.destinationId, "publish")).id,
    );
    await expect.poll(async () => (await find(first.id))?.phase).toBe("live");
    f.edit("Second release");
    const second = await publisher.start(
      f.projectId,
      (await publisher.review(f.projectId, f.destinationId, "publish")).id,
    );
    await expect.poll(async () => (await find(second.id))?.active).toBe(true);
    expect(await find(first.id)).toMatchObject({
      phase: "live",
      active: false,
      availability: "retained",
    });
    await rm(path.join(f.destination.store, "releases", first.artifactId), {
      recursive: true,
    });
    expect(await find(first.id)).toMatchObject({
      phase: "live",
      availability: "removed",
    });
    await expect(
      publisher.review(f.projectId, f.destinationId, "rollback", first.id),
    ).rejects.toThrow(/no longer retained/);
  } finally {
    await publisher.close();
  }
});
