import { expect, test } from "@playwright/test";
import { newDocument } from "../../client/visual-builder/starters";

test("publishing a renamed redirect destination preserves the live page until its redirects are updated", async ({
  page,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8),
    id = crypto.randomUUID();
  const slug = `route-target-${suffix}`,
    document = newDocument("Redirect destination", slug, false);
  const request = (data: unknown) =>
    page.request.post("/__builder-local", {
      headers: { "X-Kaizen-Builder": "1" },
      data,
    });
  let response = await request({ action: "save", id, version: 0, document });
  expect(response.ok()).toBeTruthy();
  let saved = await response.json();
  response = await request({ action: "publish", id, version: saved.version });
  expect(response.ok()).toBeTruthy();
  saved = await response.json();
  const workspace = await (await page.request.get("/__builder-local")).json();
  const originalRules = workspace.routes?.draft || [];
  response = await request({
    action: "routes",
    version: workspace.routes?.version || 0,
    rules: [
      ...originalRules,
      {
        id: crypto.randomUUID(),
        source: `/route-old-${suffix}/`,
        destination: `/${slug}/`,
        status: 302,
      },
    ],
  });
  expect(response.ok()).toBeTruthy();
  let routes = await response.json();
  response = await request({
    action: "publish-routes",
    version: routes.version,
  });
  expect(response.ok()).toBeTruthy();
  response = await request({
    action: "save",
    id,
    version: saved.version,
    document: { ...document, slug: `${slug}-new` },
  });
  expect(response.ok()).toBeTruthy();
  saved = await response.json();
  response = await request({ action: "publish", id, version: saved.version });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toMatch(/redirect|destination/i);
  const after = await (await page.request.get("/__builder-local")).json();
  expect(
    after.pages.find((item: { id: string }) => item.id === id).published.slug,
  ).toBe(slug);
  expect((await page.request.get(`/${slug}/`)).status()).toBe(200);
  expect(
    (
      await page.request.get(`/route-old-${suffix}/`, { maxRedirects: 0 })
    ).headers().location,
  ).toBe(`/${slug}/`);
  response = await request({
    action: "routes",
    version: routes.version,
    rules: originalRules,
  });
  expect(response.ok()).toBeTruthy();
  routes = await response.json();
  response = await request({
    action: "publish-routes",
    version: routes.version,
  });
  expect(response.ok()).toBeTruthy();
  response = await request({ action: "publish", id, version: saved.version });
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).published.slug).toBe(`${slug}-new`);
});
