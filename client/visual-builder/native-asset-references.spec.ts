import { afterEach, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  lstat,
  rename,
  chmod,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  NativeAssetMatcher,
  scanNativeAssetReferences,
  scanHostedNativeAssetReferences,
} from "../../scripts/builder-native-asset-references";
import { HostedWebsiteFolders } from "../../scripts/builder-hosted-folders";

const exec = promisify(execFile),
  roots: string[] = [];
const git = (root: string, ...args: string[]) =>
  exec("git", ["-C", root, "-c", "core.hooksPath=/dev/null", ...args], {
    env: {
      PATH: process.env.PATH,
      LANG: "C",
      LC_ALL: "C",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_AUTHOR_NAME: "Fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.test",
      GIT_COMMITTER_NAME: "Fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.test",
    },
  });
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "kaizen-native-assets-"));
  roots.push(directory);
  const root = path.join(directory, "repository"),
    recovery = path.join(directory, "drafts"),
    store = path.join(directory, "releases");
  for (const folder of [root, recovery, store]) await mkdir(folder);
  await git(root, "init", "--initial-branch=main");
  await writeFile(path.join(root, "package.json"), "{}");
  await git(root, "add", "package.json");
  await git(root, "commit", "-m", "Fixture baseline");
  const asset = {
    assetId: randomUUID(),
    url: 'https://fixture.example.test/media/old folder/café #?"photo.png',
  };
  const input = {
    root,
    assets: [asset],
    recoveryRoots: [recovery],
    releaseStores: [store],
  };
  return { directory, root, recovery, store, asset, input };
}
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

it("accepts only the producer's exact quiescent index lock and still refuses other or changed locks", async () => {
  const f = await fixture();
  const filename = path.join(f.root, ".git/index.lock");
  const contents = "Kaizen checkout " + randomUUID() + "\n";
  await writeFile(filename, contents, { mode: 0o600 });
  const metadata = await lstat(filename);
  const ownedIndex = { dev: metadata.dev, ino: metadata.ino, contents };
  await expect(scanNativeAssetReferences(f.input)).rejects.toThrow(
    "fully verified",
  );
  expect(
    (await scanNativeAssetReferences({ ...f.input, ownedIndex })).references,
  ).toEqual([]);
  await writeFile(path.join(f.root, ".git/HEAD.lock"), "Another operation");
  await expect(
    scanNativeAssetReferences({ ...f.input, ownedIndex }),
  ).rejects.toThrow("fully verified");
  await rm(path.join(f.root, ".git/HEAD.lock"));
  await writeFile(filename, "Changed owner");
  await expect(
    scanNativeAssetReferences({ ...f.input, ownedIndex }),
  ).rejects.toThrow("fully verified");
  await writeFile(path.join(f.root, ".git/replacement"), contents, {
    mode: 0o600,
  });
  await rename(path.join(f.root, ".git/replacement"), filename);
  await expect(
    scanNativeAssetReferences({ ...f.input, ownedIndex }),
  ).rejects.toThrow("fully verified");
});

it("finds current untracked source and returns no source contents or private paths", async () => {
  const f = await fixture();
  const filename = path.join(f.root, "untracked.txt");
  await writeFile(filename, `private surrounding value ${f.asset.assetId}`);
  const before = await readFile(filename);
  const result = await scanNativeAssetReferences(f.input);
  expect(result.references).toEqual([
    { assetId: f.asset.assetId, sources: ["source"] },
  ]);
  expect(result.historyObjects).toBeGreaterThan(0);
  expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(result)).not.toContain("private surrounding value");
  expect(JSON.stringify(result)).not.toContain(f.root);
  expect(await readFile(filename)).toEqual(before);
  expect((await git(f.root, "status", "--porcelain")).stdout).toBe(
    "?? untracked.txt\n",
  );
});

