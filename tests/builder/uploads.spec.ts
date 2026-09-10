import { expect, test } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
import { createHash } from "node:crypto";
import type { Asset, Workspace } from "../../shared/visualBuilder";

test("an interrupted ZIP resumes after reload from its confirmed chunk, with one queue owner and no duplicate files", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const pack = `Recovery ${crypto.randomUUID().slice(0, 8)}`,
    slug = `recovery-${crypto.randomUUID().slice(0, 8)}`;
  const chunkSize = 6 * 1024 * 1024;
  const bytes = Buffer.alloc(14 * 1024 * 1024);
  for (let offset = 0; offset < bytes.length; offset++)
    bytes[offset] = offset % 251;
  const zip = zipSync({
    "licences/LICENCE.txt": strToU8(
      "Synthetic upload regression fixture. No third-party asset licence.",
    ),
    "components/reference.tsx": bytes,
  });
  let allowResume = false,
    secondChunks = 0,
    uploadUrl = "";
  const offsets: number[] = [];
  await context.route("**/__builder-upload/**", async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      const offset = Number(request.headers()["upload-offset"]);
      offsets.push(offset);
      uploadUrl = request.url();
      if (offset >= chunkSize && !allowResume) {
        secondChunks++;
        await route.abort("internetdisconnected");
        return;
      }
    }
    await route.continue();
  });
  const api = async (): Promise<Workspace> =>
    (await page.request.get("/__builder-local")).json();
  await page.goto("/builder/");
  await page.getByRole("button", { name: "Blank page", exact: true }).click();
  await page.getByRole("button", { name: "Page", exact: true }).click();
  await page.getByRole("textbox", { name: "Page URL", exact: true }).fill(slug);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  const importer = page.getByRole("button", {
    name: "Import assets",
    exact: true,
  });
  if ((await importer.getAttribute("aria-expanded")) === "false")
    await importer.click();
  await page
    .getByRole("textbox", { name: "Pack name", exact: true })
    .fill(pack);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "recovery-pack.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zip),
  });
  await expect.poll(() => secondChunks, { timeout: 30_000 }).toBeGreaterThan(0);
  const competing = await context.newPage();
  await competing.goto("/builder/");
  await competing
    .getByRole("button")
    .filter({ hasText: `/${slug}/` })
    .click();
  await competing.getByRole("button", { name: "Assets", exact: true }).click();
  await competing
    .getByRole("button", { name: "Resume import", exact: true })
    .click();
  await expect(competing.locator(".builder-error")).toContainText(
    "another tab",
  );
  await competing.close();
  await page.getByRole("button", { name: "Pause import", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume import", exact: true }),
  ).toBeVisible();
  const paused = await page.request.head(uploadUrl, {
    headers: { "Tus-Resumable": "1.0.0", "X-Kaizen-Builder": "1" },
  });
  expect(paused.status()).toBe(200);
  expect(paused.headers()["upload-offset"]).toBe(String(chunkSize));
  expect(
    (
      await page.request.head(uploadUrl, {
        headers: { "Tus-Resumable": "1.0.0" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.head(uploadUrl, {
        headers: {
          "Tus-Resumable": "1.0.0",
          "X-Kaizen-Builder": "1",
          Origin: "https://outside.test",
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await api()).assets.filter((asset) => asset.pack === pack),
  ).toHaveLength(1);
  await page.screenshot({ path: "test-results/builder-upload-paused.png" });
  await page.reload();
  await page
    .getByRole("button")
    .filter({ hasText: `/${slug}/` })
    .click();
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Upload recovery" }),
  ).toContainText("1 of 2 files complete");
  await expect(page.locator(".builder-import-status")).toContainText(
    "recovered",
  );
  const resumedAt = offsets.length;
  allowResume = true;
  await page
    .getByRole("button", { name: "Resume import", exact: true })
    .click();
  await expect(page.locator(".builder-import-status")).toContainText(
    "2 imported · 0 duplicates skipped · 0 errors",
    { timeout: 60_000 },
  );
  expect(offsets.slice(resumedAt)).toEqual([chunkSize, 2 * chunkSize]);
  await expect(
    page.getByRole("region", { name: "Upload recovery" }),
  ).toHaveCount(0);
  const assets = (await api()).assets.filter((asset) => asset.pack === pack);
  expect(assets).toHaveLength(2);
  const source = assets.find((asset) => asset.kind === "code")!;
  expect(source.path).toBe("components/reference.tsx");
  expect(source.hash).toBe(createHash("sha256").update(bytes).digest("hex"));
  const downloaded = await page.request.get(source.url);
  expect(await downloaded.body()).toEqual(bytes);
  expect(downloaded.headers()["content-disposition"]).toBe("attachment");
  const stored = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("kaizen-builder-imports", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result
            .transaction("files")
            .objectStore("files")
            .count();
          request.onsuccess = () => {
            resolve(request.result);
            open.result.close();
          };
        };
      }),
  );
  expect(stored).toBe(0);
  await page.screenshot({ path: "test-results/builder-upload-resumed.png" });
});

test("a lost small-file acknowledgement can be retried without duplication and discarding pending files keeps completed assets", async ({
  page,
  context,
}) => {
  const pack = `Retry ${crypto.randomUUID().slice(0, 8)}`;
  let failScope = true;
  await context.route("**/__builder-local?scope=1", async (route) => {
    if (failScope) {
      failScope = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"temporarily unavailable"}',
      });
    } else await route.continue();
  });
  let dropAcknowledgement = true;
  await context.route("**/__builder-local?action=upload", async (route) => {
    const response = await route.fetch();
    if (dropAcknowledgement) {
      dropAcknowledgement = false;
      await route.abort("internetdisconnected");
    } else await route.fulfill({ response });
  });
  await page.goto("/builder/");
  await page.getByRole("button", { name: "Blank page", exact: true }).click();
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "upload workspace is unavailable",
  );
  await page
    .getByRole("button", { name: "Retry upload recovery", exact: true })
    .click();
  const importer = page.getByRole("button", {
    name: "Import assets",
    exact: true,
  });
  if ((await importer.getAttribute("aria-expanded")) === "false")
    await importer.click();
  await page
    .getByRole("textbox", { name: "Pack name", exact: true })
    .fill(pack);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await (
    await chooser
  ).setFiles([
    {
      name: "LICENCE.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Synthetic recovery fixture"),
    },
    {
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    },
  ]);
  await expect(page.locator(".builder-import-status")).toContainText(
    "2 errors",
  );
  await page
    .getByRole("button", { name: "Resume import", exact: true })
    .click();
  await expect(page.locator(".builder-import-status")).toContainText(
    "1 duplicates skipped · 1 errors",
  );
  await page
    .getByRole("button", { name: "Discard pending import", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Upload recovery" }),
  ).toHaveCount(0);
  const workspace: Workspace = await (
    await page.request.get("/__builder-local")
  ).json();
  const assets: Asset[] = workspace.assets.filter(
    (asset) => asset.pack === pack,
  );
  expect(assets).toHaveLength(1);
  expect(assets[0].kind).toBe("licence");
  if ((await importer.getAttribute("aria-expanded")) === "false")
    await importer.click();
  await expect(
    page.getByRole("button", { name: "Upload", exact: true }),
  ).toBeEnabled();
});
