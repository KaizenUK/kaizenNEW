import { test, expect } from "./browser-fixture";
import { siteFixture } from "./site-fixture";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
const exec = promisify(execFile);
test.use({ actionTimeout: 15000 });
test("M2: an independently built Astro React island hydrates inside the editable snapshot", async ({
  page,
}) => {
  test.setTimeout(180000);
  const fixture = await siteFixture(
      page,
      `---\nimport Island from '../components/Island';\nimport card from '../content/card.json';\n---\n<html><head><title>Native garden</title><link rel="icon" href="data:,"/></head><body><main><section><h1>A native garden</h1><Island client:load/></section><section data-kaizen-block={card.registrationId} data-kaizen-block-id={card.id} style={\`--d-padding:\${card.style.desktop.padding}px;--t-padding:\${card.style.desktop.padding}px;--m-padding:\${card.style.mobile.padding}px;--d-background:\${card.style.desktop.background}\`}><h2>{card.text}</h2></section></main><style>body{font:20px system-ui;padding:24px;color:#123d32}h1{color:rgb(20,70,40)}[data-kaizen-block]{padding:var(--d-padding);background:var(--d-background)}</style></body></html>`,
    ),
    { root } = fixture;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await mkdir(path.join(root, "src/components"));
    await mkdir(path.join(root, "src/content"));
    await writeFile(
      path.join(root, "src/content/card.json"),
      JSON.stringify({
        id: "native-panel",
        registrationId: "content-panel-v1",
        text: "Registered panel",
        style: {
          desktop: { padding: 24, background: "#ffffff" },
          mobile: { padding: 12 },
        },
      }),
    );
    await writeFile(
      path.join(root, "src/components/Island.tsx"),
      `import {useEffect,useState} from 'react';export default function Island(){const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return <section data-hydrated={ready?'true':'false'}><h2>Our native\n studio</h2><img src="/images/original.svg" alt="Native garden image"/><p>{ready?'Island hydrated':'Waiting for hydration'}</p></section>}`,
    );
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        type: "module",
        scripts: { build: "astro build" },
        dependencies: {
          astro: "7.3.2",
          "@astrojs/react": "6.0.5",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
        pnpm: { overrides: { sharp: "0.35.4" } },
      }),
    );
    await writeFile(
      path.join(root, "astro.config.mjs"),
      "import{defineConfig}from'astro/config';import react from'@astrojs/react';export default defineConfig({output:'static',integrations:[react()]});",
    );
    if (!process.env.npm_execpath)
      throw new Error(
        "Set npm_execpath to the installed pnpm CLI for this isolated fixture.",
      );
    await exec(
      process.execPath,
      [
        process.env.npm_execpath,
        "install",
        "--ignore-scripts",
        "--prefer-offline",
      ],
      { cwd: root, timeout: 120000, maxBuffer: 2 * 1024 * 1024 },
    );
    await fixture.open();
    const frame = page.frameLocator('iframe[title="Website canvas"]');
    await expect(frame.locator("[data-hydrated]")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await expect(
      frame.getByRole("heading", { name: "A native garden" }),
    ).toHaveCSS("color", "rgb(20, 70, 40)");
    expect(
      await frame
        .getByRole("img")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    ).toBe(true);
    // An unchanged section order must not disconnect hydrated islands on every draft update.
    await frame.locator("main").evaluate((main) => {
      main.setAttribute("data-section-moves", "0");
      new MutationObserver((records) => {
        const removed = records
          .flatMap((record) => [...record.removedNodes])
          .filter(
            (node) => node instanceof Element && node.tagName === "SECTION",
          );
        main.setAttribute(
          "data-section-moves",
          String(
            Number(main.getAttribute("data-section-moves")) + removed.length,
          ),
        );
      }).observe(main, { childList: true });
    });
    const title = frame.getByRole("heading", { name: "Our native studio" });
    await title.dblclick();
    await title.fill("Our edited React studio");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Edits saved on this computer",
    );
    await frame.getByRole("heading", { name: "Registered panel" }).click();
    await expect(
      page.getByRole("heading", { name: "Content panel", exact: true }),
    ).toBeVisible();
    await page.getByRole("spinbutton", { name: /desktop padding/ }).fill("48");
    await expect(frame.locator("[data-kaizen-block]")).toHaveCSS(
      "padding-top",
      "48px",
    );
    await expect(frame.locator("main")).toHaveAttribute(
      "data-section-moves",
      "0",
    );
    const previousFrame = await page
      .locator('iframe[title="Website canvas"]')
      .getAttribute("src");
    await page
      .getByRole("button", { name: "Review my changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "src/components/Island.tsx",
    );
    await page
      .getByRole("button", { name: "Apply changes to the folder", exact: true })
      .click();
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "No changes yet",
    );
    await expect(
      page.locator('iframe[title="Website canvas"]'),
    ).not.toHaveAttribute("src", previousFrame!);
    await expect(
      frame.getByRole("heading", { name: "Our edited React studio" }),
    ).toBeVisible();
    await expect(frame.locator("[data-kaizen-block]")).toHaveCSS(
      "padding-top",
      "48px",
    );
    expect(errors).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
