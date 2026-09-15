import { afterEach, expect, it } from "vitest";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { request } from "node:http";
import { once } from "node:events";
import {
  domainReleases,
  domainNginxConfig,
  verifyDomainRoute,
  DomainReleaseError,
  type DomainReleaseTarget,
} from "../../scripts/builder-domain-releases";
import { readClientDestinations } from "../../scripts/client-publication.mjs";
import {
  bindClientStore,
  activateRelease,
  checkLive,
  initialiseStore,
  nginxConfig,
  stageRelease,
  verifyRelease,
} from "../../scripts/kaizen-releases.mjs";

const roots: string[] = [];
const children: ChildProcess[] = [];
afterEach(async () => {
  for (const child of children.splice(0))
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "exit");
      child.kill("SIGTERM");
      await closed;
    }
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
const input = (): DomainReleaseTarget => ({
  domainId: randomUUID(),
  projectId: randomUUID(),
  hostname: "customer.fixture.co.uk",
  bindingKind: "client-primary",
  destinationId: randomUUID(),
});
const guard = async () => {};
const writeJson = (file: string, value: unknown) =>
  writeFile(file, JSON.stringify(value) + "\n");
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "kaizen-domain-releases-"));
  roots.push(root);
  const journalRoot = path.join(root, "private"),
    primaryStoresRoot = path.join(root, "stores"),
    configRoot = path.join(root, "config"),
    registryFile = path.join(configRoot, "destinations.json"),
    nginxFile = path.join(configRoot, "domains.conf");
  await mkdir(journalRoot, { mode: 0o700 });
  await mkdir(primaryStoresRoot, { mode: 0o755 });
  await mkdir(configRoot, { mode: 0o755 });
  await writeFile(registryFile, '{"schemaVersion":1,"destinations":[]}\n', {
    mode: 0o644,
  });
  let failReload = false,
    reloads = 0;
  const config = {
    journalRoot,
    primaryStoresRoot,
    registryFile,
    nginxFile,
    proxyPort: 8094,
    publicationUid: process.getuid!(),
    publicationGid: process.getgid!(),
    observe: async () => {},
    reload: async (expected: string) => {
      reloads++;
      expect(await readFile(nginxFile, "utf8")).toBe(expected);
      if (failReload) throw new Error("Untrusted process output");
    },
  };
  return {
    root,
    config,
    releases: domainReleases(config),
    registry: () => readClientDestinations(registryFile),
    binding: (item: DomainReleaseTarget) =>
      path.join(journalRoot, `release-${item.domainId}.json`),
    state: () =>
      readFile(path.join(journalRoot, "routes.json"), "utf8").then(JSON.parse),
    reloads: () => reloads,
    failReload: (value: boolean) => {
      failReload = value;
    },
  };
}
async function existing(
  f: Awaited<ReturnType<typeof fixture>>,
  native = false,
) {
  const source = path.join(f.root, "existing-source"),
    store = path.join(f.root, "existing-store");
  await mkdir(source);
  await writeFile(
    path.join(source, "index.html"),
    "<h1>Already published website</h1>",
  );
  await mkdir(path.join(source, "about"));
  await writeFile(
    path.join(source, "about/index.html"),
    "<h1>Published about page</h1>",
  );
  const client = native
    ? null
    : {
        projectId: randomUUID(),
        destinationId: randomUUID(),
        environment: "production",
        origin: "https://original.fixture.co.uk",
      };
  if (native) {
    await mkdir(path.join(source, "builder"));
    await writeFile(
      path.join(source, "builder/index.html"),
      "<h1>Builder</h1>",
    );
  } else await bindClientStore({ store, client });
  const manifest = await stageRelease({
    source,
    store,
    client,
    id: "published-one",
  });
  await initialiseStore({ store, id: manifest.id });
  await chmod(store, 0o755);
  const destination = client && { ...client, label: "Existing website", store };
  if (destination)
    await writeJson(f.config.registryFile, {
      schemaVersion: 1,
      destinations: [destination],
    });
  const item: DomainReleaseTarget = {
    ...input(),
    projectId: client?.projectId ?? "kaizen",
    destinationId: client?.destinationId ?? null,
    bindingKind: native ? "repository-alias" : "client-alias",
  };
  return { item, store, manifest, destination, source };
}