it("keeps references in packed older commits after their source file was deleted", async () => {
  const f = await fixture();
  await writeFile(path.join(f.root, "old.txt"), f.asset.assetId);
  await git(f.root, "add", "old.txt");
  await git(f.root, "commit", "-m", "Previous website file");
  await git(f.root, "rm", "old.txt");
  await git(f.root, "commit", "-m", "Remove current source reference");
  await git(f.root, "gc", "--prune=never");
  expect(
    (await readdir(path.join(f.root, ".git/objects/pack"))).some((name) =>
      name.endsWith(".pack"),
    ),
  ).toBe(true);
  expect((await scanNativeAssetReferences(f.input)).references).toEqual([
    { assetId: f.asset.assetId, sources: ["history"] },
  ]);
});

it("also retains unreachable Git blobs while their original data remains in the repository", async () => {
  const f = await fixture();
  await writeFile(path.join(f.root, "orphan.txt"), f.asset.assetId);
  await git(f.root, "hash-object", "-w", "orphan.txt");
  await rm(path.join(f.root, "orphan.txt"));
  expect((await scanNativeAssetReferences(f.input)).references).toEqual([
    { assetId: f.asset.assetId, sources: ["history"] },
  ]);
});

it("finds saved draft/recovery and older release URLs including JSON and HTML escaping", async () => {
  const f = await fixture();
  await writeFile(
    path.join(f.recovery, "draft.json"),
    JSON.stringify({ image: f.asset.url }),
  );
  await mkdir(path.join(f.store, "old/site"), { recursive: true });
  await writeFile(
    path.join(f.store, "old/site/index.html"),
    `<img src="${f.asset.url.replace(/"/g, "&quot;")}">`,
  );
  expect((await scanNativeAssetReferences(f.input)).references).toEqual([
    { assetId: f.asset.assetId, sources: ["recovery", "releases"] },
  ]);
  await writeFile(
    path.join(f.store, "old/site/index.html"),
    f.asset.url.split("/").map(encodeURIComponent).join("/"),
  );
  expect(
    (await scanNativeAssetReferences(f.input)).references[0].sources,
  ).toContain("releases");
});

it("streams identifiers and UTF-8 paths split across chunks without matching across separate files", () => {
  const asset = { assetId: randomUUID(), url: "folder/café.png" },
    matcher = new NativeAssetMatcher([asset]);
  const whole = Buffer.from(asset.url);
  const consume = matcher.stream("source");
  for (const byte of whole) consume(Uint8Array.of(byte));
  consume(new Uint8Array(), true);
  expect(matcher.references()).toEqual([
    { assetId: asset.assetId, sources: ["source"] },
  ]);
  const separate = new NativeAssetMatcher([{ ...asset, url: null }]);
  separate.stream("source")(Buffer.from(asset.assetId.slice(0, 18)), true);
  separate.stream("source")(Buffer.from(asset.assetId.slice(18)), true);
  expect(separate.references()).toEqual([]);
});

it("refuses incomplete inventories rather than reporting unused files", async () => {
  const f = await fixture();
  await writeFile(path.join(f.root, "many.txt"), "x".repeat(200));
  for (const limits of [
    { bytes: 1 },
    { files: 1 },
    { historyBytes: 1 },
    { historyObjects: 1 },
  ])
    await expect(
      scanNativeAssetReferences({ ...f.input, limits }),
    ).rejects.toThrow("could not be fully verified");
  expect((await readFile(path.join(f.root, "many.txt"))).length).toBe(200);
});

it("rejects missing, linked or special files and never follows a configured root outside its directory", async () => {
  const f = await fixture();
  const outside = path.join(f.directory, "outside");
  await mkdir(outside);
  await writeFile(path.join(outside, "secret.txt"), f.asset.assetId);
  const linked = path.join(f.directory, "linked");
  await symlink(outside, linked);
  await expect(
    scanNativeAssetReferences({ ...f.input, releaseStores: [linked] }),
  ).rejects.toThrow("could not be fully verified");
  await symlink(outside, path.join(f.recovery, "foreign"));
  await expect(scanNativeAssetReferences(f.input)).rejects.toThrow(
    "could not be fully verified",
  );
  await rm(path.join(f.recovery, "foreign"));
  await exec("mkfifo", [path.join(f.recovery, "pipe")]);
  await expect(scanNativeAssetReferences(f.input)).rejects.toThrow(
    "could not be fully verified",
  );
  await expect(
    scanNativeAssetReferences({
      ...f.input,
      root: path.join(f.directory, "missing"),
    }),
  ).rejects.toThrow("could not be fully verified");
});

