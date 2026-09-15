import { afterEach, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  unlink,
  symlink,
  stat,
  chmod,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  directAdminDomains,
  domainApacheCustom,
  DomainProviderError,
  type DomainIdentity,
} from "../../scripts/builder-domain-provider";
import {
  domainApacheReload,
  verifyDomainApacheConfig,
} from "../../scripts/builder-domain-apache";
import { DomainCertificateError } from "../../scripts/builder-domain-certificates";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
const item = (): DomainIdentity => ({
  domainId: randomUUID(),
  projectId: randomUUID(),
  hostname: "customer.fixture.co.uk",
});
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

it("withdraws a ready route without deleting its provider object or restarting certificate issuance", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  await f.provider.route(d, true, f.guard);
  const before = f.calls.length;
  await expect(f.provider.withdraw(d, false, f.guard)).resolves.toEqual({
    providerWithdrawn: true,
  });
  expect(f.domains.has(d.hostname)).toBe(true);
  expect(await readFile(f.custom(d), "utf8")).toContain("[R=503,L]");
  expect(f.calls.slice(before).every((call) => call.method === "GET")).toBe(
    true,
  );
  await f.provider.route(d, true, f.guard);
  expect(await readFile(f.custom(d), "utf8")).toContain("ProxyPreserveHost On");
});

it("disables ACME while withdrawing a domain whose DNS or authority was lost", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  const before = f.calls.length;
  await f.provider.withdraw(d, true, f.guard);
  expect(
    f.calls
      .slice(before)
      .find(
        (call) =>
          call.method === "PUT" && call.pathname.endsWith("/acme-config"),
      )?.body,
  ).toMatchObject({ enabled: false });
  expect(f.domains.has(d.hostname)).toBe(true);
});

it("withdraws a creation with a lost reply and can complete the same owned setup later", async () => {
  const f = await fixture(),
    d = item();
  f.options({ loseCreate: true });
  await expect(f.provider.ensure(d, f.guard)).rejects.toThrow();
  expect(f.domains.has(d.hostname)).toBe(true);
  await f.provider.withdraw(d, true, f.guard);
  expect(await readFile(f.custom(d), "utf8")).toContain("[R=503,L]");
  await f.provider.ensure(d, f.guard);
  expect(f.calls.filter((call) => call.body?.action === "create")).toHaveLength(
    1,
  );
});

it("proves an absent route without creating anything and refuses a foreign provider object", async () => {
  const f = await fixture(),
    d = item();
  await expect(f.provider.withdraw(d, true, f.guard)).resolves.toEqual({
    providerWithdrawn: true,
  });
  expect(f.calls.every((call) => call.method === "GET")).toBe(true);
  f.domains.add(d.hostname);
  await expect(f.provider.withdraw(d, true, f.guard)).rejects.toMatchObject({
    reason: "domain_in_use",
  });
});

