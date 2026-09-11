import { test, expect } from "./browser-fixture";
import { createHash } from "node:crypto";
import { newDocument } from "../../client/visual-builder/starters";

test("Unity client dashboard keeps two open projects and their assets isolated", async ({
  page,
  context,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const name = `Client Alpha ${suffix}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/builder/");
  await page
    .getByRole("button", { name: "Client projects", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .first()
    .fill(name);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const card = page.getByRole("article", { name, exact: true });
  await expect(card).toContainText("No deployment destination configured");
  await card.getByRole("link", { name: "Open project" }).click();
  const alpha = new URL(page.url()).searchParams.get("project")!;
  const response = await page.request.post("/__builder-projects", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "create", name: `Client Beta ${suffix}` },
  });
  expect(response.ok()).toBeTruthy();
  const beta = (await response.json()).id;
  const document = newDocument("Alpha page", "client-home", false);
  document.theme.accent = "#ff0088";
  const saved = await page.request.post(`/__builder-local?project=${alpha}`, {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "save", id: crypto.randomUUID(), version: 0, document },
  });
  expect(saved.ok()).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("button").filter({ hasText: "/client-home/" }),
  ).toHaveCount(1);
  const other = await context.newPage();
  await other.goto(`/builder/?project=${beta}`);
  await expect(
    other.getByRole("button").filter({ hasText: "/client-home/" }),
  ).toHaveCount(0);
  const bytes = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="purple"/></svg>',
  );
  const asset = {
    id: crypto.randomUUID(),
    hash: createHash("sha256").update(bytes).digest("hex"),
    name: "client-logo.svg",
    path: "client-logo.svg",
    pack: "Client identity",
    mime: "image/svg+xml",
    kind: "icon",
    size: bytes.length,
    url: "",
    tags: [],
    favourite: false,
    createdAt: new Date().toISOString(),
  };
  const uploaded = await page.request.post(
    `/__builder-local?project=${alpha}&action=upload`,
    {
      headers: {
        "X-Kaizen-Builder": "1",
        "X-Asset-Metadata": encodeURIComponent(JSON.stringify(asset)),
        "Content-Type": asset.mime,
      },
      data: bytes,
    },
  );
  expect(uploaded.ok()).toBeTruthy();
  const media = await uploaded.json();
  expect(media.url).toContain(`project=${alpha}`);
  expect((await page.request.get(media.url)).ok()).toBeTruthy();
  expect(
    (await page.request.get(media.url.replace(alpha, beta))).status(),
  ).toBe(404);
  expect(
    (await page.request.get(`/__builder-local?project=${beta}`)).ok(),
  ).toBeTruthy();
  expect(
    (await (await page.request.get(`/__builder-local?project=${beta}`)).json())
      .assets,
  ).toEqual([]);
  const betaDocument = newDocument("Beta page", "client-home", false);
  betaDocument.theme.accent = "#00bb88";
  expect(
    (
      await other.request.post(`/__builder-local?project=${beta}`, {
        headers: { "X-Kaizen-Builder": "1" },
        data: {
          action: "save",
          id: crypto.randomUUID(),
          version: 0,
          document: betaDocument,
        },
      })
    ).ok(),
  ).toBe(true);
  const betaBytes = Buffer.from(bytes.toString().replace("purple", "green"));
  const betaAsset = {
    ...asset,
    size: betaBytes.length,
    id: crypto.randomUUID(),
    hash: createHash("sha256").update(betaBytes).digest("hex"),
  };
  const betaUpload = await other.request.post(
    `/__builder-local?project=${beta}&action=upload`,
    {
      headers: {
        "X-Kaizen-Builder": "1",
        "X-Asset-Metadata": encodeURIComponent(JSON.stringify(betaAsset)),
        "Content-Type": betaAsset.mime,
      },
      data: betaBytes,
    },
  );
  expect(betaUpload.ok()).toBe(true);
  const betaMedia = await betaUpload.json();
  expect(await (await page.request.get(media.url)).body()).toEqual(bytes);
  expect(await (await other.request.get(betaMedia.url)).body()).toEqual(
    betaBytes,
  );
  expect(
    (await other.request.get(betaMedia.url.replace(beta, alpha))).status(),
  ).toBe(404);
  for (const [id, title, accent, assetId] of [
    [alpha, "Alpha page", "#ff0088", media.id],
    [beta, "Beta page", "#00bb88", betaMedia.id],
  ]) {
    const state = await (
      await page.request.get(`/__builder-local?project=${id}`)
    ).json();
    expect(state.pages).toHaveLength(1);
    expect(state.pages[0].draft).toMatchObject({
      title,
      slug: "client-home",
      theme: { accent },
    });
    expect(state.assets.map((item) => item.id)).toEqual([assetId]);
  }
  await other.reload();
  await other.getByRole("button").filter({ hasText: "/client-home/" }).click();
  await expect(other.locator(".builder-editor-header")).toContainText(
    `Client Beta ${suffix}`,
  );
  await expect(
    other
      .frameLocator("#preview-frame")
      .locator("[style*='--kb-accent']")
      .first(),
  ).toHaveCSS("--kb-accent", "#00bb88");
  const publication = await page.request.post(
    `/__builder-local?project=${alpha}`,
    {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "publish", id: (await saved.json()).id, version: 1 },
    },
  );
  expect(publication.ok()).toBeFalsy();
  expect(await publication.text()).toContain("no publication destination");
  await page.getByRole("button").filter({ hasText: "/client-home/" }).click();
  await expect(page.locator(".builder-editor-header")).toContainText(name);
  await expect(
    page
      .frameLocator("#preview-frame")
      .locator("[style*='--kb-accent']")
      .first(),
  ).toHaveCSS("--kb-accent", "#ff0088");
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Client projects", exact: true })
    .click();
  await card.getByRole("button", { name: "Duplicate", exact: true }).click();
  const copyName = `${name} copy`,
    renamed = `Renamed copy ${suffix}`;
  const copy = page.getByRole("article", { name: copyName, exact: true });
  await expect(copy).toContainText("No deployment destination configured");
  await copy
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill(renamed);
  await copy.getByRole("button", { name: "Rename", exact: true }).click();
  const renamedCard = page.getByRole("article", { name: renamed, exact: true });
  await renamedCard
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(renamedCard).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Show archived projects", exact: true })
    .check();
  await expect(renamedCard).toContainText("Archived");
  await expect(
    renamedCard.getByRole("link", { name: "Open project", exact: true }),
  ).toHaveCount(0);
  await renamedCard
    .getByRole("button", { name: "Restore project", exact: true })
    .click();
  await expect(
    renamedCard.getByRole("link", { name: "Open project", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/projects-unity-desktop.png",
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await renamedCard.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/projects-unity-mobile.png",
    fullPage: false,
  });
  expect(errors).toEqual([]);
  await other.close();
});
