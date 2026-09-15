import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const temporary = await mkdtemp(path.join(os.tmpdir(), "kaizen-studio-env-"));
const output = path.join(temporary, "dist");
const cli = process.env.npm_execpath;
assert.ok(cli && path.isAbsolute(cli), "Run pnpm test:studio:env.");
const privateValues = Object.fromEntries(
  [
    "SANITY_API_TOKEN",
    "SANITY_AUTH_TOKEN",
    "BUILDER_RELEASE_SERVICE_ROLE_KEY",
  ].map((key) => [key, `private-studio-canary-${randomUUID()}`]),
);
let logs = "";
try {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        cli,
        "--dir",
        "apps/studio",
        "exec",
        "vite",
        "build",
        "--outDir",
        output,
      ],
      {
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          CI: "1",
          NODE_ENV: "production",
          PUBLIC_SANITY_PROJECT_ID: "test1234",
          PUBLIC_SANITY_DATASET: "production",
          SANITY_STUDIO_DATASET: "production",
          ...privateValues,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (bytes) => {
        logs = (logs + bytes.toString()).slice(-20000);
      });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Studio build failed with exit ${code}. ${logs}`)),
    );
  });
  let files = 0,
    publicProject = false;
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await inspect(file);
      else if (entry.isFile()) {
        files++;
        const text = await readFile(file);
        for (const value of Object.values(privateValues))
          assert.equal(
            text.includes(Buffer.from(value)),
            false,
            `Server configuration leaked into ${path.relative(output, file)}.`,
          );
        publicProject ||= text.includes(Buffer.from("test1234"));
      } else throw new Error("Unexpected Studio output entry.");
    }
  }
  await inspect(output);
  assert.ok(
    publicProject,
    "The Studio build must retain its public project configuration.",
  );
  console.log(
    `Studio environment check passed across ${files} built files: public settings retained, server canaries excluded.`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
