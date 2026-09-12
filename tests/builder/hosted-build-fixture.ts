import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { hostedHelperFixture } from "./hosted-helper-fixture";

/** Controls and observations live outside the source fingerprint, in this fixture's private build home. */
export const hostedBuildScript = `
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const home = path.resolve('../build-home');
const control = () => JSON.parse(readFileSync(path.join(home, 'fixture-control.json'), 'utf8'));
const countFile = path.join(home, 'fixture-count');
let count = 0; try { count = Number(readFileSync(countFile, 'utf8')); } catch {}
writeFileSync(countFile, String(++count));
writeFileSync(path.join(home, 'fixture-environment.json'), JSON.stringify(process.env));
mkdirSync('dist', {recursive:true});
writeFileSync('dist/index.html', 'Partial fixture output');
console.log('x'.repeat(110000)); console.log('Fixture build started ' + count);
while (control().mode === 'hold') await new Promise(resolve => setTimeout(resolve, 50));
if (control().mode === 'fail') { console.error('Deliberate fixture build failure'); process.exit(19); }
writeFileSync('dist/index.html', '<!doctype html><html><body><main><h1>Hosted original</h1></main></body></html>');
console.log('Fixture build completed ' + count);
`;
type Fixture = Awaited<ReturnType<typeof hostedHelperFixture>>;
export const buildHome = (api: Fixture, id: string) =>
  path.join(path.dirname(api.folders.root(id)), "build-home");
export const buildMode = (
  api: Fixture,
  id: string,
  mode: "hold" | "fail" | "success",
) =>
  writeFile(
    path.join(buildHome(api, id), "fixture-control.json"),
    JSON.stringify({ mode }),
  );
export const buildCount = async (api: Fixture, id: string) =>
  Number(
    await readFile(
      path.join(buildHome(api, id), "fixture-count"),
      "utf8",
    ).catch(() => "0"),
  );
