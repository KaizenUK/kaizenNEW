import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, symlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { RepositoryRunner, type BuildJob } from "../../scripts/builder-runner";
import { RepositoryCompanion } from "../../scripts/builder-repository";
import { sourcePreviewPath } from "../../scripts/builder-source-preview";
import {
  frameHtml,
  frameCss,
  frameSrcset,
} from "../../scripts/builder-source-frame";

describe("M2-T1 cookie-free frame assets", () => {
  const prefix = "/__kaizen-preview/token";
  it("rewrites HTML URL attributes without changing scripts, text or external URLs", () => {
    const html = `<link href='/style.css'><img src=/photo.png srcset="/small.png 1x, /large.png 2x" poster="/poster.png"><meta content="/share.png"><astro-island component-url="/island.js" renderer-url="/react.js"></astro-island><a href="https://example.com/">/text</a><script>const s='<img src="/literal.png">';</script>`;
    const result = frameHtml(html, prefix);
    for (const name of [
      "style.css",
      "photo.png",
      "small.png",
      "large.png",
      "poster.png",
      "share.png",
      "island.js",
      "react.js",
    ])
      expect(result).toContain(`${prefix}/${name}`);
    expect(result).toContain(`href="https://example.com/"`);
    expect(result).toContain(`const s='<img src="/literal.png">';`);
    expect(frameHtml(result, prefix)).toBe(result);
  });
  it("keeps data, protocol-relative and external URLs and handles CSS imports and inline styles", () => {
    expect(
      frameSrcset(
        "data:image/png;base64,AAAA 1x, /large.png 2x, https://example.com/img.png 3x",
        prefix,
      ),
    ).toBe(
      `data:image/png;base64,AAAA 1x, ${prefix}/large.png 2x, https://example.com/img.png 3x`,
    );
    const css = `@import '/theme.css'; a{background:url(/a.png);mask:url("//cdn.test/b.svg");content:"url(/text)"}/* url(/comment) */`;
    expect(frameCss(css, prefix)).toBe(
      `@import '${prefix}/theme.css'; a{background:url(${prefix}/a.png);mask:url("//cdn.test/b.svg");content:"url(/text)"}/* url(/comment) */`,
    );
    expect(
      frameHtml(
        '<style>a{background:url(/a.png)}</style><div style="background:url(/b.png)"></div>',
        prefix,
      ),
    ).toBe(
      `<style>a{background:url(${prefix}/a.png)}</style><div style="background:url(${prefix}/b.png)"></div>`,
    );
  });
});

const runners: RepositoryRunner[] = [];
function runner(timeout?: number) {
  const value = new RepositoryRunner(timeout);
  runners.push(value);
  return value;
}
afterEach(async () => {
  await Promise.all(runners.splice(0).map((value) => value.close()));
});
async function fixture(script: string) {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-runner-test-"));
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      type: "module",
      scripts: { build: "node build.mjs" },
      dependencies: { astro: "6.0.4", "@astrojs/react": "5.0.0" },
    }),
  );
  await writeFile(
    path.join(root, "build.mjs"),
    `import {mkdir,writeFile} from 'node:fs/promises';\n${script}`,
  );
  return root;
}
async function finished(value: RepositoryRunner, job: BuildJob) {
  let result = job;
  const end = Date.now() + 15000;
  while (result.status === "building" && Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, 40));
    result = value.status(job.id, job.projectId);
  }
  expect(result.status, JSON.stringify(result)).not.toBe("building");
  return result;
}
const output = `await mkdir('dist/contact',{recursive:true}); await writeFile('dist/index.html','<h1>First client</h1><a href="/contact/">Contact</a>'); await writeFile('dist/contact/index.html','<h1>Contact</h1>');`;

