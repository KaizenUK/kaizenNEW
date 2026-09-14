import { createServer } from "node:https";
import { readFile, readdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

// Compare isolated production builds made with the documented fixture config.
// No real provider, account, project, telemetry or external font requests.
const [beforeDirectory, afterDirectory, output] = process.argv.slice(2);
if (!beforeDirectory || !afterDirectory || !output)
  throw new Error(
    "Usage: node scripts/measure-builder-performance.mjs BEFORE_DIST AFTER_DIST OUTPUT_JSON",
  );
const projectId = "11111111-1111-4111-8111-111111111111";
const user = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "performance@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: {
    full_name: "Performance Fixture",
    builder_password_set: true,
  },
  app_metadata: {},
  created_at: "2026-09-14T00:00:00Z",
};
const exp = Math.floor(Date.now() / 1000) + 3600;
const session = {
  access_token: [
    { alg: "HS256", typ: "JWT" },
    { sub: user.id, role: "authenticated", exp },
    "fixture-signature",
  ]
    .map((v) =>
      Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString(
        "base64url",
      ),
    )
    .join("."),
  refresh_token: "fixture-refresh",
  expires_at: exp,
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const project = {
  id: projectId,
  name: "Performance fixture",
  archived: false,
  version: 1,
  createdAt: user.created_at,
  updatedAt: user.created_at,
  capabilities: {
    hasInventory: false,
    legacyWorkspace: false,
    publishPath: "worker",
  },
  destination: {
    kind: "unconfigured",
    label: "No deployment destination configured",
  },
  access: { role: "owner", canPublish: true },
};
const settings = {
  cpuSlowdown: 4,
  latencyMs: 40,
  downloadBitsPerSecond: 10000000,
  uploadBitsPerSecond: 1000000,
  runsPerBuild: 5,
};
const tlsDirectory = await mkdtemp(
  path.join(os.tmpdir(), "kaizen-performance-tls-"),
);
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    path.join(tlsDirectory, "key.pem"),
    "-out",
    path.join(tlsDirectory, "cert.pem"),
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=IP:127.0.0.1,DNS:localhost",
  ],
  { stdio: "ignore" },
);
const tls = {
  key: await readFile(path.join(tlsDirectory, "key.pem")),
  cert: await readFile(path.join(tlsDirectory, "cert.pem")),
};
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
async function serve(directory) {
  const files = new Map(),
    chunks = [];
  for (const name of await readdir(directory, { recursive: true })) {
    let bytes;
    try {
      bytes = await readFile(path.join(directory, name));
    } catch (e) {
      if (e.code === "EISDIR") continue;
      throw e;
    }
    const body = gzipSync(bytes);
    files.set(`/${name.replaceAll(path.sep, "/")}`, {
      body,
      type: types[path.extname(name)] || "application/octet-stream",
    });
    if (name.endsWith(".js"))
      chunks.push({ file: name, bytes: bytes.length, gzip: body.length });
  }
  const server = createServer(tls, (req, res) => {
    let key = new URL(req.url, "http://127.0.0.1").pathname;
    if (key.endsWith("/")) key += "index.html";
    const file = files.get(key);
    if (!file) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": file.type,
      "Content-Encoding": "gzip",
      "Cache-Control": "no-store",
      "Content-Length": file.body.length,
    });
    res.end(file.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    origin: `https://127.0.0.1:${server.address().port}`,
    chunks: chunks.sort((a, b) => b.bytes - a.bytes),
  };
}
const builds = {
  before: await serve(path.resolve(beforeDirectory)),
  after: await serve(path.resolve(afterDirectory)),
};
const browser = await chromium.launch();
const results = [];
try {
  for (let run = 1; run <= settings.runsPerBuild; run++)
    for (const name of run % 2 ? ["before", "after"] : ["after", "before"]) {
      const build = builds[name],
        context = await browser.newContext({
          viewport: { width: 1366, height: 768 },
          ignoreHTTPSErrors: true,
        });
      const page = await context.newPage(),
        unexpected = [],
        expectedFixtureErrors = [],
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        if (
          message.location().url ===
            `${build.origin}/editor-api/builder-repository` &&
          message.text() ===
            "Failed to load resource: the server responded with a status of 503 (Service Unavailable)"
        )
          expectedFixtureErrors.push(message.text());
        else errors.push(message.text());
      });
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (
          url.origin === build.origin &&
          !url.pathname.startsWith("/editor-api/")
        )
          return route.continue();
        if (
          ["fonts.googleapis.com", "fonts.gstatic.com", "rsms.me"].includes(
            url.hostname,
          )
        )
          return route.fulfill({ contentType: "text/css", body: "" });
        const headers = {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
        };
        if (route.request().method() === "OPTIONS")
          return route.fulfill({ status: 204, headers });
        if (url.hostname === "performance-fixture.supabase.test") {
          if (url.pathname === "/auth/v1/user")
            return route.fulfill({ headers, json: user });
          if (url.pathname === "/functions/v1/builder-projects") {
            const input = route.request().postDataJSON();
            if (input.action === "list")
              return route.fulfill({ headers, json: [project] });
            if (input.action === "load" && input.projectId === projectId)
              return route.fulfill({
                headers,
                json: { pages: [], assets: [], saved: [] },
              });
            if (input.action === "record-error")
              return route.fulfill({ headers, json: { recorded: false } });
          }
        }
        if (
          url.origin === build.origin &&
          url.pathname === "/editor-api/builder-repository"
        )
          return route.fulfill({
            status: 503,
            json: {
              error: "This fixture website has no repository connected.",
            },
          });
        unexpected.push(
          `${route.request().method()} ${url.origin}${url.pathname}`,
        );
        return route.abort();
      });
      await context.addInitScript((value) => {
        localStorage.setItem(
          "sb-performance-fixture-auth-token",
          JSON.stringify(value),
        );
        const observer = new MutationObserver(() => {
          const button = [...document.querySelectorAll("button")].find(
            (b) => b.textContent.trim() === "Blank page" && !b.disabled,
          );
          if (
            !button ||
            !document.body.innerText.includes("Performance fixture")
          )
            return;
          observer.disconnect();
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (
                button.isConnected &&
                !button.disabled &&
                button.getBoundingClientRect().width > 0
              )
                window.builderUsefulPaint = performance.now();
            }),
          );
        });
        observer.observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
        });
      }, session);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Emulation.setCPUThrottlingRate", {
        rate: settings.cpuSlowdown,
      });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: settings.latencyMs,
        downloadThroughput: settings.downloadBitsPerSecond / 8,
        uploadThroughput: settings.uploadBitsPerSecond / 8,
      });
      await page.goto(`${build.origin}/builder/?project=${projectId}`);
      try {
        await page.waitForFunction(() => window.builderUsefulPaint > 0, null, {
          timeout: 30000,
        });
      } catch (error) {
        await page.screenshot({
          path: `${output}.failure.png`,
          fullPage: true,
        });
        throw new Error(
          JSON.stringify({
            name,
            unexpected,
            errors,
            body: await page.locator("body").innerText(),
          }),
          { cause: error },
        );
      }
      const measurement = await page.evaluate(() => {
        const useful = window.builderUsefulPaint;
        const resources = performance
          .getEntriesByType("resource")
          .filter((r) => r.responseEnd <= useful);
        return {
          usefulPaintMs: useful,
          firstContentfulPaintMs: performance.getEntriesByName(
            "first-contentful-paint",
          )[0]?.startTime,
          scriptTransferBytes: resources
            .filter((r) => new URL(r.name).pathname.endsWith(".js"))
            .reduce((n, r) => n + r.encodedBodySize, 0),
          scripts: resources
            .filter((r) => new URL(r.name).pathname.endsWith(".js"))
            .map((r) => new URL(r.name).pathname),
        };
      });
      if (unexpected.length || errors.length)
        throw new Error(JSON.stringify({ name, unexpected, errors }));
      if (
        name === "after" &&
        measurement.scripts.some((file) =>
          /\/(?:PageEditor|SitePageEditor|AssetLibrary)\./.test(file),
        )
      )
        throw new Error("An editor was downloaded before opening a feature.");
      results.push({ build: name, run, expectedFixtureErrors, ...measurement });
      console.log(
        `${name} ${run}: useful ${Math.round(measurement.usefulPaintMs)} ms, scripts ${measurement.scriptTransferBytes} bytes`,
      );
      await context.close();
    }
  if (builds.after.chunks[0].bytes > 1000 * 1000)
    throw new Error(
      "The after build still exceeds the existing chunk warning threshold.",
    );
  const median = (items) =>
    items.sort((a, b) => a - b)[Math.floor(items.length / 2)];
  await writeFile(
    output,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        browser: browser.version(),
        machine: {
          cpu: os.cpus()[0].model,
          logicalCpus: os.cpus().length,
          memoryMiB: Math.round(os.totalmem() / 1048576),
        },
        settings,
        limits:
          "Fourfold CPU slowdown and a shaped local network are a reproducible proxy, not a measurement on a physical mid-range laptop. Empty signed-in project, fixture provider replies, local gzip HTTPS static server with a temporary test certificate, external fonts stubbed. First useful paint is two animation frames after a visible enabled Blank page control and project name appear. Five fresh contexts per build, cache disabled, alternating order. FCP includes Astro's opening message and is not readiness.",
        summaries: Object.fromEntries(
          Object.keys(builds).map((name) => [
            name,
            {
              medianUsefulPaintMs: median(
                results
                  .filter((r) => r.build === name)
                  .map((r) => r.usefulPaintMs),
              ),
              medianScriptTransferBytes: median(
                results
                  .filter((r) => r.build === name)
                  .map((r) => r.scriptTransferBytes),
              ),
              largestChunks: builds[name].chunks.slice(0, 15),
            },
          ]),
        ),
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await rm(tlsDirectory, { recursive: true, force: true });
  await Promise.all(
    Object.values(builds).map(
      ({ server }) => new Promise((resolve) => server.close(resolve)),
    ),
  );
}