it("requires the exact owner and fresh authority even for withdrawal", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  await f.provider.route(d, true, f.guard);
  const before = await readFile(f.custom(d), "utf8");
  await expect(
    f.provider.withdraw({ ...d, domainId: randomUUID() }, true, f.guard),
  ).rejects.toThrow();
  f.options({ guardError: true });
  await expect(f.provider.withdraw(d, true, f.guard)).rejects.toMatchObject({
    reason: "access_changed",
  });
  expect(await readFile(f.custom(d), "utf8")).toBe(before);
});
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "kaizen-domain-provider-"));
  roots.push(root);
  const journalRoot = path.join(root, "private"),
    domainsRoot = path.join(root, "domains");
  await mkdir(journalRoot, { mode: 0o700 });
  await mkdir(domainsRoot, { mode: 0o755 });
  const domains = new Set<string>(),
    calls: { method: string; pathname: string; body?: any }[] = [];
  let loseCreate = false,
    loseDelete = false,
    reloadError = false,
    guardError = false,
    reloads = 0,
    list: unknown;
  let acme: any;
  const api = async (method: string, pathname: string, body?: any) => {
    calls.push({ method, pathname, body });
    if (pathname.endsWith("/acme-config")) {
      if (method === "PUT") {
        acme = structuredClone(body);
        return undefined;
      }
      return structuredClone(acme);
    }
    if (method === "GET") return list ?? [...domains];
    if (body.action === "create") {
      if (domains.has(body.domain)) throw new Error("Already exists");
      domains.add(body.domain);
      if (loseCreate) {
        loseCreate = false;
        throw new Error("Private provider response lost");
      }
    } else {
      domains.delete(body.select0);
      if (loseDelete) {
        loseDelete = false;
        throw new Error("Private provider response lost");
      }
    }
    return { error: "0" };
  };
  const reload = async () => {
    reloads++;
    if (reloadError) throw new Error("Private configuration detail");
  };
  const guard = async () => {
    if (guardError) throw new DomainProviderError("access_changed");
  };
  const config = {
    username: "kzsites",
    journalRoot,
    domainsRoot,
    proxyPort: 8094,
    api,
    reload,
  };
  const provider = directAdminDomains(config);
  return {
    root,
    journalRoot,
    domainsRoot,
    config,
    provider,
    domains,
    calls,
    guard,
    journal: (d: DomainIdentity) =>
      path.join(journalRoot, `${d.hostname}.json`),
    custom: (d: DomainIdentity) =>
      path.join(domainsRoot, `${d.hostname}.cust_httpd`),
    options: (value: {
      loseCreate?: boolean;
      loseDelete?: boolean;
      reloadError?: boolean;
      guardError?: boolean;
      list?: unknown;
    }) => {
      if (value.loseCreate !== undefined) loseCreate = value.loseCreate;
      if (value.loseDelete !== undefined) loseDelete = value.loseDelete;
      if (value.reloadError !== undefined) reloadError = value.reloadError;
      if (value.guardError !== undefined) guardError = value.guardError;
      if (value.list !== undefined) list = value.list;
    },
    reloads: () => reloads,
  };
}

it("creates an unavailable static domain, then enables only the requested hostname", async () => {
  const f = await fixture(),
    d = item();
  await expect(f.provider.ensure(d, f.guard)).resolves.toEqual({
    providerOwned: true,
    domainId: d.domainId,
  });
  expect(f.calls.find((call) => call.method === "POST")?.body).toEqual({
    action: "create",
    domain: d.hostname,
    ubandwidth: "unlimited",
    uquota: "unlimited",
  });
  expect(await readFile(f.custom(d), "utf8")).toContain("[R=503,L]");
  await f.provider.route(d, true, f.guard);
  const custom = await readFile(f.custom(d), "utf8");
  expect(custom).toContain(`https://${d.hostname}%{REQUEST_URI}`);
  expect(custom).toContain(
    "!^customer\\.fixture\\.co\\.uk(?::(?:80|443))?$ [NC]",
  );
  expect(custom).toContain("[R=421,L]");
  expect(custom).toContain("ProxyPass /.well-known/acme-challenge/ !");
  expect(custom).toContain("ProxyPass / http://127.0.0.1:8094/");
  expect(custom).not.toContain("[R=503,L]");
  expect((await stat(f.journal(d))).mode & 0o777).toBe(0o600);
  expect((await stat(f.custom(d))).mode & 0o777).toBe(0o644);
});

it("keeps an already enabled route on an idempotent ensure", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  await f.provider.route(d, true, f.guard);
  const content = await readFile(f.custom(d), "utf8");
  await f.provider.ensure(d, f.guard);
  expect(await readFile(f.custom(d), "utf8")).toBe(content);
  expect(f.calls.filter((c) => c.body?.action === "create")).toHaveLength(1);
});

it("recovers a lost create response without duplicating the provider object", async () => {
  const f = await fixture(),
    d = item();
  f.options({ loseCreate: true });
  await expect(f.provider.ensure(d, f.guard)).rejects.toMatchObject({
    reason: "provider_failed",
  });
  expect(JSON.parse(await readFile(f.journal(d), "utf8")).phase).toBe(
    "creating",
  );
  await f.provider.ensure(d, f.guard);
  expect(f.calls.filter((c) => c.body?.action === "create")).toHaveLength(1);
  expect(JSON.parse(await readFile(f.journal(d), "utf8")).phase).toBe(
    "present",
  );
});

