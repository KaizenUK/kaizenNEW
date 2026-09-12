// Run from the repository root after pnpm build. Only reads source/build output here; all runner state and edits use a disposable copy.
import { mkdtemp, cp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { RepositoryRunner } from "../../../scripts/builder-runner.ts";
import { RepositoryCompanion } from "../../../scripts/builder-repository.ts";
const root = await mkdtemp(path.join(tmpdir(), "kaizen-real-page-copy-"));
const runner = new RepositoryRunner();
let browser;
try {
  for (const directory of ["src", "client", "shared"])
    await cp(directory, path.join(root, directory), { recursive: true });
  await cp("dist", path.join(root, "built-copy"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      type: "module",
      dependencies: { astro: "7.3.2", "@astrojs/react": "6.0.5" },
      scripts: { build: "node build.mjs" },
    }),
  );
  await writeFile(
    path.join(root, "build.mjs"),
    "import{cp}from'node:fs/promises';await cp('built-copy','dist',{recursive:true});",
  );
  const inspection = await new RepositoryCompanion().inspectSourcePage(
    root,
    "src/pages/about.astro",
  );
  let job = await runner.start(
    (await runner.prepare(root, "copied-site")).id,
    "copied-site",
  );
  await expect
    .poll(() => {
      job = runner.status(job.id, "copied-site");
      return job.status;
    })
    .not.toBe("building");
  expect(job.status, job.log).toBe("succeeded");
  const preview = await runner.sourcePreview(
    job.id,
    "copied-site",
    inspection,
    "https://builder.example",
    true,
    true,
  );
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.grantPermissions(["local-network-access"], {
    origin: "https://builder.example",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://builder.example/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<iframe style="width:1280px;height:900px" title="Website canvas" sandbox="allow-scripts allow-same-origin" allow="local-network-access; local-network; loopback-network" src="${preview.url}"></iframe><output></output><script>let edits={};window.addEventListener('message',event=>{if(event.data.nonce!==${JSON.stringify(preview.nonce)})return;if(event.data.type==='kaizen-source-ready')event.source.postMessage({type:'kaizen-source-state',nonce:event.data.nonce,values:edits,orders:{},locked:false},event.origin);if(event.data.type==='kaizen-source-edit'){edits[event.data.id]=event.data.value;document.querySelector('output').textContent=event.data.value;}});</script>`,
    }),
  );
  await page.goto("https://builder.example/");
  const frame = page.frameLocator("iframe");
  const heading = frame.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(
    "You've been through the agency thing before.",
  );
  await heading.dblclick();
  await heading.fill("Actual page copy acceptance");
  await expect(page.locator("output")).toHaveText(
    "Actual page copy acceptance",
  );
  await page.screenshot({ path: "test-results/kaizen-about-copy-1440.png" });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.locator("iframe").evaluate((el) => (el.style.width = "390px"));
  await heading.fill("Actual phone copy acceptance");
  await expect(page.locator("output")).toHaveText(
    "Actual phone copy acceptance",
  );
  await page.screenshot({ path: "test-results/kaizen-about-copy-390.png" });
  console.log(
    JSON.stringify({
      fields: inspection.fields.length,
      files: inspection.files.length,
      errors,
    }),
  );
  expect(errors).toEqual([]);
} finally {
  await browser?.close();
  await runner.close();
  await rm(root, { recursive: true, force: true });
}
