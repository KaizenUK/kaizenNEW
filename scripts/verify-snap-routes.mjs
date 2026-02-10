import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");

function routeToHtmlPath(route, sourceDir) {
  if (route === "/") {
    return path.join(ROOT, sourceDir, "index.html");
  }

  return path.join(ROOT, sourceDir, route.replace(/^\/+/, ""), "index.html");
}

function main() {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
  const sourceDir = pkg?.reactSnap?.source ?? "dist";
  const routes = pkg?.reactSnap?.include ?? [];

  if (!Array.isArray(routes) || routes.length === 0) {
    console.warn("verify-snap-routes: no reactSnap include routes found.");
    return;
  }

  const missing = [];

  for (const route of routes) {
    const htmlPath = routeToHtmlPath(route, sourceDir);
    if (!existsSync(htmlPath)) {
      missing.push({ route, htmlPath });
    }
  }

  if (missing.length > 0) {
    console.error(
      `verify-snap-routes: missing prerendered HTML for ${missing.length} route(s):`,
    );
    for (const entry of missing) {
      console.error(`- ${entry.route} -> ${entry.htmlPath}`);
    }
    process.exit(1);
  }

  console.log(
    `verify-snap-routes: all ${routes.length} reactSnap route(s) exist in ${sourceDir}.`,
  );
}

main();
