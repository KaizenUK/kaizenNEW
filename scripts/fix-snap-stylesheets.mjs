import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = "dist/spa";

function listHtmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listHtmlFiles(fullPath));
      continue;
    }
    if (extname(fullPath) === ".html") {
      files.push(fullPath);
    }
  }
  return files;
}

function rewriteBlockingStylesheetTag(html) {
  return html.replace(
    /<link\b(?=[^>]*onload="this\.onload=null;this\.rel='stylesheet'")(?=[^>]*as="style")([^>]*?)>/g,
    (tag) => tag.replace(/rel="stylesheet"/, 'rel="preload"'),
  );
}

function main() {
  const htmlFiles = listHtmlFiles(ROOT);
  let updatedCount = 0;

  for (const filePath of htmlFiles) {
    const before = readFileSync(filePath, "utf8");
    const after = rewriteBlockingStylesheetTag(before);
    if (after !== before) {
      writeFileSync(filePath, after, "utf8");
      updatedCount += 1;
    }
  }

  console.log(`Fixed stylesheet preload tags in ${updatedCount} HTML files.`);
}

main();
