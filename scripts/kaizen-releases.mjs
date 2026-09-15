import { constants } from "node:fs";
import {
  mkdir,
  readdir,
  lstat,
  readFile,
  writeFile,
  open,
  rename,
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
import { withRecoveryLock } from "./release-recovery.mjs";
import {
  assertReleaseIdNotRetired,
  unfinishedRetirement,
} from "./release-retirement-state.mjs";
import {
  checkReleaseStorage,
  copyReleaseFile,
  hashReleaseFile,
  readReleaseFile,
  releaseStorageLimits,
} from "./release-storage.mjs";
import {
  canonicalRedirectPath,
  technicalRoute,
  builderNginxRules,
  builderRedirectChecks,
  validateBuilderRedirects,
} from "../shared/builderRedirects.js";

const run = promisify(execFile);
const pathKey = (value) =>
  process.platform === "win32" ? value.toLowerCase() : value;
const MARKER = ".well-known/kaizen-release.json";
const CLIENT_BINDING = "client-destination.json";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function validateClientDestination(value) {
  if (
    !value ||
    Object.keys(value).sort().join(",") !==
      "destinationId,environment,origin,projectId" ||
    !uuidPattern.test(value.projectId) ||
    !uuidPattern.test(value.destinationId) ||
    !["staging", "production"].includes(value.environment)
  )
    throw new Error(
      "A client release needs an explicit project, destination and environment.",
    );
  const origin = new URL(value.origin);
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    value.origin !== origin.origin ||
    !(
      origin.protocol === "https:" ||
      (origin.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
    )
  )
    throw new Error(
      "Use a canonical HTTPS destination origin, or loopback HTTP for an isolated local destination.",
    );
  return {
    projectId: value.projectId,
    destinationId: value.destinationId,
    environment: value.environment,
    origin: origin.origin,
  };
}
async function clientBinding(root) {
  const file = path.join(root, CLIENT_BINDING);
  const stat = await lstat(file).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("The client destination binding must be a regular file.");
  return validateClientDestination(
    JSON.parse((await readReleaseFile(file, stat, 16384)).toString()),
  );
}
const sameClient = (a, b) =>
  JSON.stringify(a && validateClientDestination(a)) ===
  JSON.stringify(b && validateClientDestination(b));
/** One-time server setup. A client can never claim an existing legacy or other client's store. */
export async function bindClientStore({ store, client }) {
  const value = validateClientDestination(client);
  if (!path.isAbsolute(store))
    throw new Error(
      "Use an absolute path for the dedicated client release store.",
    );
  const root = await storeRoot(store);
  if (pathKey(root) !== pathKey(path.resolve(store)))
    throw new Error("Client release stores must not use symbolic links.");
  return withLock(root, async () => {
    const existing = await clientBinding(root);
    if (existing) {
      if (!sameClient(existing, value))
        throw new Error(
          "This release store belongs to a different client destination.",
        );
      return existing;
    }
    if (
      (await readdir(root)).some(
        (name) =>
          ![
            "releases",
            "transactions",
            "immutable",
            ".activation-lock",
          ].includes(name),
      ) ||
      (await readdir(path.join(root, "releases"))).length ||
      (await readdir(path.join(root, "transactions"))).length ||
      (await readdir(path.join(root, "immutable"))).length
    )
      throw new Error(
        "Bind a new empty store. Existing Kaizen or client releases cannot be reassigned.",
      );
    await writeFile(
      path.join(root, CLIENT_BINDING),
      JSON.stringify(value, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    return value;
  });
}
async function assertClientStore(root, client) {
  if (!sameClient(await clientBinding(root), client || null))
    throw new Error(
      "Release identity does not match this store's client destination.",
    );
}
function publicFileChecks(files) {
  return files
    .filter((file) => file.path !== MARKER)
    .map((file) => ({
      path:
        file.path === "index.html" || file.path.endsWith("/index.html")
          ? file.path === "index.html"
            ? "/"
            : `/${file.path.slice(0, -10).split("/").map(encodeURIComponent).join("/")}`
          : `/${file.path.split("/").map(encodeURIComponent).join("/")}`,
      sha256: file.sha256,
    }));
}
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
    Buffer.byteLength(name) > 1024 ||
    path.isAbsolute(name) ||
    /[\\\x00-\x1f]/.test(name) ||
    name.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error("Invalid release file path.");
  return name;
}
async function hashFile(file) {
  return hashReleaseFile(file);
}
async function storeRoot(value) {
  const requested = path.resolve(value || "");
  if (
    !value ||
    requested === path.parse(requested).root ||
    pathKey(requested) === pathKey(os.homedir())
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
async function safeDirectory(root, relative, create = true) {
  let current = root;
  for (const part of safeRelative(relative).split("/")) {
    current = path.join(current, part);
    let created = false;
    if (create) {
      created = true;
      await mkdir(current).catch((error) => {
        if (error.code !== "EEXIST") throw error;
        created = false;
      });
    }
    const stat = await lstat(current).catch((error) => {
      if (!create && error.code === "ENOENT") return null;
      throw error;
    });
    if (!stat) return null;
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(
        `Release directory is not an ordinary directory: ${current}`,
      );
    if (created) await chmod(current, 0o755);
  }
  return current;
}
async function filesIn(
  root,
  relative = "",
  inventory = { entries: 0 },
  depth = 0,
) {
  if (depth > 128)
    throw new Error("Release files exceed the directory-depth limit.");
  const result = [];
  for (const entry of await readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    if (++inventory.entries > 20000)
      throw new Error("Release files exceed the bounded inventory limit.");
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    safeRelative(name);
    if (entry.isSymbolicLink())
      throw new Error(`Release files cannot contain symbolic links: ${name}`);
    if (entry.isDirectory())
      result.push(...(await filesIn(root, name, inventory, depth + 1)));
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
export function nginxConfig(root, id, client = false, responseIdentity = true) {
  releaseId(id);
  const location = nginxPath(path.join(root, "releases", id));
  const identity = responseIdentity
    ? `add_header X-Kaizen-Release "${id}" always; `
    : "";
  return `# Kaizen managed release: ${id}\nroot "${location}/site";\n${identity ? `${identity.trim()}\n` : ""}include "${location}/redirects.conf";\n# Keep immutable build assets available to visitors with an older page open.\nlocation ^~ /_astro/ { alias "${nginxPath(path.join(root, "immutable", "_astro"))}/"; }\n${client ? `location ^~ /assets/ { alias "${nginxPath(path.join(root, "immutable", "assets"))}/"; }\n` : ""}location = /.well-known/kaizen-release.json { ${identity}add_header Cache-Control "no-store" always; try_files $uri =404; }\n`;
}
function matchesManagedConfig(root, id, client, text) {
  // Accept the exact retained format from before per-response identities were
  // introduced, without accepting arbitrary edits to a serving configuration.
  return [true, false].some(
    (identity) => text === nginxConfig(root, id, client, identity),
  );
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
  const text = (await readReleaseFile(file, stat, 16384)).toString(),
    id = text.match(/^# Kaizen managed release: ([\w-]+)\n/)?.[1];
  if (
    !id ||
    !matchesManagedConfig(root, id, Boolean(await clientBinding(root)), text)
  )
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
  client = null,
  redirectRules = null,
  report = (_event) => {},
  storageLimits = releaseStorageLimits(),
}) {
  releaseId(id);
  if (commit && !/^[a-f0-9]{40,64}$/i.test(commit))
    throw new Error("Invalid source commit.");
  const root = await storeRoot(store),
    input = await realpath(path.resolve(source));
  return withLock(root, () => stageUnderLock());
  async function stageUnderLock() {
    await assertReleaseIdNotRetired(root, id);
    if (client) client = validateClientDestination(client);
    await assertClientStore(root, client);
    if (root === input || inside(input, root) || inside(root, input))
      throw new Error(
        "Build output and release store must be separate directories.",
      );
    const names = await filesIn(input);
    if (names.length > 10000)
      throw new Error("Releases support at most 10,000 files.");
    const admitted = new Map();
    const directories = new Set();
    let sourceBytes = 0;
    for (const name of names) {
      const info = await lstat(path.join(input, name));
      sourceBytes += info.size;
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size > 32 * 1024 ** 2 ||
        sourceBytes > 200 * 1024 ** 2
      )
        throw new Error("Releases support 32 MB per file and 200 MB total.");
      admitted.set(name, info);
      const parts = name.split("/");
      for (let count = 1; count < parts.length; count++)
        directories.add(parts.slice(0, count).join("/"));
    }
    if (redirectRules !== null)
      redirectRules = validateBuilderRedirects(
        redirectRules,
        names
          .filter(
            (name) => name === "index.html" || name.endsWith("/index.html"),
          )
          .map((name) =>
            name === "index.html" ? "/" : `/${name.slice(0, -10)}`,
          ),
      );
    if (
      !names.includes("index.html") ||
      (!client && !names.includes("builder/index.html"))
    )
      throw new Error(
        client
          ? "A client build must contain index.html."
          : "The public build must contain the home page and builder entry page.",
      );
    if (
      names.some((name) =>
        /(^|\/)(\.env(?:\..*)?|\.git|\.kaizen-builder|test-results|workspace\.json|node_modules|__builder-local|__builder-upload)(\/|$)/.test(
          name,
        ),
      )
    )
      throw new Error(
        "The build contains local workspace or server-only files.",
      );
    if (client) {
      if (
        names.length > 10000 ||
        names.some(
          (name) =>
            /(^|\/)(\.kaizen|reference-packs|src|scripts|package\.json|package-lock\.json|pnpm-lock\.yaml)(\/|$)/.test(
              name,
            ) ||
            name.endsWith(".map") ||
            name
              .split("/")
              .some((part) => part.startsWith(".") && part !== ".well-known"),
        )
      )
        throw new Error(
          "Client publication contains private source/backup files or exceeds 10,000 files.",
        );
    }
    const final = path.join(root, "releases", id),
      temporary = path.join(root, `.staging-${id}-${randomUUID()}`);
    if (await lstat(final).catch(() => null))
      throw new Error(
        "That release ID already exists. Retained releases are immutable.",
      );
    // Reserve source bytes, generated manifest/check lists, redirects and
    // directory entries before copying. Actual copies cannot exceed the source
    // observation. The operation lock prevents a second same-store spender.
    await checkReleaseStorage(root, storageLimits, {
      bytes:
        sourceBytes +
        names.length * 16 * 1024 +
        directories.size * 8 * 1024 +
        2 * 1024 ** 2,
    });
    await mkdir(temporary);
    await mkdir(path.join(temporary, "site"));
    await chmod(temporary, 0o755);
    await chmod(path.join(temporary, "site"), 0o755);
    try {
      report({ status: "staging", releaseId: id });
      for (const name of names) {
        if (
          name === MARKER ||
          // Apache/PHP control files belong to the source export, never Nginx's
          // public artifact. Nginx correctly denies serving these dotfiles.
          [".htaccess", ".user.ini"].includes(path.posix.basename(name)) ||
          ["redirects.generated.conf", "redirects.generated.json"].includes(
            name,
          )
        )
          continue;
        await safeDirectory(
          temporary,
          `site/${path.posix.dirname(name) === "." ? "" : path.posix.dirname(name)}`.replace(
            /\/$/,
            "",
          ),
        );
        await copyReleaseFile(
          path.join(input, name),
          path.join(temporary, "site", name),
          admitted.get(name),
        );
        await chmod(path.join(temporary, "site", name), 0o644);
      }
      await safeDirectory(temporary, "site/.well-known");
      const createdAt = new Date().toISOString();
      await writeFile(
        path.join(temporary, "site", MARKER),
        JSON.stringify({
          schemaVersion: client ? 2 : 1,
          releaseId: id,
          createdAt,
          commit,
          responseIdentity: "release-id-v1",
          ...(client ? { client } : {}),
        }),
        { flag: "wx", mode: 0o644 },
      );
      const redirects =
        redirectRules !== null
          ? Buffer.from(builderNginxRules(redirectRules).join("\n") + "\n")
          : names.includes("redirects.generated.conf")
            ? await readReleaseFile(
                path.join(input, "redirects.generated.conf"),
                admitted.get("redirects.generated.conf"),
                1024 ** 2,
              )
            : Buffer.from("# No redirects in this release.\n");
      await writeFile(path.join(temporary, "redirects.conf"), redirects, {
        flag: "wx",
        mode: 0o644,
      });
      const files = [];
      for (const name of await filesIn(path.join(temporary, "site"))) {
        const file = path.join(temporary, "site", name),
          stat = await lstat(file);
        files.push({
          path: name,
          size: stat.size,
          sha256: await hashFile(file),
        });
      }
      const redirectMetadata =
        redirectRules !== null
          ? { schemaVersion: 1, checks: builderRedirectChecks(redirectRules) }
          : names.includes("redirects.generated.json")
            ? JSON.parse(
                (
                  await readReleaseFile(
                    path.join(input, "redirects.generated.json"),
                    admitted.get("redirects.generated.json"),
                    1024 ** 2,
                  )
                ).toString(),
              )
            : { schemaVersion: 1, checks: [] };
      if (redirectMetadata.schemaVersion !== 1)
        throw new Error("Invalid redirect metadata version.");
      const manifest = {
        // Version 3 adds complete served-file verification for native Kaizen sites.
        // Retained version 1 releases keep their original checks for rollback.
        schemaVersion: client ? 2 : 3,
        responseIdentity: "release-id-v1",
        ...(client ? { client } : {}),
        id,
        createdAt,
        commit,
        files,
        checks: publicFileChecks(files),
        redirectHash: digest(redirects),
        redirectChecks: validateRedirectChecks(redirectMetadata.checks),
      };
      await writeFile(
        path.join(temporary, "release.json"),
        JSON.stringify(manifest, null, 2),
        { flag: "wx", mode: 0o644 },
      );
      await assertClientStore(root, client);
      await checkReleaseStorage(root, storageLimits);
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
    (
      await readReleaseFile(
        path.join(directory, "release.json"),
        await lstat(path.join(directory, "release.json")),
        64 * 1024 ** 2,
      )
    ).toString(),
  );
  if (
    ![1, 2, 3].includes(manifest.schemaVersion) ||
    (manifest.responseIdentity !== undefined &&
      manifest.responseIdentity !== "release-id-v1") ||
    manifest.id !== id ||
    !Array.isArray(manifest.files) ||
    !Array.isArray(manifest.checks)
  )
    throw new Error("Invalid release manifest.");
  if (manifest.schemaVersion === 2) validateClientDestination(manifest.client);
  else if (manifest.client)
    throw new Error("This release manifest cannot claim a client destination.");
  await assertClientStore(root, manifest.client);
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
    digest(
      await readReleaseFile(
        path.join(directory, "redirects.conf"),
        await lstat(path.join(directory, "redirects.conf")),
        1024 ** 2,
      ),
    ) !== manifest.redirectHash
  )
    throw new Error("Retained redirect configuration changed.");
  const marker = JSON.parse(
    (
      await readReleaseFile(
        path.join(directory, "site", MARKER),
        await lstat(path.join(directory, "site", MARKER)),
        16384,
      )
    ).toString(),
  );
  if (
    marker.releaseId !== id ||
    marker.responseIdentity !== manifest.responseIdentity ||
    (manifest.client &&
      (!sameClient(marker.client, manifest.client) ||
        marker.schemaVersion !== 2))
  )
    throw new Error("The retained release marker does not match.");
  if (manifest.schemaVersion !== 1) {
    if (
      JSON.stringify(manifest.checks) !==
      JSON.stringify(publicFileChecks(manifest.files))
    )
      throw new Error("Releases must verify every served file.");
    if (!manifest.checks.some((check) => check.path === "/"))
      throw new Error("The release has no homepage check.");
    if (
      !manifest.client &&
      !manifest.checks.some((check) => check.path === "/builder/")
    )
      throw new Error("The release is missing its builder check.");
    return manifest;
  }
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
async function installImmutableAssets(root, manifest, storageLimits) {
  const additions = [];
  for (const file of manifest.files.filter(
    (file) =>
      file.path.startsWith("_astro/") ||
      (manifest.client && file.path.startsWith("assets/")),
  )) {
    const target = path.join(root, "immutable", file.path);
    await safeDirectory(
      root,
      `immutable/${path.posix.dirname(file.path)}`,
      false,
    );
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
    additions.push(file);
  }
  if (additions.length) {
    const directories = new Set();
    for (const file of additions) {
      const parts = file.path.split("/");
      for (let count = 1; count < parts.length; count++)
        directories.add(parts.slice(0, count).join("/"));
    }
    const bytes =
      additions.reduce((sum, file) => sum + file.size, 0) +
      additions.length * 16 * 1024 +
      directories.size * 8 * 1024;
    await checkReleaseStorage(root, storageLimits, {
      bytes,
      immutableBytes: bytes,
    });
  }
  for (const file of additions) {
    const target = path.join(root, "immutable", file.path);
    await safeDirectory(root, `immutable/${path.posix.dirname(file.path)}`);
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      const source = path.join(
        root,
        "releases",
        manifest.id,
        "site",
        file.path,
      );
      const info = await lstat(source);
      if (info.size !== file.size)
        throw new Error(
          "The retained release changed before asset installation.",
        );
      await copyReleaseFile(source, temporary, info);
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
// Retention joins the same lock as staging/activation. Its caller validates an
// existing canonical store first; inventory must never create/adopt a store.
export {
  withLock as withReleaseStoreLock,
  currentConfig as readReleaseSelection,
};
export async function initialiseStore({
  store,
  id,
  storageLimits = releaseStorageLimits(),
}) {
  const root = await storeRoot(store);
  return withLock(root, async () => {
    if (await currentConfig(root))
      throw new Error("This release store is already initialised.");
    const manifest = await verifyRelease(root, id);
    await installImmutableAssets(root, manifest, storageLimits);
    await atomicWrite(
      path.join(root, "active.conf"),
      nginxConfig(root, id, Boolean(manifest.client)),
    );
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
    manifest.client &&
    validateClientDestination(manifest.client).origin !== base.origin
  )
    throw new Error(
      "The requested origin is not this client release's configured destination.",
    );
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
  async function requireIdentity(response, pathname) {
    if (
      manifest.responseIdentity === "release-id-v1" &&
      response.headers.get("x-kaizen-release") !== manifest.id
    ) {
      await response.body?.cancel();
      throw new Error(
        `The live response for ${pathname} came from a different release or is missing its release identity.`,
      );
    }
  }
  async function get(pathname) {
    const url = new URL(pathname, base);
    url.searchParams.set("kaizen-release-check", randomUUID());
    const response = await fetcher(url, {
      redirect: "error",
      cache: "no-store",
      // Request unmodified HTML: Cloudflare excludes AJAX responses from its
      // JavaScript Detections injection. Keep exact artifact checksums intact.
      headers: {
        "Cache-Control": "no-cache",
        "X-Requested-With": "XMLHttpRequest",
        Connection: "close",
      },
      signal: AbortSignal.timeout(timeout),
    });
    await requireIdentity(response, pathname);
    if (!response.ok)
      throw new Error(
        `Live check failed for ${pathname}: HTTP ${response.status}.`,
      );
    return new Uint8Array(await response.arrayBuffer());
  }
  const markerBytes = await get(`/${MARKER}`);
  const marker = JSON.parse(new TextDecoder().decode(markerBytes));
  if (
    manifest.schemaVersion !== 1 &&
    digest(markerBytes) !==
      manifest.files.find((file) => file.path === MARKER)?.sha256
  )
    throw new Error(
      "The served release marker does not match the retained artifact.",
    );
  if (
    marker.releaseId !== manifest.id ||
    (manifest.client && !sameClient(marker.client, manifest.client))
  )
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
          headers: {
            "Cache-Control": "no-cache",
            "X-Requested-With": "XMLHttpRequest",
            Connection: "close",
          },
          signal: AbortSignal.timeout(timeout),
        });
        await requireIdentity(response, check.source);
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
  {
    store,
    id,
    origin,
    report = (_event) => {},
    storageLimits = releaseStorageLimits(),
  },
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
    // Direct CLI and worker activation/rollback share this refusal; retirement
    // may have partly removed a release whose manifest still verifies.
    await assertReleaseIdNotRetired(root, id, "activate");
    const previous = await currentConfig(root);
    if (!previous)
      throw new Error(
        "Initialise and connect the release store to Nginx before activating a release.",
      );
    const manifest = await verifyRelease(root, id),
      old = await verifyRelease(root, previous.id);
    if (!sameClient(manifest.client || null, old.client || null))
      throw new Error(
        "Cannot activate a release from another client destination.",
      );
    // A previous successful reload may still have an older worker draining.
    // Require the complete baseline proof before any mutation, with the same
    // bounded observation used for activation and restoration.
    await observe(old);
    await adapters.beforePrepare?.(manifest, old);
    await installImmutableAssets(root, manifest, storageLimits);
    const next = nginxConfig(root, id, Boolean(manifest.client)),
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
/** Finish a stopped activation's selected configuration, then reconcile its owner. */
export async function reconcileRelease(
  { store, id, origin, restoreId },
  adapters = {},
) {
  const root = await storeRoot(store);
  return withRecoveryLock(
    path.join(root, ".activation-lock"),
    async (owner) => {
      const selected = await currentConfig(root);
      if (!selected || selected.id !== id)
        throw new Error(
          "Selected configuration changed before recovery. Inspect the destination again.",
        );
      // Only a newly selected restoration target is checked: the selected
      // release is always protected, and retirement recovery reconciles it.
      if (restoreId)
        await assertReleaseIdNotRetired(root, restoreId, "activate");
      // Verify the artifact to be served against the store's fixed identity.
      // A corrupt candidate must not prevent restoring an intact previous site.
      const manifest = await verifyRelease(root, restoreId || id);
      if (
        restoreId &&
        !matchesManagedConfig(root, id, Boolean(manifest.client), selected.text)
      )
        throw new Error(
          "The active include was edited externally; recovery has preserved it.",
        );
      const recoveredConfig = restoreId
        ? nginxConfig(root, restoreId, Boolean(manifest.client))
        : selected.text;
      const journal = path.join(root, "transactions", `${randomUUID()}.json`);
      const transaction = {
        schemaVersion: 1,
        id: path.basename(journal, ".json"),
        releaseId: manifest.id,
        ...(restoreId ? { previousSelectedReleaseId: id } : {}),
        startedAt: new Date().toISOString(),
        recoveredOwner: owner,
        status: "reconciling",
      };
      const save = async (status, error) => {
        Object.assign(transaction, {
          status,
          updatedAt: new Date().toISOString(),
          ...(error ? { error: error.message } : {}),
        });
        await atomicWrite(journal, JSON.stringify(transaction, null, 2));
      };
      const nginx = (args) =>
        run(
          process.getuid?.() === 0 ? "nginx" : "sudo",
          process.getuid?.() === 0 ? args : ["-n", "nginx", ...args],
          { timeout: 30000, maxBuffer: 1024 * 1024 },
        );
      await save("reconciling");
      try {
        await adapters.beforeReconcile?.(manifest);
        if ((await currentConfig(root))?.text !== selected.text)
          throw new Error("Selected configuration changed during recovery.");
        if (restoreId)
          await atomicWrite(path.join(root, "active.conf"), recoveredConfig);
        await (adapters.validateConfig || (() => nginx(["-t"])))();
        await (adapters.reload || (() => nginx(["-s", "reload"])))();
        for (let attempt = 0; ; attempt++) {
          try {
            await (adapters.checkLive || checkLive)(origin, manifest);
            break;
          } catch (error) {
            if (attempt >= 4) throw error;
            await new Promise((resolve) =>
              setTimeout(resolve, 250 * (attempt + 1)),
            );
          }
        }
        if ((await currentConfig(root))?.text !== recoveredConfig)
          throw new Error(
            "Selected configuration changed while verifying recovery.",
          );
        await adapters.finalize?.(manifest);
        await save("reconciled");
        return transaction;
      } catch (error) {
        await save("recovery_required", error);
        throw error;
      }
    },
  );
}
export async function listReleases(store) {
  const root = await storeRoot(store),
    current = await currentConfig(root);
  // Domain and publication checks list stores without the activation lock. A
  // killed retirement's target is no longer retained and may lack its manifest.
  const retiring = await unfinishedRetirement(root);
  const releases = [];
  for (const name of await readdir(path.join(root, "releases"))) {
    releaseId(name);
    if (name === retiring && name !== current?.id) continue;
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
