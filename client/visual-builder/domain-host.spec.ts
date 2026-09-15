import { afterEach, expect, it, vi } from "vitest";
import {
  chmod,
  link,
  mkdtemp,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  domainHostConfiguration,
  domainNginxReload,
  localDomainHost,
  readDomainHostFile,
} from "../../scripts/builder-domain-host";

const configuration = () => ({
  schemaVersion: 1,
  workerId: "fixture-worker",
  ipv4: ["192.0.2.10"],
  ipv6: [],
  providerUser: "admin",
  publicationUser: "fixture-publisher",
  reservedHostnames: ["original.fixture.co.uk"],
  native: {
    projectId: "kaizen",
    store: "/var/lib/fixture-production",
    origin: "https://original.fixture.co.uk",
  },
});
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

it("normalizes operator ingress and reservations without accepting executable or path overrides", () => {
  const value = configuration();
  value.ipv4.push("192.0.2.10");
  value.reservedHostnames = ["ORIGINAL.fixture.co.uk."];
  expect(domainHostConfiguration(value)).toEqual(configuration());
  for (const extra of [
    "dns",
    "https",
    "nginxBinary",
    "jobsRoot",
    "client",
    "certificate",
    "reload",
  ])
    expect(() =>
      domainHostConfiguration({ ...value, [extra]: "/tmp/untrusted" }),
    ).toThrow();
});

it.each([
  { workerId: "../other" },
  { providerUser: "root" },
  { publicationUser: "root" },
  { publicationUser: "admin" },
  { ipv4: ["https://192.0.2.10"] },
  {
    native: {
      projectId: "kaizen",
      store: "/tmp/store/../live",
      origin: "https://original.fixture.co.uk",
    },
  },
  {
    native: {
      projectId: "kaizen",
      store: "/tmp/store",
      origin: "https://original.fixture.co.uk/",
    },
  },
  { reservedHostnames: [] },
])("refuses invalid or unprotected host settings: %j", (change) => {
  expect(() =>
    domainHostConfiguration({ ...configuration(), ...change }),
  ).toThrow();
});

it("refuses a non-root production factory before reading private host files", async () => {
  if (process.getuid?.() === 0) return;
  await expect(localDomainHost({})).rejects.toThrow("could not be verified");
});

it("reads ordinary private files and refuses readable secrets, linked files and the wrong owner", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "kaizen-domain-host-"));
  roots.push(root);
  const file = path.join(root, "private.json"),
    alias = path.join(root, "alias.json"),
    uid = process.getuid!();
  await writeFile(file, '{"fixture":true}', { mode: 0o600 });
  expect(await readDomainHostFile(file, uid, true)).toBe('{"fixture":true}');
  await expect(readDomainHostFile(file, uid + 1, true)).rejects.toThrow();
  await chmod(file, 0o644);
  await expect(readDomainHostFile(file, uid, true)).rejects.toThrow();
  await chmod(file, 0o600);
  await link(file, alias);
  await expect(readDomainHostFile(file, uid, true)).rejects.toThrow();
  await unlink(alias);
  await symlink(file, alias);
  await expect(readDomainHostFile(alias, uid, true)).rejects.toThrow();
  await chmod(file, 0o666);
  await expect(readDomainHostFile(file, uid)).rejects.toThrow();
});

const file = "/etc/nginx/kaizen-domains.conf",
  expected = "server { listen 127.0.0.1:8094; return 404; }\n";
const dump = (text = expected) =>
  `# configuration file /etc/nginx/nginx.conf:\nhttp { include ${file}; }\n# configuration file ${file}:\n${text}\n# configuration file /var/lib/other/active.conf:\nroot /var/lib/other;\n`;

it("the standalone bundle runs only the domain entry point, with no other release CLI or checkout dependencies", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "kaizen-domain-bundle-"));
  roots.push(root);
  const output = path.join(root, "worker.mjs"),
    run = promisify(execFile);
  await run(process.execPath, [
    path.resolve("scripts/build-domain-worker.mjs"),
    output,
  ]);
  const result = await run(
    process.execPath,
    [output, "--invalid-fixture-argument"],
    {
      cwd: root,
      env: { PATH: "/usr/bin:/bin" },
    },
  ).then(
    () => {
      throw new Error("Invalid command unexpectedly succeeded.");
    },
    (error) => error,
  );
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe(
    '{"status":"failed","reason":"domain_host_unverified"}\n',
  );
});
it("requires the consumed include, a successful reload and an active daemon", async () => {
  const calls: string[][] = [];
  const run = vi.fn(async (binary: string, args: string[]) => {
    calls.push([binary, ...args]);
    return args[0] === "-T"
      ? dump()
      : args[0] === "is-active"
        ? "active\n"
        : "";
  });
  const nginx = domainNginxReload(file, run, async () => expected);
  await nginx.check(expected);
  expect(calls).toEqual([["/usr/local/sbin/nginx", "-T"]]);
  calls.length = 0;
  await nginx.reload(expected);
  expect(calls).toEqual([
    ["/usr/local/sbin/nginx", "-T"],
    ["/usr/bin/systemctl", "reload", "kaizen-nginx.service"],
    ["/usr/bin/systemctl", "is-active", "kaizen-nginx.service"],
  ]);
});

it.each([
  "missing",
  "stale",
  "duplicate",
  "invalid",
  "changed-before",
  "changed-after-test",
  "reload-failed",
  "inactive",
  "changed-after-reload",
])("does not confirm a route with %s Nginx evidence", async (failure) => {
  let reads = 0;
  const read = async () => {
    reads++;
    return failure === "changed-before" ||
      (failure === "changed-after-test" && reads >= 2) ||
      (failure === "changed-after-reload" && reads >= 3)
      ? "changed"
      : expected;
  };
  const calls: string[] = [];
  const run = async (_binary: string, args: string[]) => {
    calls.push(args[0]);
    if (args[0] === "-T") {
      if (failure === "invalid")
        throw new Error("invalid fixture configuration");
      return failure === "missing"
        ? "# different configuration\n"
        : failure === "stale"
          ? dump("different\n")
          : failure === "duplicate"
            ? dump() + dump()
            : dump();
    }
    if (args[0] === "reload" && failure === "reload-failed")
      throw new Error("fixture reload failed");
    return failure === "inactive" ? "inactive" : "active";
  };
  await expect(
    domainNginxReload(file, run, read).reload(expected),
  ).rejects.toThrow();
  if (
    [
      "missing",
      "stale",
      "duplicate",
      "invalid",
      "changed-before",
      "changed-after-test",
    ].includes(failure)
  )
    expect(calls).not.toContain("reload");
});
