/** Root-only entry point. The installed bundle and configuration are operator-owned. */
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { normalizeDomainHostname } from "../shared/builderDomains";
import { normalizeDomainIngress } from "./builder-domain-dns";
import { localDirectAdminApi } from "./builder-directadmin-api";
import { localDomainApacheReload } from "./builder-domain-apache";
import { directAdminDomains } from "./builder-domain-provider";
import { domainReleases, verifyDomainRoute } from "./builder-domain-releases";
import { createReleaseClient } from "./builder-release-worker.mjs";
import { readClientDestinations } from "./client-publication.mjs";
import { runDomainJob, runDomainQueue } from "./builder-domain-worker";

export const domainHostPaths = Object.freeze({
  configuration: "/etc/kaizen/domain-worker.json",
  jobs: "/var/lib/kaizen-domains/jobs",
  provider: "/var/lib/kaizen-domains/provider",
  routing: "/var/lib/kaizen-domains/routing",
  stores: "/var/lib/kaizen-client-releases",
  nginx: "/etc/nginx/kaizen-domains.conf",
  proxyPort: 8094,
});
const bad = () =>
  new Error("The domain worker host configuration could not be verified.");
type Native = { projectId: "kaizen"; store: string; origin: string };
export type DomainHostConfiguration = {
  schemaVersion: 1;
  workerId: string;
  ipv4: string[];
  ipv6: string[];
  reservedHostnames: string[];
  providerUser: string;
  publicationUser: string;
  native?: Native;
};
const safePath = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\/[a-zA-Z0-9_./-]+$/.test(value) &&
  path.normalize(value) === value &&
  value !== "/";

export function domainHostConfiguration(
  value: unknown,
): DomainHostConfiguration {
  try {
    const item = value as DomainHostConfiguration;
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).some(
        (key) =>
          ![
            "schemaVersion",
            "workerId",
            "ipv4",
            "ipv6",
            "reservedHostnames",
            "providerUser",
            "publicationUser",
            "native",
          ].includes(key),
      ) ||
      item.schemaVersion !== 1 ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(item.workerId || "") ||
      ![item.providerUser, item.publicationUser].every(
        (user) =>
          typeof user === "string" &&
          /^[a-z][a-z0-9_-]{0,31}$/.test(user) &&
          user !== "root",
      ) ||
      item.providerUser === item.publicationUser ||
      !Array.isArray(item.reservedHostnames) ||
      item.reservedHostnames.length > 100
    )
      throw bad();
    const ingress = normalizeDomainIngress(item);
    const reservedHostnames = [
      ...new Set(item.reservedHostnames.map(normalizeDomainHostname)),
    ].sort();
    let native: Native | undefined;
    if (item.native !== undefined) {
      const n = item.native;
      if (
        !n ||
        Object.keys(n).sort().join(",") !== "origin,projectId,store" ||
        n.projectId !== "kaizen" ||
        !safePath(n.store)
      )
        throw bad();
      const origin = new URL(n.origin);
      if (
        origin.protocol !== "https:" ||
        origin.origin !== n.origin ||
        origin.port ||
        normalizeDomainHostname(origin.hostname) !== origin.hostname ||
        !reservedHostnames.some(
          (name) =>
            origin.hostname === name || origin.hostname.endsWith(`.${name}`),
        )
      )
        throw bad();
      native = { ...n };
    }
    return {
      schemaVersion: 1,
      workerId: item.workerId,
      ...ingress,
      reservedHostnames,
      providerUser: item.providerUser,
      publicationUser: item.publicationUser,
      ...(native ? { native } : {}),
    };
  } catch {
    throw bad();
  }
}

/** Production passes uid 0. An explicit fixture uid permits permission tests without root. */
export async function readDomainHostFile(
  file: string,
  uid = 0,
  privateFile = false,
) {
  if (!safePath(file) || (await realpath(file)) !== file) throw bad();
  for (let parent = path.dirname(file); ; parent = path.dirname(parent)) {
    const stat = await lstat(parent);
    // The fixture's temporary ancestor may be sticky; production's selected
    // /etc and /var paths may never have writable ancestors.
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (uid === 0 && (stat.uid !== 0 || stat.mode & 0o022))
    )
      throw bad();
    if (parent === "/") break;
  }
  const stat = await lstat(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.uid !== uid ||
    stat.mode & (privateFile ? 0o077 : 0o022) ||
    stat.size > 4194304
  )
    throw bad();
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = await handle.stat();
    if (
      current.dev !== stat.dev ||
      current.ino !== stat.ino ||
      current.size > 4194304
    )
      throw bad();
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}