it("prepares only an empty holding page, registers it, and removes routing without deleting retained work", async () => {
  const f = await fixture(),
    item = input();
  const draft = path.join(f.root, "private-draft.json");
  await writeFile(draft, '{"text":"Not published"}');
  const prepared = await f.releases.prepare(item, null, guard);
  expect(prepared.manifest.client.origin).toBe(`https://${item.hostname}`);
  expect(prepared.artifactId).toBe(`domain-${item.domainId}`);
  expect(prepared.manifest.files.map((file) => file.path)).toEqual(
    expect.arrayContaining(["index.html", "robots.txt"]),
  );
  expect(
    await readFile(
      path.join(
        prepared.store,
        "releases",
        prepared.artifactId,
        "site/index.html",
      ),
      "utf8",
    ),
  ).toContain("This website is coming soon.");
  expect(await f.registry()).toEqual([]);
  await expect(lstat(f.config.nginxFile)).rejects.toHaveProperty(
    "code",
    "ENOENT",
  );
  await f.releases.route(item, true, prepared.artifactId, guard);
  expect(await f.registry()).toHaveLength(1);
  expect(await readFile(f.config.nginxFile, "utf8")).toContain(
    `include "${prepared.store}/active.conf"`,
  );
  expect((await lstat(f.binding(item))).mode & 0o777).toBe(0o600);
  expect((await lstat(f.config.registryFile)).mode & 0o777).toBe(0o644);
  const before = await readFile(
    path.join(prepared.store, "active.conf"),
    "utf8",
  );
  await f.releases.route(item, false, null, guard);
  expect(await f.registry()).toEqual([]);
  expect(await readFile(f.config.nginxFile, "utf8")).not.toContain(
    item.hostname,
  );
  expect(await readFile(path.join(prepared.store, "active.conf"), "utf8")).toBe(
    before,
  );
  expect(await verifyRelease(prepared.store, prepared.artifactId)).toEqual(
    prepared.manifest,
  );
  expect(await readFile(draft, "utf8")).toBe('{"text":"Not published"}');
  await f.releases.prepare(item, prepared.artifactId, guard);
  await f.releases.route(item, true, prepared.artifactId, guard);
  expect(await f.registry()).toHaveLength(1);
});

it.each([false, true])(
  "aliases preserve the existing client/native identity and origin (native=%s)",
  async (native) => {
    const f = await fixture(),
      old = await existing(f, native);
    const releases = domainReleases({
      ...f.config,
      ...(native
        ? {
            native: {
              projectId: "kaizen" as const,
              store: old.store,
              origin: "https://original.fixture.co.uk",
            },
          }
        : {}),
    });
    const originalRegistry = await f.registry(),
      originalInclude = await readFile(
        path.join(old.store, "active.conf"),
        "utf8",
      );
    const prepared = await releases.prepare(old.item, old.manifest.id, guard);
    expect(prepared.origin).toBe("https://original.fixture.co.uk");
    expect(prepared.manifest).toEqual(old.manifest);
    await releases.route(old.item, true, old.manifest.id, guard);
    expect(await f.registry()).toEqual(originalRegistry);
    await releases.route(old.item, false, null, guard);
    expect(await f.registry()).toEqual(originalRegistry);
    expect(await readFile(path.join(old.store, "active.conf"), "utf8")).toBe(
      originalInclude,
    );
    expect(await verifyRelease(old.store, old.manifest.id)).toEqual(
      old.manifest,
    );
  },
);

it("never resets a published primary to its holding page", async () => {
  const f = await fixture(),
    item = input(),
    first = await f.releases.prepare(item, null, guard);
  const source = path.join(f.root, "owner-published");
  await mkdir(source);
  await writeFile(
    path.join(source, "index.html"),
    "<h1>The owner's published page</h1>",
  );
  await stageRelease({
    source,
    store: first.store,
    id: "owner-published",
    client: first.manifest.client,
  });
  // Model the release engine's selected output; real activation is covered below.
  await writeFile(
    path.join(first.store, "active.conf"),
    nginxConfig(first.store, "owner-published", true),
  );
  await expect(f.releases.prepare(item, null, guard)).rejects.toBeInstanceOf(
    DomainReleaseError,
  );
  const current = await f.releases.prepare(item, "owner-published", guard);
  expect(current.artifactId).toBe("owner-published");
  await expect(
    f.releases.route(item, true, first.artifactId, guard),
  ).rejects.toBeInstanceOf(DomainReleaseError);
  await f.releases.route(item, true, current.artifactId, guard);
});

