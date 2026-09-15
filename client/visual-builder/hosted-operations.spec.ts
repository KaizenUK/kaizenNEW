import { afterEach, describe, expect, it } from "vitest";
import { lstat, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { request, createServer } from "node:http";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { hostedHelperFixture } from "../../tests/builder/hosted-helper-fixture";

const fixtures: Awaited<ReturnType<typeof hostedHelperFixture>>[] = [];
async function fixture() {
  const value = await hostedHelperFixture();
  fixtures.push(value);
  return value;
}
afterEach(async () => {
  for (const value of fixtures.splice(0).reverse()) await value.close();
});

// Fetch may replace Host, so send the exact negative-probe headers over HTTP.
function probe(url: string, headers: Record<string, string>) {
  return new Promise<Response>((resolve, reject) => {
    const outgoing = request(url, { headers }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (bytes) => chunks.push(bytes));
      incoming.once("error", reject);
      incoming.once("end", () =>
        resolve(
          new Response(Buffer.concat(chunks), {
            status: incoming.statusCode,
            headers: Object.entries(incoming.headers).map(
              ([name, value]): [string, string] => [
                name,
                Array.isArray(value) ? value.join(",") : value || "",
              ],
            ),
          }),
        ),
      );
    });
    outgoing.setTimeout(5000, () =>
      outgoing.destroy(new Error("Health probe timed out.")),
    );
    outgoing.once("error", reject);
    outgoing.end();
  });
}

describe("hosted helper operations", () => {
  it("starts and shuts down through the permanent service's versioned runtime link", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "kaizen-helper-entry-"),
    );
    const reserve = createServer();
    await new Promise<void>((resolve) =>
      reserve.listen(0, "127.0.0.1", resolve),
    );
    const port = (reserve.address() as { port: number }).port;
    await new Promise<void>((resolve) => reserve.close(() => resolve()));
    const runtime = path.join(directory, "runtime");
    await symlink(process.cwd(), runtime, "dir");
    const configuration = path.join(directory, "projects.json");
    await writeFile(
      configuration,
      JSON.stringify({ version: 1, projects: [] }),
      { mode: 0o600 },
    );
    const child = spawn(
      process.execPath,
      [
        path.resolve("node_modules/tsx/dist/cli.mjs"),
        path.join(runtime, "scripts/builder-hosted-helper.ts"),
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          PATH: process.env.PATH,
          BUILDER_HOSTED_PROJECTS_FILE: configuration,
          BUILDER_HOSTED_WORK_DIRECTORY: path.join(directory, "work"),
          BUILDER_HOSTED_CREDENTIALS_DIRECTORY: path.join(
            directory,
            "credentials",
          ),
          BUILDER_HOSTED_SUPABASE_URL: "https://fixture.supabase.invalid",
          BUILDER_HOSTED_SUPABASE_ANON_KEY: "fixture-public-anon-key",
          BUILDER_HOSTED_BILLING_KEY: "ab".repeat(32),
          BUILDER_HOSTED_PORT: String(port),
          BUILDER_HOSTED_EDITOR_ORIGIN: "https://builder.example",
          ALLOWED_STUDIO_ORIGINS: "https://builder.example",
        },
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const stopped = new Promise<number | null>((resolve) =>
      child.once("exit", resolve),
    );
    try {
      await expect
        .poll(
          async () => {
            if (child.exitCode !== null)
              throw new Error(`Helper exited: ${output}`);
            return fetch(`http://127.0.0.1:${port}/health`)
              .then((response) => response.status)
              .catch(() => 0);
          },
          { timeout: 10000 },
        )
        .toBe(200);
      expect(
        await lstat(path.join(directory, "work")).catch(() => null),
      ).toBeNull();
      child.kill("SIGTERM");
      const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
      try {
        expect(await stopped).toBe(0);
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      await stopped;
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports process liveness over loopback without an account, secrets or project disk access", async () => {
    const api = await fixture();
    const response = await fetch(`${api.helper.origin}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      service: "kaizen-hosted-helper",
      status: "running",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    const head = await fetch(`${api.helper.origin}/health`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(api.calls).toHaveLength(0);
    expect(await lstat(api.folders.directory).catch(() => null)).toBeNull();
  });

  it("refuses browser and forwarded health probes without advertising cross-origin access", async () => {
    const api = await fixture();
    for (const headers of [
      { Host: "untrusted.example" },
      { Origin: "https://builder.example" },
      { Forwarded: "for=127.0.0.1" },
      { "X-Forwarded-For": "127.0.0.1" },
      { "X-Forwarded-Host": "127.0.0.1" },
      { "Sec-Fetch-Site": "cross-site" },
    ]) {
      const response = await probe(`${api.helper.origin}/health`, headers);
      expect(response.status, JSON.stringify(headers)).toBe(404);
      expect(await response.json()).toEqual({
        error: "Hosted helper route not found.",
      });
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
    const post = await fetch(`${api.helper.origin}/health`, { method: "POST" });
    expect(post.status).toBe(404);
    await post.body?.cancel();
    const query = await fetch(`${api.helper.origin}/health?project=private`);
    expect(query.status).toBe(404);
    await query.body?.cancel();
    expect(api.calls).toHaveLength(0);
  });

  it("reports stopping as unhealthy and safely shares repeated shutdown requests", async () => {
    const api = await fixture();
    const stopping = api.service.close();
    expect(api.service.close()).toBe(stopping);
    await stopping;
    const response = await fetch(`${api.helper.origin}/health`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      service: "kaizen-hosted-helper",
      status: "stopping",
    });
    const closed = api.helper.close();
    expect(api.helper.close()).toBe(closed);
    await closed;
  });
});
