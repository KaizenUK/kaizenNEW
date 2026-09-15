/** Domain routes reuse retained release stores; no project source or draft is read. */
import { constants } from "node:fs";
import {
  chown,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { request } from "node:http";
import { normalizeDomainHostname } from "../shared/builderDomains";
import { validateClientDestinations } from "./client-publication.mjs";
import {
  bindClientStore,
  initialiseStore,
  listReleases,
  stageRelease,
  verifyRelease,
} from "./kaizen-releases.mjs";
import { releaseEvidence } from "./builder-release-worker.mjs";
import { inspectProcessLock, withRecoveryLock } from "./release-recovery.mjs";
import type { DomainIdentity } from "./builder-domain-provider";

export class DomainReleaseError extends Error {
  constructor(
    public reason:
      | "configuration_changed"
      | "routing_failed" = "configuration_changed",
  ) {
    super("The domain's retained release and routing could not be confirmed.");
    this.name = "DomainReleaseError";
  }
}
export type DomainReleaseTarget = DomainIdentity & {
  bindingKind: "client-primary" | "client-alias" | "repository-alias";
  destinationId: string | null;
};
type Destination = {
  projectId: string;
  destinationId: string;
  environment: "production";
  origin: string;
  label: string;
  store: string;
};
type Binding = DomainReleaseTarget & {
  schemaVersion: 1;
  store: string;
  origin: string;
  destination: Destination | null;
  prepared: boolean;
};
type Route = DomainReleaseTarget & { store: string };
type Pending = {
  target: DomainReleaseTarget;
  registry: string;
  nginx: string;
  routes: Route[];
};
type State = {
  schemaVersion: 1;
  registrySha: string;
  nginxSha: string | null;
  routes: Route[];
  pending: Pending | null;
};
type Config = {
  /** Existing private directory for durable ownership and interrupted updates. */
  journalRoot: string;
  primaryStoresRoot: string;
  registryFile: string;
  /** A dedicated include inside Nginx's http block, separate from other sites. */
  nginxFile: string;
  proxyPort: number;
  publicationUid: number;
  publicationGid: number;
  native?: { projectId: "kaizen"; store: string; origin: string };
  /** Test, reload and confirm the configured Nginx process. HTTPS is checked later. */
  reload: (expectedInclude: string) => Promise<void>;
  /** Isolated test harness only. Production verifies the fixed loopback listener. */
  observe?: (
    hostname: string,
    port: number,
    manifest: any | null,
  ) => Promise<void>;
};
type Guard = () => Promise<void>;
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const bad = () => new DomainReleaseError();
const json = (value: unknown) => JSON.stringify(value) + "\n";
const identityKeys = [
  "domainId",
  "projectId",
  "hostname",
  "bindingKind",
  "destinationId",
] as const;

function target(value: DomainReleaseTarget): DomainReleaseTarget {
  if (
    !value ||
    !uuid.test(value.domainId) ||
    normalizeDomainHostname(value.hostname) !== value.hostname ||
    !["client-primary", "client-alias", "repository-alias"].includes(
      value.bindingKind,
    ) ||
    (value.bindingKind === "repository-alias"
      ? value.projectId !== "kaizen" || value.destinationId !== null
      : !uuid.test(value.projectId) || !uuid.test(value.destinationId))
  )
    throw bad();
  return Object.fromEntries(
    identityKeys.map((key) => [key, value[key]]),
  ) as DomainReleaseTarget;
}
function sameTarget(a: DomainReleaseTarget, b: DomainReleaseTarget) {
  return identityKeys.every((key) => a[key] === b[key]);
}
function safePath(value: string) {
  if (
    typeof value !== "string" ||
    !path.isAbsolute(value) ||
    path.normalize(value) !== value ||
    value === path.parse(value).root ||
    /[\x00-\x1f"$\\]/.test(value)
  )
    throw bad();
  return value;
}
async function ordinaryDirectory(directory: string, privateDirectory = false) {
  safePath(directory);
  const stat = await lstat(directory);
  if (
    !stat.isDirectory() ||
    stat.mode & 0o022 ||
    (await realpath(directory)) !== directory ||
    (privateDirectory && (stat.uid !== process.getuid?.() || stat.mode & 0o077))
  )
    throw bad();
}
async function readOwned(
  file: string,
  privateFile = false,
): Promise<string | null> {
  const stat = await lstat(file).catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (!stat) return null;
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.mode & 0o022 ||
    stat.uid !== process.getuid?.() ||
    stat.size > 1024 * 1024 ||
    (privateFile && stat.mode & 0o077)
  )
    throw bad();
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = await handle.stat();
    if (
      current.ino !== stat.ino ||
      current.dev !== stat.dev ||
      current.size > 1024 * 1024
    )
      throw bad();
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}
async function durableWrite(file: string, text: string, mode: number) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", mode);
  try {
    await handle.writeFile(text);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, file);
    const parent = await open(
      path.dirname(file),
      constants.O_RDONLY | constants.O_DIRECTORY,
    );
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  } finally {
    await unlink(temporary).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}

