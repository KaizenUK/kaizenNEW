/** Storage API adapter for the trusted upload worker. Never accept paths from a browser. */
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { accountId } from "./builder-hosted-auth";
import { privateFile } from "./builder-hosted-folders";
import { MAX_UPLOAD_BYTES } from "./builder-upload-spool";
import { validProjectId } from "../shared/builderProjects";

export type UploadObject = {
  id: string;
  project_id: string;
  asset_id: string;
  bucket_id: string;
  object_name: string;
  bytes: number;
  sha256: string;
  mime: string;
  object_scope?: "registered" | "orphan";
};
export type StorageProbe = Omit<UploadObject, "sha256" | "mime"> & {
  object_scope: "orphan";
};
export type StoredUpload = {
  bytes: number;
  sha256: string;
  version: string;
  etag: string;
};
type Observation = { bytes: number; version: string; etag: string };
export class UploadProviderError extends Error {
  constructor(readonly reason: "unavailable" | "changed" | "invalid") {
    super(
      reason === "changed"
        ? "The stored upload could not be matched to the original file. Its data has been kept."
        : "The upload service could not verify file storage. Resume the original import to retry.",
    );
  }
}
const unavailable = () => new UploadProviderError("unavailable");
function objectKey(item: UploadObject) {
  if (
    !item ||
    !accountId(item.id) ||
    !accountId(item.asset_id) ||
    !validProjectId(item.project_id) ||
    !Number.isSafeInteger(item.bytes) ||
    item.bytes < 0 ||
    item.bytes > MAX_UPLOAD_BYTES ||
    !/^[a-f0-9]{64}$/.test(item.sha256) ||
    typeof item.mime !== "string" ||
    item.mime.length < 1 ||
    item.mime.length > 255 ||
    /[\x00-\x1f\x7f]/.test(item.mime) ||
    (item.object_scope !== undefined &&
      !["registered", "orphan"].includes(item.object_scope)) ||
    typeof item.object_name !== "string" ||
    Buffer.byteLength(item.object_name) > 1024 ||
    !item.object_name ||
    /[\x00-\x1f\x7f]/.test(item.object_name) ||
    item.object_name.split("/").some((part) => part === "." || part === "..") ||
    !(item.project_id === "kaizen"
      ? ["builder-media", "builder-source"].includes(item.bucket_id) &&
        (item.object_scope === "orphan" || item.object_name === item.asset_id)
      : item.bucket_id === "builder-project-files" &&
        (item.object_scope === "orphan"
          ? item.object_name.startsWith(`${item.project_id}/`)
          : item.object_name === `${item.project_id}/${item.asset_id}`))
  )
    throw new UploadProviderError("invalid");
  try {
    return `${item.bucket_id}/${item.object_name.split("/").map(encodeURIComponent).join("/")}`;
  } catch {
    throw new UploadProviderError("invalid");
  }
}
async function boundedJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw unavailable();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 16384) throw unavailable();
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw unavailable();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
async function absent(response: Response) {
  if (response.ok) return false;
  const body = await boundedJson(response);
  // Other 400/404 responses (including unavailable buckets) are not object-removal proof.
  if ([400, 404].includes(response.status) && body?.code === "NoSuchKey")
    return true;
  throw unavailable();
}
function same(a: Observation, b: Observation) {
  return a.bytes === b.bytes && a.version === b.version && a.etag === b.etag;
}

