/** Explicit operator fixture: one temporary hosting object, never a CA request. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { request } from "node:http";
import { directAdminDomains } from "../../scripts/builder-domain-provider";
import { localDirectAdminApi } from "../../scripts/builder-directadmin-api";
import { localDomainApacheReload } from "../../scripts/builder-domain-apache";
import {
  ensureDomainCertificate,
  DomainCertificateError,
} from "../../scripts/builder-domain-certificates";

assert.equal(
  process.getuid?.(),
  0,
  "Run this explicit hosting fixture as root.",
);
assert.ok(
  process.argv.includes("--run"),
  "Use --run for this temporary provider fixture.",
);
const admin = (
  await promisify(execFile)("/usr/local/directadmin/directadmin", ["admin"])
).stdout.trim();
const directory = await mkdtemp("/var/lib/kaizen-domain-provider-check-");
const item = {
  domainId: randomUUID(),
  projectId: randomUUID(),
  hostname: `hosting-check-${randomUUID().slice(0, 8)}.kaizenweb.co.uk`,
};
const journalRoot = path.join(directory, "provider");
await mkdir(journalRoot, { mode: 0o700 });
const identityFile = path.join(directory, "identity.json"),
  identityText = JSON.stringify(item) + "\n";
await writeFile(identityFile, identityText, { flag: "wx", mode: 0o600 });
// The isolated fixture has no project/account/draft. Production calls must use
// the lifecycle worker's real database and DNS ownership guard instead.
const guard = async () =>
  assert.equal(await readFile(identityFile, "utf8"), identityText);
const api = localDirectAdminApi(admin);
const provider = directAdminDomains({
  username: admin,
  journalRoot,
  domainsRoot: `/usr/local/directadmin/data/users/${admin}/domains`,
  proxyPort: 8094,
  api,
  reload: localDomainApacheReload(admin),
});
const existingDomains = await api("GET", "/CMD_API_SHOW_DOMAINS?json=yes");
const releaseFile = "/var/lib/kaizen/production/active.conf";
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const originalRelease = digest(await readFile(releaseFile));
let readyPlanRefused = false,
  providerComplete = false;
try {
  await provider.ensure(item, guard);
  process.stdout.write(
    JSON.stringify({
      step: "provider-created",
      hostname: item.hostname,
      directory,
    }) + "\n",
  );
  const http = await new Promise<number>((resolve, reject) => {
    const req = request(
      {
        host: "144.91.72.17",
        port: 80,
        path: "/",
        headers: { Host: item.hostname },
        signal: AbortSignal.timeout(5000),
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode || 0));
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(http, 503, "New fixture must serve the unavailable response.");
  const domainConfig = Object.fromEntries(
    (
      await readFile(
        `/usr/local/directadmin/data/users/${admin}/domains/${item.hostname}.conf`,
        "utf8",
      )
    )
      .split("\n")
      .map((line) => line.split("=")),
  );
  for (const flag of ["ssl", "php", "cgi"])
    assert.equal(domainConfig[flag], "OFF", `${flag} must start disabled`);
  const initial = await api(
    "GET",
    `/api/domain-tls/${item.hostname}/acme-config`,
  );
  assert.equal(
    initial.enabled,
    false,
    "SSL-off creation must not start broad ACME issuance.",
  );
  try {
    await provider.withOwned(item, guard, (ownedApi) =>
      ensureDomainCertificate(
        item.hostname,
        async (method, pathname, body, form) => {
          if (pathname.endsWith("/provision-certs"))
            throw new Error(
              "This fixture must never request a public certificate.",
            );
          if (method === "PUT" && (body as any)?.enabled === true) {
            readyPlanRefused = true;
            throw new DomainCertificateError("tls_pending");
          }
          return ownedApi(method, pathname, body, form);
        },
        guard,
      ),
    );
    throw new Error(
      "A DNS-free fixture cannot complete certificate provisioning.",
    );
  } catch (error) {
    assert.equal(error.reason, "tls_pending");
  }
  const observed = await api(
    "GET",
    `/api/domain-tls/${item.hostname}/acme-config`,
  );
  assert.equal(observed.enabled, false);
  assert.equal(observed.preferWildcard, false);
  assert.equal(observed.dnsProvider, "");
  assert.equal(Object.keys(observed.dnsEnvironment).length, 0);
  assert.ok(!observed.skipDNSNames.includes(item.hostname));
  assert.ok(observed.skipDNSNames.length > 0);
  process.stdout.write(
    JSON.stringify({
      step: "disabled-certificate-plan-verified",
      excludedNameCount: observed.skipDNSNames.length,
      issuanceRefusedByFixture: readyPlanRefused,
    }) + "\n",
  );
  providerComplete = true;
} finally {
  // Preserve journals on any cleanup error for recovery of this exact fixture.
  await provider.remove(item, guard);
  assert.deepEqual(
    await api("GET", "/CMD_API_SHOW_DOMAINS?json=yes"),
    existingDomains,
  );
  assert.equal(digest(await readFile(releaseFile)), originalRelease);
  await writeFile(
    path.join(directory, "result.json"),
    JSON.stringify({
      ok: providerComplete,
      providerRemoved: true,
      releaseUnchanged: true,
      publicCertificateRequested: false,
    }) + "\n",
    { mode: 0o600 },
  );
  process.stdout.write(
    JSON.stringify({
      step: "provider-removed",
      releaseUnchanged: true,
      directory,
    }) + "\n",
  );
}
