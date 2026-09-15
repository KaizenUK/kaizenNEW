import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer, type Server } from "node:https";
import { randomUUID, createHash } from "node:crypto";
import {
  bindClientStore,
  stageRelease,
  verifyRelease,
  checkLive,
} from "../../scripts/kaizen-releases.mjs";
import { verifyDomainHttps } from "../../scripts/builder-domain-https";
import { directAdminApi } from "../../scripts/builder-directadmin-api";

const hostname = "customer.fixture.co.uk";
const run = promisify(execFile);
let root: string, ca: Buffer;
const certificates: Record<string, { key: Buffer; cert: Buffer }> = {};
const servers: Server[] = [];
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "kaizen-domain-https-"));
  await run(
    "openssl",
    [
      "req",
      "-new",
      "-x509",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:P-256",
      "-nodes",
      "-days",
      "2",
      "-subj",
      "/CN=Kaizen isolated fixture CA",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-keyout",
      "ca.key",
      "-out",
      "ca.crt",
    ],
    { cwd: root },
  );
  ca = await readFile(path.join(root, "ca.crt"));
  for (const [name, names] of Object.entries({
    exact: hostname,
    rotated: hostname,
    wrong: "foreign.fixture.co.uk",
    extra: `${hostname},DNS:www.${hostname}`,
    wildcard: "*.fixture.co.uk",
    self: hostname,
  })) {
    await run(
      "openssl",
      [
        "req",
        "-new",
        "-newkey",
        "ec",
        "-pkeyopt",
        "ec_paramgen_curve:P-256",
        "-nodes",
        "-subj",
        `/CN=${hostname}`,
        "-keyout",
        `${name}.key`,
        "-out",
        `${name}.csr`,
      ],
      { cwd: root },
    );
    await writeFile(
      path.join(root, `${name}.ext`),
      `subjectAltName=DNS:${names}\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\n`,
    );
    await run(
      "openssl",
      [
        "x509",
        "-req",
        "-in",
        `${name}.csr`,
        "-days",
        "2",
        "-set_serial",
        String(Object.keys(certificates).length + 1),
        "-extfile",
        `${name}.ext`,
        "-out",
        `${name}.crt`,
        ...(name === "self"
          ? ["-signkey", `${name}.key`]
          : ["-CA", "ca.crt", "-CAkey", "ca.key"]),
      ],
      { cwd: root },
    );
    certificates[name] = {
      key: await readFile(path.join(root, `${name}.key`)),
      cert: await readFile(path.join(root, `${name}.crt`)),
    };
  }
}, 30000);
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