it.each([false, true])(
  "recovers interrupted initial configuration with the pending file installed=%s",
  async (installed) => {
    const f = await fixture(),
      d = item();
    f.options({ loseCreate: true });
    await expect(f.provider.ensure(d, f.guard)).rejects.toThrow();
    const j = JSON.parse(await readFile(f.journal(d), "utf8"));
    const content = domainApacheCustom(d, 8094, false);
    j.pendingCustomSha = digest(content);
    await writeFile(f.journal(d), JSON.stringify(j), { mode: 0o600 });
    if (installed) await writeFile(f.custom(d), content, { mode: 0o600 });
    await f.provider.ensure(d, f.guard);
    expect(JSON.parse(await readFile(f.journal(d), "utf8"))).toMatchObject({
      phase: "present",
      customSha: digest(content),
      pendingCustomSha: null,
    });
  },
);

it("retries a failed reload before claiming the initial domain ready", async () => {
  const f = await fixture(),
    d = item();
  f.options({ reloadError: true });
  await expect(f.provider.ensure(d, f.guard)).rejects.toThrow(
    "could not be confirmed",
  );
  expect(JSON.parse(await readFile(f.journal(d), "utf8")).phase).toBe(
    "creating",
  );
  f.options({ reloadError: false });
  await f.provider.ensure(d, f.guard);
  expect(f.reloads()).toBe(2);
});

it.each(["domain", "custom"])(
  "refuses to adopt a pre-existing %s without any mutation",
  async (kind) => {
    const f = await fixture(),
      d = item();
    if (kind === "domain") f.domains.add(d.hostname);
    else await writeFile(f.custom(d), "# operator owned\n", { mode: 0o600 });
    await expect(f.provider.ensure(d, f.guard)).rejects.toMatchObject({
      reason: "domain_in_use",
    });
    expect(f.calls.filter((c) => c.method === "POST")).toEqual([]);
    await expect(readFile(f.journal(d))).rejects.toMatchObject({
      code: "ENOENT",
    });
  },
);

it.each(["ensure", "route", "remove"])(
  "preserves externally changed configuration during %s",
  async (operation) => {
    const f = await fixture(),
      d = item();
    await f.provider.ensure(d, f.guard);
    const changed = (await readFile(f.custom(d), "utf8")) + "# operator edit\n";
    await writeFile(f.custom(d), changed);
    const invoke =
      operation === "route"
        ? f.provider.route(d, false, f.guard)
        : f.provider[operation](d, f.guard);
    await expect(invoke).rejects.toMatchObject({
      reason: "configuration_changed",
    });
    expect(await readFile(f.custom(d), "utf8")).toBe(changed);
    expect(f.domains.has(d.hostname)).toBe(true);
    expect(f.calls.filter((c) => c.body?.delete)).toEqual([]);
  },
);

it("refuses a conflicting identity and rejects a forged copy of the ownership comment", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  const second = { ...d, domainId: randomUUID(), projectId: randomUUID() };
  await expect(f.provider.ensure(second, f.guard)).rejects.toMatchObject({
    reason: "domain_in_use",
  });
  await expect(f.provider.remove(second, f.guard)).rejects.toMatchObject({
    reason: "domain_in_use",
  });
  await writeFile(
    f.custom(d),
    `# kaizen-domain-v1 ${d.domainId} ${d.projectId}\nProxyPass / http://foreign/\n`,
  );
  await expect(f.provider.remove(d, f.guard)).rejects.toMatchObject({
    reason: "configuration_changed",
  });
});

it("withdraws routing before deletion and keeps unrelated domains and retained files", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  await f.provider.route(d, true, f.guard);
  const retained = path.join(f.root, "retained-release.json");
  await writeFile(retained, "retained");
  f.domains.add("unrelated.fixture.co.uk");
  const provider = directAdminDomains({
    ...f.config,
    api: async (method, pathname, body: any, form) => {
      if (body?.delete) {
        expect(await readFile(f.custom(d), "utf8")).toContain("[R=503,L]");
        expect(body).toEqual({
          delete: "yes",
          confirmed: "yes",
          select0: d.hostname,
        });
        expect(form).toBe(true);
        expect(JSON.parse(await readFile(f.journal(d), "utf8")).phase).toBe(
          "removing",
        );
      }
      return f.config.api(method, pathname, body);
    },
  });
  await expect(provider.remove(d, f.guard)).resolves.toEqual({
    providerRemoved: true,
    routingRemoved: true,
  });
  expect([...f.domains]).toEqual(["unrelated.fixture.co.uk"]);
  expect(await readFile(retained, "utf8")).toBe("retained");
  await expect(readFile(f.custom(d))).rejects.toMatchObject({ code: "ENOENT" });
  await f.provider.remove(d, f.guard);
  expect(f.calls.filter((c) => c.body?.delete)).toHaveLength(1);
});

