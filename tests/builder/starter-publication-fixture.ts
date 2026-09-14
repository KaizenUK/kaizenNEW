import { expect } from "./browser-fixture";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  bindClientStore,
  stageRelease,
  initialiseStore,
  checkLive,
} from "../../scripts/kaizen-releases.mjs";

/** Isolated real staging destination; never points at a hosted/client destination. */
export async function starterStaging(
  projectId: string,
  use: (destination: {
    origin: string;
    destinationId: string;
  }) => Promise<void>,
) {
  const run = promisify(execFile),
    binary = process.env.KAIZEN_NGINX_BINARY || "nginx";
  await run(binary, ["-v"]);
  const prefix = path.resolve("test-results/builder-client-nginx");
  await mkdir(path.join(prefix, "logs"), { recursive: true });
  await mkdir(path.join(prefix, "temp"), { recursive: true });
  try {
    const pid = Number(
      await readFile(path.join(prefix, "logs/nginx.pid"), "utf8"),
    );
    process.kill(pid, 0);
    throw new Error(
      `An existing test Nginx process ${pid} still owns this prefix.`,
    );
  } catch (error) {
    if (!["ENOENT", "ESRCH"].includes(error.code)) throw error;
  }
  const root = await mkdtemp(path.join(prefix, "starter-")),
    source = path.join(root, "baseline"),
    store = path.join(root, "store");
  await mkdir(source);
  await writeFile(
    path.join(source, "index.html"),
    "<!doctype html><h1>Initial staging destination</h1>",
  );
  const reservation = createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`,
    destinationId = randomUUID();
  const client = { projectId, destinationId, environment: "staging", origin };
  await bindClientStore({ store, client });
  const baseline = await stageRelease({ store, client, source, id: "initial" });
  await initialiseStore({ store, id: baseline.id });
  const forward = (value: string) => value.replace(/\\/g, "/");
  await writeFile(
    path.join(prefix, "nginx.conf"),
    `daemon off; master_process on; worker_processes 1; worker_shutdown_timeout 5s; pid logs/nginx.pid; error_log logs/error.log notice; events {worker_connections 128;} http {types {text/html html; text/css css; application/javascript js; image/svg+xml svg; application/json json;} access_log off; keepalive_timeout 1s; client_body_temp_path temp/client_body; proxy_temp_path temp/proxy; fastcgi_temp_path temp/fastcgi; uwsgi_temp_path temp/uwsgi; scgi_temp_path temp/scgi; server {listen 127.0.0.1:${port};server_name localhost;include "${forward(path.join(store, "active.conf"))}";index index.html;location / {try_files $uri $uri/ =404;}}}`,
  );
  const registry = path.resolve(
    "test-results/builder-client-destinations.json",
  );
  await writeFile(
    registry,
    JSON.stringify({
      schemaVersion: 1,
      destinations: [{ ...client, label: "Starter staging fixture", store }],
    }),
  );
  const args = ["-p", `${forward(prefix)}/`, "-c", "nginx.conf"];
  await run(binary, [...args, "-t"]);
  const child = spawn(binary, args, { cwd: prefix, stdio: "ignore" });
  let exited = false;
  child.on("exit", () => {
    exited = true;
  });
  try {
    await expect
      .poll(async () => {
        try {
          await checkLive(origin, baseline);
          return true;
        } catch {
          return false;
        }
      })
      .toBe(true);
    await use({ origin, destinationId });
  } finally {
    await run(binary, [...args, "-s", "quit"]);
    await expect.poll(() => exited).toBe(true);
    await writeFile(
      registry,
      JSON.stringify({ schemaVersion: 1, destinations: [] }),
    );
  }
}
