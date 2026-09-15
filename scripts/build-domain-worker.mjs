/** Build a self-contained root runtime; imported release libraries keep their CLI inactive. */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2];
if (
  !output ||
  !path.isAbsolute(output) ||
  process.argv.length !== 3 ||
  path.basename(output) !== "worker.mjs"
)
  throw new Error("Choose an absolute worker.mjs output path.");
await build({
  stdin: {
    contents:
      'import { runDomainHostCli } from "./scripts/builder-domain-host.ts"; runDomainHostCli();',
    resolveDir: root,
    loader: "ts",
  },
  outfile: output,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // The bundle has one explicit entry above. Library CLI guards compare their
  // module URL with argv[1]; bundling must not turn all of them into entry points.
  define: {
    "import.meta.url": JSON.stringify("file:///__kaizen_bundled_library__.mjs"),
  },
  banner: {
    js: 'import { createRequire as kaizenCreateRequire } from "node:module"; const require = kaizenCreateRequire(new URL("file:///opt/kaizen-domain-worker/worker.mjs"));',
  },
  logLevel: "warning",
});