it.each([false, true])(
  "recovers a lost deletion acknowledgement with custom file removed=%s",
  async (customRemoved) => {
    const f = await fixture(),
      d = item();
    await f.provider.ensure(d, f.guard);
    f.options({ loseDelete: true });
    await expect(f.provider.remove(d, f.guard)).rejects.toMatchObject({
      reason: "provider_failed",
    });
    if (customRemoved) await unlink(f.custom(d));
    await f.provider.remove(d, f.guard);
    expect(f.calls.filter((c) => c.body?.delete)).toHaveLength(1);
    expect(JSON.parse(await readFile(f.journal(d), "utf8")).phase).toBe(
      "removed",
    );
  },
);

it("will not report removal until Apache reload succeeds", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  let reloads = 0;
  const provider = directAdminDomains({
    ...f.config,
    reload: async () => {
      if (++reloads === 2) throw new Error("Reload failed after deletion");
    },
  });
  await expect(provider.remove(d, f.guard)).rejects.toThrow();
  expect(JSON.parse(await readFile(f.journal(d), "utf8")).phase).toBe(
    "removing",
  );
  await f.provider.remove(d, f.guard);
  expect(JSON.parse(await readFile(f.journal(d), "utf8")).phase).toBe(
    "removed",
  );
});

it("permits a fresh claim after confirmed removal and fences the old identity", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  await f.provider.remove(d, f.guard);
  const second = { ...d, domainId: randomUUID(), projectId: randomUUID() };
  await f.provider.ensure(second, f.guard);
  expect(
    JSON.parse(
      await readFile(
        path.join(f.journalRoot, `${d.domainId}.retired.json`),
        "utf8",
      ),
    ).phase,
  ).toBe("removed");
  await expect(f.provider.remove(d, f.guard)).rejects.toMatchObject({
    reason: "domain_in_use",
  });
  expect(f.domains.has(d.hostname)).toBe(true);
});

it("does not recreate an externally removed domain or overwrite a replacement after removal", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  f.domains.delete(d.hostname);
  await expect(f.provider.ensure(d, f.guard)).rejects.toMatchObject({
    reason: "configuration_changed",
  });
  f.domains.add(d.hostname);
  await f.provider.remove(d, f.guard);
  f.domains.add(d.hostname);
  await expect(f.provider.remove(d, f.guard)).rejects.toMatchObject({
    reason: "configuration_changed",
  });
  expect(f.domains.has(d.hostname)).toBe(true);
});

it("removes a request made before any hosting attempt without provider mutations", async () => {
  const f = await fixture(),
    d = item();
  await expect(f.provider.remove(d, f.guard)).resolves.toEqual({
    providerRemoved: true,
    routingRemoved: true,
  });
  expect(f.calls.filter((c) => c.method === "POST")).toEqual([]);
  expect(JSON.parse(await readFile(f.journal(d), "utf8")).phase).toBe(
    "removed",
  );
  await expect(f.provider.ensure(d, f.guard)).rejects.toMatchObject({
    reason: "configuration_changed",
  });
});

it("rechecks authority before provider mutations", async () => {
  const f = await fixture(),
    d = item();
  f.options({ guardError: true });
  await expect(f.provider.ensure(d, f.guard)).rejects.toMatchObject({
    reason: "access_changed",
  });
  expect(f.calls).toEqual([]);
  let checks = 0;
  const guard = async () => {
    if (++checks === 3) throw new DomainProviderError("access_changed");
  };
  await expect(f.provider.ensure(d, guard)).rejects.toMatchObject({
    reason: "access_changed",
  });
  expect(f.calls.filter((c) => c.method === "POST")).toEqual([]);
});

it("refuses malformed provider domain lists", async () => {
  const f = await fixture(),
    d = item();
  f.options({ list: { domain: d.hostname } });
  await expect(f.provider.ensure(d, f.guard)).rejects.toThrow();
  expect(f.calls.filter((c) => c.method === "POST")).toEqual([]);
});

