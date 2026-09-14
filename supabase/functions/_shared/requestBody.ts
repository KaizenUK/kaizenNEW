export class RequestBodyError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Count actual streamed bytes: Content-Length alone is not a body limit. */
export async function readJsonObject(
  request: Request,
  maximumBytes: number,
): Promise<Record<string, unknown>> {
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    throw new RequestBodyError(415, "Send this request as JSON.");
  const encoding = request.headers
    .get("content-encoding")
    ?.trim()
    .toLowerCase();
  if (encoding && encoding !== "identity")
    throw new RequestBodyError(415, "Compressed requests are not supported.");
  const length = request.headers.get("content-length");
  if (
    length !== null &&
    (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))
  )
    throw new RequestBodyError(400, "Invalid request length.");
  if (length !== null && Number(length) > maximumBytes)
    throw new RequestBodyError(413, "This request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400, "A request is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyError(413, "This request is too large.");
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new RequestBodyError(400, "A JSON object is required.");
    return value;
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, "This request contains invalid JSON.");
  } finally {
    reader.releaseLock();
  }
}
