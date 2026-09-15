/** Loopback-only HTTP host for the private upload worker. */
import { createServer, type IncomingMessage } from "node:http";
import { Readable, Transform } from "node:stream";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { HostedUploads, HOSTED_UPLOAD_PATH } from "./builder-hosted-uploads";
import { UploadSpool } from "./builder-upload-spool";
import { HostedRepositoryAccess } from "./builder-hosted-auth";
import { uploadStorageProvider } from "./builder-upload-provider";
import { createReleaseClient } from "./builder-release-worker.mjs";
import {
  parseAllowedOrigins,
  DEFAULT_EDITOR_ORIGINS,
} from "../shared/builderOrigins";

export const MAX_UPLOAD_CHUNK_BYTES = 6 * 1024 ** 2;
type UploadHandler = Pick<HostedUploads, "handle"> &
  Partial<Pick<HostedUploads, "maintain">>;
function headerMap(request: IncomingMessage) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value))
      throw new Error("Invalid repeated upload header.");
    if (value !== undefined) headers.set(name, value);
  }
  return headers;
}
export async function startUploadHost(options: {
  service: UploadHandler;
  port?: number;
  maintenanceIntervalMs?: number;
}) {
  const maintenanceInterval = options.maintenanceIntervalMs ?? 60000;
  if (
    !Number.isSafeInteger(maintenanceInterval) ||
    maintenanceInterval < 10 ||
    maintenanceInterval > 3600000
  )
    throw new Error("Invalid upload maintenance interval.");
  const pending = new Set<Promise<void>>();
  let maintenance: Promise<void> | undefined;
  let maintenanceTimer: NodeJS.Timeout | undefined;
  let closing = false,
    listeningPort = 0;
  const server = createServer({ maxHeaderSize: 16384 }, (req, res) => {
    const operation = (async () => {
      let overflow = false;
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      const failure = (status: number, message: string) => {
        res.shouldKeepAlive = false;
        res
          .writeHead(status, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: message }));
      };
      try {
        if (req.url === "/health") {
          if (
            !["GET", "HEAD"].includes(req.method || "") ||
            req.headers.host !== `127.0.0.1:${listeningPort}` ||
            Object.keys(req.headers).some(
              (name) =>
                name === "origin" ||
                name === "forwarded" ||
                name.startsWith("x-forwarded-") ||
                name === "sec-fetch-site",
            )
          )
            return failure(404, "Upload address not found.");
          res
            .writeHead(closing ? 503 : 200, {
              "Content-Type": "application/json",
            })
            .end(
              req.method === "HEAD"
                ? undefined
                : JSON.stringify({ status: closing ? "stopping" : "running" }),
            );
          return;
        }
        if (!req.url?.startsWith(HOSTED_UPLOAD_PATH))
          return failure(404, "Upload address not found.");
        if (closing || pending.size >= 4)
          return failure(
            503,
            "The upload service is busy. Resume after another request finishes.",
          );
        const length = req.headers["content-length"];
        if (
          length !== undefined &&
          (typeof length !== "string" ||
            !/^(0|[1-9][0-9]*)$/.test(length) ||
            Number(length) > MAX_UPLOAD_CHUNK_BYTES)
        )
          return failure(
            413,
            "The upload chunk is too large. Resume using smaller chunks.",
          );
        if (
          req.method !== "PATCH" &&
          ((length && length !== "0") || req.headers["transfer-encoding"])
        )
          return failure(
            400,
            "Send file bytes through the resumable upload request.",
          );
        let body: ReadableStream<Uint8Array> | undefined;
        const controller = new AbortController();
        const aborted = () => controller.abort();
        req.once("aborted", aborted);
        if (req.method === "PATCH") {
          let received = 0;
          const bounded = new Transform({
            transform(chunk, _encoding, callback) {
              received += chunk.length;
              if (received > MAX_UPLOAD_CHUNK_BYTES) {
                overflow = true;
                return callback(new Error("Upload chunk size exceeded."));
              }
              callback(null, chunk);
            },
          });
          req.once("error", (error) => bounded.destroy(error));
          req.once("aborted", () =>
            bounded.destroy(new Error("Upload interrupted.")),
          );
          body = Readable.toWeb(
            req.pipe(bounded),
          ) as ReadableStream<Uint8Array>;
        }
        try {
          const request = new Request(
            `http://127.0.0.1:${listeningPort}${req.url}`,
            {
              method: req.method,
              headers: headerMap(req),
              signal: controller.signal,
              ...(body ? { body, duplex: "half" } : {}),
            } as RequestInit,
          );
          const response = await options.service.handle(request);
          if (overflow)
            return failure(
              413,
              "The upload chunk is too large. Resume using smaller chunks.",
            );
          if (res.destroyed) return;
          res.shouldKeepAlive = response.status < 400;
          res.writeHead(response.status, Object.fromEntries(response.headers));
          // Upload responses are small JSON/TUS metadata, never asset bytes.
          if (req.method === "HEAD") res.end();
          else res.end(Buffer.from(await response.arrayBuffer()));
        } finally {
          req.off("aborted", aborted);
        }
      } catch {
        if (!res.headersSent && !res.destroyed)
          failure(
            overflow ? 413 : 503,
            overflow
              ? "The upload chunk is too large. Resume using smaller chunks."
              : "The upload service could not finish this request. Resume the original import.",
          );
        else res.destroy();
      }
    })();
    pending.add(operation);
    void operation.finally(() => pending.delete(operation));
  });
  server.maxConnections = 64;
  server.maxHeadersCount = 32;
  server.headersTimeout = 10000;
  server.requestTimeout = 120000;
  server.keepAliveTimeout = 1000;
  server.on("clientError", (_error, socket) =>
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"),
  );
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 4336, "127.0.0.1", resolve);
  });
  const address = server.address();
  listeningPort = typeof address === "object" && address ? address.port : 4336;
  const scheduleMaintenance = () => {
    if (closing || !options.service.maintain) return;
    maintenanceTimer = setTimeout(() => {
      maintenance = (async () => {
        try {
          const result = await options.service.maintain(() => closing);
          if (result.deferred)
            process.stderr.write(
              "Upload cleanup has retained unfinished items for retry.\n",
            );
        } catch {
          process.stderr.write(
            "Upload cleanup could not check its queue. Existing reservations are retained.\n",
          );
        } finally {
          scheduleMaintenance();
        }
      })();
    }, maintenanceInterval);
    maintenanceTimer.unref();
  };
  scheduleMaintenance();
  let stopping: Promise<void> | undefined;
  return {
    server,
    origin: `http://127.0.0.1:${listeningPort}`,
    close: () =>
      (stopping ??= (async () => {
        closing = true;
        clearTimeout(maintenanceTimer);
        const stopped = new Promise<void>((resolve) =>
          server.close(() => resolve()),
        );
        server.closeAllConnections();
        await Promise.allSettled([
          ...pending,
          ...(maintenance ? [maintenance] : []),
        ]);
        await stopped;
      })()),
  };
}

