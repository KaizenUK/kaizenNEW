import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, symlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { RepositoryRunner, type BuildJob } from "../../scripts/builder-runner";

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
