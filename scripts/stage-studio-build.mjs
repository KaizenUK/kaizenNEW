import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const siteDistDir = path.join(rootDir, "dist");
const studioDistDir = path.join(rootDir, "apps", "studio", "dist");
const stagedStudioDir = path.join(siteDistDir, "studio");

async function ensureDirExists(dirPath, label) {
  try {
    const details = await stat(dirPath);
    if (!details.isDirectory()) {
      throw new Error(`${label} exists but is not a directory: ${dirPath}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is missing: ${dirPath}\n${message}`);
  }
}

await ensureDirExists(siteDistDir, "Public site build output");
await ensureDirExists(studioDistDir, "Studio build output");

await rm(stagedStudioDir, { recursive: true, force: true });
await mkdir(stagedStudioDir, { recursive: true });
await cp(studioDistDir, stagedStudioDir, { recursive: true });

console.log(`Staged Studio build into ${path.relative(rootDir, stagedStudioDir)}`);
