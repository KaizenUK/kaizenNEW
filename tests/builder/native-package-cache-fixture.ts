/** Reusable offline proof; callers choose ordinary child processes or real VPS cgroups. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NativePackageCache } from "../../scripts/builder-native-package-cache";

export async function verifyNativePackageCache(input: {
  directory: string;
  cli: string;
  execute: (
    cwd: string,
    executable: string,
    args: string[],
    environment: NodeJS.ProcessEnv,
  ) => Promise<void>;
}) {
  const root = path.join(input.directory, "checkout"),
    state = path.join(input.directory, "state");
  await mkdir(root, { recursive: true, mode: 0o700 });
  await mkdir(state, { mode: 0o700 });
  const cache = new NativePackageCache(root, state, {
    BUILDER_NATIVE_CACHE_PRUNE_BYTES: "1",
  });
  await cache.prepare();
  const environment = {
    PATH: process.env.PATH,
    HOME: state,
    LANG: "C",
    CI: "1",
  };
  const contents = {
    active: 'module.exports="installed package still works";\n',
    unused:
      'module.exports="unused package";\n/*' + "padding".repeat(10000) + "*/\n",
  };
  const casPath = (name: keyof typeof contents) => {
    const hash = createHash("sha512").update(contents[name]).digest("hex");
    return path.join(cache.store, "v10/files", hash.slice(0, 2), hash.slice(2));
  };
  for (const name of ["active", "unused"] as const) {
    const directory = path.join(input.directory, name);
    await mkdir(path.join(directory, "package"), { recursive: true });
    await writeFile(
      path.join(directory, "package/package.json"),
      JSON.stringify({
        name: "fixture-" + name,
        version: "1.0.0",
        main: "index.js",
      }),
    );
    await writeFile(path.join(directory, "package/index.js"), contents[name]);
    await input.execute(
      directory,
      "/usr/bin/tar",
      ["-czf", path.join(input.directory, name + ".tgz"), "package"],
      environment,
    );
  }
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      private: true,
      name: "native-cache-fixture",
      dependencies: { "fixture-active": "file:../active.tgz" },
    }),
  );
  await writeFile(
    path.join(root, "private-draft.txt"),
    "Preserved private draft",
  );
  const options = [
    input.cli,
    ...cache.arguments(),
    "--config.ignore-scripts=true",
    "--config.ignore-pnpmfile=true",
    "--config.userconfig=/dev/null",
    "--config.globalconfig=/dev/null",
  ];
  await input.execute(
    root,
    process.execPath,
    [...options, "install", "--offline", "--package-import-method=hardlink"],
    environment,
  );
  await input.execute(
    state,
    process.execPath,
    [...options, "store", "add", path.join(input.directory, "unused.tgz")],
    environment,
  );
  assert.ok((await lstat(casPath("active"))).nlink > 1);
  assert.equal((await lstat(casPath("unused"))).nlink, 1);
  const metadata = path.join(
    cache.cache,
    "metadata-v1.3/registry.npmjs.org/unused.json",
  );
  await mkdir(path.dirname(metadata), { recursive: true });
  await writeFile(metadata, '{"versions":{}}');
  await mkdir(path.join(cache.store, "v10/tmp"), { recursive: true });
  await writeFile(
    path.join(cache.store, "v10/tmp/unfinished-download"),
    "Disposable generated download",
  );
  const preserved = path.join(cache.store, "operator-note.txt");
  await writeFile(preserved, "Unknown sibling remains charged");
  const prune = (manager: NativePackageCache) =>
    manager.prune({
      signal: new AbortController().signal,
      pressured: false,
      log: () => {},
      run: async (args, env) => {
        assert.ok(!args.includes("--force"));
        await input.execute(state, process.execPath, [input.cli, ...args], env);
      },
    });
  assert.equal(await prune(cache), true);
  const absent = async (file: string) =>
    assert.equal(
      await lstat(file).then(
        () => false,
        (error) => error.code === "ENOENT",
      ),
      true,
    );
  await absent(casPath("unused"));
  await absent(metadata);
  await absent(path.join(cache.store, "v10/tmp"));
  assert.equal(await readFile(casPath("active"), "utf8"), contents.active);
  assert.equal(
    await readFile(preserved, "utf8"),
    "Unknown sibling remains charged",
  );
  assert.equal(
    await readFile(path.join(root, "private-draft.txt"), "utf8"),
    "Preserved private draft",
  );
  await input.execute(
    root,
    process.execPath,
    [
      "-e",
      "require('node:assert/strict').equal(require('fixture-active'),'installed package still works')",
    ],
    environment,
  );
  // A new owner object can repeat completed/partly completed pnpm pruning.
  const restarted = new NativePackageCache(root, state, {
    BUILDER_NATIVE_CACHE_PRUNE_BYTES: "1",
  });
  await restarted.prepare();
  await prune(restarted);
  await input.execute(
    root,
    process.execPath,
    [
      "-e",
      "require('node:assert/strict').equal(require('fixture-active'),'installed package still works')",
    ],
    environment,
  );
}
