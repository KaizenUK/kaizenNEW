import { afterEach, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  measureRepositorySource,
  measureRepositoryOutput,
} from "../../scripts/builder-repository-usage.mjs";

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-usage-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

it.skipIf(process.platform === "win32")(
  "rejects a named pipe before opening it for a source measurement",
  async () => {
    const root = await fixture();
    await promisify(execFile)("mkfifo", [path.join(root, "pipe")]);
    await expect(measureRepositorySource(root)).rejects.toThrow(
      /regular source files/,
    );
  },
);

it("measures source including untracked bytes, excluding generated build and recovery copies", async () => {
  const root = await fixture();
  for (const folder of [
    "src/pages",
    "node_modules/test",
    "dist",
    ".kaizen/recovery/old",
    ".kaizen/build-recovery/old",
  ])
    await mkdir(path.join(root, folder), { recursive: true });
  await writeFile(path.join(root, "src/pages/[slug].astro"), "£");
  await writeFile(path.join(root, "untracked.txt"), "hello");
  const first = await measureRepositorySource(root);
  expect(first).toMatchObject({ bytes: 7, projectedBytes: 7 });
  for (const name of [
    "node_modules/test/file",
    "dist/index.html",
    ".kaizen/recovery/old/file",
    ".kaizen/build-recovery/old/file",
  ])
    await writeFile(path.join(root, name), "Generated data");
  expect(await measureRepositorySource(root)).toEqual(first);
  const projection = await measureRepositorySource(
    root,
    new Map([
      ["untracked.txt", null],
      ["src/pages/[slug].astro", Buffer.from("one")],
      ["public/new.txt", Buffer.from("test")],
    ]),
  );
  expect(projection).toEqual({ ...first, projectedBytes: 7 });
  await writeFile(path.join(root, "untracked.txt"), "changed");
  expect((await measureRepositorySource(root)).revision).not.toBe(
    first.revision,
  );
});

it("rejects linked source and invalid projected paths without reading outside the source root", async () => {
  const root = await fixture(),
    outside = await fixture();
  await writeFile(path.join(outside, "file"), "Outside source");
  await symlink(outside, path.join(root, "linked"));
  await expect(measureRepositorySource(root)).rejects.toThrow(
    /does not follow source links/,
  );
  await rm(path.join(root, "linked"));
  await expect(
    measureRepositorySource(root, new Map([["../file", Buffer.from("bad")]])),
  ).rejects.toThrow(/Invalid website usage path/);
});

it("counts each generated HTML page from frozen output rather than its single dynamic source route", () => {
  const files = new Map<string, Buffer>();
  for (let i = 0; i < 6; i++)
    files.set(`/article-${i}/index.html`, Buffer.from("<p>Page</p>"));
  files.set("/assets/site.js", Buffer.from("code"));
  expect(measureRepositoryOutput(files)).toEqual({ pages: 6, bytes: 70 });
});
