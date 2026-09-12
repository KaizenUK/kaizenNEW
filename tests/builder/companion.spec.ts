import { test, expect, type Page } from "./browser-fixture";
import {
  BUILDER_TEST_ORIGIN,
  COMPANION_TEST_ORIGIN,
  COMPANION_TEST_PORT,
} from "./ports";
import { createServer, type ViteDevServer } from "vite";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

let hosted: ViteDevServer;
test.beforeAll(async () => {
  hosted = await createServer({
    configFile: false,
    root: process.cwd(),
    envDir: false,
    cacheDir: path.resolve("test-results/companion-hosted-vite"),
    server: {
      host: "127.0.0.1",
      port: COMPANION_TEST_PORT,
      strictPort: true,
    },
    resolve: {
      alias: { "@": path.resolve("client"), "@shared": path.resolve("shared") },
    },
    define: {
      "import.meta.env.VITE_BUILDER_CLOUD": '"1"',
      "import.meta.env.VITE_SUPABASE_URL": '"https://companion-cloud.invalid"',
      "import.meta.env.VITE_SUPABASE_ANON_KEY": '"test-public-anon-key"',
    },
    plugins: [
      {
        name: "companion-browser-fixture",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith("/companion-test?")) {
              res.setHeader("Content-Type", "text/html");
              res.end(
                '<!doctype html><html><head><meta name="viewport" content="width=device-width"/><link rel="icon" href="data:,"/></head><body><div id="app"></div><script type="module" src="/@companion-test.jsx"></script></body></html>',
              );
              return;
            }
            next();
          });
        },
        resolveId(id) {
          if (id === "/@companion-test.jsx") return "\0companion-test.jsx";
        },
        load(id) {
          if (id === "\0companion-test.jsx")
            return `import React from 'react';import {createRoot} from 'react-dom/client';import HostedRepository from '/client/visual-builder/HostedRepository.tsx';import {companionConnection} from '/client/visual-builder/companionConnection.ts';import {storage} from '/client/visual-builder/storage.ts';import '/client/visual-builder/builder.css';window.testRepository=(input)=>storage.repository(input);window.testConnection=companionConnection;createRoot(document.getElementById('app')).render(React.createElement('div',{className:'builder-app','data-theme':'light'},React.createElement(HostedRepository)));`;
        },
      },
    ],
  });
  await hosted.listen();
});
test.afterAll(async () => {
  await hosted?.close();
});

