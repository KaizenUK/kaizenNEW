import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { NativeOperationJournal } from "../../scripts/builder-native-operations";
import { nativeWorkerConnection } from "../../scripts/builder-native-worker";
import { SandboxCleanupError } from "../../scripts/builder-build-sandbox";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import {
  runBuilderRelease,
  runRepositoryRelease,
  reconcileBuilderRelease,
} from "../../scripts/builder-release-worker.mjs";
import { reconcileRepositoryOutput } from "../../scripts/builder-repository-output.mjs";
import {
  stageRelease,
  initialiseStore,
  activateRelease,
  checkLive,
  listReleases,
  verifyRelease,
  nginxConfig,
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
async function fixture(
  edgeScripts = false,
  beforeStage?: (old: string, next: string) => Promise<void>,
) {
  await mkdir(temporaryRoot, { recursive: true });
  const root = await mkdtemp(path.join(temporaryRoot, "case-"));
  directories.push(root);
  const store = path.join(root, "releases"),
    old = path.join(root, "old"),
    next = path.join(root, "next");
  async function build(directory: string, label: string) {
    for (const item of ["builder", "campaign", "about", "assets", "_astro"])
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
      path.join(directory, "about/index.html"),
      `<!doctype html><title>About ${label}</title><link rel="stylesheet" href="/assets/site.css"><h1>Native ${label}</h1><img src="/assets/logo.svg" alt="Logo">`,
    );
    await writeFile(
      path.join(directory, "assets/site.css"),
      `/* ${label} */ h1 { color: blue; }`,
    );
    await writeFile(
      path.join(directory, "assets/logo.svg"),
      `<svg xmlns="http://www.w3.org/2000/svg"><title>${label}</title></svg>`,
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
  await beforeStage?.(old, next);
  const original = await stageRelease({
    source: old,
    store,
    id: "old-release",
    commit: "c".repeat(40),
  });
  await stageRelease({ source: next, store, id: "new-release" });
  await initialiseStore({ store, id: original.id });
  let active = "",
    wrongPage: string | null = null,
    rejectNewConfig = false,
    failReload = false;
  const readConfig = () => readFile(path.join(store, "active.conf"), "utf8");
  const rootFrom = (config: string) => config.match(/^root "([^"]+)";/m)![1];
  active = rootFrom(await readConfig());
  let activeIdentity = (await readConfig()).match(
    /add_header X-Kaizen-Release "([^"]+)"/,
  )?.[1];
  const responseIdentities = new Map<string, string | null>();
  // Real HTTP + filesystem activation, with a small in-memory Nginx control adapter.
  // The adapter changes served roots only on reload, as Nginx does; Linux/Nginx smoke coverage lives in CI.
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, "http://localhost"),
        name = url.pathname;
      const identity = responseIdentities.has(name)
        ? responseIdentities.get(name)
        : activeIdentity;
      if (identity) res.setHeader("X-Kaizen-Release", identity);
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
      if (wrongPage && active.includes("new-release") && name === wrongPage)
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
      res.end(
        edgeScripts &&
          name.endsWith("/") &&
          req.headers["x-requested-with"] !== "XMLHttpRequest"
          ? Buffer.concat([
              bytes,
              Buffer.from("<script>/* edge bot detection */</script>"),
            ])
          : bytes,
      );
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
      activeIdentity = (await readConfig()).match(
        /add_header X-Kaizen-Release "([^"]+)"/,
      )?.[1];
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
    responseIdentity: (pathname: string, identity: string | null) =>
      responseIdentities.set(pathname, identity),
    damagePage: (pathname = "/campaign/") => (wrongPage = pathname),
    rejectConfig: () => (rejectNewConfig = true),
    rejectReload: () => (failReload = true),
  };
}
describe("retained website releases", () => {
  it.each([
    ["/assets/site.css", "another-release"],
    ["/assets/site.css", null],
    ["/retired/", null],
    ["/.well-known/kaizen-release.json", "another-release"],
  ])(
    "rejects correct bytes at %s when the response has release identity %s",
    async (pathname, identity) => {
      const f = await fixture();
      f.responseIdentity(pathname!, identity);
      const manifest = await verifyRelease(f.store, "old-release");
      if (pathname === "/retired/")
        manifest.redirectChecks = [
          {
            source: "/retired/",
            destination: "/old/",
            status: 301,
            preserveQuery: true,
          },
        ];
      await expect(checkLive(f.origin, manifest)).rejects.toThrow(
        "different release or is missing its release identity",
      );
    },
  );
  it("does not allow removal of the response-identity requirement from a new retained manifest", async () => {
    const f = await fixture();
    const manifest = await verifyRelease(f.store, "new-release");
    delete manifest.responseIdentity;
    await writeFile(
      path.join(f.store, "releases/new-release/release.json"),
      JSON.stringify(manifest),
    );
    await expect(verifyRelease(f.store, "new-release")).rejects.toThrow(
      "retained release marker does not match",
    );
  });
  it("upgrades an intact legacy serving configuration and artifact without rewriting retained files", async () => {
    const f = await fixture();
    const manifest = await verifyRelease(f.store, "old-release");
    const directory = path.join(f.store, "releases/old-release");
    const markerPath = ".well-known/kaizen-release.json";
    const marker = JSON.parse(
      await readFile(path.join(directory, "site", markerPath), "utf8"),
    );
    delete marker.responseIdentity;
    delete manifest.responseIdentity;
    const bytes = Buffer.from(JSON.stringify(marker));
    const file = manifest.files.find(
      (entry: { path: string }) => entry.path === markerPath,
    );
    file.size = bytes.length;
    file.sha256 = createHash("sha256").update(bytes).digest("hex");
    await writeFile(path.join(directory, "site", markerPath), bytes);
    const retained = JSON.stringify(manifest);
    await writeFile(path.join(directory, "release.json"), retained);
    await writeFile(
      path.join(f.store, "active.conf"),
      nginxConfig(f.store, "old-release", false, false),
    );
    await f.adapters.reload();
    await checkLive(f.origin, await verifyRelease(f.store, "old-release"));
    await activateRelease(
      { store: f.store, id: "new-release", origin: f.origin },
      f.adapters,
    );
    await checkLive(f.origin, await verifyRelease(f.store, "new-release"));
    expect(await readFile(path.join(directory, "release.json"), "utf8")).toBe(
      retained,
    );
  });
  it("waits for a verified baseline after a graceful reload before changing the serving configuration", async () => {
    const f = await fixture();
    let oldChecks = 0;
    let switched = false;
    await activateRelease(
      { store: f.store, id: "new-release", origin: f.origin },
      {
        ...f.adapters,
        checkLive: async (origin: string, manifest: { id: string }) => {
          if (manifest.id === "old-release" && ++oldChecks < 3) {
            expect(switched).toBe(false);
            throw new Error("A previous worker is still draining.");
          }
          await checkLive(origin, manifest);
        },
        beforeSwitch: () => {
          expect(oldChecks).toBe(3);
          switched = true;
        },
      },
    );
    expect(switched).toBe(true);
  });
  it("preserves the serving configuration when baseline identity never verifies", async () => {
    const f = await fixture();
    const before = await f.readConfig();
    f.responseIdentity("/.well-known/kaizen-release.json", null);
    await expect(
      activateRelease(
        { store: f.store, id: "new-release", origin: f.origin },
        f.adapters,
      ),
    ).rejects.toThrow("missing its release identity");
    expect(await f.readConfig()).toBe(before);
    expect((await listReleases(f.store)).transactions).toHaveLength(0);
  });
  it.each([
    "/about/",
    "/assets/site.css",
    "/assets/logo.svg",
    "/_astro/new.hash.js",
  ])(
    "refuses wrong native website bytes at %s even when the marker and homepage match",
    async (pathname) => {
      const f = await fixture();
      const manifest = await verifyRelease(f.store, "new-release");
      expect(manifest.schemaVersion).toBe(3);
      expect(
        manifest.checks.some(
          (check: { path: string }) => check.path === pathname,
        ),
      ).toBe(true);
      f.damagePage(pathname);
      await expect(
        activateRelease(
          { store: f.store, id: "new-release", origin: f.origin },
          f.adapters,
        ),
      ).rejects.toThrow("does not match");
      expect(await f.readConfig()).toContain("old-release");
      await checkLive(f.origin, await verifyRelease(f.store, "old-release"));
    },
  );
  it("requires every public-file check for new native releases while retaining legacy rollback compatibility", async () => {
    const f = await fixture();
    const file = path.join(f.store, "releases/new-release/release.json");
    const manifest = await verifyRelease(f.store, "new-release");
    manifest.checks = manifest.checks.filter(
      (check: { path: string }) => check.path !== "/about/",
    );
    await writeFile(file, JSON.stringify(manifest));
    await expect(verifyRelease(f.store, "new-release")).rejects.toThrow(
      "every served file",
    );
    manifest.schemaVersion = 1;
    manifest.checks = manifest.checks.filter((check: { path: string }) =>
      ["/", "/builder/", "/campaign/"].includes(check.path),
    );
    await writeFile(file, JSON.stringify(manifest));
    await checkLive(f.origin, await verifyRelease(f.store, "old-release"));
    expect((await verifyRelease(f.store, "new-release")).schemaVersion).toBe(1);
  });
  it("keeps Apache/PHP configuration out of the Nginx public artifact without changing source output", async () => {
    const f = await fixture();
    const source = f.next;
    const controls = [
      ".htaccess",
      "about/.htaccess",
      ".user.ini",
      "about/.user.ini",
    ];
    for (const file of controls)
      await writeFile(path.join(source, file), "Require all denied\n");
    const release = await stageRelease({
      source,
      store: f.store,
      id: "apache-control",
    });
    for (const file of controls) {
      expect(await readFile(path.join(source, file), "utf8")).toBe(
        "Require all denied\n",
      );
      await expect(
        readFile(path.join(f.store, "releases", release.id, "site", file)),
      ).rejects.toMatchObject({ code: "ENOENT" });
    }
    await activateRelease(
      { store: f.store, id: release.id, origin: f.origin },
      f.adapters,
    );
    await checkLive(f.origin, release);
  });
  it("rejects a native release marker whose source commit was changed while keeping the release ID", async () => {
    const f = await fixture();
    const manifest = await verifyRelease(f.store, "old-release");
    const file = path.join(
      f.store,
      "releases",
      manifest.id,
      "site/.well-known/kaizen-release.json",
    );
    const marker = JSON.parse(await readFile(file, "utf8"));
    await writeFile(
      file,
      JSON.stringify({ ...marker, commit: "a".repeat(40) }),
    );
    await expect(checkLive(f.origin, manifest)).rejects.toThrow(
      "served release marker does not match",
    );
  });
  it("requests unmodified HTML through an injecting edge while still rejecting wrong page bytes", async () => {
    const f = await fixture(true);
    expect(await (await fetch(`${f.origin}/builder/`)).text()).toContain(
      "edge bot detection",
    );
    await checkLive(f.origin, await verifyRelease(f.store, "old-release"));
    f.damagePage();
    await expect(
      activateRelease(
        { store: f.store, id: "new-release", origin: f.origin },
        f.adapters,
      ),
    ).rejects.toThrow("does not match");
    expect(await f.readConfig()).toContain("old-release");
    await checkLive(f.origin, await verifyRelease(f.store, "old-release"));
  });
  for (const outcome of [
    "success",
    "unpublish",
    "rejected",
    "lost-ack",
    "uncertain",
    "uncertain-restore",
    "usage-uncertain",
  ] as const) {
    it(`coordinates file activation with database promotion: ${outcome}`, async () => {
      const f = await fixture(),
        billing = outputBillingBoundary(),
        id = crypto.randomUUID(),
        owner = crypto.randomUUID();
      if (outcome === "usage-uncertain") billing.faults.settle = true;
      if (outcome === "unpublish") billing.faults.quota = true;
      const job: any = {
        id,
        status: "queued",
        rollback_of: null,
        previous_release_id: null,
        artifact_id: null,
        snapshot: { schemaVersion: 1, pages: [], site: null },
        request: { action: outcome === "unpublish" ? "unpublish" : "page" },
      };
      let loseReads = false;
      const phases: string[] = [];
      const client = {
        get: async () => {
          if (loseReads) throw new Error("Connection lost");
          return structuredClone(job);
        },
        rpc: async (name: string, body: any) => {
          if (name.startsWith("builder_repository_output_"))
            return billing.client.rpc(name, body);
          if (name === "builder_claim_release") {
            job.status = "building";
            job.worker_id = body.owner_id;
            job.artifact_id = body.artifact;
            return structuredClone(job);
          }
          if (name === "builder_release_recovery_begin") {
            expect(body.expected_owner).toBe(job.worker_id);
            expect(body.baseline_artifact).toBe("old-release");
            job.worker_id = body.recovery_owner;
            job.recovery_artifact = body.desired_artifact;
            return structuredClone(job);
          }
          if (name === "builder_release_recovery_finish") {
            expect(body.recovery_owner).toBe(job.worker_id);
            expect(body.proof.artifactId).toBe(job.recovery_artifact);
            await billing.client.rpc("builder_repository_output_settle", {
              ...billing.rows.get(body.usage_id).input,
              outcome: "live",
            });
            job.status =
              job.recovery_artifact === job.artifact_id
                ? "live"
                : "rolled_back";
            return {
              id,
              status: job.status,
              artifactId: job.recovery_artifact,
              usageId: body.usage_id,
            };
          }
          if (name !== "builder_advance_release")
            throw new Error("Unexpected RPC");
          if (body.phase === "live") {
            // The public HTML has already been checked and is serving the candidate before DB promotion.
            expect(
              await (await fetch(`${f.origin}/campaign/`)).text(),
            ).toContain("CMS snapshot new");
            expect(body.proof.artifactId).toBe("coordinated-release");
            expect(body.proof.checkedResponses).toBe(8);
            if (outcome === "rejected")
              throw new Error("Database refused promotion");
            if (outcome.startsWith("uncertain")) {
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
          commit: "b".repeat(40),
          source: f.next,
          sourceRoot: f.next,
          billing: { projectId: "kaizen", channel: "production" },
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
      } else if (outcome.includes("uncertain")) {
        await expect(run).rejects.toThrow("acknowledgement is uncertain");
        expect(job.status).toBe(
          outcome.startsWith("uncertain") ? "verifying" : "live",
        );
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
      expect(billing.rows.get(id).phase).toBe(
        outcome === "rejected"
          ? "failed"
          : outcome.includes("uncertain")
            ? "reserved"
            : "live",
      );
      if (outcome === "unpublish")
        expect(
          billing.calls.find(
            (call) => call.name === "builder_repository_output_begin",
          )!.body.recovery,
        ).toBe(true);
      if (outcome.includes("uncertain")) {
        loseReads = false;
        billing.faults.settle = false;
        const restore = outcome === "uncertain-restore";
        await reconcileBuilderRelease(
          {
            client,
            requestId: id,
            projectId: "kaizen",
            channel: "production",
            store: f.store,
            origin: f.origin,
            artifactId: "coordinated-release",
            restoreId: restore ? "old-release" : undefined,
            sourceRoot: f.next,
          },
          f.adapters,
        );
        const desired = restore ? "old-release" : "coordinated-release";
        expect(job.status).toBe(restore ? "rolled_back" : "live");
        expect((await listReleases(f.store)).selectedReleaseId).toBe(desired);
        await checkLive(f.origin, await verifyRelease(f.store, desired));
        expect(
          [...billing.rows.values()]
            .filter((row) => row.phase === "live")
            .map((row) => row.input.artifact),
        ).toEqual([desired]);
        expect(billing.rows.get(id).phase).toBe("failed");
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
    // Staging now shares this lock. Finish the synthetic lock case before
    // independently checking malformed source and retained-artifact guards.
    await rm(path.join(f.store, ".activation-lock"), { recursive: true });
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

function outputBillingBoundary() {
  const calls: { name: string; body: any }[] = [],
    rows = new Map<string, any>();
  const faults = { quota: false, lostBegin: false, settle: false };
  const client = {
    rpc: async (name: string, body: any) => {
      calls.push({ name, body: structuredClone(body) });
      if (name === "builder_repository_output_read") {
        const found = [...rows.values()]
          .reverse()
          .find((row) => row.input.artifact === body.artifact);
        return found
          ? {
              id: found.input.request_id,
              phase: found.phase,
              commit: found.input.source_commit,
              measurement: found.input.sample,
            }
          : null;
      }
      if (name === "builder_repository_output_begin") {
        if (faults.quota && !body.recovery)
          throw new Error("This website exceeds its current plan.");
        if (body.recovery)
          for (const row of rows.values())
            if (
              row.phase === "reserved" &&
              row.input.target === body.target &&
              row.input.output_channel === body.output_channel
            )
              row.phase = "held";
        rows.set(body.request_id, {
          input: structuredClone(body),
          phase: "reserved",
        });
        if (faults.lostBegin)
          throw new Error("Fixture reserve acknowledgement lost.");
        return { id: body.request_id, phase: "reserved" };
      }
      if (name === "builder_repository_output_settle") {
        if (faults.settle)
          throw new Error("Fixture billing service unavailable.");
        if (body.outcome === "live")
          for (const row of rows.values())
            if (
              row.phase === "held" &&
              row.input.target === body.target &&
              row.input.output_channel === body.output_channel
            )
              row.phase = "failed";
        rows.set(body.request_id, {
          input: structuredClone(body),
          phase: body.outcome,
        });
        return { id: body.request_id, phase: body.outcome };
      }
      throw new Error("Unexpected billing operation");
    },
  };
  return { client, calls, rows, faults };
}

describe("repository deployment output accounting", () => {
  it.each(["measured", "missing source", "mismatched record"])(
    "restores a retained artifact from before output accounting: %s",
    async (outcome) => {
      const f = await fixture(),
        billing = outputBillingBoundary();
      await activateRelease(
        { store: f.store, id: "new-release", origin: f.origin },
        f.adapters,
      );
      if (outcome === "mismatched record")
        billing.rows.set(crypto.randomUUID(), {
          input: {
            artifact: "old-release",
            source_commit: "c".repeat(40),
            sample: { manifestSha256: "0".repeat(64) },
          },
          phase: "live",
        });
      const run = reconcileRepositoryOutput(
        {
          client: billing.client,
          projectId: "kaizen",
          channel: "production",
          store: f.store,
          origin: f.origin,
          artifactId: "new-release",
          restoreId: "old-release",
          sourceRoot: outcome === "missing source" ? undefined : f.next,
        },
        f.adapters,
      );
      if (outcome !== "measured") {
        await expect(run).rejects.toThrow(
          outcome === "missing source"
            ? /source directory/
            : /does not match its recorded usage/,
        );
        expect((await listReleases(f.store)).selectedReleaseId).toBe(
          "new-release",
        );
        expect(billing.calls.map((call) => call.name)).toEqual([
          "builder_repository_output_read",
        ]);
        return;
      }
      await expect(run).resolves.toMatchObject({ status: "reconciled" });
      const begin = billing.calls.find(
        (call) => call.name === "builder_repository_output_begin",
      )!.body;
      expect(begin).toMatchObject({
        artifact: "old-release",
        source_commit: "c".repeat(40),
        recovery: true,
        sample: { pages: 4 },
      });
      expect(begin.sample.sourceBytes).toBeGreaterThan(0);
      expect(billing.rows.get(begin.request_id).phase).toBe("live");
      expect((await listReleases(f.store)).selectedReleaseId).toBe(
        "old-release",
      );
      await checkLive(f.origin, await verifyRelease(f.store, "old-release"));
    },
  );
  it.each([
    "success",
    "quota",
    "lost reservation",
    "reload failure",
    "lost live acknowledgement",
  ])("accounts for the actual retained artifact across %s", async (outcome) => {
    const f = await fixture(),
      billing = outputBillingBoundary(),
      artifactId = "billing-new-release";
    if (outcome === "quota") billing.faults.quota = true;
    if (outcome === "lost reservation") billing.faults.lostBegin = true;
    if (outcome === "reload failure") f.rejectReload();
    if (outcome === "lost live acknowledgement") billing.faults.settle = true;
    const options = {
      client: billing.client,
      store: f.store,
      origin: f.origin,
      artifactId,
      commit: "b".repeat(40),
      source: f.next,
      sourceRoot: f.next,
      build: async () => {},
      billing: { projectId: "kaizen", channel: "staging" },
    };
    const run = runRepositoryRelease(options, {
      activate: (input: any, hooks: any) =>
        activateRelease(input, { ...f.adapters, ...hooks }),
    });
    if (outcome === "success")
      await expect(run).resolves.toMatchObject({ status: "live" });
    else
      await expect(run).rejects.toThrow(
        outcome === "lost live acknowledgement"
          ? /usage acknowledgement is uncertain/
          : /activation failed/,
      );
    const begin = billing.calls.find(
      (call) => call.name === "builder_repository_output_begin",
    )!.body;
    const manifest = await verifyRelease(f.store, artifactId);
    expect(begin).toMatchObject({
      target: "kaizen",
      output_channel: "staging",
      artifact: artifactId,
      source_commit: "b".repeat(40),
      sample: { pages: 4 },
    });
    expect(begin.sample.bytes).toBe(
      manifest.files.reduce((sum: number, file: any) => sum + file.size, 0),
    );
    expect(begin.sample.manifestSha256).toBe(
      createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
    );
    expect(begin.sample.sourceBytes).toBeGreaterThan(0);
    if (outcome === "lost live acknowledgement") {
      expect((await listReleases(f.store)).selectedReleaseId).toBe(artifactId);
      expect(billing.rows.get(begin.request_id).phase).toBe("reserved");
      billing.faults.settle = false;
      await reconcileRepositoryOutput(
        {
          client: billing.client,
          projectId: "kaizen",
          channel: "staging",
          store: f.store,
          origin: f.origin,
          artifactId,
        },
        f.adapters,
      );
      expect(billing.rows.get(begin.request_id).phase).toBe("failed");
      expect(
        [...billing.rows.values()].filter((row) => row.phase === "live"),
      ).toHaveLength(1);
      await checkLive(f.origin, manifest);
    } else if (outcome === "success") {
      expect(billing.rows.get(begin.request_id).phase).toBe("live");
      await checkLive(f.origin, manifest);
    } else {
      expect(billing.rows.get(begin.request_id).phase).toBe("failed");
      expect((await listReleases(f.store)).selectedReleaseId).toBe(
        "old-release",
      );
      await checkLive(f.origin, await verifyRelease(f.store, "old-release"));
    }
  });
  it("refuses invalid fixed billing configuration before queueing a Builder deployment", async () => {
    let called = false;
    const client = {
      rpc: async () => {
        called = true;
        throw new Error("Must not queue");
      },
    };
    await expect(
      runBuilderRelease({
        client,
        billing: { projectId: "", channel: "production" },
      }),
    ).rejects.toThrow(/fixed website/);
    expect(called).toBe(false);
  });
  it("refuses output whose source changed during the build without switching the website", async () => {
    const f = await fixture(),
      billing = outputBillingBoundary();
    await expect(
      runRepositoryRelease(
        {
          client: billing.client,
          store: f.store,
          origin: f.origin,
          artifactId: "billing-new-release",
          commit: "b".repeat(40),
          source: f.next,
          sourceRoot: f.next,
          build: async () =>
            writeFile(
              path.join(f.next, "index.html"),
              "Changed source during build",
            ),
          billing: { projectId: "kaizen", channel: "staging" },
        },
        {
          activate: (input: any, hooks: any) =>
            activateRelease(input, { ...f.adapters, ...hooks }),
        },
      ),
    ).rejects.toThrow(/source changed/);
    expect(billing.calls).toEqual([]);
    expect((await listReleases(f.store)).selectedReleaseId).toBe("old-release");
  });
});

async function nativeReleaseFixture(
  beforeStage?: (old: string, next: string) => Promise<void>,
) {
  const f = await fixture(false, beforeStage);
  const billing = outputBillingBoundary();
  const directory = path.join(f.root, "native-journal");
  const sourceRoot = path.join(f.root, "source");
  await mkdir(sourceRoot);
  await writeFile(path.join(sourceRoot, "index.html"), "Fixture source");
  const git = promisify(execFile);
  const environment = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  for (const args of [
    ["init"],
    ["add", "."],
    [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-m",
      "Fixture source",
    ],
  ])
    await git("git", args, { cwd: sourceRoot, env: environment });
  const active = new Set<string>();
  const identities = new Map<string, any>();
  let assets: { projectId: string; assetId: string; url: string | null }[] = [];
  let finish: (() => Promise<void>) | undefined;
  const client = {
    rpc: async (name: string, args: any): Promise<any> => {
      if (!name.startsWith("builder_native_operation_"))
        return billing.client.rpc(name, args);
      if (name === "builder_native_operation_assets") {
        expect(active.has(args.request_id)).toBe(true);
        return { id: args.request_id, assets, cursor: null };
      }
      const identity = {
        id: args.request_id,
        workerId: args.worker,
        configuration: args.fingerprint,
        projectId: args.target,
        processId: args.process_id,
        host: args.host,
        instanceId: args.instance,
      };
      if (identities.has(identity.id))
        expect(identity).toEqual(identities.get(identity.id));
      else identities.set(identity.id, identity);
      if (name === "builder_native_operation_begin") {
        expect(args.actor).toBe(null);
        active.add(identity.id);
      } else {
        expect(name).toBe("builder_native_operation_end");
        expect(args.actor).toBeUndefined();
        await finish?.();
        active.delete(identity.id);
      }
      return {
        ...identity,
        phase: active.has(identity.id) ? "active" : "complete",
      };
    },
  };
  const native = new NativeOperationJournal({
    directory,
    workerId: "fixture-native-release",
    configuration: "b".repeat(64),
    connection: nativeWorkerConnection(client),
  });
  const options = {
    client,
    native,
    store: f.store,
    origin: f.origin,
    sourceRoot,
    source: f.next,
    artifactId: "native-new-release",
    commit: "b".repeat(40),
    billing: { projectId: "kaizen", channel: "staging" },
    build: async () => {},
  };
  const adapters = {
    activate: (input: any, hooks: any) =>
      activateRelease(input, { ...f.adapters, ...hooks }),
  };
  return {
    ...f,
    billing,
    native,
    directory,
    active,
    client,
    sourceRoot,
    options,
    releaseAdapters: adapters,
    retire: (url: string) => {
      assets = [{ projectId: "kaizen", assetId: crypto.randomUUID(), url }];
    },
    onEnd: (callback?: () => Promise<void>) => {
      finish = callback;
    },
  };
}

describe("native release file protection", () => {
  const url = "https://files.example.invalid/retired image.png";
  it("holds the actual release operation through HTTP verification, accounting and delayed completion", async () => {
    const f = await nativeReleaseFixture();
    let entered!: () => void, release!: () => void;
    const ending = new Promise<void>((resolve) => (entered = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    f.onEnd(async () => {
      entered();
      await gate;
    });
    let settled = false;
    const work = runRepositoryRelease(f.options, f.releaseAdapters).finally(
      () => {
        settled = true;
      },
    );
    try {
      await ending;
      expect(settled).toBe(false);
      expect(f.active.size).toBe(1);
      expect(await f.readConfig()).toContain("native-new-release");
      await checkLive(
        f.origin,
        await verifyRelease(f.store, "native-new-release"),
      );
      expect(
        [...f.billing.rows.values()].some((row) => row.phase === "live"),
      ).toBe(true);
    } finally {
      release();
    }
    await expect(work).resolves.toMatchObject({ status: "live" });
    expect(f.active.size).toBe(0);
    expect(await readdir(f.directory)).toEqual([]);
  });
  it("rejects retired references in generated compressed bytes before retaining or activating output", async () => {
    const f = await nativeReleaseFixture();
    f.retire(url);
    const before = await f.readConfig();
    await expect(
      runRepositoryRelease(
        {
          ...f.options,
          build: async () => {
            await writeFile(
              path.join(f.next, "extra.html.gz"),
              gzipSync(`<img src="${url}">`),
            );
          },
        },
        f.releaseAdapters,
      ),
    ).rejects.toThrow("being removed");
    expect(await f.readConfig()).toBe(before);
    await expect(
      readFile(path.join(f.store, "releases/native-new-release/release.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(f.active.size).toBe(0);
    await checkLive(f.origin, await verifyRelease(f.store, "old-release"));
  });
  it("rechecks the retained artifact before immutable assets or the serving include can change", async () => {
    const f = await nativeReleaseFixture();
    f.retire(url);
    const before = await f.readConfig();
    await expect(
      runRepositoryRelease(f.options, {
        ...f.releaseAdapters,
        stage: async (input: any) => {
          await writeFile(path.join(f.next, "late.html"), `<img src="${url}">`);
          return stageRelease(input);
        },
      }),
    ).rejects.toThrow("being removed");
    expect(await f.readConfig()).toBe(before);
    await expect(
      readFile(path.join(f.store, "immutable/_astro/new.hash.js")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(f.active.size).toBe(0);
  });
  it("refuses restoration of a valid older artifact containing a retired reference", async () => {
    const f = await nativeReleaseFixture(async (old) =>
      writeFile(path.join(old, "old-image.html"), `<img src="${url}">`),
    );
    await activateRelease(
      { store: f.store, id: "new-release", origin: f.origin },
      f.adapters,
    );
    f.retire(url);
    const before = await f.readConfig();
    await expect(
      reconcileRepositoryOutput(
        {
          native: f.native,
          client: f.client,
          projectId: "kaizen",
          channel: "production",
          store: f.store,
          origin: f.origin,
          artifactId: "new-release",
          restoreId: "old-release",
          sourceRoot: f.sourceRoot,
        },
        f.adapters,
      ),
    ).rejects.toThrow("being removed");
    expect(await f.readConfig()).toBe(before);
    expect(f.billing.calls).toEqual([]);
    expect(f.active.size).toBe(0);
    await checkLive(f.origin, await verifyRelease(f.store, "new-release"));
  });
  it("retains the operation when the build controller cannot confirm child cleanup", async () => {
    const f = await nativeReleaseFixture();
    await expect(
      runRepositoryRelease(
        {
          ...f.options,
          build: async () => {
            throw new SandboxCleanupError();
          },
        },
        f.releaseAdapters,
      ),
    ).rejects.toThrow("reconciliation");
    expect(f.active.size).toBe(1);
    const [file] = await readdir(f.directory);
    expect(
      JSON.parse(await readFile(path.join(f.directory, file), "utf8"))
        .localPhase,
    ).toBe("intent");
    expect(await f.native.recover()).toEqual({ completed: 0, deferred: 1 });
    expect(await f.readConfig()).toContain("old-release");
  });

  it("refuses a Builder rollback containing a retired reference without rebuilding or switching", async () => {
    const f = await nativeReleaseFixture(async (old) =>
      writeFile(path.join(old, "old-image.html"), `<img src="${url}">`),
    );
    await activateRelease(
      { store: f.store, id: "new-release", origin: f.origin },
      f.adapters,
    );
    f.retire(url);
    const before = await f.readConfig(),
      id = crypto.randomUUID();
    let built = false;
    const job: any = {
      id,
      status: "queued",
      rollback_of: crypto.randomUUID(),
      previous_release_id: null,
      artifact_id: "old-release",
    };
    const client = {
      get: async () => structuredClone(job),
      rpc: async (name: string, args: any) => {
        if (name === "builder_claim_release") {
          job.status = "building";
          return structuredClone(job);
        }
        if (name === "builder_advance_release") {
          job.status = args.phase;
          return {};
        }
        return f.client.rpc(name, args);
      },
    };
    await expect(
      runBuilderRelease(
        {
          ...f.options,
          requestId: id,
          client,
          billing: { projectId: "kaizen", channel: "production" },
          build: async () => {
            built = true;
          },
        },
        f.releaseAdapters,
      ),
    ).rejects.toThrow("being removed");
    expect(built).toBe(false);
    expect(await f.readConfig()).toBe(before);
    expect(f.active.size).toBe(0);
    expect(job.status).toBe("failed");
    await checkLive(f.origin, await verifyRelease(f.store, "new-release"));
  });
  it("reconciles lost native completion without rebuilding or reactivating the successful release", async () => {
    const f = await nativeReleaseFixture();
    let builds = 0;
    f.onEnd(async () => {
      throw Error("Fixture end unavailable");
    });
    await expect(
      runRepositoryRelease(
        {
          ...f.options,
          build: async () => {
            builds++;
          },
        },
        f.releaseAdapters,
      ),
    ).rejects.toThrow("end unavailable");
    const before = await listReleases(f.store);
    expect(before.selectedReleaseId).toBe("native-new-release");
    expect(f.active.size).toBe(1);
    f.onEnd();
    expect(await f.native.recover()).toEqual({ completed: 1, deferred: 0 });
    expect(builds).toBe(1);
    expect((await listReleases(f.store)).transactions).toEqual(
      before.transactions,
    );
  });
  it("refuses a retired snapshot before the Builder worker persists it or starts a build", async () => {
    const f = await nativeReleaseFixture();
    f.retire(url);
    const id = crypto.randomUUID();
    let built = false;
    const job: any = {
      id,
      status: "queued",
      rollback_of: null,
      previous_release_id: null,
      snapshot: { url },
    };
    const client = {
      get: async () => structuredClone(job),
      rpc: async (name: string, args: any) => {
        if (name === "builder_claim_release") {
          job.status = "building";
          job.artifact_id = args.artifact;
          return structuredClone(job);
        }
        if (name === "builder_advance_release") {
          job.status = args.phase;
          return {};
        }
        return f.client.rpc(name, args);
      },
    };
    await expect(
      runBuilderRelease(
        {
          ...f.options,
          requestId: id,
          client,
          billing: { projectId: "kaizen", channel: "production" },
          build: async () => {
            built = true;
          },
        },
        f.releaseAdapters,
      ),
    ).rejects.toThrow("being removed");
    expect(built).toBe(false);
    await expect(
      readFile(path.join(f.store, "requests", `${id}.json`)),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(job.status).toBe("failed");
    expect(f.active.size).toBe(0);
  });
});
