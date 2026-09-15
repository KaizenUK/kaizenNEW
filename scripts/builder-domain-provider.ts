/** Hosting objects in the operator-reserved DirectAdmin domain workspace. */
import { constants } from "node:fs";
import { lstat, open, rename, unlink, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { withRecoveryLock } from "./release-recovery.mjs";
import { normalizeDomainHostname } from "../shared/builderDomains";
import type { directAdminApi } from "./builder-directadmin-api";
import { disableDomainCertificate } from "./builder-domain-certificates";

export class DomainProviderError extends Error {
  constructor(
    public reason:
      | "domain_in_use"
      | "provider_failed"
      | "tls_pending"
      | "configuration_changed"
      | "access_changed" = "provider_failed",
  ) {
    super("The website domain hosting change could not be confirmed.");
    this.name = "DomainProviderError";
  }
}
export type DomainIdentity = {
  domainId: string;
  projectId: string;
  hostname: string;
};
type Journal = DomainIdentity & {
  schemaVersion: 1;
  providerUser: string;
  phase: "creating" | "present" | "removing" | "removed";
  customSha: string | null;
  pendingCustomSha: string | null;
};
type Configuration = {
  username: string;
  /** Existing private worker directory, never a website/project path. */
  journalRoot: string;
  /** Selected account's existing DirectAdmin data/users/USER/domains directory. */
  domainsRoot: string;
  proxyPort: number;
  api: ReturnType<typeof directAdminApi>;
  /** Scoped rewrite, configuration validation and successful Apache reload. */
  reload: (item: DomainIdentity, custom: string | null) => Promise<void>;
};
type Guard = () => Promise<void>;
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const validSha = (value: unknown) =>
  value === null || (typeof value === "string" && /^[a-f0-9]{64}$/.test(value));

function identity(value: DomainIdentity): DomainIdentity {
  if (
    !uuid.test(value.domainId) ||
    (value.projectId !== "kaizen" && !uuid.test(value.projectId)) ||
    normalizeDomainHostname(value.hostname) !== value.hostname
  )
    throw new DomainProviderError("configuration_changed");
  return {
    domainId: value.domainId,
    projectId: value.projectId,
    hostname: value.hostname,
  };
}

/** Only the verified hostname is served, despite DirectAdmin's default www alias. */
export function domainApacheCustom(
  input: DomainIdentity,
  port: number,
  enabled: boolean,
): string {
  const item = identity(input);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new DomainProviderError("configuration_changed");
  const escaped = item.hostname.replace(/\./g, "\\.");
  return [
    `# kaizen-domain-v1 ${item.domainId} ${item.projectId}`,
    "RewriteEngine On",
    `RewriteCond %{HTTP_HOST} !^${escaped}(?::(?:80|443))?$ [NC]`,
    "RewriteRule ^ - [R=421,L]",
    'ErrorDocument 503 "This website is temporarily unavailable."',
    "ProxyPass /.well-known/acme-challenge/ !",
    ...(enabled
      ? [
          "RewriteCond %{HTTPS} !=on",
          "RewriteCond %{REQUEST_URI} !^/\\.well-known/acme-challenge/",
          `RewriteRule ^ https://${item.hostname}%{REQUEST_URI} [R=308,L]`,
          "ProxyPreserveHost On",
          `ProxyPass / http://127.0.0.1:${port}/`,
          `ProxyPassReverse / http://127.0.0.1:${port}/`,
        ]
      : [
          "RewriteCond %{REQUEST_URI} !^/\\.well-known/acme-challenge/",
          "RewriteRule ^ - [R=503,L]",
        ]),
    "",
  ].join("\n");
}

async function readOrdinary(
  file: string,
  privateFile = false,
): Promise<string | null> {
  let metadata;
  try {
    metadata = await lstat(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.nlink !== 1 ||
    metadata.size > 16384 ||
    metadata.mode & 0o022 ||
    (privateFile &&
      (metadata.uid !== process.getuid?.() || metadata.mode & 0o077))
  )
    throw new DomainProviderError("configuration_changed");
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = await handle.stat();
    if (
      current.ino !== metadata.ino ||
      current.dev !== metadata.dev ||
      current.size > 16384
    )
      throw new DomainProviderError("configuration_changed");
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}

async function durableWrite(
  file: string,
  text: string,
  mode = 0o600,
): Promise<void> {
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
    const directory = await open(
      path.dirname(file),
      constants.O_RDONLY | constants.O_DIRECTORY,
    );
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

async function durableUnlink(file: string): Promise<void> {
  await unlink(file);
  const directory = await open(
    path.dirname(file),
    constants.O_RDONLY | constants.O_DIRECTORY,
  );
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

/**
 * A single durable host journal prevents two project claims from adopting the
 * same object. This account must be reserved for the worker: existing domains
 * are never imported, and externally changed custom configuration is preserved.
 * Every call requires a fresh database-ownership guard from the lifecycle worker.
 */
export function directAdminDomains(config: Configuration) {
  if (
    !/^[a-z][a-z0-9_-]{0,31}$/.test(config.username) ||
    !Number.isInteger(config.proxyPort) ||
    config.proxyPort < 1024 ||
    config.proxyPort > 65535
  )
    throw new DomainProviderError("configuration_changed");
  const checkRoots = async () => {
    for (const [directory, privateRoot] of [
      [config.journalRoot, true],
      [config.domainsRoot, false],
    ] as const) {
      const stat = await lstat(directory);
      if (
        !path.isAbsolute(directory) ||
        path.normalize(directory) !== directory ||
        (await realpath(directory)) !== directory ||
        !stat.isDirectory() ||
        stat.mode & 0o022 ||
        (privateRoot && (stat.uid !== process.getuid?.() || stat.mode & 0o077))
      )
        throw new DomainProviderError("configuration_changed");
    }
  };
  const fileFor = (item: DomainIdentity) =>
    path.join(config.journalRoot, `${item.hostname}.json`);
  const customFor = (item: DomainIdentity) =>
    path.join(config.domainsRoot, `${item.hostname}.cust_httpd`);
  const save = (journal: Journal) =>
    durableWrite(fileFor(journal), JSON.stringify(journal) + "\n");
  const load = async (item: DomainIdentity): Promise<Journal | null> => {
    const text = await readOrdinary(fileFor(item), true);
    if (text === null) return null;
    const j = JSON.parse(text);
    identity(j);
    if (
      Object.keys(j).sort().join(",") !==
        "customSha,domainId,hostname,pendingCustomSha,phase,projectId,providerUser,schemaVersion" ||
      j.schemaVersion !== 1 ||
      j.hostname !== item.hostname ||
      j.providerUser !== config.username ||
      !["creating", "present", "removing", "removed"].includes(j.phase) ||
      !validSha(j.customSha) ||
      !validSha(j.pendingCustomSha)
    )
      throw new DomainProviderError("configuration_changed");
    if (
      (j.phase === "present" && !j.customSha) ||
      (j.phase === "removed" && (j.customSha || j.pendingCustomSha))
    )
      throw new DomainProviderError("configuration_changed");
    return j;
  };
  const owned = (j: Journal | null, item: DomainIdentity): Journal => {
    if (!j || j.domainId !== item.domainId || j.projectId !== item.projectId)
      throw new DomainProviderError("domain_in_use");
    return j;
  };
  const exists = async (item: DomainIdentity) => {
    const result = await config.api("GET", "/CMD_API_SHOW_DOMAINS?json=yes");
    if (
      !Array.isArray(result) ||
      result.some(
        (value) =>
          typeof value !== "string" || normalizeDomainHostname(value) !== value,
      )
    )
      throw new DomainProviderError();
    return result.includes(item.hostname);
  };
  const checkCustom = async (j: Journal, allowMissing = false) => {
    const text = await readOrdinary(customFor(j));
    if (text === null) {
      if (
        !allowMissing &&
        (j.customSha || (j.pendingCustomSha && j.phase !== "creating"))
      )
        throw new DomainProviderError("configuration_changed");
      return null;
    }
    const sha = hash(text);
    if (
      ![j.customSha, j.pendingCustomSha].includes(sha) ||
      !text.startsWith(`# kaizen-domain-v1 ${j.domainId} ${j.projectId}\n`)
    )
      throw new DomainProviderError("configuration_changed");
    return sha;
  };
  const writeCustom = async (j: Journal, enabled: boolean, guard: Guard) => {
    await checkCustom(j);
    const content = domainApacheCustom(j, config.proxyPort, enabled),
      sha = hash(content);
    await guard();
    // Intent is durable before replacement; either known hash can be recovered.
    j.pendingCustomSha = sha;
    await save(j);
    // DirectAdmin renders as its daemon account. This contains routing rules,
    // not credentials; keep it readable and root-owned, with no other writers.
    await durableWrite(customFor(j), content, 0o644);
    j.customSha = sha;
    j.pendingCustomSha = null;
    await save(j);
  };
  const reload = async (j: Journal, present: boolean) => {
    if (present) await checkCustom(j);
    const custom = await readOrdinary(customFor(j));
    if ((present && custom === null) || (!present && custom !== null))
      throw new DomainProviderError("configuration_changed");
    await config.reload(identity(j), custom);
  };
  const locked = async <T>(
    input: DomainIdentity,
    guard: Guard,
    operation: (item: DomainIdentity) => Promise<T>,
  ): Promise<T> => {
    try {
      const item = identity(input);
      await checkRoots();
      return await withRecoveryLock(
        path.join(config.journalRoot, "provider.lock"),
        async () => {
          await guard();
          return operation(item);
        },
      );
    } catch (error) {
      if (
        error?.name === "DomainCertificateError" &&
        ["tls_pending", "provider_failed", "configuration_changed"].includes(
          error.reason,
        )
      )
        throw new DomainProviderError(error.reason);
      throw error instanceof DomainProviderError
        ? error
        : new DomainProviderError();
    }
  };
  return {
    withOwned: <T>(
      input: DomainIdentity,
      guard: Guard,
      operation: (api: Configuration["api"]) => Promise<T>,
    ) =>
      locked(input, guard, async (item) => {
        const journal = owned(await load(item), item);
        if (journal.phase !== "present" || !(await exists(item)))
          throw new DomainProviderError("configuration_changed");
        await checkCustom(journal);
        const result = await operation(
          async (method, pathname, body: any, form) => {
            const isCertificate = [
              "acme-config",
              "certs",
              "provision-certs",
              "provision-certs-dry-run",
            ].some(
              (suffix) =>
                pathname === `/api/domain-tls/${item.hostname}/${suffix}`,
            );
            const isSsl =
              method === "POST" &&
              pathname === "/CMD_API_DOMAIN?json=yes" &&
              form === true &&
              body?.action === "modify" &&
              body?.domain === item.hostname &&
              body?.ssl === "ON" &&
              body?.ubandwidth === "unlimited" &&
              body?.uquota === "unlimited" &&
              Object.keys(body).sort().join(",") ===
                "action,domain,ssl,ubandwidth,uquota";
            if (!isCertificate && !isSsl)
              throw new DomainProviderError("configuration_changed");
            await guard();
            await checkCustom(journal);
            return config.api(method, pathname, body, form);
          },
        );
        await guard();
        await checkCustom(journal);
        return result;
      }),
    ensure: (input: DomainIdentity, guard: Guard) =>
      locked(input, guard, async (item) => {
        let journal = await load(item);
        const present = await exists(item);
        if (
          !journal ||
          (journal.phase === "removed" && journal.domainId !== item.domainId)
        ) {
          if (present || (await readOrdinary(customFor(item))) !== null)
            throw new DomainProviderError("domain_in_use");
          if (journal) {
            // Retain the old identity before starting a new claim on this hostname.
            await durableWrite(
              path.join(config.journalRoot, `${journal.domainId}.retired.json`),
              JSON.stringify(journal) + "\n",
            );
          }
          journal = {
            ...item,
            schemaVersion: 1,
            providerUser: config.username,
            phase: "creating",
            customSha: null,
            pendingCustomSha: null,
          };
          await guard();
          await save(journal);
        }
        journal = owned(journal, item);
        if (journal.phase === "removing" || journal.phase === "removed")
          throw new DomainProviderError("configuration_changed");
        await checkCustom(journal);
        if (!present) {
          if (journal.phase !== "creating")
            throw new DomainProviderError("configuration_changed");
          await guard();
          await config.api(
            "POST",
            "/CMD_API_DOMAIN?json=yes",
            {
              action: "create",
              domain: item.hostname,
              ubandwidth: "unlimited",
              uquota: "unlimited",
            },
            true,
          );
          if (!(await exists(item))) throw new DomainProviderError();
        }
        // A lost create acknowledgement is recoverable only with our prior intent.
        // Preserve a ready route on an ordinary idempotent ensure.
        if (journal.phase === "creating") {
          // The modern API defaults to enabled even when creation triggers are
          // off. Persist disabled ACME before confirming this owned setup.
          await disableDomainCertificate(item.hostname, config.api, guard);
          await writeCustom(journal, false, guard);
        }
        await guard();
        await reload(journal, true);
        await checkCustom(journal);
        journal.phase = "present";
        await save(journal);
        return { providerOwned: true as const, domainId: item.domainId };
      }),
    route: (input: DomainIdentity, enabled: boolean, guard: Guard) =>
      locked(input, guard, async (item) => {
        if (typeof enabled !== "boolean")
          throw new DomainProviderError("configuration_changed");
        const journal = owned(await load(item), item);
        if (journal.phase !== "present" || !(await exists(item)))
          throw new DomainProviderError("configuration_changed");
        await writeCustom(journal, enabled, guard);
        await guard();
        await reload(journal, true);
        await checkCustom(journal);
        return { routingEnabled: enabled };
      }),
    /** Withdraw incomplete or established hosting without creating or deleting it.
     * DNS/authority loss disables ACME; a pending issuance may keep its exact plan. */
    withdraw: (
      input: DomainIdentity,
      disableCertificates: boolean,
      guard: Guard,
    ) =>
      locked(input, guard, async (item) => {
        if (typeof disableCertificates !== "boolean")
          throw new DomainProviderError("configuration_changed");
        const journal = await load(item),
          present = await exists(item);
        if (!journal || journal.phase === "removed") {
          if (present || (await readOrdinary(customFor(item))) !== null)
            throw new DomainProviderError("domain_in_use");
          await guard();
          await config.reload(item, null);
          return { providerWithdrawn: true as const };
        }
        owned(journal, item);
        await checkCustom(journal, !present);
        if (present) {
          if (disableCertificates)
            await disableDomainCertificate(item.hostname, config.api, guard);
          await writeCustom(journal, false, guard);
          await guard();
          await reload(journal, true);
          await checkCustom(journal);
        } else {
          await guard();
          await config.reload(item, null);
        }
        return { providerWithdrawn: true as const };
      }),
    remove: (input: DomainIdentity, guard: Guard) =>
      locked(input, guard, async (item) => {
        let journal = await load(item);
        const present = await exists(item);
        if (!journal) {
          // Removal can be requested before the first hosting attempt exists.
          if (present || (await readOrdinary(customFor(item))) !== null)
            throw new DomainProviderError("domain_in_use");
          journal = {
            ...item,
            schemaVersion: 1,
            providerUser: config.username,
            phase: "removed",
            customSha: null,
            pendingCustomSha: null,
          };
          await guard();
          await save(journal);
        }
        journal = owned(journal, item);
        if (journal.phase === "removed") {
          if (present || (await readOrdinary(customFor(item))) !== null)
            throw new DomainProviderError("configuration_changed");
          await guard();
          await reload(journal, false);
          return {
            providerRemoved: true as const,
            routingRemoved: true as const,
          };
        }
        await checkCustom(journal, !present && journal.phase === "removing");
        if (present) {
          // Withdraw the public route before the provider deletion. Both steps can
          // be retried without touching retained release stores or another account.
          await writeCustom(journal, false, guard);
          journal.phase = "removing";
          await save(journal);
          await guard();
          await reload(journal, true);
          await checkCustom(journal);
          await guard();
          await config.api(
            "POST",
            "/CMD_API_DOMAIN?json=yes",
            { delete: "yes", confirmed: "yes", select0: item.hostname },
            true,
          );
        } else if (journal.phase !== "removing") {
          // An unacknowledged create may have made no provider object at all.
          if (
            journal.phase !== "creating" ||
            journal.customSha ||
            journal.pendingCustomSha
          )
            throw new DomainProviderError("configuration_changed");
          journal.phase = "removing";
          await save(journal);
        }
        if (await exists(item)) throw new DomainProviderError();
        await checkCustom(journal, true);
        // Some DA versions retain custom files after deleting the domain.
        if ((await readOrdinary(customFor(item))) !== null) {
          await guard();
          await durableUnlink(customFor(item));
        }
        await guard();
        await reload(journal, false);
        if (
          (await exists(item)) ||
          (await readOrdinary(customFor(item))) !== null
        )
          throw new DomainProviderError();
        journal.phase = "removed";
        journal.customSha = journal.pendingCustomSha = null;
        await save(journal);
        return {
          providerRemoved: true as const,
          routingRemoved: true as const,
        };
      }),
  };
}
