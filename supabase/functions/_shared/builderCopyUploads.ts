/** Server copies use the same quota-reserved transfer path as browser imports. */
import { validProjectId } from "../../../shared/builderProjects.ts";
import type { Asset } from "../../../shared/visualBuilder.ts";

const chunkBytes = 6 * 1024 ** 2;
export function copyUploadOrigin(value: string | undefined) {
  try {
    const url = new URL(value || "");
    if (
      url.protocol !== "https:" ||
      url.origin !== value ||
      url.username ||
      url.password
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error(
      "Website copying is not configured yet. Existing websites are unchanged.",
    );
  }
}
export async function copyUploadId(projectId: string, assetId: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        `kaizen-hosted-upload\0${projectId}\0${assetId}`,
      ),
    ),
  );
  digest[6] = (digest[6] & 15) | 64;
  digest[8] = (digest[8] & 63) | 128;
  const hex = Array.from(digest.slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function copyFileThroughUploadService(options: {
  origin: string;
  token: string;
  projectId: string;
  asset: Asset;
  bytes: ArrayBuffer;
  fetch?: typeof fetch;
}) {
  const origin = copyUploadOrigin(options.origin),
    { asset, bytes, projectId } = options;
  if (
    !validProjectId(projectId) ||
    projectId === "kaizen" ||
    !validProjectId(asset.id) ||
    asset.id === "kaizen" ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < 1 ||
    asset.size > 50 * 1024 ** 2 ||
    bytes.byteLength !== asset.size ||
    !/^[a-f0-9]{64}$/.test(asset.hash) ||
    !/^[a-zA-Z0-9_.-]+$/.test(options.token)
  )
    throw new Error("Invalid file in the website copy.");
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== asset.hash)
    throw new Error(
      "A source file changed. The copy has been kept for review.",
    );
  const endpoint = `${origin}/editor-uploads`,
    id = await copyUploadId(projectId, asset.id),
    address = `${endpoint}/${id}`;
  const request = async (
    url: string,
    init: RequestInit,
    expected: number[],
  ) => {
    const response = await (options.fetch || fetch)(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Tus-Resumable": "1.0.0",
        ...init.headers,
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    if (!expected.includes(response.status)) {
      await response.body?.cancel();
      throw new Error(
        response.status === 429
          ? "The copy paused at its storage limit. Check the plan or pending imports, then resume this copy."
          : "The copy paused while transferring a file. Resume this copy to keep its progress.",
      );
    }
    return response;
  };
  const metadata = {
    projectId,
    assetId: asset.id,
    bytes: asset.size,
    sha256: asset.hash,
    mime: asset.mime,
    kind: asset.kind,
  };
  const encoded = btoa(
    Array.from(new TextEncoder().encode(JSON.stringify(metadata)), (byte) =>
      String.fromCharCode(byte),
    ).join(""),
  );
  const created = await request(
    endpoint,
    {
      method: "POST",
      headers: {
        "Upload-Length": String(asset.size),
        "Upload-Metadata": `file ${encoded}`,
      },
    },
    [201],
  );
  const location = created.headers.get("Location");
  await created.body?.cancel();
  if (!location || new URL(location, endpoint).href !== address)
    throw new Error("The upload service returned an unexpected copy address.");
  const head = await request(address, { method: "HEAD" }, [200, 204]);
  const offsetValue = head.headers.get("Upload-Offset");
  await head.body?.cancel();
  if (
    head.headers.get("Upload-Length") !== String(asset.size) ||
    !offsetValue ||
    !/^(0|[1-9][0-9]*)$/.test(offsetValue) ||
    Number(offsetValue) > asset.size
  )
    throw new Error("The copied file has an unexpected resume offset.");
  let offset = Number(offsetValue);
  while (offset < asset.size) {
    const end = Math.min(offset + chunkBytes, asset.size);
    const response = await request(
      address,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/offset+octet-stream",
          "Upload-Offset": String(offset),
        },
        body: bytes.slice(offset, end),
      },
      [204],
    );
    await response.body?.cancel();
    if (response.headers.get("Upload-Offset") !== String(end))
      throw new Error(
        "The copied file needs its upload offset checked before continuing.",
      );
    offset = end;
  }
  const finished = await request(
    `${address}/finish`,
    { method: "POST" },
    [200],
  );
  const reader = finished.body?.getReader();
  if (!reader) throw new Error("The copied file needs its completion checked.");
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 4096)
        throw new Error("The copied file returned an invalid completion.");
      parts.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  const joined = new Uint8Array(length);
  let cursor = 0;
  for (const part of parts) {
    joined.set(part, cursor);
    cursor += part.length;
  }
  let receipt: any;
  try {
    receipt = JSON.parse(new TextDecoder().decode(joined));
  } catch {
    throw new Error("The copied file returned an invalid completion.");
  }
  if (
    receipt.id !== id ||
    receipt.projectId !== projectId ||
    receipt.assetId !== asset.id ||
    receipt.bytes !== asset.size ||
    receipt.sha256 !== asset.hash ||
    receipt.status !== "stored"
  )
    throw new Error(
      "The copied file has not been verified. Resume this copy to check it.",
    );
}
