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
      'import {runNativeReleaseCli} from "./scripts/builder-native-release.ts"; runNativeReleaseCli().catch(error => { console.error(error.message); process.exitCode=1; });',
    resolveDir: root,
    loader: "ts",
  },
  outfile: output,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  define: {
    "import.meta.url": JSON.stringify("file:///__kaizen_bundled_library__.mjs"),
  },
  banner: {
    js: 'import {createRequire as nativeRequire} from "node:module"; import {fileURLToPath as nativeFileURL} from "node:url"; import {dirname as nativeDirname} from "node:path"; const require=nativeRequire(import.meta.url); const __filename=nativeFileURL(import.meta.url),__dirname=nativeDirname(__filename);',
  },
  logLevel: "warning",
});
