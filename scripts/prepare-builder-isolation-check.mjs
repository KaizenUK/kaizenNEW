/** Package the temporary Linux fixture; this is never a deployable website. */
import { execFileSync } from "node:child_process";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination))
  throw new Error("Provide an absolute temporary output directory.");
await mkdir(destination, { recursive: true, mode: 0o755 });
const banner =
  'import {createRequire as fixtureRequire} from "node:module"; import {fileURLToPath as fixtureFileURL} from "node:url"; import {dirname as fixtureDirname} from "node:path"; const require=fixtureRequire(import.meta.url); const __filename=fixtureFileURL(import.meta.url),__dirname=fixtureDirname(__filename);';
execFileSync(
  "pnpm",
  [
    "exec",
    "esbuild",
    "tests/builder/verify-build-isolation.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--banner:js=${banner}`,
    `--outfile=${path.join(destination, "verify.mjs")}`,
  ],
  { stdio: "inherit" },
);
await copyFile(
  "scripts/builder-build-payload.py",
  path.join(destination, "builder-build-payload.py"),
);