export function uploadStorageProvider(options: {
  url: string;
  serviceKey: string;
  fetch?: typeof fetch;
}) {
  let origin: URL;
  try {
    origin = new URL(options.url);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      !options.serviceKey ||
      /[\x00-\x20\x7f]/.test(options.serviceKey)
    )
      throw unavailable();
  } catch {
    throw unavailable();
  }
  async function request(
    route: string,
    init: RequestInit & { duplex?: "half" } = {},
  ) {
    try {
      return await (options.fetch || fetch)(
        new URL(`/storage/v1/${route}`, origin),
        {
          ...init,
          headers: {
            ...init.headers,
            apikey: options.serviceKey,
            Authorization: `Bearer ${options.serviceKey}`,
            "Accept-Encoding": "identity",
          },
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(120000),
        },
      );
    } catch {
      throw unavailable();
    }
  }
  async function inspect(item: UploadObject): Promise<Observation | null> {
    const key = objectKey(item),
      response = await request(`object/info/${key}`);
    if (await absent(response)) return null;
    const data = await boundedJson(response);
    if (
      data.name !== item.object_name ||
      data.bucket_id !== item.bucket_id ||
      !Number.isSafeInteger(data.size) ||
      data.size < 0 ||
      typeof data.version !== "string" ||
      !data.version ||
      data.version.length > 255 ||
      typeof data.etag !== "string" ||
      !data.etag ||
      data.etag.length > 255
    )
      throw unavailable();
    return { bytes: data.size, version: data.version, etag: data.etag };
  }
  async function readBytes(
    item: UploadObject,
    matchHash = true,
  ): Promise<StoredUpload & { mime: string }> {
    const key = objectKey(item),
      before = await inspect(item);
    if (!before || before.bytes !== item.bytes)
      throw new UploadProviderError("changed");
    const query = new URLSearchParams({
      versionId: before.version,
      cacheNonce: randomUUID(),
    });
    const response = await request(`object/${key}?${query}`);
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw unavailable();
    }
    const length = response.headers.get("content-length");
    if (
      length !== null &&
      (!/^[0-9]+$/.test(length) || Number(length) !== item.bytes)
    ) {
      await response.body.cancel();
      throw new UploadProviderError("changed");
    }
    const reader = response.body.getReader(),
      hash = createHash("sha256");
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > item.bytes) throw new UploadProviderError("changed");
        hash.update(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const actualHash = hash.digest("hex"),
      mime = response.headers.get("content-type") || "application/octet-stream";
    if (size !== item.bytes || (matchHash && actualHash !== item.sha256))
      throw new UploadProviderError("changed");
    if (!mime || mime.length > 255 || /[\x00-\x1f\x7f]/.test(mime))
      throw unavailable();
    const after = await inspect(item);
    if (!after || !same(before, after))
      throw new UploadProviderError("changed");
    return { ...after, sha256: actualHash, mime };
  }
  async function verify(item: UploadObject): Promise<StoredUpload> {
    const { mime: _mime, ...receipt } = await readBytes(item);
    return receipt;
  }
  async function measure(item: StorageProbe) {
    if (item.object_scope !== "orphan")
      throw new UploadProviderError("invalid");
    const probe = {
      ...item,
      sha256: "0".repeat(64),
      mime: "application/octet-stream",
    };
    if (!(await inspect(probe))) return null;
    return readBytes(probe, false);
  }
  async function ensure(item: UploadObject, verifiedLocalPath: string) {
    if (item.bytes === 0 || item.object_scope === "orphan")
      throw new UploadProviderError("invalid");
    const key = objectKey(item);
    // An existing object might be the result of a successful write whose reply was lost.
    if (await inspect(item)) return verify(item);
    await privateFile(verifiedLocalPath, MAX_UPLOAD_BYTES);
    const file = await open(
      verifiedLocalPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const info = await file.stat();
      if (!info.isFile() || info.nlink !== 1 || info.size !== item.bytes)
        throw new UploadProviderError("changed");
      const hash = createHash("sha256");
      for await (const chunk of file.createReadStream({ autoClose: false }))
        hash.update(chunk);
      if (hash.digest("hex") !== item.sha256)
        throw new UploadProviderError("changed");
      const stream = file.createReadStream({ start: 0, autoClose: false });
      let response: Response;
      try {
        response = await request(`object/${key}`, {
          method: "POST",
          body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
          headers: {
            "Content-Type": item.mime,
            "Content-Length": String(item.bytes),
            "cache-control": "max-age=3600",
            "x-upsert": "false",
          },
          duplex: "half",
        });
      } finally {
        stream.destroy();
      }
      // Leave unknown/failed writes for a fresh inspect/verify retry. Never roll them back blindly.
      if (!response.ok) {
        await response.body?.cancel();
        throw unavailable();
      }
      await boundedJson(response);
    } finally {
      await file.close();
    }
    return verify(item);
  }
  async function remove(item: UploadObject) {
    const key = objectKey(item),
      before = await inspect(item);
    if (!before) return;
    const verified = await verify(item);
    if (!same(before, verified)) throw new UploadProviderError("changed");
    // Target only the observed version. A replacement object must never be deleted by this cleanup.
    const response = await request(
      `object/${key}?${new URLSearchParams({ versionId: before.version })}`,
      { method: "DELETE" },
    );
    if (!response.ok && !(await absent(response))) throw unavailable();
    if (response.ok) await boundedJson(response);
    if (await inspect(item)) throw new UploadProviderError("changed");
  }
  return { inspect, verify, measure, ensure, remove };
}
