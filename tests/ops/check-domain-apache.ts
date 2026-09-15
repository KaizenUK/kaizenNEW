/** Explicit isolated VPS proof. No DirectAdmin resources or public listeners. */
import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, chmod, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createServer, request } from "node:http";
import { request as httpsRequest } from "node:https";
import { domainApacheCustom } from "../../scripts/builder-domain-provider";

const run = promisify(execFile);
const item = {
  domainId: randomUUID(),
  projectId: randomUUID(),
  hostname: "customer.fixture.co.uk",
};
const binary = process.env.KAIZEN_APACHE_BINARY || "/usr/sbin/httpd";
const mpm = process.env.KAIZEN_APACHE_MPM || "/usr/lib/apache/mod_mpm_event.so";
const root = await mkdtemp(
  path.join(os.tmpdir(), "kaizen-domain-apache-check-"),
);
const backend = createServer((req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.end(`${req.headers.host}|${req.url}`);
});
let child: ChildProcess | undefined,
  checked = 0;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const freePort = async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
};
const get = (port: number, secure: boolean, hostname: string, pathname = "/") =>
  new Promise<{ status: number; body: string; location?: string }>(
    (resolve, reject) => {
      // This self-signed certificate exercises Apache routing only. The production
      // HTTPS verifier has separate real-chain tests and never uses this override.
      const req = (secure ? httpsRequest : request)(
        {
          host: "127.0.0.1",
          port,
          path: pathname,
          headers: { Host: hostname },
          servername: item.hostname,
          rejectUnauthorized: false,
          agent: false,
          signal: AbortSignal.timeout(1500),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          res.on("end", () =>
            resolve({
              status: res.statusCode || 0,
              body: Buffer.concat(chunks).toString("utf8"),
              location: res.headers.location,
            }),
          );
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.end();
    },
  );
const stop = async () => {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    child = undefined;
    return;
  }
  const stopped = once(child, "exit");
  child.kill("SIGTERM");
  const timer = setTimeout(() => child?.kill("SIGKILL"), 5000);
  try {
    await stopped;
  } finally {
    clearTimeout(timer);
    child = undefined;
  }
};
try {
  await chmod(root, 0o755);
  const documentRoot = path.join(root, "site");
  await mkdir(path.join(documentRoot, ".well-known", "acme-challenge"), {
    recursive: true,
    mode: 0o755,
  });
  await writeFile(
    path.join(documentRoot, ".well-known", "acme-challenge", "fixture"),
    "fixture-challenge",
    { mode: 0o644 },
  );
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
      "1",
      "-subj",
      `/CN=${item.hostname}`,
      "-addext",
      `subjectAltName=DNS:${item.hostname}`,
      "-keyout",
      path.join(root, "key.pem"),
      "-out",
      path.join(root, "certificate.pem"),
    ],
    { timeout: 10000 },
  );
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const backendPort = (backend.address() as { port: number }).port;
  const httpPort = await freePort(),
    httpsPort = await freePort();
  for (const enabled of [false, true]) {
    const custom = domainApacheCustom(item, backendPort, enabled);
    const vhost = (
      port: number,
      secure: boolean,
    ) => `<VirtualHost 127.0.0.1:${port}>
ServerName www.${item.hostname}
ServerAlias ${item.hostname}
DocumentRoot "${documentRoot}"
${secure ? `SSLEngine On\nSSLCertificateFile "${root}/certificate.pem"\nSSLCertificateKeyFile "${root}/key.pem"` : ""}
${custom}</VirtualHost>`;
    const configuration = `ServerRoot "${root}"
LoadModule mpm_event_module "${mpm}"
Listen 127.0.0.1:${httpPort}
Listen 127.0.0.1:${httpsPort}
ServerName 127.0.0.1
PidFile "${root}/httpd.pid"
ErrorLog "${root}/error.log"
LogLevel warn
TypesConfig /dev/null
User nobody
Group nogroup
ServerLimit 1
StartServers 1
ThreadsPerChild 8
MaxRequestWorkers 8
MinSpareThreads 1
MaxSpareThreads 8
SSLSessionCache none
<Directory />
Require all denied
</Directory>
<Directory "${documentRoot}">
Require all granted
</Directory>
${vhost(httpPort, false)}
${vhost(httpsPort, true)}
`;
    const config = path.join(root, "httpd.conf");
    await writeFile(config, configuration, { mode: 0o600 });
    await run(binary, ["-f", config, "-t"], {
      timeout: 10000,
      maxBuffer: 16384,
    });
    child = spawn(binary, ["-f", config, "-DFOREGROUND"], { stdio: "ignore" });
    let listening = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error("Isolated Apache exited before its check.");
      try {
        await get(httpPort, false, item.hostname);
        listening = true;
        break;
      } catch {
        await pause(25);
      }
    }
    assert.ok(listening, "Isolated Apache must listen.");
    for (const secure of [false, true]) {
      const port = secure ? httpsPort : httpPort;
      const challenge = await get(
        port,
        secure,
        item.hostname,
        "/.well-known/acme-challenge/fixture",
      );
      assert.equal(challenge.status, 200);
      assert.equal(challenge.body, "fixture-challenge");
      checked++;
      for (const name of [
        `www.${item.hostname}`,
        "unverified.fixture.co.uk",
        `${item.hostname}:7777`,
      ]) {
        assert.equal((await get(port, secure, name)).status, 421);
        checked++;
      }
      const page = await get(
        port,
        secure,
        item.hostname,
        "/page/?from=fixture",
      );
      if (!enabled) {
        assert.equal(page.status, 503);
      } else if (!secure) {
        assert.equal(page.status, 308);
        assert.equal(
          page.location,
          `https://${item.hostname}/page/?from=fixture`,
        );
      } else {
        assert.equal(page.status, 200);
        assert.equal(page.body, `${item.hostname}|/page/?from=fixture`);
      }
      checked++;
    }
    if (enabled) {
      const encoded = await get(
        httpPort,
        false,
        item.hostname,
        "/a%20page/?value=a%20b",
      );
      assert.equal(
        encoded.location,
        `https://${item.hostname}/a%20page/?value=a%20b`,
      );
      checked++;
      assert.equal(
        (await get(httpsPort, true, `${item.hostname}:443`)).status,
        200,
      );
      checked++;
    }
    await stop();
  }
  process.stdout.write(
    JSON.stringify({
      ok: true,
      checks: checked,
      scope: "isolated-loopback-apache-routing",
      publicListeners: false,
      providerResources: false,
    }) + "\n",
  );
} finally {
  await stop();
  if (backend.listening)
    await new Promise<void>((resolve) => backend.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
}
