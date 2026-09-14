import { test, expect } from "./browser-fixture";
import { siteFixture } from "./site-fixture";
import { RepositoryRunner } from "../../scripts/builder-runner";
import { RepositoryCompanion } from "../../scripts/builder-repository";
import { rm } from "node:fs/promises";
import { BUILDER_TEST_ORIGIN } from "./ports";

test("M3-T2: image previews decode in the local builder frame without sharing blob URLs", async ({
  page,
  context,
  browserName,
}) => {
  const fixture = await siteFixture(
    page,
    '<html><body><h1>Image preview</h1><img src="/images/original.svg" srcset="/images/original.svg 1x" alt="Original picture"></body></html>',
  );
  const runner = new RepositoryRunner();
  // WebKit's developer path opens the local builder; its public path uses the
  // separate, authenticated HTTPS hosted-preview journey in every engine.
  const parentOrigin =
    browserName === "webkit" ? BUILDER_TEST_ORIGIN : "https://builder.example";
  try {
    const inspection = await new RepositoryCompanion().inspectSourcePage(
      fixture.root,
      "src/pages/index.astro",
    );
    let job = await runner.start(
      (await runner.prepare(fixture.root, "image-fixture")).id,
      "image-fixture",
    );
    await expect
      .poll(() => {
        job = runner.status(job.id, "image-fixture");
        return job.status;
      })
      .not.toBe("building");
    expect(job.status, job.log).toBe("succeeded");
    const preview = await runner.sourcePreview(
      job.id,
      "image-fixture",
      inspection,
      parentOrigin,
      true,
      true,
    );
    expect(
      (await fetch(preview.url)).headers.get("content-security-policy"),
    ).toBe(
      `connect-src 'none'; form-action 'none'; frame-ancestors 'self' ${parentOrigin}`,
    );
    if (browserName === "chromium")
      await context.grantPermissions(["local-network-access"], {
        origin: parentOrigin,
      });
    await page.route(`${parentOrigin}/**`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<html><head><link rel="icon" href="data:,"/></head><body><iframe title="Website canvas" sandbox="allow-scripts allow-same-origin" allow="local-network-access; local-network; loopback-network" src="${preview.url}"></iframe></body></html>`,
      }),
    );
    await page.goto(parentOrigin);
    const frame = page.frameLocator('iframe[title="Website canvas"]');
    const picture = frame.getByRole("img", { name: "Original picture" });
    const decodedWidth = () =>
      picture.evaluate((image: HTMLImageElement) =>
        image.complete ? image.naturalWidth : 0,
      );
    await expect.poll(decodedWidth).toBe(80);
    const imageFields = inspection.fields
      .filter((field) => field.kind === "image")
      .map((field) => field.id);
    expect(imageFields).toHaveLength(2);
    const sendImage = (
      nonce = preview.nonce,
      ids = imageFields,
      restore = false,
    ) =>
      page.evaluate(
        ({ nonce, ids, restore, origin }) => {
          const blob = new Blob(
            [
              '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="40"><rect width="96" height="40" fill="purple"/></svg>',
            ],
            { type: "image/svg+xml" },
          );
          const images = restore
            ? {}
            : Object.fromEntries(
                ids.map((id) => [id, { key: "chosen-picture", blob }]),
              );
          document.querySelector("iframe")!.contentWindow!.postMessage(
            {
              type: "kaizen-source-state",
              nonce,
              images,
              values: {},
              orders: {},
              locked: false,
            },
            origin,
          );
          return new Promise<void>((resolve) => {
            const received = (event: MessageEvent) => {
              if (
                event.origin !== origin ||
                event.data.nonce !==
                  new URL(document.querySelector("iframe")!.src).pathname.split(
                    "/",
                  )[2] ||
                event.data.type !== "kaizen-source-ready"
              )
                return;
              window.removeEventListener("message", received);
              resolve();
            };
            window.addEventListener("message", received);
            document.querySelector("iframe")!.contentWindow!.postMessage(
              {
                type: "kaizen-source-hello",
                nonce: new URL(
                  document.querySelector("iframe")!.src,
                ).pathname.split("/")[2],
              },
              origin,
            );
          });
        },
        { nonce, ids, restore, origin: new URL(preview.url).origin },
      );
    await sendImage("wrong-nonce");
    await expect.poll(decodedWidth).toBe(80);
    await expect(picture).not.toHaveAttribute("src", /^blob:/);
    await sendImage(preview.nonce, ["unknown-field"]);
    await expect.poll(decodedWidth).toBe(80);
    await expect(picture).not.toHaveAttribute("src", /^blob:/);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await sendImage();
      await expect.poll(decodedWidth).toBe(96);
      const url = await picture.getAttribute("src");
      expect(url).toMatch(new RegExp(`^blob:http://127\\.0\\.0\\.1:`));
      expect(url).not.toContain(parentOrigin);
      await sendImage();
      await expect(picture).toHaveAttribute("src", url!);
      await sendImage(preview.nonce, [], true);
      await expect.poll(decodedWidth).toBe(80);
      await expect(picture).toHaveAttribute("srcset", /original\.svg 1x$/);
    }
  } finally {
    await runner.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});
