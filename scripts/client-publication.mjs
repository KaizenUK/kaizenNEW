/** Server-only destination registry and CLI. No destination defaults to Kaizen. */
import {
  readFile,
  lstat,
  realpath,
  mkdtemp,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import {
  validateClientDestination,
  bindClientStore,
  stageRelease,
  initialiseStore,
  verifyRelease,
  activateRelease,
  reconcileRelease,
  checkLive,
  listReleases,
} from "./kaizen-releases.mjs";
const pathKey = (value) =>
  process.platform === "win32" ? value.toLowerCase() : value;

async function canonicalStore(value) {
  if (typeof value !== "string" || !path.isAbsolute(value))
    throw new Error("Destination stores must use absolute paths.");
  const resolved = path.resolve(value);
  if (
    resolved === path.parse(resolved).root ||
    pathKey(resolved) === pathKey(os.homedir())
  )
    throw new Error("Use a dedicated client release store.");
  let ancestor = resolved;
  for (;;) {
    const stat = await lstat(ancestor).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (stat) {
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        pathKey(await realpath(ancestor)) !== pathKey(ancestor)
      )
        throw new Error(
          "Destination stores cannot use linked or non-directory paths.",
        );
      break;
    }
    ancestor = path.dirname(ancestor);
  }
  return resolved;
}
export async function readClientDestinations(file) {
  if (typeof file !== "string" || !path.isAbsolute(file))
    throw new Error(
      "Set an absolute server-owned client destination configuration file.",
    );
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100000)
    throw new Error("Invalid client destination configuration file.");
  return validateClientDestinations(JSON.parse(await readFile(file, "utf8")));
}
/** Validate an operator-owned update before atomically replacing the registry. */
export async function validateClientDestinations(config) {
  if (
    config.schemaVersion !== 1 ||
    Object.keys(config).sort().join(",") !== "destinations,schemaVersion" ||
    !Array.isArray(config.destinations) ||
    config.destinations.length > 100
  )
    throw new Error("Unsupported client destination configuration.");
  const destinations = [];
  for (const item of config.destinations) {
    if (
      !item ||
      Object.keys(item).sort().join(",") !==
        "destinationId,environment,label,origin,projectId,store" ||
      typeof item.label !== "string" ||
      !item.label.trim() ||
      item.label.length > 100 ||
      /[\u0000-\u001f]/.test(item.label)
    )
      throw new Error(
        "Each destination needs its own identity, label, origin and store.",
      );
    const client = validateClientDestination({
      projectId: item.projectId,
      destinationId: item.destinationId,
      environment: item.environment,
      origin: item.origin,
    });
    const store = await canonicalStore(item.store);
    const key = process.platform === "win32" ? store.toLowerCase() : store;
    for (const other of destinations) {
      const otherKey =
        process.platform === "win32" ? other.store.toLowerCase() : other.store;
      if (
        other.destinationId === client.destinationId ||
        other.origin === client.origin ||
        (other.projectId === client.projectId &&
          other.environment === client.environment) ||
        key === otherKey ||
        key.startsWith(otherKey + path.sep) ||
        otherKey.startsWith(key + path.sep)
      )
        throw new Error(
          "Destinations must have unique IDs, origins, non-overlapping stores and one target per project/environment.",
        );
    }
    destinations.push({ ...client, label: item.label.trim(), store });
  }
  return destinations;
}
export function publicDestination(destination) {
  const { projectId, destinationId, environment, origin, label } = destination;
  return { projectId, destinationId, environment, origin, label };
}
function identity(destination) {
  return validateClientDestination({
    projectId: destination.projectId,
    destinationId: destination.destinationId,
    environment: destination.environment,
    origin: destination.origin,
  });
}
async function assertConfiguredStore(destination) {
  const file = path.join(destination.store, "client-destination.json");
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("The destination binding is not a regular file.");
  const actual = validateClientDestination(
    JSON.parse(await readFile(file, "utf8")),
  );
  if (JSON.stringify(actual) !== JSON.stringify(identity(destination)))
    throw new Error(
      "The configured project or destination does not match the store binding.",
    );
}
/** The caller supplies authorization. The configured store and release identity are always rechecked. */
export async function clientPublicationAction(
  destination,
  action,
  options = {},
  adapters = {},
) {
  const client = identity(destination),
    store = await canonicalStore(destination.store);
  const report = options.report || (() => {});
  if (action === "bind") return bindClientStore({ store, client });
  await assertConfiguredStore({ ...destination, store });
  if (action === "stage")
    return stageRelease({
      store,
      client,
      source: options.source,
      id: options.id,
      commit: options.commit || "",
      redirectRules: options.redirects
        ? JSON.parse(await readFile(options.redirects, "utf8"))
        : null,
      report,
    });
  if (action === "init") return initialiseStore({ store, id: options.id });
  if (action === "list")
    return {
      ...publicDestination(destination),
      ...(await listReleases(store)),
    };
  if (action === "verify-live")
    return checkLive(client.origin, await verifyRelease(store, options.id));
  if (action === "reconcile")
    return reconcileRelease(
      {
        store,
        id: options.id,
        origin: client.origin,
        restoreId: options.restoreId,
      },
      adapters,
    );
  if (action === "activate" || action === "rollback")
    return activateRelease(
      { store, id: options.id, origin: client.origin, report },
      adapters,
    );
  if (action === "unpublish") {
    // Retained as a normal immutable artifact so restoration uses the same verified path.
    const temporary = await mkdtemp(
      path.join(os.tmpdir(), "kaizen-unpublished-client-"),
    );
    await writeFile(
      path.join(temporary, "index.html"),
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Website unavailable</title></head><body><main><h1>This website is temporarily unavailable</h1></main></body></html>',
    );
    await stageRelease({
      store,
      client,
      source: temporary,
      id: options.id,
      report,
    });
    return activateRelease(
      { store, id: options.id, origin: client.origin, report },
      adapters,
    );
  }
  throw new Error(
    "Use bind, stage, init, activate, rollback, unpublish, list, verify-live or reconcile.",
  );
}
async function cli() {
  const [action, ...args] = process.argv.slice(2),
    options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (
      !/^--(config|destination|source|id|commit|redirects)$/.test(
        args[index],
      ) ||
      !args[index + 1] ||
      options[args[index].slice(2)]
    )
      throw new Error(
        "Use --config, --destination and action-specific --source/--id/--commit arguments.",
      );
    options[args[index].slice(2)] = args[index + 1];
  }
  const config = options.config || process.env.BUILDER_CLIENT_DESTINATIONS_FILE;
  const destinations = await readClientDestinations(config);
  const destination = destinations.find(
    (item) => item.destinationId === options.destination,
  );
  if (!destination)
    throw new Error(
      "Choose an explicitly configured --destination ID. There is no default publication target.",
    );
  const report = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
  report({ destination: publicDestination(destination), action });
  report(
    await clientPublicationAction(destination, action, { ...options, report }),
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