it.each(["custom", "journal", "root"])(
  "refuses %s symlinks without touching their targets",
  async (kind) => {
    const f = await fixture(),
      d = item();
    await f.provider.ensure(d, f.guard);
    const target = path.join(f.root, "untouched");
    await writeFile(target, "untouched");
    if (kind === "root") {
      const link = path.join(f.root, "alias");
      await symlink(f.domainsRoot, link);
      await expect(
        directAdminDomains({ ...f.config, domainsRoot: link }).remove(
          d,
          f.guard,
        ),
      ).rejects.toThrow();
    } else {
      const file = kind === "custom" ? f.custom(d) : f.journal(d);
      await unlink(file);
      await symlink(target, file);
      await expect(f.provider.remove(d, f.guard)).rejects.toThrow();
    }
    expect(await readFile(target, "utf8")).toBe("untouched");
    expect(f.domains.has(d.hostname)).toBe(true);
  },
);

it("requires a private journal directory and rejects unsafe identities", async () => {
  const f = await fixture(),
    d = item();
  await chmod(f.journalRoot, 0o755);
  await expect(f.provider.ensure(d, f.guard)).rejects.toThrow();
  await chmod(f.journalRoot, 0o700);
  for (const change of [
    { hostname: "a.co.uk\nProxyPass / http://evil/" },
    { domainId: "../escape" },
    { projectId: "../escape" },
  ])
    await expect(
      f.provider.ensure({ ...d, ...change }, f.guard),
    ).rejects.toThrow();
  expect(f.calls).toEqual([]);
});

it("rejects live ownership and recovers only after the actual recorded process exits", async () => {
  const f = await fixture(),
    d = item();
  const child = spawn(process.execPath, [
    "-e",
    "process.stdout.write('ready');setInterval(()=>{},1000)",
  ]);
  try {
    await once(child.stdout, "data");
    const lock = path.join(f.journalRoot, "provider.lock");
    await mkdir(lock);
    await writeFile(
      path.join(lock, "owner.json"),
      JSON.stringify({
        pid: child.pid,
        host: os.hostname(),
        token: randomUUID(),
      }),
    );
    await expect(f.provider.ensure(d, f.guard)).rejects.toThrow();
    expect(f.calls).toEqual([]);
    const exit = once(child, "exit");
    child.kill("SIGTERM");
    await exit;
    await f.provider.ensure(d, f.guard);
    await expect(stat(lock)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
});

it("scopes owned certificate operations to that domain and the fixed SSL enable body", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  await f.provider.withOwned(d, f.guard, (api) =>
    api("GET", `/api/domain-tls/${d.hostname}/certs`),
  );
  for (const pathname of [
    `/api/domain-tls/foreign.fixture.co.uk/certs`,
    `/api/domain-tls/${d.hostname}/../foreign/certs`,
    "/CMD_API_SHOW_DOMAINS?json=yes",
  ])
    await expect(
      f.provider.withOwned(d, f.guard, (api) => api("GET", pathname)),
    ).rejects.toMatchObject({ reason: "configuration_changed" });
  await expect(
    f.provider.withOwned(d, f.guard, (api) =>
      api(
        "POST",
        "/CMD_API_DOMAIN?json=yes",
        {
          action: "modify",
          domain: d.hostname,
          delete: "yes",
          select0: "foreign.fixture.co.uk",
        },
        true,
      ),
    ),
  ).rejects.toMatchObject({ reason: "configuration_changed" });
  expect(
    f.calls.filter((c) => c.pathname.includes("/domain-tls/")),
  ).toHaveLength(3);
  expect(f.calls.some((c) => c.body?.delete)).toBe(false);
});

it("checks authority and custom configuration throughout a certificate operation", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  await expect(
    f.provider.withOwned(d, f.guard, async (api) => {
      await api("GET", `/api/domain-tls/${d.hostname}/certs`);
      f.options({ guardError: true });
      await api("PUT", `/api/domain-tls/${d.hostname}/acme-config`, {
        enabled: true,
      });
    }),
  ).rejects.toMatchObject({ reason: "access_changed" });
  expect(f.calls.filter((c) => c.method === "PUT")).toHaveLength(1);
  f.options({ guardError: false });
  await expect(
    f.provider.withOwned(d, f.guard, async () => {
      await writeFile(f.custom(d), "# changed\n");
    }),
  ).rejects.toMatchObject({ reason: "configuration_changed" });
});

