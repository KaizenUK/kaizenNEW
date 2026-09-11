import { realpath, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { ClientPublicationSnapshot } from "../shared/builderClientPublication";
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export async function loadPublicationAsset(
  snapshot: ClientPublicationSnapshot,
  url: string,
  options: {
    samplesRoot: string;
    registered: (id: string) => Promise<Uint8Array>;
  },
) {
  const asset = snapshot.workspace.assets.find((value) => value.url === url);
  if (asset) {
    const bytes = await options.registered(asset.id);
    if (bytes.length !== asset.size || hash(bytes) !== asset.hash)
      throw new Error(`Asset changed since upload: ${asset.name}`);
    return new Uint8Array(bytes);
  }
  // Built-in sample files are the only unregistered local URLs allowed. No cross-project or arbitrary filesystem reads.
  if (url.startsWith("/builder-samples/")) {
    const root = await realpath(options.samplesRoot),
      file = await realpath(
        path.resolve(root, url.slice("/builder-samples/".length)),
      );
    if (!file.startsWith(root + path.sep))
      throw new Error("Invalid built-in sample path.");
    return new Uint8Array(await readFile(file));
  }
  const remote = new URL(url, "https://unregistered.invalid");
  const cms = snapshot.workspace.settings?.value.cms;
  const allowed =
    remote.hostname === "images.unsplash.com" ||
    (remote.hostname === "cdn.sanity.io" &&
      cms?.kind === "sanity-public" &&
      remote.pathname.startsWith(`/images/${cms.projectId}/${cms.dataset}/`));
  if (
    allowed &&
    remote.protocol === "https:" &&
    !remote.username &&
    !remote.password &&
    !remote.port
  ) {
    const response = await fetch(remote, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/") ||
      !response.body
    ) {
      await response.body?.cancel();
      throw new Error(
        "The configured public image provider did not return an image.",
      );
    }
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 32 * 1024 * 1024)
          throw new Error("Publication images must be smaller than 32 MB.");
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
  throw new Error(
    `Import this media into the project's Asset library before publishing: ${url.slice(0, 180)}`,
  );
}