it("preserves unrelated destinations and refuses another project at the same hostname", async () => {
  const f = await fixture(),
    old = await existing(f),
    item = input();
  const first = await f.releases.prepare(item, null, guard);
  await f.releases.route(item, true, first.artifactId, guard);
  await expect(
    f.releases.prepare({ ...input(), hostname: item.hostname }, null, guard),
  ).rejects.toThrow();
  await expect(
    f.releases.route(
      { ...old.item, hostname: item.hostname },
      true,
      old.manifest.id,
      guard,
    ),
  ).rejects.toThrow();
  await f.releases.route(item, false, null, guard);
  expect(await f.registry()).toEqual([old.destination]);
  const replacement = { ...input(), hostname: item.hostname };
  const next = await f.releases.prepare(replacement, null, guard);
  expect(next.store).not.toBe(first.store);
  await f.releases.route(replacement, true, next.artifactId, guard);
  await expect(
    f.releases.route(item, true, first.artifactId, guard),
  ).rejects.toThrow();
  expect(await verifyRelease(first.store, first.artifactId)).toEqual(
    first.manifest,
  );
});

it("recovers an interrupted reload and lets removal supersede the incomplete enable", async () => {
  const f = await fixture(),
    item = input(),
    first = await f.releases.prepare(item, null, guard);
  f.failReload(true);
  await expect(
    f.releases.route(item, true, first.artifactId, guard),
  ).rejects.toMatchObject({ reason: "routing_failed" });
  expect((await f.state()).pending).not.toBeNull();
  f.failReload(false);
  await f.releases.route(item, true, first.artifactId, guard);
  expect((await f.state()).pending).toBeNull();
  f.failReload(true);
  await expect(
    f.releases.route(item, true, first.artifactId, guard),
  ).rejects.toThrow();
  f.failReload(false);
  await f.releases.route(item, false, null, guard);
  expect(await f.registry()).toEqual([]);
  expect((await f.state()).pending).toBeNull();
  expect(await verifyRelease(first.store, first.artifactId)).toEqual(
    first.manifest,
  );
});

it("retains the before-image when a second interruption occurs while superseding an update", async () => {
  const f = await fixture(),
    item = input(),
    first = await f.releases.prepare(item, null, guard);
  f.failReload(true);
  await expect(
    f.releases.route(item, true, first.artifactId, guard),
  ).rejects.toThrow();
  f.failReload(false);
  let calls = 0;
  await expect(
    f.releases.route(item, false, null, async () => {
      if (++calls === 3)
        throw new Error("Claim changed after new intent, before file writes");
    }),
  ).rejects.toThrow("Claim changed");
  await f.releases.route(item, false, null, guard);
  expect(await f.registry()).toEqual([]);
  expect(await readFile(f.config.nginxFile, "utf8")).not.toContain(
    item.hostname,
  );
});

it.each([3, 4, 5, 6, 7])(
  "recovers interruption at routing boundary %s using the same owned files",
  async (boundary) => {
    const f = await fixture(),
      item = input(),
      first = await f.releases.prepare(item, null, guard);
    let calls = 0;
    await expect(
      f.releases.route(item, true, first.artifactId, async () => {
        if (++calls === boundary)
          throw new Error("Interrupted routing operation");
      }),
    ).rejects.toThrow("Interrupted routing");
    expect((await f.state()).pending).not.toBeNull();
    await f.releases.route(item, true, first.artifactId, guard);
    expect((await f.state()).pending).toBeNull();
    expect(await f.registry()).toHaveLength(1);
    expect(await readFile(f.config.nginxFile, "utf8")).toContain(item.hostname);
    expect(await verifyRelease(first.store, first.artifactId)).toEqual(
      first.manifest,
    );
  },
);

it("detects external edits arriving after the ownership guard", async () => {
  const f = await fixture(),
    item = input(),
    first = await f.releases.prepare(item, null, guard);
  let calls = 0;
  const external = '{"schemaVersion":1,"destinations":[]}\n\n';
  await expect(
    f.releases.route(item, true, first.artifactId, async () => {
      if (++calls === 3) await writeFile(f.config.registryFile, external);
    }),
  ).rejects.toBeInstanceOf(DomainReleaseError);
  expect(await readFile(f.config.registryFile, "utf8")).toBe(external);
  expect(f.reloads()).toBe(0);
});