test("hosted repository UI edits real local source across origins with consent, draft recovery and revoked access", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  // Only cloud identity/catalogue are fixtures. Popup, postMessage, local HTTP,
  // inspections, private drafts, review/apply and filesystem writes are real.
  await context.route("https://companion-cloud.invalid/**", async (route) => {
    if (route.request().url().includes("/functions/v1/builder-projects"))
      await route.fulfill({
        json: [
          { id: "fixture-client", name: "Companion client", archived: false },
        ],
      });
    else
      await route.fulfill({
        status: 400,
        json: { error: "Unexpected cloud request in companion test" },
      });
  });
  await context.addInitScript((hostedOrigin: string) => {
    if (location.origin !== hostedOrigin) return;
    localStorage.setItem(
      "sb-companion-cloud-auth-token",
      JSON.stringify({
        access_token: "fixture-access-token",
        refresh_token: "fixture-refresh-token",
        token_type: "bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        user: {
          id: "fixture-account",
          aud: "authenticated",
          role: "authenticated",
          email: "fixture@example.invalid",
        },
      }),
    );
    localStorage.setItem(
      "kaizen-native-repository:fixture-client",
      "C:/stale-browser-folder",
    );
  }, COMPANION_TEST_ORIGIN);
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-paired-browser-"));
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      type: "module",
      scripts: { build: "astro build" },
      dependencies: {
        astro: "7.3.2",
        react: "19.2.4",
        "@astrojs/react": "6.0.5",
        "react-dom": "19.2.4",
      },
    }),
  );
  await writeFile(
    path.join(root, "astro.config.mjs"),
    "import {defineConfig} from 'astro/config';export default defineConfig({output:'static'});",
  );
  await promisify(execFile)(
    "pnpm",
    ["install", "--ignore-scripts", "--prefer-offline"],
    {
      cwd: root,
      shell: process.platform === "win32",
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  const file = path.join(root, "src/pages/index.astro");
  const original =
    "<main><h1>Original paired page</h1><p>Keep the original design</p></main><style>h1{color:teal}</style>";
  await writeFile(file, original);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const open = async () => {
    await page.goto(
      `${COMPANION_TEST_ORIGIN}/companion-test?project=fixture-client`,
    );
    await page.getByLabel("Helper address").fill(BUILDER_TEST_ORIGIN);
  };
  const pair = async (reconnect = false) => {
    const popupEvent = context.waitForEvent("page");
    await page
      .getByRole("button", { name: "Connect helper", exact: true })
      .click();
    const popup = await popupEvent;
    popup.on("pageerror", (e) => errors.push(e.message));
    await expect(
      popup.getByText("Companion client", { exact: true }),
    ).toBeVisible();
    if (!reconnect) await popup.getByLabel("Folder to share").fill(root);
    else await expect(popup.getByLabel("Folder to share")).toHaveValue(root);
    await popup.getByRole("button", { name: "Allow this folder" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Connected to" }),
    ).toContainText(root);
    return popup;
  };
  await open();
  let popup = await pair();
  await expect(page.getByLabel("Website folder on this computer")).toHaveValue(
    root,
  );
  const attempt = async (input: Record<string, unknown>) =>
    page.evaluate(async (value) => {
      try {
        return { result: await (window as any).testRepository(value) };
      } catch (e) {
        return { error: e.message };
      }
    }, input);
  expect(
    (await attempt({ action: "repository-inspect", root: path.dirname(root) }))
      .error,
  ).toContain("approved folder");
  expect((await attempt({ action: "publish" })).error).toContain(
    "not available",
  );
  const crossOrigin = await page.request.post(
    `${BUILDER_TEST_ORIGIN}/__builder-companion`,
    {
      headers: { Origin: COMPANION_TEST_ORIGIN, "X-Kaizen-Builder": "1" },
      data: { action: "connect" },
    },
  );
  expect(crossOrigin.status()).toBe(403);
  const edit = async () => {
    await page
      .getByRole("button", { name: "Check folder", exact: true })
      .click();
    await page
      .locator(".builder-repository li")
      .filter({ hasText: "src/pages/index.astro" })
      .getByRole("button", { name: "Edit text and links" })
      .click();
    const editor = page.getByRole("region", {
      name: "Existing page content editor",
    });
    await editor.getByRole("searchbox").fill("Original paired page");
    return editor;
  };
  let editor = await edit();
  await editor.getByRole("textbox").fill("Saved through the hosted editor");
  await expect(
    editor.getByRole("status", { name: "Source editing draft" }),
  ).toContainText("Edits saved on this computer");
  expect(await readFile(file, "utf8")).toBe(original);
  await popup.getByRole("button", { name: "Stop sharing this folder" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Helper not connected." }),
  ).toBeVisible();
  await expect(editor.getByRole("textbox")).toHaveValue(
    "Saved through the hosted editor",
  );
  expect(
    (await attempt({ action: "repository-inspect", root })).error,
  ).toContain("Connect the local companion");
  await popup.close();
  popup = await pair(true);
  await editor.getByRole("button", { name: "Close editor" }).click();
  await popup.close();
  await open();
  popup = await pair();
  editor = await edit();
  await expect(editor.getByRole("textbox")).toHaveValue(
    "Saved through the hosted editor",
  );
  await editor.getByRole("button", { name: "Review my changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Changes to apply" }),
  ).toBeVisible();
  expect(await readFile(file, "utf8")).toBe(original);
  await page
    .getByRole("button", { name: "Apply changes to the folder" })
    .click();
  await expect(
    page.locator(".builder-repository > [role=status]"),
  ).toContainText("Files applied");
  expect(await readFile(file, "utf8")).toBe(
    original.replace("Original paired page", "Saved through the hosted editor"),
  );
  await page
    .getByRole("button", { name: "Check build command", exact: true })
    .click();
  await page.getByRole("button", { name: "Run build", exact: true }).click();
  await expect(
    page.locator(".builder-repository-build [role=status]"),
  ).toContainText("Build finished", { timeout: 90000 });
  await page
    .getByRole("button", { name: "Edit text and links", exact: true })
    .click();
  const selectionEvent = context.waitForEvent("page");
  await editor
    .getByRole("button", { name: "Pick text from the preview" })
    .click();
  const selection = await selectionEvent;
  selection.on("pageerror", (e) => errors.push(e.message));
  await expect(
    editor.getByRole("status", { name: "Rendered source selection" }),
  ).toContainText("ready");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await selection.setViewportSize({ width, height: 1000 });
    await selection
      .getByRole("heading", { name: "Saved through the hosted editor" })
      .click();
    await expect(editor.getByRole("textbox")).toHaveCount(1);
    await expect(editor.getByRole("textbox")).toHaveValue(
      "Saved through the hosted editor",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/hosted-companion-${width}.png`,
      fullPage: true,
    });
  }
  await selection.close();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const backup = page.getByRole("region", { name: "Native repository backup" });
  await backup
    .getByRole("button", {
      name: "Prepare folder backup",
      exact: true,
    })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Download folder backup" }).click();
  const archive = path.join(root, "native-test-backup.zip");
  await (await downloadEvent).saveAs(archive);
  await page.screenshot({
    path: "test-results/hosted-companion-connected.png",
    fullPage: true,
  });
  await popup.close();
  await open();
  const target = path.join(root, "restored");
  const restorePopupEvent = context.waitForEvent("page");
  await page
    .getByRole("button", { name: "Connect helper", exact: true })
    .click();
  popup = await restorePopupEvent;
  await popup.getByLabel("Folder to share").fill(target);
  await popup
    .getByLabel("This is a new, empty folder for restoring a backup")
    .check();
  await popup.getByRole("button", { name: "Allow this folder" }).click();
  await expect(page.getByLabel("Website folder on this computer")).toHaveValue(
    target,
  );
  await expect(backup.getByLabel("New folder to restore into")).toHaveValue(
    target,
  );
  await backup.getByLabel("Backup ZIP file").setInputFiles(archive);
  await backup.getByRole("button", { name: "Check backup file" }).click();
  await backup.getByRole("button", { name: "Restore into new folder" }).click();
  await expect(backup.getByRole("status")).toContainText("Restored");
  expect(
    await readFile(path.join(target, "src/pages/index.astro"), "utf8"),
  ).toBe(await readFile(file, "utf8"));
  await popup.close();
  expect(errors).toEqual([]);
});
