import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
export async function siteFixture(page: Page, source: string) {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-site-browser-"));
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  await mkdir(path.join(root, "public/images"), { recursive: true });
  await writeFile(path.join(root, "src/pages/index.astro"), source);
  await writeFile(
    path.join(root, "public/images/original.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="green"/></svg>',
  );
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      type: "module",
      dependencies: { astro: "7.3.2", "@astrojs/react": "6.0.5" },
      scripts: { build: "node build.mjs" },
    }),
  );
  await writeFile(
    path.join(root, "build.mjs"),
    "import{mkdir,readFile,writeFile,cp}from'node:fs/promises';await mkdir('dist');await cp('public','dist',{recursive:true});await writeFile('dist/index.html',(await readFile('src/pages/index.astro','utf8')).replace('{cms.quote}','CMS supplied quote'));",
  );
  const response = await page.request.post("/__builder-projects", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "create", name: "Website fixture" },
  });
  if (!response.ok()) throw new Error(await response.text());
  const project = await response.json();
  await page.goto(`/builder/?project=${project.id}`);
  await page.evaluate(
    ({ id, root }) =>
      localStorage.setItem(`kaizen-native-repository:${id}`, root),
    { id: project.id, root },
  );
  return {
    root,
    project,
    async open() {
      await page.reload();
      await page
        .getByRole("button", { name: "Edit existing /", exact: true })
        .click();
      await page.getByRole("button", { name: "Build", exact: true }).click();
    },
  };
}