it("will not reconcile another domain's unresolved routing operation", async () => {
  const f = await fixture(),
    item = input(),
    first = await f.releases.prepare(item, null, guard);
  f.failReload(true);
  await expect(
    f.releases.route(item, true, first.artifactId, guard),
  ).rejects.toThrow();
  const state = await f.state();
  await expect(
    f.releases.route(
      { ...input(), hostname: "other.fixture.co.uk" },
      false,
      null,
      guard,
    ),
  ).rejects.toThrow();
  expect(await f.state()).toEqual(state);
  f.failReload(false);
  await f.releases.route(item, false, null, guard);
});

it.each(["registry", "nginx"])(
  "preserves external edits to %s instead of overwriting them",
  async (which) => {
    const f = await fixture(),
      item = input(),
      first = await f.releases.prepare(item, null, guard);
    await f.releases.route(item, true, first.artifactId, guard);
    const file =
      which === "registry" ? f.config.registryFile : f.config.nginxFile;
    const external = (await readFile(file, "utf8")) + "\n";
    await writeFile(file, external);
    await expect(
      f.releases.route(item, false, null, guard),
    ).rejects.toBeInstanceOf(DomainReleaseError);
    expect(await readFile(file, "utf8")).toBe(external);
  },
);

it("rejects revoked authority before setup and rechecks it before changing routing files", async () => {
  const f = await fixture(),
    item = input();
  await expect(
    f.releases.prepare(item, null, async () => {
      throw new Error("No ownership");
    }),
  ).rejects.toThrow("No ownership");
  await expect(lstat(f.binding(item))).rejects.toHaveProperty("code", "ENOENT");
  const first = await f.releases.prepare(item, null, guard);
  let count = 0;
  await expect(
    f.releases.route(item, true, first.artifactId, async () => {
      if (++count === 3) throw new Error("Ownership changed");
    }),
  ).rejects.toThrow("Ownership changed");
  expect(await f.registry()).toEqual([]);
  expect(f.reloads()).toBe(0);
  await f.releases.route(item, false, null, guard);
});

it.each(["directory", "symlink", "hardlink", "writable"])(
  "refuses a pre-existing primary store or unsafe registry (%s)",
  async (kind) => {
    const f = await fixture(),
      item = input();
    if (kind === "directory")
      await mkdir(
        path.join(f.config.primaryStoresRoot, `domain-${item.domainId}`),
      );
    else if (kind === "symlink") {
      await unlink(f.config.registryFile);
      await symlink("/dev/null", f.config.registryFile);
    } else if (kind === "hardlink")
      await link(f.config.registryFile, path.join(f.root, "other-link"));
    else await chmod(f.config.registryFile, 0o666);
    await expect(f.releases.prepare(item, null, guard)).rejects.toThrow();
    await expect(lstat(f.binding(item))).rejects.toHaveProperty(
      "code",
      "ENOENT",
    );
  },
);

it("refuses changed alias ownership and corrupted retained release bytes", async () => {
  const f = await fixture(),
    old = await existing(f);
  await expect(
    f.releases.prepare(
      { ...old.item, projectId: randomUUID() },
      old.manifest.id,
      guard,
    ),
  ).rejects.toThrow();
  await f.releases.prepare(old.item, old.manifest.id, guard);
  await writeFile(
    path.join(old.store, "releases", old.manifest.id, "site/index.html"),
    "<h1>Changed outside publication</h1>",
  );
  await expect(
    f.releases.route(old.item, true, old.manifest.id, guard),
  ).rejects.toThrow();
  expect(f.reloads()).toBe(0);
});

it("allows an unprovisioned removal without inventing a store or destination", async () => {
  const f = await fixture(),
    item = input();
  await expect(
    f.releases.route(item, false, null, guard),
  ).resolves.toMatchObject({ routingRemoved: true });
  expect(await f.registry()).toEqual([]);
  await expect(lstat(f.binding(item))).rejects.toHaveProperty("code", "ENOENT");
});