export async function uploadHostService(env: NodeJS.ProcessEnv) {
  const number = (name: string, fallback: number) => {
    const value = env[name];
    if (value !== undefined && !/^(0|[1-9][0-9]*)$/.test(value))
      throw new Error("Invalid upload service configuration.");
    const result = value === undefined ? fallback : Number(value);
    if (!Number.isSafeInteger(result))
      throw new Error("Invalid upload service configuration.");
    return result;
  };
  const url = env.BUILDER_UPLOAD_SUPABASE_URL || "",
    key = env.BUILDER_UPLOAD_SERVICE_KEY || "";
  const access = new HostedRepositoryAccess({
    url,
    anonKey: env.BUILDER_UPLOAD_ANON_KEY || "",
  });
  const provider = uploadStorageProvider({ url, serviceKey: key });
  const client = createReleaseClient({ url, key });
  const port = number("BUILDER_UPLOAD_PORT", 4336);
  if (port < 1024 || port > 65535)
    throw new Error("Invalid upload service port.");
  const spool = await UploadSpool.create(env.BUILDER_UPLOAD_DIRECTORY || "", {
    bytes: number("BUILDER_UPLOAD_MAX_BYTES", 2 * 1024 ** 3),
    files: number("BUILDER_UPLOAD_MAX_FILES", 1024),
    freeBytes: number("BUILDER_UPLOAD_MIN_FREE_BYTES", 2 * 1024 ** 3),
  });
  const service = new HostedUploads({
    workerId: env.BUILDER_UPLOAD_WORKER_ID || "",
    spool,
    access,
    provider,
    rpc: client.rpc,
    origins: parseAllowedOrigins(
      env.ALLOWED_STUDIO_ORIGINS,
      DEFAULT_EDITOR_ORIGINS,
      "ALLOWED_STUDIO_ORIGINS",
    ),
  });
  return { service, port };
}
export async function runUploadHostCli() {
  try {
    if (process.argv.length !== 2) throw new Error("Invalid arguments.");
    const host = await startUploadHost(await uploadHostService(process.env));
    const stop = () => {
      void host
        .close()
        .then(() => {
          process.exitCode = 0;
        })
        .catch(() => {
          process.exitCode = 1;
        });
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    process.stdout.write("Kaizen upload service is listening on loopback.\n");
  } catch {
    process.stderr.write(
      "Kaizen upload service could not start. Check its private configuration and storage permissions.\n",
    );
    process.exitCode = 1;
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  void runUploadHostCli();