it("refuses Git alternates and linked object directories instead of reading unrelated repositories", async () => {
  const f = await fixture();
  const alternates = path.join(f.root, ".git/objects/info/alternates");
  await writeFile(alternates, "/private/another/repository/objects\n");
  await expect(scanNativeAssetReferences(f.input)).rejects.toThrow(
    "could not be fully verified",
  );
  await rm(alternates);
  await symlink(f.recovery, path.join(f.root, ".git/objects/linked"));
  await expect(scanNativeAssetReferences(f.input)).rejects.toThrow(
    "could not be fully verified",
  );
});

it("does not skip corrupt Git objects or expose Git stderr", async () => {
  const f = await fixture();
  await writeFile(path.join(f.root, "orphan.txt"), f.asset.assetId);
  const oid = (
    await git(f.root, "hash-object", "-w", "orphan.txt")
  ).stdout.trim();
  await rm(path.join(f.root, "orphan.txt"));
  await chmod(
    path.join(f.root, ".git/objects", oid.slice(0, 2), oid.slice(2)),
    0o600,
  );
  await writeFile(
    path.join(f.root, ".git/objects", oid.slice(0, 2), oid.slice(2)),
    "private corrupted object",
  );
  await expect(scanNativeAssetReferences(f.input)).rejects.toThrow(
    /^Website file references could not be fully verified\. Existing files are kept\.$/,
  );
});

it("honours cancellation and validates candidates without inventing an empty success", async () => {
  const f = await fixture(),
    controller = new AbortController();
  controller.abort();
  await expect(
    scanNativeAssetReferences({ ...f.input, signal: controller.signal }),
  ).rejects.toThrow("could not be fully verified");
  for (const assets of [
    [],
    [{ ...f.asset, assetId: "invalid" }],
    [f.asset, f.asset],
    [{ ...f.asset, url: "bad\nvalue" }],
  ])
    await expect(
      scanNativeAssetReferences({ ...f.input, assets }),
    ).rejects.toThrow("could not be fully verified");
});

it("uses the helper's actual project and build locks and includes all saved account drafts", async () => {
  const f = await fixture(),
    projectId = randomUUID(),
    host = path.join(f.directory, "host");
  const folders = new HostedWebsiteFolders(
    host,
    path.join(f.directory, "credentials"),
    [
      {
        projectId,
        repositoryUrl: "git@example.test:fixture/site.git",
        branch: "main",
      },
    ],
  );
  const checkout = folders.root(projectId);
  await mkdir(path.dirname(checkout), { recursive: true, mode: 0o700 });
  await git(f.directory, "clone", f.root, checkout);
  await git(
    checkout,
    "remote",
    "set-url",
    "origin",
    "git@example.test:fixture/site.git",
  );
  const drafts = await folders.draftsDirectory(projectId, randomUUID());
  await writeFile(path.join(drafts, "saved.json"), f.asset.assetId);
  expect(
    (
      await scanHostedNativeAssetReferences(
        folders,
        projectId,
        [f.asset],
        [f.store],
      )
    ).references,
  ).toEqual([{ assetId: f.asset.assetId, sources: ["recovery"] }]);
  let release: () => Promise<void>;
  await folders.locked(projectId, async () => {
    release = await folders.claimBuild(projectId, randomUUID());
  });
  await expect(
    scanHostedNativeAssetReferences(folders, projectId, [f.asset], [f.store]),
  ).rejects.toThrow("A build owns this website folder");
  await release();
  const another = new HostedWebsiteFolders(
    host,
    path.join(f.directory, "credentials"),
    [
      {
        projectId,
        repositoryUrl: "git@example.test:fixture/site.git",
        branch: "main",
      },
    ],
  );
  await folders.locked(projectId, async () => {
    await expect(
      scanHostedNativeAssetReferences(another, projectId, [f.asset], [f.store]),
    ).rejects.toThrow("Another helper operation owns");
  });
});