it("refuses active process locks and does not guess from elapsed time", async () => {
  const f = await fixture(),
    item = input(),
    lock = path.join(f.config.journalRoot, "routes.lock");
  await mkdir(lock);
  await writeJson(path.join(lock, "owner.json"), {
    pid: process.pid,
    host: os.hostname(),
    createdAt: "2000-01-01",
  });
  await expect(f.releases.prepare(item, null, guard)).rejects.toThrow(
    "still running",
  );
  expect(await lstat(lock)).toBeTruthy();
});

it("recovers a global lock only after the actual owning process has exited", async () => {
  const f = await fixture(),
    item = input(),
    lock = path.join(f.config.journalRoot, "routes.lock");
  const child = spawn(process.execPath, ["-e", "process.stdin.resume()"], {
    stdio: ["pipe", "ignore", "ignore"],
  });
  children.push(child);
  await once(child, "spawn");
  await mkdir(lock);
  await writeJson(path.join(lock, "owner.json"), {
    pid: child.pid,
    host: os.hostname(),
  });
  await expect(f.releases.prepare(item, null, guard)).rejects.toThrow(
    "still running",
  );
  const closed = once(child, "exit");
  child.stdin!.end();
  await closed;
  await expect(f.releases.prepare(item, null, guard)).resolves.toMatchObject({
    artifactId: `domain-${item.domainId}`,
  });
  await expect(lstat(lock)).rejects.toHaveProperty("code", "ENOENT");
});

it("keeps private journals and configuration outside serving stores", async () => {
  const f = await fixture();
  for (const change of [
    { journalRoot: path.join(f.config.primaryStoresRoot, "private") },
    { nginxFile: path.join(f.config.primaryStoresRoot, "domains.conf") },
    {
      registryFile: path.join(f.config.primaryStoresRoot, "destinations.json"),
    },
    {
      native: {
        projectId: "kaizen" as const,
        store: f.config.journalRoot,
        origin: "https://original.fixture.co.uk",
      },
    },
  ])
    expect(() => domainReleases({ ...f.config, ...change })).toThrow();
});

it("rejects host/path injection and unsupported routing identities", () => {
  const item = input(),
    route = { ...item, store: "/var/lib/retained/one" };
  for (const update of [
    { hostname: "*.fixture.co.uk" },
    { hostname: "x; return 200;" },
    { store: '/tmp/"; include /tmp/other;' },
    { store: "/tmp/$host" },
    { destinationId: randomUUID(), bindingKind: "repository-alias" },
  ]) {
    expect(() =>
      domainNginxConfig([{ ...route, ...update } as any], 8094),
    ).toThrow();
  }
  expect(() =>
    domainNginxConfig([route, { ...route, domainId: randomUUID() }], 8094),
  ).toThrow();
  expect(() => domainNginxConfig([route], 80)).toThrow();
});

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as any).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
function get(port: number, host: string, pathname: string) {
  return new Promise<{ status: number; body: string; headers: any }>(
    (resolve, reject) => {
      const req = request(
        {
          hostname: "127.0.0.1",
          port,
          path: pathname,
          headers: { Host: host, Connection: "close" },
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (part) => {
            body += part;
          });
          res.on("end", () =>
            resolve({ status: res.statusCode!, body, headers: res.headers }),
          );
        },
      );
      req.on("error", reject);
      req.setTimeout(3000, () =>
        req.destroy(new Error("Fixture HTTP deadline")),
      );
      req.end();
    },
  );
}