describe("reviewed local repository builds", () => {
  it("binds rendered selection to the project, current source and private built snapshot", async () => {
    const root = await fixture(output);
    await writeFile(
      path.join(root, "src/pages/index.astro"),
      "<h1>First client</h1>",
    );
    const inspection = await new RepositoryCompanion().inspectSourcePage(
      root,
      "src/pages/index.astro",
    );
    const value = runner();
    const job = await finished(
      value,
      await value.start((await value.prepare(root, "client-a")).id, "client-a"),
    );
    await expect(
      value.sourcePreview(
        job.id,
        "client-b",
        inspection,
        "http://localhost:4321",
      ),
    ).rejects.toThrow("not found");
    await expect(
      value.sourcePreview(
        job.id,
        "client-a",
        inspection,
        "https://example.com",
      ),
    ).rejects.toThrow("local editor");
    const selected = await value.sourcePreview(
      job.id,
      "client-a",
      inspection,
      "http://localhost:4321",
    );
    const framed = await value.sourcePreview(
      job.id,
      "client-a",
      inspection,
      "https://builder.example",
      true,
      true,
    );
    const frameResponse = await fetch(framed.url);
    expect(frameResponse.status).toBe(200);
    expect(frameResponse.headers.get("set-cookie")).toBeNull();
    expect(frameResponse.headers.get("content-security-policy")).toBe(
      "connect-src 'none'; form-action 'none'; frame-ancestors 'self' https://builder.example",
    );
    expect(await frameResponse.text()).toContain(
      `/__kaizen-preview/${framed.nonce}/__kaizen-canvas.js`,
    );
    expect(
      (await fetch(framed.url.replace(framed.nonce, "0".repeat(64)))).status,
    ).toBe(403);
    const entry = await fetch(selected.url, { redirect: "manual" });
    expect(entry.status).toBe(303);
    const cookie = entry.headers.get("set-cookie")!.split(";")[0];
    const origin = new URL(selected.url).origin;
    const bridge = `${origin}/__kaizen-source-script/${selected.nonce}.js`;
    expect((await fetch(bridge)).status).toBe(403);
    const html = await (
      await fetch(new URL(entry.headers.get("location")!, origin), {
        headers: { Cookie: cookie },
      })
    ).text();
    expect(html).toContain(`/__kaizen-source-script/${selected.nonce}.js`);
    expect(
      await (await fetch(origin, { headers: { Cookie: cookie } })).text(),
    ).not.toContain("__kaizen-source-script");
    const script = await (
      await fetch(bridge, { headers: { Cookie: cookie } })
    ).text();
    expect(script).toContain("First client");
    expect(script).toContain("http://localhost:4321");
    await writeFile(
      path.join(root, "src/pages/index.astro"),
      "<h1>New source</h1>",
    );
    await expect(
      value.sourcePreview(
        job.id,
        "client-a",
        inspection,
        "http://localhost:4321",
      ),
    ).rejects.toThrow("changed after this build");
    expect(sourcePreviewPath("src/pages/blog/index.astro")).toBe("/blog/");
    expect(() => sourcePreviewPath("src/pages/[slug].astro")).toThrow(
      "static Astro",
    );
  });
  it("rejects output built while source changed and preserves the developer edit", async () => {
    const root = await fixture(
      `${output} await writeFile('src/pages/changed.astro','<p>New developer content</p>');`,
    );
    const value = runner();
    const job = await finished(
      value,
      await value.start((await value.prepare(root, "client-a")).id, "client-a"),
    );
    expect(job.status).toBe("failed");
    expect(job.error).toContain("Source files changed during");
    expect(job.previewUrl).toBeUndefined();
    expect(
      await readFile(path.join(root, "src/pages/changed.astro"), "utf8"),
    ).toContain("New developer content");
    expect(
      await readFile(
        path.join(job.recoveryDirectory, "failed-dist/index.html"),
        "utf8",
      ),
    ).toContain("First client");
  });
  it("runs the actual package command and serves a private, frozen, isolated static snapshot", async () => {
    const root = await fixture(
      `${output} await mkdir('dist/.kaizen',{recursive:true}); await writeFile('dist/.kaizen/project.zip','private'); await writeFile('dist/app.js.map','private');`,
    );
    const value = runner();
    const plan = await value.prepare(root, "client-a");
    expect(plan.scripts).toEqual([
      { name: "build", command: "node build.mjs" },
    ]);
    await expect(value.start(plan.id, "client-b")).rejects.toThrow(
      "another project",
    );
    const first = await value.start(plan.id, "client-a");
    expect(() => value.status(first.id, "client-b")).toThrow("not found");
    const concurrent = await value.prepare(root, "client-b");
    await expect(value.start(concurrent.id, "client-b")).rejects.toThrow(
      "already running",
    );
    const job = await finished(value, first);
    expect(job.status, job.error).toBe("succeeded");
    const origin = new URL(job.previewUrl!).origin;
    expect((await fetch(origin)).status).toBe(403);
    const entry = await fetch(job.previewUrl!, { redirect: "manual" });
    expect(entry.status).toBe(303);
    const cookie = entry.headers.get("set-cookie")!.split(";")[0];
    await writeFile(
      path.join(root, "dist/index.html"),
      "New disk content must not alter the preview",
    );
    const response = await fetch(origin, { headers: { Cookie: cookie } });
    expect(await response.text()).toContain("First client");
    expect(response.headers.get("content-security-policy")).toContain(
      "connect-src 'none'",
    );
    expect(
      await (
        await fetch(`${origin}/contact/`, { headers: { Cookie: cookie } })
      ).text(),
    ).toContain("Contact");
    for (const file of [
      "/.kaizen/project.zip",
      "/app.js.map",
      "/package.json",
      "/%2e%2e/package.json",
      "/index.html::$DATA",
    ])
      expect(
        (await fetch(`${origin}${file}`, { headers: { Cookie: cookie } }))
          .status,
      ).toBe(404);
    expect(
      (await fetch(origin, { method: "POST", headers: { Cookie: cookie } }))
        .status,
    ).toBe(403);
    await value.cancel(first.id, "client-a");
    expect(value.status(first.id, "client-a").previewUrl).toBeUndefined();
    await expect(fetch(origin)).rejects.toThrow();
  }, 30000);
  it("ignores helper drafts when checking whether reviewed source has changed", async () => {
    const root = await fixture(output),
      value = runner();
    const plan = await value.prepare(root, "client-a");
    await mkdir(path.join(root, ".kaizen-builder"));
    await writeFile(
      path.join(root, ".kaizen-builder", "draft.json"),
      "private draft",
    );
    const job = await finished(value, await value.start(plan.id, "client-a"));
    expect(job.status, job.log).toBe("succeeded");
  });
  it("rejects stale review and does not accept old dist after a failed or empty build", async () => {
    const root = await fixture(`${output} process.exitCode=2;`);
    await mkdir(path.join(root, "dist"));
    await writeFile(
      path.join(root, "dist/index.html"),
      "Previous working build",
    );
    const value = runner();
    const stale = await value.prepare(root, "client-a");
    await writeFile(
      path.join(root, "src/pages/new.astro"),
      "<p>Developer edit</p>",
    );
    await expect(value.start(stale.id, "client-a")).rejects.toThrow(
      "changed since",
    );
    const job = await finished(
      value,
      await value.start((await value.prepare(root, "client-a")).id, "client-a"),
    );
    expect(job.status).toBe("failed");
    expect(job.previewUrl).toBeUndefined();
    expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe(
      "Previous working build",
    );
    expect(
      await readFile(
        path.join(job.recoveryDirectory, "failed-dist/index.html"),
        "utf8",
      ),
    ).toContain("First client");
    await writeFile(
      path.join(root, "build.mjs"),
      "console.log('exit zero without output')",
    );
    const empty = await finished(
      value,
      await value.start((await value.prepare(root, "client-a")).id, "client-a"),
    );
    expect(empty.status).toBe("failed");
    expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe(
      "Previous working build",
    );
  }, 30000);
  it("cancels and times out real processes, recovers output and allows a later successful build", async () => {
    const root = await fixture(
      `${output} console.log('running'); setInterval(()=>{},1000);`,
    );
    const value = runner(1500);
    const first = await value.start(
      (await value.prepare(root, "client-a")).id,
      "client-a",
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    const cancelled = await value.cancel(first.id, "client-a");
    expect(cancelled.status).toBe("cancelled");
    const timeout = await finished(
      value,
      await value.start((await value.prepare(root, "client-a")).id, "client-a"),
    );
    expect(timeout.status).toBe("cancelled");
    expect(timeout.error).toContain("time limit");
    await writeFile(
      path.join(root, "build.mjs"),
      `import {mkdir,writeFile} from 'node:fs/promises'; ${output}`,
    );
    const recovered = await finished(
      value,
      await value.start((await value.prepare(root, "client-a")).id, "client-a"),
    );
    expect(recovered.status, recovered.error).toBe("succeeded");
  }, 30000);
  it("refuses linked output without moving files outside the inspected repository", async () => {
    const root = await fixture(output),
      outside = await mkdtemp(path.join(tmpdir(), "kaizen-runner-outside-"));
    await writeFile(path.join(outside, "index.html"), "Keep this file");
    await symlink(
      outside,
      path.join(root, "dist"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const value = runner();
    const result = await finished(
      value,
      await value.start((await value.prepare(root, "client-a")).id, "client-a"),
    );
    expect(result.status).toBe("failed");
    expect(result.error).toContain("real directory");
    expect(await readFile(path.join(outside, "index.html"), "utf8")).toBe(
      "Keep this file",
    );
  });
});