/** Exact hosts only, behind Apache on a separate loopback listener. */
export function domainNginxConfig(routes: Route[], port: number): string {
  if (
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    routes.length > 100
  )
    throw bad();
  const hosts = new Set<string>(),
    ids = new Set<string>();
  const blocks = [...routes]
    .sort((a, b) => a.hostname.localeCompare(b.hostname))
    .map((route) => {
      const item = target(route);
      safePath(route.store);
      if (hosts.has(item.hostname) || ids.has(item.domainId)) throw bad();
      hosts.add(item.hostname);
      ids.add(item.domainId);
      return [
        `# kaizen-domain-v1 ${item.domainId} ${item.projectId}`,
        "server {",
        `  listen 127.0.0.1:${port};`,
        `  server_name ${item.hostname};`,
        "  server_tokens off;",
        "  port_in_redirect off;",
        "  absolute_redirect off;",
        "  index index.html;",
        `  include "${route.store}/active.conf";`,
        "  location / { try_files $uri $uri/ $uri.html =404; }",
        "  location ~ /\\.(?!well-known/) { deny all; }",
        "}",
      ].join("\n");
    });
  return [
    "# Kaizen domain routes v1 — managed by the domain worker",
    `server { listen 127.0.0.1:${port} default_server; server_name _; return 404; }`,
    ...blocks,
    "",
  ].join("\n");
}

/** A successful reload alone is insufficient: confirm the new worker serves the
 * exact marker, or that the removed host reaches only the default 404 server. */
