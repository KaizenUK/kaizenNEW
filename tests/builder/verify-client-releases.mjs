// Actual Nginx, separate client stores and independently built website input.
import { mkdtemp, mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  bindClientStore,
  stageRelease,
  initialiseStore,
  activateRelease,
  verifyRelease,
  checkLive,
  listReleases,
} from "../../scripts/kaizen-releases.mjs";
import {
  builderNginxRules,
  builderRedirectChecks,
} from "../../shared/builderRedirects.js";
import {
  readClientDestinations,
  clientPublicationAction,
} from "../../scripts/client-publication.mjs";

if (!process.argv[2])
  throw new Error("Pass an independently built client repository folder.");
const source = path.resolve(process.argv[2], "dist");
await readFile(path.join(source, "about/index.html"));
const binary = process.env.KAIZEN_NGINX_BINARY || "nginx",
  run = promisify(execFile);
// Reload verification can finish while an older Nginx worker is still draining.
// Subsequent observations must also require the expected bytes after that handoff.
async function afterReload(observe) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await observe();
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
const siteFetch = (url, options = {}) =>
  fetch(url, {
    ...options,
    headers: { ...options.headers, Connection: "close" },
  });
const base = path.resolve("test-results/client-nginx-releases");
await mkdir(base, { recursive: true });
const root = await mkdtemp(path.join(base, "run-")),
  prefix = path.join(root, "nginx");
await mkdir(path.join(prefix, "logs"), { recursive: true });
await mkdir(path.join(prefix, "temp"));
const forward = (value) => value.replaceAll("\\", "/");
const nginx = (args) =>
  run(binary, ["-p", `${forward(prefix)}/`, "-c", "nginx.conf", ...args], {
    cwd: prefix,
    windowsHide: true,
    timeout: 15000,
  });
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const alpha = randomUUID(),
  beta = randomUUID();
const destinations = [];
for (const [name, projectId, environment] of [
  ["alpha-stage", alpha, "staging"],
  ["alpha-live", alpha, "production"],
  ["beta-live", beta, "production"],
]) {
  const port = await freePort(),
    origin = `http://127.0.0.1:${port}`,
    store = path.join(root, name);
  const client = {
    projectId,
    destinationId: randomUUID(),
    environment,
    origin,
  };
  await bindClientStore({ store, client });
  const manifest = await stageRelease({
    store,
    source,
    id: "baseline",
    client,
  });
  await initialiseStore({ store, id: manifest.id });
  destinations.push({ name, port, origin, store, client, manifest });
}
await writeFile(
  path.join(prefix, "nginx.conf"),
  `daemon off;
master_process on;
worker_processes 1;
pid logs/nginx.pid;
error_log logs/error.log notice;
events {worker_connections 128;}
http {
types {text/html html; text/css css; application/javascript js; application/json json; image/svg+xml svg; image/png png; image/jpeg jpg jpeg; font/woff2 woff2;}
access_log off;
client_body_temp_path temp/client_body; proxy_temp_path temp/proxy; fastcgi_temp_path temp/fastcgi; uwsgi_temp_path temp/uwsgi; scgi_temp_path temp/scgi;
${destinations.map((destination) => `server {listen 127.0.0.1:${destination.port}; server_name localhost; include "${forward(path.join(destination.store, "active.conf"))}"; index index.html; location / {try_files $uri $uri/ =404;}}`).join("\n")}
}
`,
);
await nginx(["-t"]);
const child = spawn(binary, ["-p", `${forward(prefix)}/`, "-c", "nginx.conf"], {
  cwd: prefix,
  windowsHide: true,
  stdio: "ignore",
});
let exited = false;
child.on("exit", () => {
  exited = true;
});
const adapters = {
  validateConfig: () => nginx(["-t"]),
  reload: () => nginx(["-s", "reload"]),
};
const target = destinations[1];
const configFile = path.join(root, "destinations.json");
await writeFile(
  configFile,
  JSON.stringify({
    schemaVersion: 1,
    destinations: destinations.map((value) => ({
      ...value.client,
      label: value.name,
      store: value.store,
    })),
  }),
);
const registered = (await readClientDestinations(configFile)).find(
  (value) => value.destinationId === target.client.destinationId,
);
const cli = (action, args = []) =>
  run(
    process.execPath,
    [
      path.resolve("scripts/client-publication.mjs"),
      action,
      "--config",
      configFile,
      "--destination",
      target.client.destinationId,
      ...args,
    ],
    { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 },
  );
