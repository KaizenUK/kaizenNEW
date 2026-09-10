// Real Nginx smoke test, isolated on a temporary loopback port. No system config or personal workspace is changed.
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import assert from "node:assert/strict";
import {
  builderNginxRules,
  builderRedirectChecks,
} from "../../shared/builderRedirects.js";
import {
  stageRelease,
  initialiseStore,
  activateRelease,
  verifyRelease,
  checkLive,
  listReleases,
} from "../../scripts/kaizen-releases.mjs";

const run = promisify(execFile),
  binary = process.env.KAIZEN_NGINX_BINARY || "nginx";
const base = path.resolve("test-results/nginx-release-smoke");
await mkdir(base, { recursive: true });
const root = await mkdtemp(path.join(base, "run-")),
  store = path.join(root, "store"),
  prefix = path.join(root, "nginx");
await mkdir(path.join(prefix, "logs"), { recursive: true });
await mkdir(path.join(prefix, "temp"), { recursive: true });
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`,
  forward = (file) => file.replaceAll("\\", "/");
const nginx = (args) =>
  run(binary, ["-p", `${forward(prefix)}/`, "-c", "nginx.conf", ...args], {
    cwd: prefix,
    windowsHide: true,
    timeout: 15_000,
  });
const redirectRules = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    source: "/old-url/",
    destination: "/campaign/",
    status: 301,
  },
];
async function build(
  id,
  label,
  redirects = builderNginxRules(redirectRules).join("\n"),
) {
  const source = path.join(root, id);
  for (const name of ["builder", "campaign", "_astro"])
    await mkdir(path.join(source, name), { recursive: true });
  await writeFile(
    path.join(source, "index.html"),
    `<!doctype html><title>${label}</title><h1>${label}</h1>`,
  );
  await writeFile(
    path.join(source, "builder/index.html"),
    `<!doctype html><meta name="robots" content="noindex"><h1>Builder ${label}</h1>`,
  );
  await writeFile(
    path.join(source, "campaign/index.html"),
    `<!doctype html><html data-kaizen-builder-page><h1>CMS ${label}</h1></html>`,
  );
  await writeFile(
    path.join(source, `_astro/${id}.hash.js`),
    `console.log(${JSON.stringify(label)})`,
  );
  await writeFile(path.join(source, "redirects.generated.conf"), redirects);
  await writeFile(
    path.join(source, "redirects.generated.json"),
    JSON.stringify({
      schemaVersion: 1,
      checks: builderRedirectChecks(redirectRules),
    }),
  );
  return stageRelease({ source, store, id });
}
const old = await build("original", "Original release");
await initialiseStore({ store, id: old.id });
await writeFile(
  path.join(prefix, "nginx.conf"),
  `daemon off;\nmaster_process on;\nworker_processes 1;\npid logs/nginx.pid;\nerror_log logs/error.log notice;\nevents {worker_connections 128;}\nhttp { types { text/html html; text/css css; application/javascript js; application/json json; image/svg+xml svg; image/png png; image/jpeg jpg jpeg; image/webp webp; font/woff2 woff2; font/ttf ttf; } access_log off; client_body_temp_path temp/client_body; proxy_temp_path temp/proxy; fastcgi_temp_path temp/fastcgi; uwsgi_temp_path temp/uwsgi; scgi_temp_path temp/scgi; server { listen 127.0.0.1:${port}; server_name localhost; include "${forward(path.join(store, "active.conf"))}"; index index.html; location / {try_files $uri $uri/ =404;} } }\n`,
);
await nginx(["-t"]);
const child = spawn(binary, ["-p", `${forward(prefix)}/`, "-c", "nginx.conf"], {
  cwd: prefix,
  windowsHide: true,
  stdio: "ignore",
});
let exited = false;
child.on("exit", () => (exited = true));
try {
  for (let i = 0; ; i++) {
    try {
      await checkLive(origin, old);
      break;
    } catch (error) {
      if (i === 30 || exited) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const adapters = {
    validateConfig: () => nginx(["-t"]),
    reload: () => nginx(["-s", "reload"]),
  };
  await build("next", "New release");
  const live = await activateRelease({ store, id: "next", origin }, adapters);
  assert.equal(live.status, "live");
  assert.match(
    await (await fetch(`${origin}/campaign/`)).text(),
    /CMS New release/,
  );
  assert.equal(
    (await fetch(`${origin}/old-url/`, { redirect: "manual" })).status,
    301,
  );
  assert.equal((await fetch(`${origin}/_astro/original.hash.js`)).status, 200);
  await build(
    "invalid-config",
    "Invalid config",
    "this_is_not_a_real_nginx_directive;\n",
  );
  await assert.rejects(
    () => activateRelease({ store, id: "invalid-config", origin }, adapters),
    /previous release was restored and verified/,
  );
  await checkLive(origin, await verifyRelease(store, "next"));
  // Valid Nginx syntax and correct pages cannot hide a lost query or wrong redirect target.
  await build(
    "wrong-redirect",
    "Wrong redirect",
    'location = "/old-url" { return 301 "/campaign/"; }\nlocation = "/old-url/" { return 301 "/campaign/"; }',
  );
  await assert.rejects(
    () => activateRelease({ store, id: "wrong-redirect", origin }, adapters),
    /previous release was restored and verified/,
  );
  await checkLive(origin, await verifyRelease(store, "next"));
  assert.equal((await fetch(`${origin}/redirects.generated.json`)).status, 404);
  // Nginx accepts this release's syntax, but a route override serves the wrong page. The HTTP hash check must catch it.
  await build(
    "wrong-route",
    "Wrong routed content",
    'location = "/campaign/" { return 200 "wrong response"; }\n',
  );
  await assert.rejects(
    () => activateRelease({ store, id: "wrong-route", origin }, adapters),
    /previous release was restored and verified/,
  );
  await checkLive(origin, await verifyRelease(store, "next"));
  await activateRelease({ store, id: "original", origin }, adapters);
  assert.match(
    await (await fetch(`${origin}/campaign/`)).text(),
    /CMS Original release/,
  );
  assert.equal((await fetch(`${origin}/_astro/next.hash.js`)).status, 200);
  assert.equal(
    (await fetch(`${origin}/.well-known/kaizen-release.json`)).headers.get(
      "cache-control",
    ),
    "no-store",
  );
  assert.deepEqual(
    (await listReleases(store)).transactions.map((item) => item.status).sort(),
    ["live", "live", "rolled_back", "rolled_back", "rolled_back"],
  );
  if (process.env.KAIZEN_RELEASE_SOURCE) {
    const application = await stageRelease({
      source: process.env.KAIZEN_RELEASE_SOURCE,
      store,
      id: "application-build",
    });
    await activateRelease({ store, id: application.id, origin }, adapters);
    const observed = await checkLive(origin, application);
    console.log(
      `Complete application artifact verified through Nginx: ${application.files.length} files, ${observed.checked} marker/page/redirect responses.`,
    );
    const { chromium, expect } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        }),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      if (process.env.KAIZEN_RELEASE_SNAPSHOT_TEST) {
        const snapshot = JSON.parse(
          await readFile(process.env.KAIZEN_RELEASE_SNAPSHOT_TEST, "utf8"),
        );
        assert.equal(snapshot.pages.length, 3);
        for (const item of snapshot.pages) {
          await page.goto(`${origin}/${item.document.slug}/`);
          await expect(
            page.locator("html[data-kaizen-builder-page]"),
          ).toHaveCount(1);
          assert.ok((await page.title()).includes(item.document.title));
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > window.innerWidth,
            ),
            false,
          );
        }
      } else {
        const fixture = JSON.parse(
          await readFile(
            "test-results/builder-conversions-fixture.json",
            "utf8",
          ),
        );
        await page.goto(`${origin}/${fixture.slug}/`);
        await expect(page.locator(".kb-reviewed-card")).toHaveText(
          "A reviewed and editable card",
        );
        await expect(page.locator(".kb-reviewed-card").locator("..")).toHaveCSS(
          "padding-left",
          "12px",
        );
        await expect(page.locator("script")).toHaveCount(0);
      }
      await page.screenshot({
        path: "test-results/builder-release-published-mobile.png",
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${origin}/builder/`);
      await expect(page.locator(".builder-app")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "A little inspiration",
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
      await page.screenshot({
        path: "test-results/builder-release-editor.png",
      });
      assert.deepEqual(errors, []);
      console.log(
        "Browser verified the static mobile page and the compiled builder entry through Nginx's retained asset alias. Hosted sign-in is not claimed.",
      );
    } finally {
      await browser.close();
    }
  }
  console.log(
    `Real Nginx release checks passed: activation, redirect aliases/query preservation, immutable assets, invalid config recovery, wrong-route/redirect recovery and exact rollback. Artifacts: ${root}`,
  );
} finally {
  await nginx(["-s", "quit"]);
  for (let i = 0; !exited && i < 100; i++)
    await new Promise((resolve) => setTimeout(resolve, 100));
  if (!exited)
    throw new Error(
      `The test Nginx process ${child.pid} has not exited; inspect it before cleanup.`,
    );
}
