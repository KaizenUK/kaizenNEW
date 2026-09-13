import { HostedHelperError } from "./builder-hosted-auth";

/** Read-only public release identity, from an operator-approved origin. A marker does not attest all served bytes. */
export async function hostedReleaseMarker(
  origin: string,
  request: typeof fetch = fetch,
) {
  try {
    const response = await request(
      new URL("/.well-known/kaizen-release.json", origin),
      {
        headers: { Accept: "application/json" },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        bytes += item.value.byteLength;
        if (bytes > 8192) throw new Error();
        chunks.push(item.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const marker = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      marker.schemaVersion !== 1 ||
      typeof marker.commit !== "string" ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(marker.commit) ||
      typeof marker.releaseId !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(marker.releaseId)
    )
      throw new Error();
    return {
      commit: marker.commit as string,
      releaseId: marker.releaseId as string,
    };
  } catch {
    throw new HostedHelperError(
      409,
      "The website's deployed revision could not be checked. Ask the owner to check deployment before publishing.",
    );
  }
}
