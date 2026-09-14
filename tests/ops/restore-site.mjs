// Synthetic release store and a real Nginx recovery host. Never a deployment.
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { builderNginxRules, builderRedirectChecks } from "../../shared/builderRedirects.js";
import { stageRelease, initialiseStore, verifyRelease, checkLive, activateRelease, nginxConfig } from "../../scripts/kaizen-releases.mjs";

const [action, store, originalStore] = process.argv.slice(2);
assert.ok(path.isAbsolute(store));
const run = promisify(execFile);
const rules = [{ id: "11111111-1111-4111-8111-111111111111", source: "/old-url/", destination: "/campaign/", status: 301 }];

if (action === "create") {
  for (const id of ["original", "next"]) {
    const source = path.join(path.dirname(store), `build-${id}`);
    for (const dir of ["builder", "campaign", "_astro"]) await mkdir(path.join(source, dir), { recursive: true });
    await writeFile(path.join(source, "index.html"), `<!doctype html><title>${id}</title><h1>Published ${id}</h1>`);
    await writeFile(path.join(source, "campaign/index.html"), `<!doctype html><h1>Campaign ${id}</h1>`);
    await writeFile(path.join(source, "builder/index.html"), `<!doctype html><meta name="robots" content="noindex"><h1>Builder ${id}</h1>`);
    await writeFile(path.join(source, `_astro/${id}.hash.js`), `console.log("Synthetic ${id}")`);
    await writeFile(path.join(source, "redirects.generated.conf"), builderNginxRules(rules).join("\n"));
    await writeFile(path.join(source, "redirects.generated.json"), JSON.stringify({ schemaVersion: 1, checks: builderRedirectChecks(rules) }));
    await stageRelease({ store, source, id });
  }
  await initialiseStore({ store, id: "original" });
  console.log(JSON.stringify({ store, selected: "original" }));
} else if (action === "verify") {
  // The source store must be unavailable before any response counts as recovery.
  await assert.rejects(access(originalStore));
  const selected = await readFile(path.join(store, "active.conf"), "utf8");
  assert.equal(selected, nginxConfig(originalStore, "original"));
  const original = await verifyRelease(store, "original");
  await verifyRelease(store, "next");
  const prefix = path.join(path.dirname(store), "recovery-nginx");
  await mkdir(path.join(prefix, "logs"), { recursive: true });
  await mkdir(path.join(prefix, "temp"), { recursive: true });
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const binary = process.env.KAIZEN_NGINX_BINARY || "nginx";
  const nginx = args => run(binary, ["-p", `${prefix}/`, "-c", "nginx.conf", ...args], { cwd: prefix, timeout: 15000 });
  await writeFile(path.join(prefix, "nginx.conf"), `daemon off; master_process on; worker_processes 1; pid logs/nginx.pid; error_log logs/error.log; events {worker_connections 128;} http {types {text/html html; application/javascript js; application/json json;} access_log off; client_body_temp_path temp/body; proxy_temp_path temp/proxy; fastcgi_temp_path temp/fastcgi; uwsgi_temp_path temp/uwsgi; scgi_temp_path temp/scgi; server {listen 127.0.0.1:${port}; server_name localhost; index index.html; include "${path.join(store, "active.conf")}"; location / {try_files $uri $uri/ =404;} } }`);
  // Its original absolute paths cannot be used on the new recovery host.
  await assert.rejects(nginx(["-t"]));
  await writeFile(path.join(store, "active.conf"), nginxConfig(store, "original"));
  await nginx(["-t"]);
  const child = spawn(binary, ["-p", `${prefix}/`, "-c", "nginx.conf"], { cwd: prefix, stdio: "ignore" });
  const stopped = new Promise(resolve => child.once("exit", resolve));
  let running = true;
  child.once("exit", () => { running = false; });
  try {
    let observed;
    for (let attempt = 0; ; attempt++) {
      try { observed = await checkLive(origin, original); break; }
      catch (error) { if (attempt === 30 || !running) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    const adapters = { validateConfig: () => nginx(["-t"]), reload: () => nginx(["-s", "reload"]) };
    const fetchPage = (route, options = {}) => fetch(origin + route, { ...options, headers: { Connection: "close" } });
    assert.match(await (await fetchPage("/campaign/")).text(), /Campaign original/);
    for (const route of ["/.git/config", "/operator-settings", "/working-copy"]) assert.equal((await fetchPage(route)).status, 404);
    const next = await activateRelease({ store, id: "next", origin }, adapters);
    assert.equal(next.status, "live");
    await checkLive(origin, await verifyRelease(store, "next"));
    const redirect = await fetchPage("/old-url/?fixture=retained", { redirect: "manual" });
    assert.equal(redirect.status, 301);
    assert.ok(redirect.headers.get("location").endsWith("/campaign/?fixture=retained"));
    assert.equal((await fetchPage("/_astro/original.hash.js")).status, 200);
    const rollback = await activateRelease({ store, id: "original", origin }, adapters);
    assert.equal(rollback.status, "live");
    await checkLive(origin, original);
    assert.equal((await fetchPage("/_astro/next.hash.js")).status, 200);
    console.log(JSON.stringify({ restored: true, sourceUnavailable: true, checked: observed.checked,
      activation: next.status, rollback: rollback.status, privatePathsDenied: true }));
  } finally {
    if (running) {
      await nginx(["-s", "quit"]).catch(() => child.kill("SIGTERM"));
      await stopped;
    }
  }
} else {
  throw new Error("Use create or verify with an isolated absolute store path.");
}
