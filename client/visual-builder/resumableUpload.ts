import { Upload } from "tus-js-client";

export const UPLOAD_CHUNK_SIZE = 6 * 1024 * 1024;
export type UploadControl = {
  signal?: AbortSignal;
  uploadUrl?: string;
  onUploadUrl?: (url: string) => Promise<void>;
  recover?: boolean;
  scope?: string;
};
export function assertUploadUrl(value: string, endpoint: string): string {
  const url = new URL(value, endpoint),
    base = new URL(endpoint);
  if (
    url.origin !== base.origin ||
    (url.pathname !== base.pathname &&
      !url.pathname.startsWith(base.pathname.replace(/\/$/, "") + "/")) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error(
      "The saved upload address does not belong to this workspace. Discard this import and select the files again.",
    );
  return url.href;
}
export async function resumableUpload(
  blob: Blob,
  options: UploadControl & {
    endpoint: string;
    metadata: Record<string, string>;
    headers: () => Promise<Record<string, string>>;
    progress: (percent: number) => void;
  },
): Promise<string> {
  options.signal?.throwIfAborted();
  const saved =
    options.uploadUrl && assertUploadUrl(options.uploadUrl, options.endpoint);
  return new Promise((resolve, reject) => {
    const finish = (error?: unknown) => {
      options.signal?.removeEventListener("abort", pause);
      error ? reject(error) : resolve(upload.url!);
    };
    const upload = new Upload(blob, {
      endpoint: options.endpoint,
      uploadUrl: saved || undefined,
      chunkSize: UPLOAD_CHUNK_SIZE,
      retryDelays: [0, 1000, 3000, 5000],
      uploadDataDuringCreation: false,
      storeFingerprintForResuming: false,
      metadata: options.metadata,
      onBeforeRequest: async (request) => {
        options.signal?.throwIfAborted();
        assertUploadUrl(request.getURL(), options.endpoint);
        const headers = await options.headers();
        options.signal?.throwIfAborted();
        for (const [key, value] of Object.entries(headers))
          request.setHeader(key, value);
        const xhr = request.getUnderlyingObject();
        if (xhr && "timeout" in xhr) xhr.timeout = 180_000;
      },
      onAfterResponse: async (request, response) => {
        const location = response.getHeader("Location");
        if (
          request.getMethod() === "POST" &&
          response.getStatus() === 201 &&
          location
        )
          await options.onUploadUrl?.(
            assertUploadUrl(location, options.endpoint),
          );
      },
      onProgress: (sent, total) =>
        options.progress(Math.round((sent / total) * 100)),
      onShouldRetry: (error) => {
        const status = error.originalResponse?.getStatus() || 0;
        return (
          !options.signal?.aborted &&
          (!status || [408, 409, 423, 429].includes(status) || status >= 500)
        );
      },
      onError: (error) =>
        finish(
          new Error(
            `Upload interrupted${"originalResponse" in error && error.originalResponse ? ` (${error.originalResponse.getStatus()})` : ""}. Resume to retry; sign in again if access expired.`,
          ),
        ),
      onSuccess: () => finish(),
    });
    const pause = () => {
      void upload
        .abort(false)
        .finally(() => finish(new DOMException("Upload paused", "AbortError")));
    };
    options.signal?.addEventListener("abort", pause, { once: true });
    upload.start();
  });
}