it("preserves pending certificate state through the provider ownership wrapper", async () => {
  const f = await fixture(),
    d = item();
  await f.provider.ensure(d, f.guard);
  await expect(
    f.provider.withOwned(d, f.guard, async () => {
      throw new DomainCertificateError("tls_pending");
    }),
  ).rejects.toMatchObject({ reason: "tls_pending" });
});

const virtualHost = (d: DomainIdentity, custom: string, port = 80) =>
  `<VirtualHost 144.91.72.17:${port}>\nServerName www.${d.hostname}\nServerAlias ${d.hostname}\n${custom}</VirtualHost>\n`;

it("rewrites one hosting account, checks the matching hosts, validates, reloads and reads back", async () => {
  const d = item(),
    custom = domainApacheCustom(d, 8094, true);
  const configuration = virtualHost(d, custom) + virtualHost(d, custom, 443);
  const calls: string[][] = [];
  let reads = 0;
  const reload = domainApacheReload("kzsites", {
    run: async (binary, args) => {
      calls.push([binary, ...args]);
    },
    readConfig: async () => {
      reads++;
      return configuration;
    },
  });
  await reload(d, custom);
  expect(calls).toEqual([
    [
      "/usr/local/directadmin/directadmin",
      "taskq",
      "--run",
      "action=rewrite&value=httpd&user=kzsites",
    ],
    ["/usr/sbin/apachectl", "configtest"],
    ["/usr/bin/systemctl", "reload", "httpd"],
    ["/usr/bin/systemctl", "is-active", "--quiet", "httpd"],
  ]);
  expect(reads).toBe(2);
});

it.each(["missing", "wrong host", "stale https", "outside block"])(
  "rejects %s generated configuration before Apache reload",
  async (kind) => {
    const d = item(),
      custom = domainApacheCustom(d, 8094, true),
      stale = domainApacheCustom(d, 8094, false);
    const configuration =
      kind === "missing"
        ? ""
        : kind === "wrong host"
          ? virtualHost({ ...d, hostname: "foreign.fixture.co.uk" }, custom)
          : kind === "stale https"
            ? virtualHost(d, custom) + virtualHost(d, stale, 443)
            : custom + virtualHost(d, "");
    const commands: string[] = [];
    const reload = domainApacheReload("kzsites", {
      run: async (binary) => {
        commands.push(binary);
      },
      readConfig: async () => configuration,
    });
    await expect(reload(d, custom)).rejects.toMatchObject({
      reason: "configuration_changed",
    });
    expect(commands).toEqual(["/usr/local/directadmin/directadmin"]);
  },
);

it("refuses deletion evidence when any generated host or ownership marker remains", () => {
  const d = item(),
    custom = domainApacheCustom(d, 8094, false);
  expect(() => verifyDomainApacheConfig(virtualHost(d, ""), d, null)).toThrow();
  expect(() => verifyDomainApacheConfig(custom, d, null)).toThrow();
  expect(() =>
    verifyDomainApacheConfig(
      virtualHost({ ...d, hostname: "other.fixture.co.uk" }, ""),
      d,
      null,
    ),
  ).not.toThrow();
});

it("never reloads invalid Apache configuration and sanitizes command output", async () => {
  const d = item(),
    custom = domainApacheCustom(d, 8094, false),
    commands: string[] = [];
  const reload = domainApacheReload("kzsites", {
    readConfig: async () => virtualHost(d, custom),
    run: async (binary) => {
      commands.push(binary);
      if (binary.endsWith("apachectl"))
        throw new Error("private provider path and diagnostic");
    },
  });
  await expect(reload(d, custom)).rejects.toThrow("could not be confirmed");
  expect(commands.some((binary) => binary.endsWith("systemctl"))).toBe(false);
});

it("refuses a configuration that changes during reload", async () => {
  const d = item(),
    custom = domainApacheCustom(d, 8094, false);
  let reads = 0;
  const reload = domainApacheReload("kzsites", {
    run: async () => {},
    readConfig: async () => (++reads === 1 ? virtualHost(d, custom) : ""),
  });
  await expect(reload(d, custom)).rejects.toMatchObject({
    reason: "configuration_changed",
  });
});
