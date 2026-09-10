import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import { runBuilderRelease } from "../../scripts/builder-release-worker.mjs";
import {
  stageRelease,
  initialiseStore,
  activateRelease,
  checkLive,
  listReleases,
  verifyRelease,
} from "../../scripts/kaizen-releases.mjs";

const temporaryRoot = path.resolve("test-results/release-transactions");
const directories: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const directory of directories.splice(0)) {
    if (!path.resolve(directory).startsWith(temporaryRoot + path.sep))
      throw new Error("Unsafe release fixture cleanup.");
    await rm(directory, { recursive: true, force: true });
  }
});
async function fixture() {
  await mkdir(temporaryRoot, { recursive: true });
  const root = await mkdtemp(path.join(temporaryRoot, "case-"));
  directories.push(root);
  const store = path.join(root, "releases"),
    old = path.join(root, "old"),
    next = path.join(root, "next");
  async function build(directory: string, label: string) {
    for (const item of ["builder", "campaign", "_astro"])
      await mkdir(path.join(directory, item), { recursive: true });
    await writeFile(
      path.join(directory, "index.html"),
      `<!doctype html><title>${label}</title><h1>${label} home</h1>`,
    );
    await writeFile(
      path.join(directory, "builder/index.html"),
      `<!doctype html><title>Builder ${label}</title>`,
    );
    await writeFile(
      path.join(directory, "campaign/index.html"),
      `<!doctype html><html data-kaizen-builder-page><p>CMS snapshot ${label}</p></html>`,
    );
    await writeFile(
      path.join(directory, `_astro/${label}.hash.js`),
      `console.log(${JSON.stringify(label)})`,
    );
    await writeFile(
      path.join(directory, "redirects.generated.conf"),
      `location = "/retired/" { return 301 "/${label}/"; }\n`,
    );
  }
  await build(old, "old");
  await build(next, "new");
  const original = await stageRelease({
    source: old,
    store,
    id: "old-release",
  });
  await stageRelease({ source: next, store, id: "new-release" });
  await initialiseStore({ store, id: original.id });
  let active = "",
    wrongPage = false,
    rejectNewConfig = false,
    failReload = false;
  const readConfig = () => readFile(path.join(store, "active.conf"), "utf8");
  const rootFrom = (config: string) => config.match(/^root "([^"]+)";/m)![1];
  active = rootFrom(await readConfig());
  // Real HTTP + filesystem activation, with a small in-memory Nginx control adapter.
  // The adapter changes served roots only on reload, as Nginx does; Linux/Nginx smoke coverage lives in CI.
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, "http://localhost"),
        name = url.pathname;
      if (name === "/retired/") {
        const conf = await readFile(
          path.join(active, "..", "redirects.conf"),
          "utf8",
        );
        res.writeHead(301, {
          Location: conf.match(/return 301 "([^"]+)"/)![1],
        });
        return res.end();
      }
      if (wrongPage && active.includes("new-release") && name === "/campaign/")
        return res.end("Different content behind the same marker");
      const file = name.startsWith("/_astro/")
        ? path.join(store, "immutable", name.slice(1))
        : path.join(
            active,
            name.slice(1),
            name.endsWith("/") ? "index.html" : "",
          );
      const bytes = await readFile(file);
      res.writeHead(200, {
        "Content-Type": name.endsWith(".json")
          ? "application/json"
          : "text/html",
        "Cache-Control": "no-store",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number },
    origin = `http://127.0.0.1:${address.port}`;
  const adapters = {
    validateConfig: async () => {
      if (rejectNewConfig && (await readConfig()).includes("new-release"))
        throw new Error("Nginx rejected the candidate config");
    },
    reload: async () => {
      if (failReload && (await readConfig()).includes("new-release"))
        throw new Error("Reload command failed");
      active = rootFrom(await readConfig());
    },
  };
  return {
    root,
    store,
    old,
    next,
    origin,
    adapters,
    readConfig,
    damagePage: () => (wrongPage = true),
    rejectConfig: () => (rejectNewConfig = true),
    rejectReload: () => (failReload = true),
  };
}
describe("retained website releases", () => {
  for (const outcome of [
    "success",
    "rejected",
    "lost-ack",
    "uncertain",
  ] as const) {
    it(`coordinates file activation with database promotion: ${outcome}`, async () => {
      const f = await fixture(),
        id = crypto.randomUUID(),
        owner = crypto.randomUUID();
      const job: any = {
        id,
        status: "queued",
        rollback_of: null,
        previous_release_id: null,
        artifact_id: null,
        snapshot: { schemaVersion: 1, pages: [], site: null },
      };
      let loseReads = false;
      const phases: string[] = [];
      const client = {
        get: async () => {
          if (loseReads) throw new Error("Connection lost");
          return structuredClone(job);
        },
        rpc: async (name: string, body: any) => {
          if (name === "builder_claim_release") {
            job.status = "building";
            job.artifact_id = body.artifact;
            return structuredClone(job);
          }
          if (name !== "builder_advance_release")
            throw new Error("Unexpected RPC");
          if (body.phase === "live") {
            // The public HTML has already been checked and is serving the candidate before DB promotion.
            expect(
              await (await fetch(`${f.origin}/campaign/`)).text(),
            ).toContain("CMS snapshot new");
            expect(body.proof.artifactId).toBe("coordinated-release");
            expect(body.proof.checkedResponses).toBe(4);
            if (outcome === "rejected")
              throw new Error("Database refused promotion");
            if (outcome === "uncertain") {
              loseReads = true;
              throw new Error("Acknowledgement unavailable");
            }
          }
          job.status = body.phase;
          phases.push(body.phase);
          if (body.phase === "live" && outcome === "lost-ack")
            throw new Error("Committed response was lost");
          return structuredClone(job);
        },
      };
      const run = runBuilderRelease(
        {
          client,
          store: f.store,
          origin: f.origin,
          requestId: id,
          ownerId: owner,
          artifactId: "coordinated-release",
          source: f.next,
          build: async (snapshotFile: string) =>
            expect(JSON.parse(await readFile(snapshotFile, "utf8"))).toEqual(
              job.snapshot,
            ),
        },
        {
          activate: (options: any, hooks: any) =>
            activateRelease(options, { ...f.adapters, ...hooks }),
        },
      );
      if (outcome === "rejected") {
        await expect(run).rejects.toThrow("Database refused promotion");
        expect(job.status).toBe("rolled_back");
        expect(await (await fetch(`${f.origin}/campaign/`)).text()).toContain(
          "CMS snapshot old",
        );
      } else if (outcome === "uncertain") {
        await expect(run).rejects.toThrow("acknowledgement is uncertain");
        expect(job.status).toBe("verifying");
        expect((await listReleases(f.store)).transactions[0].status).toBe(
          "recovery_required",
        );
        expect(await (await fetch(`${f.origin}/campaign/`)).text()).toContain(
          "CMS snapshot new",
        );
      } else {
        expect((await run).status).toBe("live");
        expect(phases).toEqual(["activating", "verifying", "live"]);
      }
    }, 15_000);
  }
  it("does not restore files after a successful database commit when the final journal write fails", async () => {
    const f = await fixture();
    await expect(
      activateRelease(
        {
          store: f.store,
          id: "new-release",
          origin: f.origin,
          report: (event: any) => {
            if (event.status === "live")
              throw new Error("Journal reporting failed after commit");
          },
        },
        { ...f.adapters, finalize: async () => undefined },
      ),
    ).rejects.toThrow("after commit");
    expect(await (await fetch(`${f.origin}/campaign/`)).text()).toContain(
      "CMS snapshot new",
    );
    expect((await listReleases(f.store)).transactions[0].status).toBe(
      "recovery_required",
    );
  });
  it("activates checked files, keeps old immutable assets and rolls back the exact CMS/redirect snapshot", async () => {
    const f = await fixture(),
      events: string[] = [];
    await checkLive(f.origin, await verifyRelease(f.store, "old-release"));
    const result = await activateRelease(
      {
        store: f.store,
        id: "new-release",
        origin: f.origin,
        report: (event: any) => events.push(event.status),
      },
      f.adapters,
    );
    expect(result.status).toBe("live");
    expect(events).toEqual(["checking", "activating", "verifying", "live"]);
    expect(await (await fetch(`${f.origin}/campaign/`)).text()).toContain(
      "CMS snapshot new",
    );
    expect(
      await (await fetch(`${f.origin}/_astro/old.hash.js`)).text(),
    ).toContain('"old"');
    await writeFile(
      path.join(f.next, "campaign/index.html"),
      "CMS changed after deployment",
    );
    await activateRelease(
      { store: f.store, id: "old-release", origin: f.origin },
      f.adapters,
    );
    expect(await (await fetch(`${f.origin}/campaign/`)).text()).toContain(
      "CMS snapshot old",
    );
    expect(
      (await fetch(`${f.origin}/retired/`, { redirect: "manual" })).headers.get(
        "location",
      ),
    ).toBe("/old/");
    expect(
      await (await fetch(`${f.origin}/_astro/new.hash.js`)).text(),
    ).toContain('"new"');
    const listed = await listReleases(f.store);
    expect(listed.selectedReleaseId).toBe("old-release");
    expect(listed.transactions).toHaveLength(2);
    expect(listed.releases).toHaveLength(2);
  }, 15_000);
  it.each(["configuration", "reload", "health"])(
    "restores and verifies the previous release after a %s failure",
    async (failure) => {
      const f = await fixture(),
        before = await f.readConfig();
      if (failure === "configuration") f.rejectConfig();
      else if (failure === "reload") f.rejectReload();
      else f.damagePage();
      await expect(
        activateRelease(
          { store: f.store, id: "new-release", origin: f.origin },
          f.adapters,
        ),
      ).rejects.toThrow(/previous release was restored and verified/);
      expect(await f.readConfig()).toBe(before);
      expect(await (await fetch(`${f.origin}/campaign/`)).text()).toContain(
        "CMS snapshot old",
      );
      expect((await listReleases(f.store)).transactions[0].status).toBe(
        "rolled_back",
      );
    },
    15_000,
  );
  it("refuses changed archives, path traversal, symlinks, duplicate IDs and activation locks", async () => {
    const f = await fixture(),
      before = await f.readConfig();
    await expect(
      stageRelease({ source: f.next, store: f.store, id: "new-release" }),
    ).rejects.toThrow(/already exists/);
    await expect(
      stageRelease({ source: f.next, store: f.store, id: "../escape" }),
    ).rejects.toThrow();
    await mkdir(path.join(f.store, ".activation-lock"));
    await writeFile(
      path.join(f.store, ".activation-lock/owner.json"),
      JSON.stringify({ pid: process.pid, host: "fixture" }),
    );
    await expect(
      activateRelease(
        { store: f.store, id: "new-release", origin: f.origin },
        f.adapters,
      ),
    ).rejects.toThrow(/owns the lock/);
    const candidate = path.join(
      f.store,
      "releases/new-release/site/campaign/index.html",
    );
    await writeFile(candidate, "tampered");
    await expect(verifyRelease(f.store, "new-release")).rejects.toThrow(
      /checksum/,
    );
    await mkdir(path.join(f.next, ".git"));
    await writeFile(
      path.join(f.next, ".git/config"),
      "Private repository configuration",
    );
    await expect(
      stageRelease({ source: f.next, store: f.store, id: "private-files" }),
    ).rejects.toThrow(/server-only/);
    await symlink(
      f.old,
      path.join(f.next, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(
      stageRelease({ source: f.next, store: f.store, id: "linked-release" }),
    ).rejects.toThrow(/symbolic links/);
    expect(await f.readConfig()).toBe(before);
  });
  it("reports recovery required if external edits prevent safe automatic restoration", async () => {
    const f = await fixture();
    const adapters = {
      ...f.adapters,
      reload: async () => {
        await writeFile(
          path.join(f.store, "active.conf"),
          "# An administrator changed this\n",
        );
        throw new Error("reload interrupted");
      },
    };
    await expect(
      activateRelease(
        { store: f.store, id: "new-release", origin: f.origin },
        adapters,
      ),
    ).rejects.toThrow(/automatic recovery could not be verified/);
    expect(await f.readConfig()).toContain("administrator changed");
    const files = await import("node:fs/promises").then((fs) =>
      fs.readdir(path.join(f.store, "transactions")),
    );
    expect(
      JSON.parse(
        await readFile(path.join(f.store, "transactions", files[0]), "utf8"),
      ).status,
    ).toBe("recovery_required");
  });
});