it.runIf(Boolean(process.env.KAIZEN_NGINX_BINARY))(
  "serves primary and alias bytes through real Nginx, then withdraws only their hosts",
  async () => {
    const f = await fixture(),
      old = await existing(f),
      item = { ...input(), hostname: "new.fixture.co.uk" },
      port = await freePort();
    const binary = process.env.KAIZEN_NGINX_BINARY!,
      run = promisify(execFile);
    await mkdir(path.join(f.root, "logs"));
    await mkdir(path.join(f.root, "temp"));
    await writeFile(f.config.nginxFile, domainNginxConfig([], port), {
      mode: 0o644,
    });
    const configuration = path.join(f.root, "nginx.conf");
    await writeFile(
      configuration,
      `daemon off; master_process on; worker_processes 1; pid logs/nginx.pid; error_log logs/error.log; events {worker_connections 128;} http {types {text/html html; application/json json;} access_log off; keepalive_timeout 0; client_body_temp_path temp/body; proxy_temp_path temp/proxy; fastcgi_temp_path temp/fastcgi; uwsgi_temp_path temp/uwsgi; scgi_temp_path temp/scgi; include "${f.config.nginxFile}";}`,
    );
    await run(binary, ["-p", f.root + "/", "-c", configuration, "-t"]);
    const child = spawn(binary, ["-p", f.root + "/", "-c", configuration], {
      stdio: "ignore",
    });
    children.push(child);
    await expect
      .poll(
        async () =>
          (
            await get(port, "unmapped.fixture.co.uk", "/").catch(() => ({
              status: 0,
            }))
          ).status,
      )
      .toBe(404);
    const releases = domainReleases({
      ...f.config,
      proxyPort: port,
      observe: undefined,
      reload: async () => {
        await run(binary, ["-p", f.root + "/", "-c", configuration, "-t"]);
        child.kill("SIGHUP");
      },
    });
    const first = await releases.prepare(item, null, guard);
    await releases.route(item, true, first.artifactId, guard);
    await releases.prepare(old.item, old.manifest.id, guard);
    await releases.route(old.item, true, old.manifest.id, guard);
    await expect
      .poll(async () => (await get(port, item.hostname, "/")).body)
      .toContain("This website is coming soon.");
    await expect
      .poll(async () => (await get(port, old.item.hostname, "/about/")).body)
      .toContain("Published about page");
    const marker = await get(
      port,
      old.item.hostname,
      "/.well-known/kaizen-release.json",
    );
    expect(JSON.parse(marker.body).client).toEqual(old.manifest.client);
    expect(marker.headers["x-kaizen-release"]).toBe(old.manifest.id);
    await expect(
      verifyDomainRoute("wrong.fixture.co.uk", port, old.manifest),
    ).rejects.toMatchObject({ reason: "routing_failed" });
    await expect(
      verifyDomainRoute(old.item.hostname, port, null),
    ).rejects.toMatchObject({ reason: "routing_failed" });
    expect((await get(port, "www." + item.hostname, "/")).status).toBe(404);
    expect((await get(port, item.hostname, "/.env")).status).toBe(403);
    expect((await get(port, old.item.hostname, "/does-not-exist")).status).toBe(
      404,
    );
    const publishedSource = path.join(f.root, "published-source");
    await mkdir(publishedSource);
    await writeFile(
      path.join(publishedSource, "index.html"),
      "<h1>Owner chose to publish this website</h1>",
    );
    await stageRelease({
      source: publishedSource,
      store: first.store,
      id: "owner-publication",
      client: first.manifest.client,
    });
    const published = await activateRelease(
      { store: first.store, id: "owner-publication", origin: first.origin },
      {
        validateConfig: () =>
          run(binary, ["-p", f.root + "/", "-c", configuration, "-t"]),
        reload: async () => {
          child.kill("SIGHUP");
        },
        checkLive: (origin, manifest) =>
          checkLive(origin, manifest, {
            fetcher: async (url) => {
              const response = await get(
                port,
                new URL(url).hostname,
                new URL(url).pathname + new URL(url).search,
              );
              return new Response(response.body, {
                status: response.status,
                headers: response.headers,
              });
            },
          }),
      },
    );
    expect(published.status).toBe("live");
    expect((await get(port, item.hostname, "/")).body).toContain(
      "Owner chose to publish",
    );
    await expect(
      releases.prepare(item, "owner-publication", guard),
    ).resolves.toMatchObject({ artifactId: "owner-publication" });
    await releases.route(item, false, null, guard);
    await expect
      .poll(async () => (await get(port, item.hostname, "/")).status)
      .toBe(404);
    expect((await get(port, old.item.hostname, "/")).body).toContain(
      "Already published website",
    );
    await releases.route(old.item, false, null, guard);
    await expect
      .poll(async () => (await get(port, old.item.hostname, "/")).status)
      .toBe(404);
    expect(await f.registry()).toEqual([old.destination]);
    expect(await verifyRelease(first.store, first.artifactId)).toEqual(
      first.manifest,
    );
    expect(await verifyRelease(old.store, old.manifest.id)).toEqual(
      old.manifest,
    );
  },
  30000,
);