export async function verifyDomainRoute(
  hostname: string,
  port: number,
  manifest: any | null,
): Promise<void> {
  if (
    normalizeDomainHostname(hostname) !== hostname ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
  )
    throw bad();
  const marker = manifest?.files?.find(
    (file) => file.path === ".well-known/kaizen-release.json",
  );
  if (manifest && (!marker || !/^[a-f0-9]{64}$/.test(marker.sha256)))
    throw bad();
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const observed = await new Promise<{
        status: number;
        release: string | string[];
        bytes: Buffer;
      }>((resolve, reject) => {
        const req = request(
          {
            hostname: "127.0.0.1",
            port,
            path: `/.well-known/kaizen-release.json?domain-route-check=${randomUUID()}`,
            agent: false,
            headers: {
              Host: hostname,
              Connection: "close",
              "Cache-Control": "no-cache",
            },
          },
          async (response) => {
            try {
              let size = 0;
              const chunks: Buffer[] = [];
              for await (const chunk of response) {
                size += chunk.length;
                if (size > 65536)
                  throw new DomainReleaseError("routing_failed");
                chunks.push(Buffer.from(chunk));
              }
              resolve({
                status: response.statusCode,
                release: response.headers["x-kaizen-release"],
                bytes: Buffer.concat(chunks),
              });
            } catch (error) {
              response.destroy();
              req.destroy();
              reject(error);
            }
          },
        );
        const deadline = setTimeout(
          () => req.destroy(new DomainReleaseError("routing_failed")),
          2000,
        );
        req.once("close", () => clearTimeout(deadline));
        req.once("error", reject);
        req.end();
      });
      if (
        manifest
          ? observed.status !== 200 ||
            observed.release !== manifest.id ||
            createHash("sha256").update(observed.bytes).digest("hex") !==
              marker.sha256
          : observed.status !== 404 || Boolean(observed.release)
      )
        throw new DomainReleaseError("routing_failed");
      return;
    } catch {
      if (attempt === 7) throw new DomainReleaseError("routing_failed");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

/** A global journal serializes registry/include changes; per-domain journals own stores. */
export function domainReleases(config: Config) {
  for (const value of [
    config.journalRoot,
    config.primaryStoresRoot,
    config.registryFile,
    config.nginxFile,
  ])
    safePath(value);
  if (
    config.registryFile === config.nginxFile ||
    ![config.publicationUid, config.publicationGid].every(
      (n) => Number.isInteger(n) && n >= 0,
    )
  )
    throw bad();
  domainNginxConfig([], config.proxyPort);
  if (config.native) {
    safePath(config.native.store);
    if (
      config.native.projectId !== "kaizen" ||
      new URL(config.native.origin).origin !== config.native.origin ||
      new URL(config.native.origin).protocol !== "https:"
    )
      throw bad();
  }
  const overlaps = (a: string, b: string) =>
    a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
  for (const store of [
    config.primaryStoresRoot,
    ...(config.native ? [config.native.store] : []),
  ]) {
    if (
      [config.journalRoot, config.registryFile, config.nginxFile].some(
        (privatePath) => overlaps(store, privatePath),
      )
    )
      throw bad();
  }
  const bindingFile = (item: DomainReleaseTarget) =>
    path.join(config.journalRoot, `release-${item.domainId}.json`);
  const stateFile = path.join(config.journalRoot, "routes.json");
  const locked = async <T>(
    guard: Guard,
    operation: () => Promise<T>,
  ): Promise<T> => {
    await ordinaryDirectory(config.journalRoot, true);
    for (const directory of [
      config.primaryStoresRoot,
      path.dirname(config.registryFile),
      path.dirname(config.nginxFile),
    ])
      await ordinaryDirectory(directory);
    return withRecoveryLock(
      path.join(config.journalRoot, "routes.lock"),
      async () => {
        await guard();
        return operation();
      },
    );
  };
  const saveBinding = (binding: Binding) =>
    durableWrite(bindingFile(binding), json(binding), 0o600);
  const loadBinding = async (
    item: DomainReleaseTarget,
  ): Promise<Binding | null> => {
    const text = await readOwned(bindingFile(item), true);
    if (text === null) return null;
    const binding = JSON.parse(text) as Binding;
    if (
      Object.keys(binding).sort().join(",") !==
        "bindingKind,destination,destinationId,domainId,hostname,origin,prepared,projectId,schemaVersion,store" ||
      binding.schemaVersion !== 1 ||
      typeof binding.prepared !== "boolean" ||
      !sameTarget(target(binding), item)
    )
      throw bad();
    safePath(binding.store);
    if (
      [config.journalRoot, config.registryFile, config.nginxFile].some(
        (privatePath) => overlaps(binding.store, privatePath),
      )
    )
      throw bad();
    if (item.bindingKind === "repository-alias") {
      if (
        !config.native ||
        binding.destination !== null ||
        binding.store !== config.native.store ||
        binding.origin !== config.native.origin
      )
        throw bad();
    } else {
      const [destination] = await validateClientDestinations({
        schemaVersion: 1,
        destinations: [binding.destination],
      });
      if (
        destination.projectId !== item.projectId ||
        destination.destinationId !== item.destinationId ||
        destination.environment !== "production" ||
        destination.store !== binding.store ||
        destination.origin !== binding.origin ||
        (item.bindingKind === "client-primary" &&
          (binding.store !==
            path.join(config.primaryStoresRoot, `domain-${item.domainId}`) ||
            binding.origin !== `https://${item.hostname}`))
      )
        throw bad();
    }
    return binding;
  };
  const currentRegistry = async () => {
    const text = await readOwned(config.registryFile);
    if (text === null) throw bad();
    return {
      text,
      entries: (await validateClientDestinations(
        JSON.parse(text),
      )) as Destination[],
    };
  };
  const checkSelected = async (
    binding: Binding,
    expectedArtifactId: string,
  ) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(expectedArtifactId))
      throw bad();
    await ordinaryDirectory(binding.store);
    const selected = await listReleases(binding.store);
    if (selected.selectedReleaseId !== expectedArtifactId) throw bad();
    const manifest = await verifyRelease(binding.store, expectedArtifactId);
    const client = binding.destination && {
      projectId: binding.projectId,
      destinationId: binding.destinationId,
      environment: "production",
      origin: binding.origin,
    };
    if (client ? !same(manifest.client, client) : Boolean(manifest.client))
      throw bad();
    return {
      store: binding.store,
      origin: binding.origin,
      manifest,
      ...releaseEvidence(manifest),
    };
  };
  const prepare = async (
    input: DomainReleaseTarget,
    expectedArtifactId: string | null,
    guard: Guard,
  ) => {
    const item = target(input);
    return locked(guard, async () => {
      let binding = await loadBinding(item);
      const registry = await currentRegistry();
      if (!binding) {
        let destination: Destination | null;
        if (item.bindingKind === "repository-alias") {
          if (!config.native) throw bad();
          destination = null;
        } else if (item.bindingKind === "client-alias") {
          destination = registry.entries.find(
            (d) =>
              d.destinationId === item.destinationId &&
              d.projectId === item.projectId &&
              d.environment === "production",
          );
          if (!destination || !destination.origin.startsWith("https://"))
            throw bad();
        } else {
          destination = {
            projectId: item.projectId,
            destinationId: item.destinationId,
            environment: "production",
            origin: `https://${item.hostname}`,
            label: item.hostname,
            store: path.join(
              config.primaryStoresRoot,
              `domain-${item.domainId}`,
            ),
          };
          // Persist ownership BEFORE creating a store. Never adopt a pre-existing one.
          if (
            await lstat(destination.store).catch((e) => {
              if (e.code === "ENOENT") return null;
              throw e;
            })
          )
            throw bad();
          await validateClientDestinations({
            schemaVersion: 1,
            destinations: [...registry.entries, destination],
          });
        }
        binding = {
          ...item,
          schemaVersion: 1,
          destination,
          prepared: false,
          store: destination?.store ?? config.native.store,
          origin: destination?.origin ?? config.native.origin,
        };
        if (
          [config.journalRoot, config.registryFile, config.nginxFile].some(
            (privatePath) => overlaps(binding.store, privatePath),
          )
        )
          throw bad();
        await guard();
        await saveBinding(binding);
      }
      if (
        item.bindingKind === "client-alias" &&
        !registry.entries.some((d) => same(d, binding.destination))
      )
        throw bad();
      const baseline = `domain-${item.domainId}`;
      const expected =
        expectedArtifactId ??
        (item.bindingKind === "client-primary" ? baseline : null);
      if (!expected) throw bad();
      if (item.bindingKind === "client-primary" && !binding.prepared) {
        if (expected !== baseline) throw bad();
        await guard();
        await mkdir(binding.store, { recursive: true, mode: 0o755 });
        await ordinaryDirectory(binding.store);
        // A failed initial bind/init can leave its engine lock. Recovery proves its
        // process stopped; it never discards a publication job's transaction lock.
        const lock = path.join(binding.store, ".activation-lock");
        if (await inspectProcessLock(lock))
          await withRecoveryLock(lock, async (owner) => {
            await guard();
            if (owner.jobId) throw bad();
          });
        await bindClientStore({
          store: binding.store,
          client: {
            projectId: item.projectId,
            destinationId: item.destinationId,
            environment: "production",
            origin: binding.origin,
          },
        });
        if (
          !(await lstat(path.join(binding.store, "releases", baseline)).catch(
            (e) => {
              if (e.code === "ENOENT") return null;
              throw e;
            },
          ))
        ) {
          const source = await mkdtemp(
            path.join(config.journalRoot, "holding-page-"),
          );
          try {
            await writeFile(
              path.join(source, "index.html"),
              '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Website coming soon</title></head><body><main><h1>This website is coming soon.</h1></main></body></html>',
            );
            await writeFile(
              path.join(source, "robots.txt"),
              "User-agent: *\nDisallow: /\n",
            );
            await guard();
            await stageRelease({
              source,
              store: binding.store,
              id: baseline,
              client: {
                projectId: item.projectId,
                destinationId: item.destinationId,
                environment: "production",
                origin: binding.origin,
              },
            });
          } finally {
            await rm(source, { recursive: true, force: true });
          }
        }
        const current = await listReleases(binding.store);
        if (!current.selectedReleaseId) {
          await guard();
          await initialiseStore({ store: binding.store, id: baseline });
        }
        await checkSelected(binding, baseline);
        // Only the new empty baseline is assigned to the configured publication
        // account. Existing published stores never undergo recursive ownership changes.
        const assign = async (file: string) => {
          const stat = await lstat(file);
          if (
            stat.isSymbolicLink() ||
            (!stat.isFile() && !stat.isDirectory()) ||
            (stat.isFile() && stat.nlink !== 1) ||
            ![process.getuid?.(), config.publicationUid].includes(stat.uid)
          )
            throw bad();
          if (stat.isDirectory())
            for (const name of await readdir(file))
              await assign(path.join(file, name));
          await chown(file, config.publicationUid, config.publicationGid);
        };
        await guard();
        await assign(binding.store);
        await chmod(binding.store, 0o755);
      }
      const verified = await checkSelected(binding, expected);
      await guard();
      if (!binding.prepared) {
        binding.prepared = true;
        await saveBinding(binding);
      }
      return verified;
    });
  };
  const route = async (
    input: DomainReleaseTarget,
    enabled: boolean,
    expectedArtifactId: string | null,
    guard: Guard,
  ) => {
    const item = target(input);
    return locked(guard, async () => {
      const binding = await loadBinding(item);
      if (enabled && (!binding?.prepared || !expectedArtifactId)) throw bad();
      const verified = enabled
        ? await checkSelected(binding, expectedArtifactId)
        : null;
      const registry = await currentRegistry();
      const currentNginx = await readOwned(config.nginxFile);
      const text = await readOwned(stateFile, true);
      let state: State;
      if (text === null) {
        if (
          currentNginx !== null &&
          currentNginx !== domainNginxConfig([], config.proxyPort)
        )
          throw bad();
        state = {
          schemaVersion: 1,
          registrySha: sha(registry.text),
          nginxSha: currentNginx === null ? null : sha(currentNginx),
          routes: [],
          pending: null,
        };
      } else {
        state = JSON.parse(text);
        if (
          Object.keys(state).sort().join(",") !==
            "nginxSha,pending,registrySha,routes,schemaVersion" ||
          state.schemaVersion !== 1 ||
          !/^[a-f0-9]{64}$/.test(state.registrySha) ||
          !(state.nginxSha === null || /^[a-f0-9]{64}$/.test(state.nginxSha))
        )
          throw bad();
        domainNginxConfig(state.routes, config.proxyPort);
      }
      // A retry accepts only the exact pre-update or intended bytes. A newer
      // remove/pause for this domain supersedes its interrupted enable operation.
      if (state.pending) {
        if (
          !sameTarget(target(state.pending.target), item) ||
          state.pending.nginx !==
            domainNginxConfig(state.pending.routes, config.proxyPort)
        )
          throw bad();
        await validateClientDestinations(JSON.parse(state.pending.registry));
      }
      const actualNginxSha = currentNginx === null ? null : sha(currentNginx);
      if (
        ![
          state.registrySha,
          ...(state.pending ? [sha(state.pending.registry)] : []),
        ].includes(sha(registry.text)) ||
        ![
          state.nginxSha,
          ...(state.pending ? [sha(state.pending.nginx)] : []),
        ].includes(actualNginxSha)
      )
        throw bad();
      const previousRoutes = state.pending?.routes ?? state.routes;
      if (
        !binding &&
        (previousRoutes.some((d) => d.domainId === item.domainId) ||
          (item.bindingKind === "client-primary" &&
            registry.entries.some(
              (d) => d.destinationId === item.destinationId,
            )))
      )
        throw bad();
      for (const previous of previousRoutes) {
        if (previous.domainId === item.domainId && !sameTarget(previous, item))
          throw bad();
        if (
          enabled &&
          previous.domainId !== item.domainId &&
          previous.hostname === item.hostname
        )
          throw bad();
      }
      let entries = registry.entries;
      if (item.bindingKind === "client-primary" && binding) {
        const existing = entries.find(
          (d) => d.destinationId === item.destinationId,
        );
        if (existing && !same(existing, binding.destination)) throw bad();
        entries = entries.filter((d) => d.destinationId !== item.destinationId);
        if (enabled) entries.push(binding.destination);
      } else if (
        enabled &&
        item.bindingKind === "client-alias" &&
        !entries.some((d) => same(d, binding.destination))
      )
        throw bad();
      await validateClientDestinations({
        schemaVersion: 1,
        destinations: entries,
      });
      const routes = previousRoutes.filter((d) => d.domainId !== item.domainId);
      if (enabled) routes.push({ ...item, store: binding.store });
      const pending: Pending = {
        target: item,
        registry: json({ schemaVersion: 1, destinations: entries }),
        nginx: domainNginxConfig(routes, config.proxyPort),
        routes,
      };
      await guard();
      // Superseding a partial transaction must retain its actual current bytes
      // as the next before-image, including a crash before either file is written.
      state = {
        schemaVersion: 1,
        registrySha: sha(registry.text),
        nginxSha: actualNginxSha,
        routes: previousRoutes,
        pending,
      };
      await durableWrite(stateFile, json(state), 0o600);
      await guard();
      if (
        (await readOwned(config.registryFile)) !== registry.text ||
        (await readOwned(config.nginxFile)) !== currentNginx
      )
        throw bad();
      await durableWrite(config.registryFile, pending.registry, 0o644);
      await guard();
      if ((await readOwned(config.nginxFile)) !== currentNginx) throw bad();
      await durableWrite(config.nginxFile, pending.nginx, 0o644);
      await guard();
      try {
        await config.reload(pending.nginx);
      } catch {
        throw new DomainReleaseError("routing_failed");
      }
      await guard();
      try {
        await (config.observe ?? verifyDomainRoute)(
          item.hostname,
          config.proxyPort,
          verified?.manifest ?? null,
        );
      } catch {
        throw new DomainReleaseError("routing_failed");
      }
      await guard();
      if (
        (await readOwned(config.registryFile)) !== pending.registry ||
        (await readOwned(config.nginxFile)) !== pending.nginx
      )
        throw bad();
      state = {
        schemaVersion: 1,
        registrySha: sha(pending.registry),
        nginxSha: sha(pending.nginx),
        routes,
        pending: null,
      };
      await durableWrite(stateFile, json(state), 0o600);
      return { domainId: item.domainId, routingRemoved: !enabled };
    });
  };
  return { prepare, route };
}