it("reads URLs inside retained native ZIP backups and gzip/brotli public files without extracting files", async () => {
  const { zipSync } = await import("fflate"),
    { gzipSync, brotliCompressSync } = await import("node:zlib");
  const f = await fixture();
  await writeFile(
    path.join(f.recovery, "backup.zip"),
    zipSync({ "repository/index.html": Buffer.from(f.asset.url) }),
  );
  await writeFile(path.join(f.store, "site.html.gz"), gzipSync(f.asset.url));
  await writeFile(
    path.join(f.store, "site.html.br"),
    brotliCompressSync(f.asset.url),
  );
  expect((await scanNativeAssetReferences(f.input)).references).toEqual([
    { assetId: f.asset.assetId, sources: ["recovery", "releases"] },
  ]);
  expect(await readdir(f.recovery)).toEqual(["backup.zip"]);
  await writeFile(
    path.join(f.root, "backup.zip"),
    zipSync({ "source/file.txt": Buffer.from(f.asset.assetId) }),
  );
  expect(
    (await scanNativeAssetReferences(f.input)).references[0].sources,
  ).toContain("source");
});

it("rejects corrupt archives, over-expansion and excessive nesting instead of overlooking their references", async () => {
  const { zipSync } = await import("fflate"),
    { gzipSync } = await import("node:zlib");
  const f = await fixture();
  const zipped = path.join(f.recovery, "backup.zip");
  await writeFile(zipped, "Invalid private archive");
  await expect(scanNativeAssetReferences(f.input)).rejects.toThrow(
    "could not be fully verified",
  );
  let nested = zipSync({ "original.txt": Buffer.from(f.asset.assetId) });
  for (let i = 0; i < 4; i++) nested = zipSync({ "inner.zip": nested });
  await writeFile(zipped, nested);
  await expect(scanNativeAssetReferences(f.input)).rejects.toThrow(
    "could not be fully verified",
  );
  await rm(zipped);
  await writeFile(
    path.join(f.recovery, "huge.txt.gz"),
    gzipSync("x".repeat(50000)),
  );
  await expect(
    scanNativeAssetReferences({ ...f.input, limits: { bytes: 1000 } }),
  ).rejects.toThrow("could not be fully verified");
});

it("decodes archived files in packed Git history after their working files are gone", async () => {
  const { zipSync } = await import("fflate"),
    { gzipSync, brotliCompressSync } = await import("node:zlib");
  const f = await fixture();
  const second = { assetId: randomUUID(), url: null },
    third = { assetId: randomUUID(), url: null };
  await writeFile(
    path.join(f.root, "old.zip"),
    zipSync({ "site.html": Buffer.from(f.asset.assetId) }),
  );
  await writeFile(path.join(f.root, "old.html.gz"), gzipSync(second.assetId));
  await writeFile(
    path.join(f.root, "old.html.br"),
    brotliCompressSync(third.assetId),
  );
  await git(f.root, "add", "old.zip", "old.html.gz", "old.html.br");
  await git(f.root, "commit", "-m", "Retained compressed files");
  await git(f.root, "rm", "old.zip", "old.html.gz", "old.html.br");
  await git(f.root, "commit", "-m", "Delete current archives");
  await git(f.root, "gc", "--prune=never");
  const found = await scanNativeAssetReferences({
    ...f.input,
    assets: [f.asset, second, third],
  });
  expect(found.references).toEqual(
    [f.asset, second, third]
      .map((asset) => ({ assetId: asset.assetId, sources: ["history"] }))
      .sort((a, b) => a.assetId.localeCompare(b.assetId)),
  );
});
