// Real runner snapshot, no cookies or security-disabling flags. WebKit uses
// the local developer builder: HTTPS-to-HTTP loopback embedding is blocked there.
// Run: pnpm exec tsx docs/handover/experiments/source-frame-host-check.mjs
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, firefox, webkit, expect } from "@playwright/test";
import { RepositoryRunner } from "../../../scripts/builder-runner.ts";
import { RepositoryCompanion } from "../../../scripts/builder-repository.ts";
const root = await mkdtemp(path.join(tmpdir(), "kaizen-frame-spike-"));
const runner = new RepositoryRunner();
const browserName = process.env.FRAME_BROWSER || "chromium";
const parentOrigin =
  browserName === "webkit"
    ? "http://127.0.0.1:4322"
    : "https://builder.example";
let browser;
const diagnostics = [];
try {
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  await writeFile(
    path.join(root, "src/pages/index.astro"),
    "<h1>Rendered local page</h1>",
  );
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      type: "module",
      dependencies: { astro: "7.3.2", "@astrojs/react": "6.0.5" },
      scripts: { build: "node build.mjs" },
    }),
  );
  const output = {
    "index.html":
      '<!doctype html><html><head><link rel="stylesheet" href="/site.css"></head><body><h1>Loading</h1><img alt="Fixture" src="/image.svg"><script type="module" src="/app.js"></script></body></html>',
    "app.js":
      "import {heading} from './heading.js'; document.querySelector('h1').textContent=heading;",
    "heading.js": "export const heading = 'Rendered local page';",
    "site.css":
      '@import "/theme.css"; body { background-image: url(/image.svg); }',
    "theme.css": "h1 { color: rgb(12, 34, 56); }",
    "image.svg":
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="green"/></svg>',
  };
  await writeFile(
    path.join(root, "build.mjs"),
    `import {mkdir,writeFile} from 'node:fs/promises'; await mkdir('dist'); for (const [name,bytes] of Object.entries(${JSON.stringify(output)})) await writeFile('dist/'+name,bytes);`,
  );
  const inspection = await new RepositoryCompanion().inspectSourcePage(
    root,
    "src/pages/index.astro",
  );
  let job = await runner.start(
    (await runner.prepare(root, "fixture")).id,
    "fixture",
  );
  await expect
    .poll(() => {
      job = runner.status(job.id, "fixture");
      return job.status;
    })
    .not.toBe("building");
  expect(job.status, job.log).toBe("succeeded");
  const preview = await runner.sourcePreview(
    job.id,
    "fixture",
    inspection,
    parentOrigin,
    true,
    true,
  );
  const response = await fetch(preview.url);
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("content-security-policy")).toBe(
    `connect-src 'none'; form-action 'none'; frame-ancestors 'self' ${parentOrigin}`,
  );
  expect((await fetch(new URL("/app.js", preview.url))).status).toBe(403);
  const engine = { chromium, firefox, webkit }[browserName];
  if (!engine)
    throw new Error("Choose chromium, firefox or webkit for the frame check.");
  browser = await engine.launch();
  const context = await browser.newContext();
  // Models the browser's Allow decision, not disabled browser security.
  if (browserName === "chromium")
    await context.grantPermissions(["local-network-access"], {
      origin: parentOrigin,
    });
  const page = await context.newPage();
  page.on("pageerror", (e) => diagnostics.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") diagnostics.push(m.text());
  });
  page.on("requestfailed", (r) =>
    diagnostics.push(`${r.url()}: ${r.failure()?.errorText}`),
  );
  await page.route(`${parentOrigin}/**`, (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<!doctype html><h1>Hosted editor fixture</h1><output id="status">Waiting</output><iframe title="Website canvas" sandbox="allow-scripts allow-same-origin" allow="local-network-access; local-network; loopback-network" src="${preview.url}"></iframe><script>
    let count=0;
    window.addEventListener('message',event=>{
      const frame=document.querySelector('iframe');
      if(event.source!==frame.contentWindow || event.origin!==${JSON.stringify(new URL(preview.url).origin)} || event.data?.nonce!==${JSON.stringify(preview.nonce)}) return;
      if(event.data.type==='kaizen-source-ready') { count++; if(count===1) frame.contentWindow.postMessage({type:'kaizen-source-hello',nonce:${JSON.stringify(preview.nonce)}},event.origin); else document.querySelector('#status').textContent='Handshake complete'; }
    });
  </script>`,
    }),
  );
  await page.goto(parentOrigin);
  const frame = page.frameLocator("iframe");
  await expect(frame.getByRole("heading")).toHaveText("Rendered local page");
  await expect(page.locator("#status")).toHaveText("Handshake complete");
  await expect(frame.getByRole("heading")).toHaveCSS(
    "color",
    "rgb(12, 34, 56)",
  );
  expect(
    await frame
      .getByRole("img")
      .evaluate((img) => img.complete && img.naturalWidth === 16),
  ).toBe(true);
  expect(await context.cookies(new URL(preview.url).origin)).toEqual([]);
  expect(diagnostics).toEqual([]);
  console.log(
    `PASS: ${browser.version()} ${parentOrigin.startsWith("https:") ? "HTTPS" : "HTTP local"} parent → real loopback snapshot; modules, CSS imports, images and bidirectional nonce handshake; no cookies.`,
  );
} catch (error) {
  console.error("Frame diagnostics:", diagnostics);
  throw error;
} finally {
  await browser?.close();
  await runner.close();
  await rm(root, { recursive: true, force: true });
}
