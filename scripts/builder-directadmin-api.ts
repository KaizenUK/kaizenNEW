/** Root-owned local DirectAdmin transport. Temporary login keys stay in memory. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, lstat } from "node:fs/promises";
import { X509Certificate, createHash } from "node:crypto";
import { Agent, request } from "node:https";
import { connect, type TLSSocket } from "node:tls";

export class DirectAdminError extends Error {
  constructor(public status?: number) {
    super("The local domain hosting request could not be confirmed.");
    this.name = "DirectAdminError";
  }
}
type Dependencies = {
  apiUrl: () => Promise<string>;
  certificate: () => Promise<Buffer>;
  /** Operator inspection only; never enabled by the domain lifecycle worker. */
  operatorRead?: boolean;
  creationReady?: () => Promise<void>;
  /** Isolated HTTPS fixture only. The root factory fixes the real port. */
  port?: number;
  timeout?: number;
};
const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

export function directAdminApi(username: string, dependencies: Dependencies) {
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(username)) throw new DirectAdminError();
  const port = dependencies.port ?? 2222,
    timeout = dependencies.timeout ?? 30000;
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isInteger(timeout) ||
    timeout < 1 ||
    timeout > 60000
  )
    throw new DirectAdminError();
  return async (
    method: "GET" | "POST" | "PUT",
    pathname: string,
    body?: unknown,
    form = false,
  ): Promise<any> => {
    // Requests can only reach the daemon on this host. Explicit known API paths
    // prevent a caller sending the temporary key through a proxy/plugin route.
    if (
      !/^\/(?:CMD_API_(?:DOMAIN|SHOW_DOMAINS)(?:\?json=yes)?|api\/domain-tls\/[a-z0-9.-]+\/(?:acme-config|certs|provision-certs|provision-certs-dry-run))$/.test(
        pathname,
      ) &&
      !(
        dependencies.operatorRead &&
        method === "GET" &&
        pathname === "/api/license"
      )
    )
      throw new DirectAdminError();
    let agent: Agent | undefined;
    try {
      if (
        method === "POST" &&
        pathname.startsWith("/CMD_API_DOMAIN") &&
        (body as any)?.action === "create"
      )
        await dependencies.creationReady?.();
      const pinned = sha256(
        new X509Certificate(await dependencies.certificate()).raw,
      );
      const login = new URL((await dependencies.apiUrl()).trim());
      if (
        login.protocol !== "https:" ||
        login.pathname !== "/" ||
        login.search ||
        login.hash ||
        Number(login.port || 443) !== port ||
        decodeURIComponent(login.username) !== username ||
        !login.password ||
        login.href.length > 8192
      )
        throw new DirectAdminError();
      const authorization =
        "Basic " +
        Buffer.from(
          `${username}:${decodeURIComponent(login.password)}`,
        ).toString("base64");
      const payload =
        body === undefined
          ? undefined
          : form
            ? new URLSearchParams(body as Record<string, string>).toString()
            : JSON.stringify(body);
      if (payload && Buffer.byteLength(payload) > 65536)
        throw new DirectAdminError();
      agent = new Agent({ keepAlive: false, maxSockets: 1 });
      agent.createConnection = (_options: any, callback: any): any => {
        // The daemon may use its own certificate. Pin the root-configured local
        // leaf before releasing the socket to HTTP, so no login key is sent to
        // an unverified listener. Public website TLS uses system trust instead.
        let finished = false;
        const socket = connect({
          host: "127.0.0.1",
          port,
          servername: login.hostname,
          rejectUnauthorized: false,
        });
        const done = (error?: Error) => {
          if (finished) return;
          finished = true;
          socket.setTimeout(0);
          if (error) socket.destroy();
          callback(error || null, error ? undefined : socket);
        };
        socket.setTimeout(timeout, () => done(new DirectAdminError()));
        socket.once("error", () => done(new DirectAdminError()));
        socket.once("secureConnect", () => {
          const observed = socket.getPeerX509Certificate();
          if (!observed || sha256(observed.raw) !== pinned)
            done(new DirectAdminError());
          else done();
        });
        return undefined;
      };
      return await new Promise((resolve, reject) => {
        const req = request(
          {
            hostname: "127.0.0.1",
            port,
            path: pathname,
            method,
            agent,
            signal: AbortSignal.timeout(timeout),
            headers: {
              Authorization: authorization,
              Host: `${login.hostname}:${port}`,
              Accept: "application/json",
              Connection: "close",
              ...(payload !== undefined
                ? {
                    "Content-Type": form
                      ? "application/x-www-form-urlencoded"
                      : "application/json",
                    "Content-Length": String(Buffer.byteLength(payload)),
                  }
                : {}),
            },
          },
          async (response) => {
            try {
              if ((response.socket as TLSSocket).remoteAddress !== "127.0.0.1")
                throw new DirectAdminError();
              const status = response.statusCode || 500;
              if (status < 200 || status >= 300)
                throw new DirectAdminError(status);
              const chunks: Buffer[] = [];
              let size = 0;
              for await (const chunk of response) {
                size += chunk.length;
                if (size > 1048576) throw new DirectAdminError();
                chunks.push(Buffer.from(chunk));
              }
              if (status === 204) {
                resolve(undefined);
                return;
              }
              const text = Buffer.concat(chunks).toString("utf8");
              let data: any;
              if (
                /^application\/json(?:;|$)/i.test(
                  response.headers["content-type"] || "",
                )
              )
                data = JSON.parse(text);
              else if (
                pathname.startsWith("/CMD_API_") &&
                /^(?:error|list\[\])=/.test(text)
              )
                data = Object.fromEntries(new URLSearchParams(text));
              else throw new DirectAdminError();
              if (
                !data ||
                typeof data !== "object" ||
                ("error" in data && ![false, 0, "0"].includes(data.error))
              )
                throw new DirectAdminError(status);
              resolve(data);
            } catch (error) {
              response.destroy();
              reject(
                error instanceof DirectAdminError
                  ? error
                  : new DirectAdminError(),
              );
            }
          },
        );
        req.once("error", () => reject(new DirectAdminError()));
        req.end(payload);
      });
    } catch (error) {
      // No URL, provider output, raw child-process error or credential in errors.
      throw error instanceof DirectAdminError ? error : new DirectAdminError();
    } finally {
      agent?.destroy();
    }
  };
}