type Command = (binary: string, args: string[]) => Promise<string>;
/** Verify the actual active configuration consumes the exact include before reload. */
export function domainNginxReload(
  file: string,
  run: Command,
  read: () => Promise<string>,
) {
  if (!safePath(file)) throw bad();
  const check = async (expected: string) => {
    if ((await read()) !== expected) throw bad();
    const dump = await run("/usr/local/sbin/nginx", ["-T"]);
    const marker = `# configuration file ${file}:\n`;
    const parts = dump.split(marker);
    if (
      parts.length !== 2 ||
      parts[1].split(/^# configuration file /m)[0].trimEnd() !==
        expected.trimEnd() ||
      (await read()) !== expected
    )
      throw bad();
  };
  return {
    check,
    reload: async (expected: string) => {
      await check(expected);
      await run("/usr/bin/systemctl", ["reload", "kaizen-nginx.service"]);
      if (
        (
          await run("/usr/bin/systemctl", ["is-active", "kaizen-nginx.service"])
        ).trim() !== "active" ||
        (await read()) !== expected
      )
        throw bad();
    },
  };
}

export async function localDomainHost(env: NodeJS.ProcessEnv = process.env) {
  if (process.getuid?.() !== 0) throw bad();
  const config = domainHostConfiguration(
    JSON.parse(
      await readDomainHostFile(domainHostPaths.configuration, 0, true),
    ),
  );
  if (
    config.workerId !== env.BUILDER_CLIENT_WORKER_ID ||
    !safePath(env.BUILDER_CLIENT_DESTINATIONS_FILE)
  )
    throw bad();
  const registryFile = env.BUILDER_CLIENT_DESTINATIONS_FILE;
  await readDomainHostFile(registryFile);
  await readClientDestinations(registryFile);
  for (const directory of [
    domainHostPaths.jobs,
    domainHostPaths.provider,
    domainHostPaths.routing,
    domainHostPaths.stores,
  ]) {
    const stat = await lstat(directory);
    if (
      (await realpath(directory)) !== directory ||
      !stat.isDirectory() ||
      stat.uid !== 0 ||
      stat.mode & (directory === domainHostPaths.stores ? 0o022 : 0o077)
    )
      throw bad();
  }
  const command = promisify(execFile);
  const run: Command = async (binary, args) => {
    // Explicit executable/argv, no shell and no inherited Node preload or environment injection.
    const { stdout } = await command(binary, args, {
      timeout: 60000,
      maxBuffer: 4194304,
      env: {
        PATH: "/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin",
        LANG: "C.UTF-8",
      },
    });
    return stdout;
  };
  const ids = await Promise.all(
    ["-u", "-g"].map((flag) =>
      run("/usr/bin/id", [flag, config.publicationUser]),
    ),
  );
  if (
    !ids.every(
      (id) => /^[1-9][0-9]*\n?$/.test(id) && Number.isSafeInteger(Number(id)),
    )
  )
    throw bad();
  const nginx = domainNginxReload(domainHostPaths.nginx, run, () =>
    readDomainHostFile(domainHostPaths.nginx),
  );
  const api = localDirectAdminApi(config.providerUser);
  const services = {
    workerId: config.workerId,
    jobsRoot: domainHostPaths.jobs,
    ingress: { ipv4: config.ipv4, ipv6: config.ipv6 },
    reservedHostnames: config.reservedHostnames,
    client: createReleaseClient({
      url: env.SUPABASE_URL || "",
      key: env.BUILDER_RELEASE_SERVICE_ROLE_KEY || "",
    }),
    provider: directAdminDomains({
      username: config.providerUser,
      journalRoot: domainHostPaths.provider,
      domainsRoot: `/usr/local/directadmin/data/users/${config.providerUser}/domains`,
      proxyPort: domainHostPaths.proxyPort,
      api,
      reload: localDomainApacheReload(config.providerUser),
    }),
    releases: domainReleases({
      journalRoot: domainHostPaths.routing,
      primaryStoresRoot: domainHostPaths.stores,
      registryFile,
      nginxFile: domainHostPaths.nginx,
      proxyPort: domainHostPaths.proxyPort,
      publicationUid: Number(ids[0]),
      publicationGid: Number(ids[1]),
      native: config.native,
      reload: nginx.reload,
    }),
  };
  return {
    services,
    checkHost: async () => {
      await nginx.check(await readDomainHostFile(domainHostPaths.nginx));
      await api("GET", "/CMD_API_SHOW_DOMAINS?json=yes");
      await verifyDomainRoute(
        `kaizen-unmapped-${randomUUID()}.com`,
        domainHostPaths.proxyPort,
        null,
      );
    },
  };
}

async function cli() {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === "--validate-configuration") {
    if (process.getuid?.() !== 0) throw bad();
    domainHostConfiguration(
      JSON.parse(await readDomainHostFile(args[1], 0, true)),
    );
    process.stdout.write('{"status":"configuration_verified"}\n');
    return;
  }
  if (
    args.length !== 1 ||
    (!["--once", "--check-host"].includes(args[0]) &&
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        args[0],
      ))
  )
    throw bad();
  const host = await localDomainHost();
  if (args[0] === "--check-host") {
    await host.checkHost();
    process.stdout.write('{"status":"host_verified"}\n');
    return;
  }
  const results =
    args[0] === "--once"
      ? await runDomainQueue(host.services)
      : [await runDomainJob(args[0], host.services)];
  for (const result of results)
    process.stdout.write(JSON.stringify(result) + "\n");
  if (results.some((result) => result.status === "recovery_required"))
    process.exitCode = 1;
}
export function runDomainHostCli() {
  cli().catch(() => {
    process.stderr.write(
      '{"status":"failed","reason":"domain_host_unverified"}\n',
    );
    process.exitCode = 1;
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  runDomainHostCli();
