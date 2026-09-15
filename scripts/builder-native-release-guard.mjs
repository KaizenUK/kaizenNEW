import path from "node:path";

/** A service caller supplies its journal; its operation spans every awaited
 * release/recovery action, including error reconciliation. */
export function withNativeRelease(options, projectId, work) {
  const { native, ...input } = options;
  return native.run("", projectId, async (nativeFiles) => {
    try {
      return await work({ ...input, nativeFiles });
    } catch (error) {
      if (error?.nativeRecoveryRequired) nativeFiles.retainOperation();
      throw error;
    }
  });
}

export async function assertNativeRelease(options, manifest) {
  if (!options.nativeFiles) return;
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(manifest?.id || "") ||
    !path.isAbsolute(options.store || "")
  )
    throw new Error("Invalid native release artifact.");
  await options.nativeFiles.assertTree(
    path.join(options.store, "releases", manifest.id),
  );
}
