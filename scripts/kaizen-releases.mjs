import { constants, createReadStream } from "node:fs";
import {
  mkdir,
  readdir,
  lstat,
  readFile,
  writeFile,
  open,
  rename,
  copyFile,
  realpath,
  unlink,
  rmdir,
  rm,
  chmod,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import {
  canonicalRedirectPath,
  technicalRoute,
} from "../shared/builderRedirects.js";

const run = promisify(execFile);
const MARKER = ".well-known/kaizen-release.json";
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const inside = (root, file) => file.startsWith(root + path.sep);
function validateRedirectChecks(checks = []) {
  if (!Array.isArray(checks) || checks.length > 400)
    throw new Error("Invalid redirect health checks.");
  const seen = new Set();
  for (const check of checks) {
    if (
      !check ||
      ![301, 302].includes(check.status) ||
      check.preserveQuery !== true ||
      typeof check.source !== "string" ||
      typeof check.destination !== "string" ||
      !check.source.startsWith("/") ||
      !check.destination.startsWith("/") ||
      canonicalRedirectPath(check.destination) !== check.destination ||
      ![
        canonicalRedirectPath(check.source),
        canonicalRedirectPath(check.source).replace(/\/$/, ""),
      ].includes(check.source) ||
      technicalRoute.test(check.source) ||
      technicalRoute.test(check.destination) ||
      seen.has(check.source)
    )
      throw new Error("Invalid redirect health check.");
    seen.add(check.source);
  }
  return checks;
}
async function renameComplete(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      if (
        process.platform !== "win32" ||
        !["EPERM", "EBUSY", "EACCES"].includes(error.code) ||
        attempt === 4
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
    }
  }
}
function releaseId(id) {
  if (!idPattern.test(id || ""))
    throw new Error(
      "Use a release ID containing 1–96 letters, numbers, hyphens or underscores.",
    );
  return id;
}
function safeRelative(name) {
  if (
    typeof name !== "string" ||
    !name ||
    path.isAbsolute(name) ||
    /[\\\x00-\x1f]/.test(name) ||
    name.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error("Invalid release file path.");
  return name;
}
async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}
async function storeRoot(value) {
  const requested = path.resolve(value || "");
  if (
    !value ||
    requested === path.parse(requested).root ||
    requested === os.homedir()
  )
    throw new Error(
      "Choose a dedicated release store, outside the public web root.",
    );
  await mkdir(requested, { recursive: true });
  const root = await realpath(requested);
  for (const name of ["releases", "transactions", "immutable"])
    await safeDirectory(root, name);
  return root;
}
async function safeDirectory(root, relative) {
  let current = root;
  for (const part of safeRelative(relative).split("/")) {
    current = path.join(current, part);
    let created = true;
    await mkdir(current).catch((error) => {
      if (error.code !== "EEXIST") throw error;
      created = false;
    });
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(
        `Release directory is not an ordinary directory: ${current}`,
      );
    if (created) await chmod(current, 0o755);
  }
  return current;
}
async function filesIn(root, relative = "") {
  const result = [];
  for (const entry of await readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    safeRelative(name);
    if (entry.isSymbolicLink())
      throw new Error(`Release files cannot contain symbolic links: ${name}`);
    if (entry.isDirectory()) result.push(...(await filesIn(root, name)));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`Unsupported release file: ${name}`);
  }
  return result.sort();
}
async function atomicWrite(file, bytes) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o644);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await renameComplete(temporary, file);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
async function safeRemoveStaging(root, directory) {
  const resolved = path.resolve(directory);
  if (
    !inside(root, resolved) ||
    !path.basename(resolved).startsWith(".staging-")
  )
    throw new Error("Refusing to remove a path outside release staging.");
  await rm(resolved, { recursive: true, force: true });
}
function nginxPath(value) {
  if (/[\x00-\x1f"$]/.test(value))
    throw new Error(
      "The release store path cannot contain controls, quotes or dollar signs.",
    );
  return value.replaceAll("\\", "/");
}
export function nginxConfig(root, id) {
  releaseId(id);
  const location = nginxPath(path.join(root, "releases", id));
  return `# Kaizen managed release: ${id}\nroot "${location}/site";\ninclude "${location}/redirects.conf";\n# Keep immutable build assets available to visitors with an older page open.\nlocation ^~ /_astro/ { alias "${nginxPath(path.join(root, "immutable", "_astro"))}/"; }\nlocation = /.well-known/kaizen-release.json { add_header Cache-Control "no-store" always; try_files $uri =404; }\n`;
}
async function currentConfig(root) {
  const file = path.join(root, "active.conf");
  const stat = await lstat(file).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("The active release include must be a regular file.");
  const text = await readFile(file, "utf8"),
    id = text.match(/^# Kaizen managed release: ([\w-]+)\n/)?.[1];
  if (!id || text !== nginxConfig(root, id))
    throw new Error(
      "The active release include was edited outside Kaizen. Inspect it before deploying.",
    );
  return { id, text };
}
export async function stageRelease({
  source,
  store,
  id,
  commit = "",
  report = (_event) => {},
}) {
  releaseId(id);
  if (commit && !/^[a-f0-9]{40,64}$/i.test(commit))
    throw new Error("Invalid source commit.");
  const root = await storeRoot(store),
    input = await realpath(path.resolve(source));
  if (root === input || inside(input, root) || inside(root, input))
    throw new Error(
      "Build output and release store must be separate directories.",
    );
  const names = await filesIn(input);
  if (!names.includes("index.html") || !names.includes("builder/index.html"))
    throw new Error(
      "The public build must contain the home page and builder entry page.",
    );
  if (
    names.some((name) =>
      /(^|\/)(\.env(?:\..*)?|\.git|\.kaizen-builder|test-results|workspace\.json|node_modules|__builder-local|__builder-upload)(\/|$)/.test(
        name,
      ),
    )
  )
    throw new Error("The build contains local workspace or server-only files.");
  const final = path.join(root, "releases", id),
    temporary = path.join(root, `.staging-${id}-${randomUUID()}`);
  if (await lstat(final).catch(() => null))
    throw new Error(
      "That release ID already exists. Retained releases are immutable.",
    );
  await mkdir(temporary);
  await mkdir(path.join(temporary, "site"));
  await chmod(temporary, 0o755);
  await chmod(path.join(temporary, "site"), 0o755);
  try {
    report({ status: "staging", releaseId: id });
    for (const name of names) {
      if (
        name === MARKER ||
        ["redirects.generated.conf", "redirects.generated.json"].includes(name)
      )
        continue;
      await safeDirectory(
        temporary,
        `site/${path.posix.dirname(name) === "." ? "" : path.posix.dirname(name)}`.replace(
          /\/$/,
          "",
        ),
      );
      await copyFile(
        path.join(input, name),
        path.join(temporary, "site", name),
        constants.COPYFILE_EXCL,
      );
      await chmod(path.join(temporary, "site", name), 0o644);
    }
    await safeDirectory(temporary, "site/.well-known");
    const createdAt = new Date().toISOString();
    await writeFile(
      path.join(temporary, "site", MARKER),
      JSON.stringify({ schemaVersion: 1, releaseId: id, createdAt, commit }),
      { flag: "wx", mode: 0o644 },
    );
    const redirects = names.includes("redirects.generated.conf")
      ? await readFile(path.join(input, "redirects.generated.conf"))
      : Buffer.from("# No redirects in this release.\n");
    await writeFile(path.join(temporary, "redirects.conf"), redirects, {
      flag: "wx",
      mode: 0o644,
    });
    const files = [],
      checks = [];
    for (const name of await filesIn(path.join(temporary, "site"))) {
      const file = path.join(temporary, "site", name),
        stat = await lstat(file);
      files.push({ path: name, size: stat.size, sha256: await hashFile(file) });
      if (name.endsWith("index.html")) {
        const html = await readFile(file, "utf8");
        if (
          name === "index.html" ||
          name === "builder/index.html" ||
          html.includes("data-kaizen-builder-page")
        )
          checks.push({
            path: name === "index.html" ? "/" : `/${name.slice(0, -10)}`,
            sha256: files.at(-1).sha256,
          });
      }
    }
    const redirectMetadata = names.includes("redirects.generated.json")
      ? JSON.parse(
          await readFile(path.join(input, "redirects.generated.json"), "utf8"),
        )
      : { schemaVersion: 1, checks: [] };
    if (redirectMetadata.schemaVersion !== 1)
      throw new Error("Invalid redirect metadata version.");
    const manifest = {
      schemaVersion: 1,
      id,
      createdAt,
      commit,
      files,
      checks,
      redirectHash: digest(redirects),
      redirectChecks: validateRedirectChecks(redirectMetadata.checks),
    };
    await writeFile(
      path.join(temporary, "release.json"),
      JSON.stringify(manifest, null, 2),
      { flag: "wx", mode: 0o644 },
    );
    await renameComplete(temporary, final);
    report({
      status: "staged",
      releaseId: id,
      files: files.length,
      bytes: files.reduce((sum, file) => sum + file.size, 0),
    });
    return manifest;
  } catch (error) {
    await safeRemoveStaging(root, temporary);
    throw error;
  }
}
export async function verifyRelease(store, id) {
  releaseId(id);
  const root = await storeRoot(store),
    directory = path.join(root, "releases", id);
  if (
    (await lstat(directory)).isSymbolicLink() ||
    (await lstat(path.join(directory, "site"))).isSymbolicLink()
  )
    throw new Error("A retained release cannot be a symbolic link.");
  const manifest = JSON.parse(
    await readFile(path.join(directory, "release.json"), "utf8"),
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.id !== id ||
    !Array.isArray(manifest.files) ||
    !Array.isArray(manifest.checks)
  )
    throw new Error("Invalid release manifest.");
  validateRedirectChecks(manifest.redirectChecks);
  const actual = await filesIn(path.join(directory, "site"));
  if (
    JSON.stringify(actual) !==
    JSON.stringify(manifest.files.map((file) => safeRelative(file.path)).sort())
  )
    throw new Error("The retained release's file list changed.");
  for (const file of manifest.files) {
    const target = path.join(directory, "site", file.path),
      stat = await lstat(target);
    if (stat.size !== file.size || (await hashFile(target)) !== file.sha256)
      throw new Error(`Retained release checksum failed: ${file.path}`);
  }
  if (
    digest(await readFile(path.join(directory, "redirects.conf"))) !==
    manifest.redirectHash
  )
    throw new Error("Retained redirect configuration changed.");
  const marker = JSON.parse(
    await readFile(path.join(directory, "site", MARKER), "utf8"),
  );
  if (marker.releaseId !== id)
    throw new Error("The retained release marker does not match.");
  for (const check of manifest.checks) {
    if (
      typeof check.path !== "string" ||
      !/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(check.path) ||
      !manifest.files.some(
        (file) =>
          `/${file.path}` === `${check.path}index.html` &&
          file.sha256 === check.sha256,
      )
    )
      throw new Error("Invalid release health check.");
  }
  if (
    !manifest.checks.some((check) => check.path === "/") ||
    !manifest.checks.some((check) => check.path === "/builder/")
  )
    throw new Error("The release is missing required health checks.");
  return manifest;
}
async function installImmutableAssets(root, manifest) {
  for (const file of manifest.files.filter((file) =>
    file.path.startsWith("_astro/"),
  )) {
    const target = path.join(root, "immutable", file.path);
    await safeDirectory(root, `immutable/${path.posix.dirname(file.path)}`);
    const existing = await lstat(target).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (existing) {
      if (
        !existing.isFile() ||
        existing.isSymbolicLink() ||
        (await hashFile(target)) !== file.sha256
      )
        throw new Error(
          `An immutable asset name has different content: ${file.path}`,
        );
      continue;
    }
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await copyFile(
        path.join(root, "releases", manifest.id, "site", file.path),
        temporary,
        constants.COPYFILE_EXCL,
      );
      await chmod(temporary, 0o644);
      if ((await hashFile(temporary)) !== file.sha256)
        throw new Error(
          `Immutable asset copy failed its checksum: ${file.path}`,
        );
      await renameComplete(temporary, target);
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
}
async function withLock(root, work) {
  const directory = path.join(root, ".activation-lock"),
    owner = {
      pid: process.pid,
      host: os.hostname(),
      token: randomUUID(),
      createdAt: new Date().toISOString(),
    };
  await mkdir(directory).catch((error) => {
    if (error.code === "EEXIST")
      throw new Error(
        "Another release activation owns the lock. Inspect its process and transaction before recovering; elapsed time alone is not proof it stopped.",
      );
    throw error;
  });
  try {
    await writeFile(path.join(directory, "owner.json"), JSON.stringify(owner), {
      flag: "wx",
    });
    return await work();
  } finally {
    await unlink(path.join(directory, "owner.json"));
    await rmdir(directory);
  }
}
export async function initialiseStore({ store, id }) {
  const root = await storeRoot(store);
  return withLock(root, async () => {
    if (await currentConfig(root))
      throw new Error("This release store is already initialised.");
    const manifest = await verifyRelease(root, id);
    await installImmutableAssets(root, manifest);
    await atomicWrite(path.join(root, "active.conf"), nginxConfig(root, id));
    return {
      status: "setup_required",
      releaseId: id,
      include: path.join(root, "active.conf"),
      message:
        "Include this file in the site's Nginx server block in place of its root and generated-redirect include, then test and reload Nginx. This command has not changed the running web server.",
    };
  });
}
export async function checkLive(
  origin,
  manifest,
  { fetcher = fetch, timeout = 15_000 } = {},
) {
  const base = new URL(origin);
  if (
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    !(
      base.protocol === "https:" ||
      (base.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
    )
  )
    throw new Error(
      "Use an HTTPS site origin, or loopback HTTP for local tests.",
    );
  async function get(pathname) {
    const url = new URL(pathname, base);
    url.searchParams.set("kaizen-release-check", randomUUID());
    const response = await fetcher(url, {
      redirect: "error",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Connection: "close" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok)
      throw new Error(
        `Live check failed for ${pathname}: HTTP ${response.status}.`,
      );
    return new Uint8Array(await response.arrayBuffer());
  }
  const marker = JSON.parse(new TextDecoder().decode(await get(`/${MARKER}`)));
  if (marker.releaseId !== manifest.id)
    throw new Error(
      "The public site is still serving a different release. Check Nginx routing and cache configuration.",
    );
  for (let start = 0; start < manifest.checks.length; start += 4)
    await Promise.all(
      manifest.checks.slice(start, start + 4).map(async (check) => {
        if (digest(await get(check.path)) !== check.sha256)
          throw new Error(
            `The live response for ${check.path} does not match the retained release.`,
          );
      }),
    );
  const redirectChecks = validateRedirectChecks(manifest.redirectChecks);
  for (let start = 0; start < redirectChecks.length; start += 4)
    await Promise.all(
      redirectChecks.slice(start, start + 4).map(async (check) => {
        const url = new URL(check.source, base);
        url.searchParams.set("kaizen-release-check", randomUUID());
        url.searchParams.set("utm_source", "redirect check");
        const response = await fetcher(url, {
          redirect: "manual",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", Connection: "close" },
          signal: AbortSignal.timeout(timeout),
        });
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (
          response.status !== check.status ||
          !location ||
          new URL(location, url).href !==
            new URL(check.destination + url.search, base).href
        )
          throw new Error(
            `Live redirect check failed for ${check.source}: expected HTTP ${check.status}, destination ${check.destination} and preserved query parameters.`,
          );
      }),
    );
  return {
    releaseId: manifest.id,
    checked: manifest.checks.length + redirectChecks.length + 1,
  };
}
export async function activateRelease(
  { store, id, origin, report = (_event) => {} },
  adapters = {},
) {
  const root = await storeRoot(store);
  const nginx = async (args) => {
    await run(
      process.getuid?.() === 0 ? "nginx" : "sudo",
      process.getuid?.() === 0 ? args : ["-n", "nginx", ...args],
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
  };
  const validate = adapters.validateConfig || (() => nginx(["-t"]));
  const reload = adapters.reload || (() => nginx(["-s", "reload"]));
  const health = adapters.checkLive || checkLive;
  async function observe(manifest) {
    let error;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await health(origin, manifest);
        return;
      } catch (failure) {
        error = failure;
        if (attempt < 4)
          await new Promise((resolve) =>
            setTimeout(resolve, 250 * (attempt + 1)),
          );
      }
    }
    throw error;
  }
  return withLock(root, async () => {
    const previous = await currentConfig(root);
    if (!previous)
      throw new Error(
        "Initialise and connect the release store to Nginx before activating a release.",
      );
    const manifest = await verifyRelease(root, id),
      old = await verifyRelease(root, previous.id);
    await health(origin, old); // Do not replace an unverified baseline.
    await installImmutableAssets(root, manifest);
    const next = nginxConfig(root, id),
      file = path.join(root, "active.conf"),
      transaction = {
        schemaVersion: 1,
        id: randomUUID(),
        releaseId: id,
        previousReleaseId: previous.id,
        startedAt: new Date().toISOString(),
        status: "prepared",
      };
    const journal = path.join(root, "transactions", `${transaction.id}.json`);
    async function update(status, detail = {}) {
      Object.assign(
        transaction,
        { status, updatedAt: new Date().toISOString() },
        detail,
      );
      await atomicWrite(journal, JSON.stringify(transaction, null, 2));
      report({ ...transaction });
    }
    await update("checking");
    let switched = false,
      finalized = false;
    try {
      await adapters.beforeSwitch?.(manifest, old);
      if ((await currentConfig(root))?.text !== previous.text)
        throw new Error(
          "The active include changed during release preparation.",
        );
      await atomicWrite(file, next);
      switched = true;
      await validate();
      await update("activating");
      await reload();
      await update("verifying");
      await adapters.beforeVerify?.(manifest, old);
      // A graceful reload can briefly serve the prior worker. Retry only the live observation.
      await observe(manifest);
      await adapters.finalize?.(manifest, old);
      finalized = Boolean(adapters.finalize);
      await update("live");
      return transaction;
    } catch (error) {
      // A lost database acknowledgement may mean the new release was already committed.
      // Preserve the verified serving artifact and require reconciliation, not a blind rollback.
      if (switched && (finalized || error?.releaseCommitUncertain === true)) {
        await update("recovery_required", { error: error.message });
        throw error;
      }
      if (switched) {
        try {
          if ((await currentConfig(root))?.text !== next)
            throw new Error(
              "The active include was changed externally; it has not been overwritten.",
            );
          await atomicWrite(file, previous.text);
          await validate();
          await reload();
          await observe(old);
          await update("rolled_back", { error: error.message });
        } catch (recovery) {
          await update("recovery_required", {
            error: error.message,
            recoveryError: recovery.message,
          });
          throw new Error(
            `Activation failed and automatic recovery could not be verified: ${recovery.message}. Inspect transaction ${transaction.id}.`,
          );
        }
      } else await update("failed", { error: error.message });
      throw new Error(
        `Release activation failed. ${switched ? "The previous release was restored and verified." : "The live release was not changed."} ${error.message}`,
      );
    }
  });
}
export async function listReleases(store) {
  const root = await storeRoot(store),
    current = await currentConfig(root);
  const releases = [];
  for (const name of await readdir(path.join(root, "releases"))) {
    releaseId(name);
    const manifest = JSON.parse(
      await readFile(path.join(root, "releases", name, "release.json"), "utf8"),
    );
    releases.push({
      id: name,
      createdAt: manifest.createdAt,
      commit: manifest.commit,
      files: manifest.files.length,
      bytes: manifest.files.reduce((sum, file) => sum + file.size, 0),
      selected: current?.id === name,
    });
  }
  const transactions = [];
  for (const name of await readdir(path.join(root, "transactions")))
    if (name.endsWith(".json"))
      transactions.push(
        JSON.parse(
          await readFile(path.join(root, "transactions", name), "utf8"),
        ),
      );
  return {
    selectedReleaseId: current?.id || null,
    releases: releases.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    transactions: transactions.sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    ),
    note: "Selected config is not proof of live success. Use verify-live to check the server response.",
  };
}
async function cli() {
  const [command, ...args] = process.argv.slice(2),
    options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!/^--[a-z-]+$/.test(args[i]) || !args[i + 1])
      throw new Error("Expected --name value arguments.");
    options[args[i].slice(2)] = args[i + 1];
  }
  if (!options.store)
    throw new Error("Provide --store with a dedicated release directory.");
  const report = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
  if (command === "stage") await stageRelease({ ...options, report });
  else if (command === "init") report(await initialiseStore(options));
  else if (command === "activate" || command === "rollback")
    await activateRelease({ ...options, report });
  else if (command === "list") report(await listReleases(options.store));
  else if (command === "verify-live")
    report(
      await checkLive(
        options.origin,
        await verifyRelease(options.store, options.id),
      ),
    );
  else
    throw new Error(
      "Use stage, init, activate, rollback, list or verify-live.",
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