try {
  for (let attempt = 0; ; attempt++)
    try {
      await Promise.all(
        destinations.map((destination) =>
          checkLive(destination.origin, destination.manifest),
        ),
      );
      break;
    } catch (error) {
      if (attempt === 30 || exited) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  await assert.rejects(
    () =>
      stageRelease({
        source,
        store: target.store,
        id: "wrong-project",
        client: destinations[2].client,
      }),
    /does not match/,
  );
  const next = path.join(root, "second-build");
  await cp(source, next, { recursive: true });
  await writeFile(
    path.join(next, "about/index.html"),
    (await readFile(path.join(next, "about/index.html"), "utf8")).replaceAll(
      "Independent client about",
      "Published revision two",
    ),
  );
  await mkdir(path.join(next, "assets"), { recursive: true });
  await writeFile(
    path.join(next, "assets/revision-two.css"),
    "body{--client-release:2}",
  );
  const redirects = [
    {
      id: randomUUID(),
      source: "/previous-about/",
      destination: "/about/",
      status: 301,
    },
  ];
  await writeFile(
    path.join(next, "redirects.generated.conf"),
    builderNginxRules(redirects).join("\n"),
  );
  await writeFile(
    path.join(next, "redirects.generated.json"),
    JSON.stringify({
      schemaVersion: 1,
      checks: builderRedirectChecks(redirects),
    }),
  );
  const reviewedRedirects = path.join(root, "reviewed-redirects.json");
  await writeFile(reviewedRedirects, JSON.stringify(redirects));
  await cli("stage", [
    "--source",
    next,
    "--redirects",
    reviewedRedirects,
    "--id",
    "revision-two",
  ]);
  const release = await verifyRelease(target.store, "revision-two");
  await clientPublicationAction(
    registered,
    "activate",
    { id: release.id },
    adapters,
  );
  const listed = JSON.parse(
    (await cli("list")).stdout.trim().split("\n").at(-1),
  );
  assert.equal(listed.selectedReleaseId, release.id);
  await cli("verify-live", ["--id", release.id]);
  assert.match(
    await (await fetch(`${target.origin}/about/`)).text(),
    /Published revision two/,
  );
  for (const other of [destinations[0], destinations[2]]) {
    await checkLive(other.origin, other.manifest);
    assert.equal(
      (await fetch(`${other.origin}/assets/revision-two.css`)).status,
      404,
    );
  }
  const alias = await fetch(
    `${target.origin}/previous-about/?utm_source=client-test`,
    { redirect: "manual" },
  );
  assert.equal(alias.status, 301);
  assert.equal(
    new URL(alias.headers.get("location"), target.origin).pathname,
    "/about/",
  );
  assert.equal(
    new URL(alias.headers.get("location"), target.origin).search,
    "?utm_source=client-test",
  );
  await alias.body?.cancel();
  const bad = path.join(root, "bad-build");
  await cp(next, bad, { recursive: true });
  // The asset bytes are unchanged. A draining previous worker must not mask the
  // candidate's broken route: every response must carry the candidate identity.
  await writeFile(
    path.join(bad, "redirects.generated.conf"),
    `${builderNginxRules(redirects).join("\n")}\nlocation = "/assets/revision-two.css" {return 200 "wrong CSS";}\n`,
  );
  await stageRelease({
    store: target.store,
    source: bad,
    id: "bad-assets",
    client: target.client,
  });
  await assert.rejects(
    () =>
      activateRelease(
        { store: target.store, id: "bad-assets", origin: target.origin },
        adapters,
      ),
    /previous release was restored and verified/,
  );
  await afterReload(() => checkLive(target.origin, release));
  await clientPublicationAction(
    registered,
    "unpublish",
    { id: "unpublished" },
    adapters,
  );
  await afterReload(async () => {
    const response = await siteFetch(`${target.origin}/contact/`);
    await response.body?.cancel();
    assert.equal(response.status, 404);
  });
  await clientPublicationAction(
    registered,
    "rollback",
    { id: release.id },
    adapters,
  );
  await afterReload(async () => {
    await checkLive(target.origin, release);
    const response = await siteFetch(`${target.origin}/contact/`);
    await response.body?.cancel();
    assert.equal(response.status, 200);
  });
  const { chromium, expect } = await import("@playwright/test");
  const context = await chromium.launchPersistentContext(
    path.join(root, "browser-profile"),
    {
      headless: true,
      ...(process.platform === "win32" ? { channel: "msedge" } : {}),
    },
  );
  try {
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${target.origin}/about/`);
      await expect(
        page.getByText("Published revision two", { exact: true }),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      if (width === 390) {
        await page.locator(".kb-menu-mobile summary").focus();
        await page.keyboard.press("Enter");
      }
      await page.screenshot({
        path: `test-results/client-release-${width}.png`,
        fullPage: true,
      });
      await page
        .locator(width === 390 ? ".kb-menu-mobile" : ".kb-menu-desktop")
        .getByRole("link", { name: "Contact", exact: true })
        .click();
      await expect(
        page.getByText("Independent client contact", { exact: true }),
      ).toBeVisible();
    }
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await context.close();
  }
  if (process.argv[3]) {
    const mediaRepository = path.resolve(process.argv[3]);
    const media = await stageRelease({
      source: path.join(mediaRepository, "dist"),
      store: target.store,
      id: "media-export",
      client: target.client,
      redirectRules: JSON.parse(
        await readFile(
          path.join(mediaRepository, "hosting/redirects.json"),
          "utf8",
        ),
      ),
    });
    await clientPublicationAction(
      registered,
      "activate",
      { id: media.id },
      adapters,
    );
    const checked = await afterReload(() => checkLive(target.origin, media));
    assert.ok(
      media.files.some((file) => /assets\/.*-[a-f0-9]{16}\./.test(file.path)),
    );
    console.log(
      `Fresh media export verified through Nginx: ${media.files.length} files, ${checked.checked} HTTP responses.`,
    );
  }
  const states = await listReleases(target.store);
  assert.equal(
    states.transactions.filter((transaction) => transaction.status === "live")
      .length,
    process.argv[3] ? 4 : 3,
  );
  assert.equal(
    states.transactions.filter(
      (transaction) => transaction.status === "rolled_back",
    ).length,
    1,
  );
  for (const other of [destinations[0], destinations[2]])
    await checkLive(other.origin, await verifyRelease(other.store, "baseline"));
  console.log(
    `Verified real Nginx client activation, separate staging/production and client stores, every-file HTTP checks, redirects, failed-release recovery, unpublish artifact, exact rollback, desktop/mobile navigation and console. Artifacts: ${root}`,
  );
} finally {
  await nginx(["-s", "quit"]);
  for (let attempt = 0; !exited && attempt < 100; attempt++)
    await new Promise((resolve) => setTimeout(resolve, 100));
  if (!exited)
    throw new Error(
      `Isolated Nginx process ${child.pid} has not exited; inspect before cleanup.`,
    );
}