/** Root entry point; neither paths nor credentials come from a project request. */
export function localDirectAdminApi(
  username: string,
  installation: { operatorRead?: boolean } = {},
) {
  const binary = "/usr/local/directadmin/directadmin",
    run = promisify(execFile);
  const command = async (args: string[]) => {
    if (process.getuid?.() !== 0) throw new DirectAdminError();
    const { stdout } = await run(binary, args, {
      timeout: 10000,
      maxBuffer: 16384,
    });
    return stdout.trim();
  };
  return directAdminApi(username, {
    operatorRead: installation.operatorRead === true,
    creationReady: async () => {
      // DirectAdmin's broad auto-creation would race the exact-name ACME plan.
      for (const key of [
        "admin_ssl_cert_on_create",
        "admin_ssl_install_to_missing",
        "admin_ssl_replace_all_expired_invalid",
      ])
        if ((await command(["config-get", key])) !== "0")
          throw new DirectAdminError();
    },
    apiUrl: () => command(["api-url", `--user=${username}`]),
    certificate: async () => {
      if (process.getuid?.() !== 0) throw new DirectAdminError();
      const file = "/usr/local/directadmin/conf/cacert.pem";
      const stat = await lstat(file);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.uid !== 0 ||
        stat.mode & 0o022 ||
        stat.size > 65536
      )
        throw new DirectAdminError();
      return readFile(file);
    },
  });
}
