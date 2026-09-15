import { test, expect } from "./browser-fixture";
import { siteFixture } from "./site-fixture";
import { rm } from "node:fs/promises";

test("hosted projects open their managed folder by default and keep edits when access ends", async ({
  page,
}) => {
  const fixture = await siteFixture(
    page,
    "<html><head><title>Hosted garden</title></head><body><h1>A hosted garden</h1><p>Keep this design.</p></body></html>",
    true,
  );
  try {
    await expect(
      page.getByRole("button", { name: "Edit existing /", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Export & handoff", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /^Hosted helper/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Refresh connection" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Use a helper on this computer" }),
    ).toHaveAttribute(
      "href",
      new RegExp(`project=${fixture.project.id}.*helper=local`),
    );
    await expect(
      page.getByLabel("Website folder for this project"),
    ).toHaveValue(fixture.root);
    await expect(
      page.getByLabel("Website folder for this project"),
    ).toHaveJSProperty("readOnly", true);
    await page.screenshot({
      path: "test-results/launch-hosted-helper-desktop.png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("heading", { name: /^Hosted helper/ })
      .scrollIntoViewIfNeeded();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(390);
    await page.screenshot({
      path: "test-results/launch-hosted-helper-phone.png",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Pages", exact: true }).click();
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    const canvas = page.frameLocator('iframe[title="Website canvas"]');
    const heading = canvas.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    expect(
      await page.evaluate(async () => {
        const { repositoryConnection } = await import(
          "/client/visual-builder/repositoryConnection.ts" as string
        );
        const cases = [
          "https://untrusted.invalid/preview/",
          location.origin + "/builder/",
          location.origin + "/editor-preview/other-project/build/",
          location.origin +
            "/editor-preview/" +
            new URLSearchParams(location.search).get("project") +
            "/build/%2f..%2fprivate",
        ];
        const addresses = cases.map((url) => {
          try {
            repositoryConnection.validatePreview(url);
            return false;
          } catch {
            return true;
          }
        });
        const frameUrl = (
          document.querySelector(
            'iframe[title="Website canvas"]',
          ) as HTMLIFrameElement
        ).src;
        const nonces = [
          undefined,
          null,
          "wrong",
          "a".repeat(63),
          "g".repeat(64),
        ].map((nonce) => {
          try {
            repositoryConnection.validateFrame(frameUrl, nonce);
            return false;
          } catch {
            return true;
          }
        });
        return [...addresses, ...nonces];
      }),
    ).toEqual(Array(9).fill(true));
    const popupEvent = page.context().waitForEvent("page");
    await page.evaluate(async () => {
      const { repositoryConnection } = await import(
        "/client/visual-builder/repositoryConnection.ts" as string
      );
      repositoryConnection.openPreviewWindow(
        (
          document.querySelector(
            'iframe[title="Website canvas"]',
          ) as HTMLIFrameElement
        ).src,
      );
    });
    const popup = await popupEvent;
    await expect(
      popup
        .frameLocator('iframe[title="Website preview"]')
        .getByRole("heading", { name: "A hosted garden" }),
    ).toBeVisible();
    await expect(popup.locator("iframe")).toHaveAttribute(
      "sandbox",
      "allow-scripts",
    );
    await popup.close();
    expect(
      await heading.evaluate(() => {
        return [
          () => localStorage.length,
          () => window.parent.document.title,
        ].map((read) => {
          try {
            return read();
          } catch (error) {
            return (error as Error).name;
          }
        });
      }),
    ).toEqual(["SecurityError", "SecurityError"]);
    await heading.dblclick();
    await heading.fill("My open website edit");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Saved",
    );
    await expect(page.getByLabel("Source editing draft")).not.toContainText(
      "on this computer",
    );
    await page.route("**/editor-api/builder-repository", (route) =>
      route.fulfill({
        status: 403,
        json: {
          error: "Project access ended. Ask the owner to restore your access.",
        },
      }),
    );
    await heading.fill("Keep my unsent website edit");
    await expect(
      page.getByRole("alert").filter({ hasText: "Project access ended" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review my changes", exact: true }),
    ).toBeDisabled();
    await expect(heading).toHaveText("Keep my unsent website edit");
    await expect(
      page.getByRole("button", { name: "Download my unapplied edits" }),
    ).toBeVisible();
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