async function fixture(
  name = "exact",
  original = `https://${hostname}`,
  native = false,
) {
  const directory = await mkdtemp(path.join(root, "site-")),
    store = path.join(directory, "store"),
    source = path.join(directory, "source");
  await mkdir(path.join(source, "garden"), { recursive: true });
  await writeFile(path.join(source, "index.html"), "<h1>Fixture home</h1>");
  if (native) {
    await mkdir(path.join(source, "builder"));
    await writeFile(
      path.join(source, "builder/index.html"),
      "<h1>Fixture builder</h1>",
    );
  }
  await writeFile(
    path.join(source, "garden/index.html"),
    "<h1>Retained garden page</h1>",
  );
  const client = {
    projectId: randomUUID(),
    destinationId: randomUUID(),
    environment: "production",
    origin: original,
  };
  if (!native) await bindClientStore({ store, client });
  await stageRelease({
    store,
    source,
    id: "domain-fixture",
    ...(!native ? { client } : {}),
    redirectRules: [
      {
        id: randomUUID(),
        source: "/old-garden/",
        destination: "/garden/",
        status: 301,
      },
    ],
  });
  const manifest = await verifyRelease(store, "domain-fixture");
  const files = new Map<string, Buffer>();
  for (const file of manifest.files) {
    const bytes = await readFile(
      path.join(store, "releases/domain-fixture/site", file.path),
    );
    files.set(`/${file.path}`, bytes);
    if (file.path.endsWith("index.html"))
      files.set(`/${file.path.slice(0, -10)}`, bytes);
  }
  const state = {
    mode: "ok",
    requests: [] as { host: string; sni: string; address: string }[],
    rotate: false,
  };
  const server = createServer(certificates[name], (request, response) => {
    state.requests.push({
      host: request.headers.host || "",
      sni: (request.socket as any).servername,
      address: request.socket.localAddress || "",
    });
    if (state.rotate) {
      state.rotate = false;
      server.setSecureContext(certificates.rotated);
    }
    if (state.mode === "hang") return;
    const url = new URL(request.url!, `https://${hostname}`);
    response.setHeader(
      "X-Kaizen-Release",
      state.mode === "identity" ? "foreign-release" : manifest.id,
    );
    const redirect = manifest.redirectChecks.find(
      (item) => item.source === url.pathname,
    );
    if (redirect) {
      response
        .writeHead(301, {
          Location:
            (state.mode === "redirect"
              ? "https://foreign.fixture.co.uk"
              : `https://${hostname}`) +
            redirect.destination +
            url.search,
        })
        .end();
      return;
    }
    const found = files.get(url.pathname);
    if (!found) {
      response.writeHead(404).end();
      return;
    }
    let body = found;
    if (state.mode === "marker" && url.pathname.includes("kaizen-release.json"))
      body = Buffer.from("{}");
    if (state.mode === "bytes" && url.pathname === "/")
      body = Buffer.from("Different website");
    if (state.mode === "oversize" && url.pathname === "/")
      body = Buffer.alloc(70000, 65);
    response.writeHead(200).end(body);
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "0.0.0.0", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture listener");
  const options = { port: address.port, ca, timeout: 2000 };
  const input: Parameters<typeof verifyDomainHttps>[0] = {
    hostname,
    origin: original,
    manifest,
    ingress: { ipv4: ["127.0.0.1"], ipv6: [] },
  };
  return {
    input,
    options,
    state,
    store,
    verify: () => verifyDomainHttps(input, options),
  };
}

it("checks actual TLS, exact retained bytes and redirects at every configured address", async () => {
  const f = await fixture();
  f.input.ingress.ipv4.push("127.0.0.2");
  const result = await f.verify();
  expect(result).toMatchObject({
    certificateNames: [hostname],
    certificateSelfSigned: false,
    checked:
      (f.input.manifest.checks.length +
        f.input.manifest.redirectChecks.length +
        1) *
      2,
  });
  expect(result.certificateSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(Date.parse(result.certificateExpiresAt)).toBeGreaterThan(
    Date.now() + 3600000,
  );
  expect(new Set(f.state.requests.map((request) => request.address))).toEqual(
    new Set(["127.0.0.1", "127.0.0.2"]),
  );
  expect(
    f.state.requests.every(
      (request) => request.host === hostname && request.sni === hostname,
    ),
  ).toBe(true);
});

async function apiFixture(operatorRead = false, creationAllowed = true) {
  const state = {
    mode: "ok",
    requests: [] as {
      authorization: string;
      path: string;
      method: string;
      body: string;
    }[],
    keys: 0,
    pin: certificates.exact.cert,
    user: "kzsites",
  };
  const server = createServer(certificates.exact, async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    state.requests.push({
      authorization: request.headers.authorization || "",
      path: request.url!,
      method: request.method!,
      body: Buffer.concat(chunks).toString(),
    });
    if (state.mode === "hang") return;
    if (state.mode === "redirect") {
      response
        .writeHead(302, { Location: "https://foreign.fixture.co.uk/private" })
        .end();
      return;
    }
    if (state.mode === "legacy") {
      response.setHeader("Content-Type", "application/x-www-form-urlencoded");
      response.end("error=0&text=ok");
      return;
    }
    if (state.mode === "empty") {
      response.writeHead(204).end();
      return;
    }
    response.setHeader("Content-Type", "application/json");
    if (state.mode === "oversize")
      response.end(JSON.stringify({ text: "x".repeat(1048577) }));
    else if (state.mode === "error")
      response.end(
        JSON.stringify({ error: "provider-private-fixture-detail" }),
      );
    else if (state.mode === "status")
      response
        .writeHead(491)
        .end(JSON.stringify({ message: "provider-private-fixture-detail" }));
    else response.end(JSON.stringify({ enabled: true }));
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const listener = server.address();
  if (!listener || typeof listener === "string")
    throw new Error("Fixture API unavailable");
  const api = directAdminApi("kzsites", {
    operatorRead,
    creationReady: async () => {
      if (!creationAllowed)
        throw new Error("Automatic certificate creation is still enabled");
    },
    port: listener.port,
    timeout: 100,
    certificate: async () => state.pin,
    apiUrl: async () =>
      `https://${state.user}:fixture-login-${++state.keys}@${hostname}:${listener.port}`,
  });
  return { state, api };
}
it("sends a fresh in-memory login key only to the pinned local daemon and encodes API bodies", async () => {
  const f = await apiFixture();
  await expect(
    f.api("GET", `/api/domain-tls/${hostname}/acme-config`),
  ).resolves.toEqual({ enabled: true });
  f.state.mode = "legacy";
  await expect(
    f.api(
      "POST",
      "/CMD_API_DOMAIN?json=yes",
      { action: "create", domain: hostname, ssl: "OFF" },
      true,
    ),
  ).resolves.toMatchObject({ error: "0" });
  expect(f.state.requests.map((item) => item.authorization)).toEqual(
    [1, 2].map(
      (id) =>
        `Basic ${Buffer.from(`kzsites:fixture-login-${id}`).toString("base64")}`,
    ),
  );
  expect(new URLSearchParams(f.state.requests[1].body).get("domain")).toBe(
    hostname,
  );
  f.state.mode = "empty";
  await expect(
    f.api("PUT", `/api/domain-tls/${hostname}/acme-config`, { enabled: false }),
  ).resolves.toBeUndefined();
  expect(JSON.parse(f.state.requests[2].body)).toEqual({ enabled: false });
});
it("refuses a changed daemon certificate or different account before transmitting the login key", async () => {
  const f = await apiFixture();
  f.state.pin = certificates.rotated.cert;
  await expect(f.api("GET", "/CMD_API_SHOW_DOMAINS?json=yes")).rejects.toThrow(
    "could not be confirmed",
  );
  expect(f.state.requests).toHaveLength(0);
  f.state.pin = certificates.exact.cert;
  f.state.user = "other";
  await expect(f.api("GET", "/CMD_API_SHOW_DOMAINS?json=yes")).rejects.toThrow(
    "could not be confirmed",
  );
  expect(f.state.requests).toHaveLength(0);
});
it("keeps account installation API routes outside the ordinary domain worker", async () => {
  const f = await apiFixture();
  for (const pathname of [
    "/CMD_API_ACCOUNT_USER?json=yes",
    "/CMD_API_SHOW_USERS?json=yes",
    "/CMD_API_SHOW_RESELLER_IPS?json=yes",
    "/api/license",
  ])
    await expect(f.api("GET", pathname)).rejects.toThrow(
      "could not be confirmed",
    );
  expect(f.state.keys).toBe(0);
  expect(f.state.requests).toHaveLength(0);
});
it("refuses domain creation before sending credentials when host preparation is incomplete", async () => {
  const f = await apiFixture(false, false);
  await expect(
    f.api(
      "POST",
      "/CMD_API_DOMAIN?json=yes",
      { action: "create", domain: hostname },
      true,
    ),
  ).rejects.toThrow("could not be confirmed");
  expect(f.state.keys).toBe(0);
  expect(f.state.requests).toHaveLength(0);
  await expect(
    f.api("GET", `/api/domain-tls/${hostname}/certs`),
  ).resolves.toEqual({ enabled: true });
});
it("allows explicit license inspection without granting account or license mutations", async () => {
  const f = await apiFixture(true);
  await expect(f.api("GET", "/api/license")).resolves.toEqual({
    enabled: true,
  });
  for (const pathname of [
    "/CMD_API_ACCOUNT_USER?json=yes",
    "/CMD_API_SELECT_USERS",
    "/api/license",
    "/api/license/update-key",
  ])
    await expect(f.api("POST", pathname)).rejects.toThrow(
      "could not be confirmed",
    );
  expect(f.state.requests).toHaveLength(1);
});
it.each(["redirect", "oversize", "hang", "error", "status"])(
  "bounds and redacts a %s provider failure without following redirects",
  async (mode) => {
    const f = await apiFixture();
    f.state.mode = mode;
    const error = await f
      .api("POST", `/api/domain-tls/${hostname}/provision-certs`)
      .catch((error) => error);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toBe(
      "DirectAdminError: The local domain hosting request could not be confirmed.",
    );
    expect(error.cause).toBeUndefined();
    expect(f.state.requests).toHaveLength(1);
    if (mode === "status") expect(error.status).toBe(491);
  },
);
it("refuses non-API routes and oversize bodies before transmitting the key", async () => {
  const f = await apiFixture();
  for (const route of [
    "https://foreign.fixture.co.uk/",
    "//foreign.co.uk",
    "/CMD_PLUGINS/private",
    `/api/domain-tls/${hostname}/../private`,
    "/CMD_API_DOMAIN?redirect=https://foreign.co.uk",
  ])
    await expect(f.api("GET", route)).rejects.toThrow("could not be confirmed");
  expect(f.state.keys).toBe(0);
  await expect(
    f.api("POST", "/CMD_API_DOMAIN?json=yes", { value: "x".repeat(65537) }),
  ).rejects.toThrow("could not be confirmed");
  expect(f.state.requests).toHaveLength(0);
});
it.each([false, true])(
  "verifies an alias without rewriting the retained %s client/native identity",
  async (native) => {
    const f = await fixture("exact", "https://original.fixture.co.uk", native);
    const file = path.join(f.store, "releases/domain-fixture/release.json");
    const original = await readFile(file);
    const digest = createHash("sha256").update(original).digest("hex");
    await expect(f.verify()).resolves.toMatchObject({
      certificateNames: [hostname],
    });
    expect(
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    ).toBe(digest);
    if (!native) {
      expect(f.input.manifest.client.origin).toBe(
        "https://original.fixture.co.uk",
      );
      await expect(
        checkLive(`https://${hostname}`, f.input.manifest),
      ).rejects.toThrow("configured destination");
    }
  },
);
it.each(["wrong", "extra", "wildcard", "self"])(
  "rejects a %s certificate even if the server can serve the files",
  async (name) => {
    const f = await fixture(name);
    if (name === "self") f.options.ca = certificates.self.cert;
    await expect(f.verify()).rejects.toMatchObject({ reason: "tls_pending" });
  },
);
it("requires a trusted chain and rejects a certificate changing during verification", async () => {
  const f = await fixture();
  await expect(
    verifyDomainHttps(f.input, { port: f.options.port }),
  ).rejects.toMatchObject({ reason: "tls_pending" });
  expect(f.state.requests).toHaveLength(0);
  f.state.rotate = true;
  await expect(f.verify()).rejects.toMatchObject({ reason: "tls_pending" });
});
it.each(["marker", "bytes", "identity", "redirect", "oversize"])(
  "refuses %s differences without following a foreign target",
  async (mode) => {
    const f = await fixture();
    f.state.mode = mode;
    await expect(f.verify()).rejects.toMatchObject({
      reason: "routing_failed",
    });
    expect(f.state.requests.every((request) => request.host === hostname)).toBe(
      true,
    );
  },
);
it("bounds a nonresponding server and refuses a missing second ingress", async () => {
  const f = await fixture();
  f.state.mode = "hang";
  await expect(
    verifyDomainHttps(f.input, { ...f.options, timeout: 50 }),
  ).rejects.toMatchObject({ reason: "routing_failed" });
  f.state.mode = "ok";
  f.input.ingress.ipv6 = ["::1"];
  await expect(f.verify()).rejects.toMatchObject({ reason: "routing_failed" });
});
