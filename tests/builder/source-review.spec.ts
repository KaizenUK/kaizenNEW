import { test, expect } from "./browser-fixture";
import { siteFixture } from "./site-fixture";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const source =
  '<html><head><title>Garden website</title><style>body{font:20px system-ui;color:#163a32;background:#f2f8f0}section{padding:28px}</style></head><body><main><section><h1>Welcome to the garden</h1><a href="/visit/">Visit us</a><img src="/images/original.svg" alt="Garden illustration"></section><section><h2>Our opening hours</h2><p>Every weekend</p></section></main></body></html>';
const exec = promisify(execFile);
const preferenceKey = (project: string) =>
  `kaizen-builder-view:22222222-2222-4222-8222-222222222222:${project}`;

for (const mode of ["client", "developer"] as const) {
  test(`${mode} view reviews actual text, link, image and section changes before applying`, async ({
    page,
  }) => {
    const fixture = await siteFixture(page, source, true);
    let releaseDraft: () => void = () => {};
    try {
      await exec("git", ["init", "-b", "fixture-stage"], { cwd: fixture.root });
      await writeFile(
        path.join(fixture.root, "public/images/updated.svg"),
        await readFile(path.join(fixture.root, "public/images/original.svg")),
      );
      await page.evaluate(({ key, mode }) => localStorage.setItem(key, mode), {
        key: preferenceKey(fixture.project.id),
        mode,
      });
      await fixture.open();
      const frame = page.frameLocator('iframe[title="Website canvas"]');
      const heading = frame.getByRole("heading", { level: 1 });
      let saving = false;
      const draftGate = new Promise<void>((resolve) => {
        releaseDraft = resolve;
      });
      if (mode === "client")
        await page.route("**/editor-api/builder-repository", async (route) => {
          const body = route.request().postDataJSON();
          if (
            body.action === "repository-source-draft-save" &&
            body.edits &&
            !saving
          ) {
            saving = true;
            await draftGate;
          }
          await route.fallback();
        });
      await heading.dblclick();
      await heading.fill("A garden for everyone");
      await heading.press("Tab");
      if (mode === "client") {
        await expect.poll(() => saving).toBe(true);
        await expect(page.getByLabel("Source editing draft")).toHaveText(
          "Draft",
        );
        await expect(page.locator(".builder-site-footer")).toContainText(
          "Draft",
        );
        releaseDraft();
        await expect(page.getByLabel("Source editing draft")).toHaveText(
          "Saved",
        );
      }
      await frame.getByRole("link", { name: "Visit us" }).click();
      await page
        .getByLabel(
          mode === "developer"
            ? /src\/pages\/index.astro .*href line/
            : "Link address",
          { exact: mode === "client" },
        )
        .fill("/new-visit/");
      await frame.getByRole("img", { name: "Garden illustration" }).click();
      await page
        .getByLabel(
          mode === "developer" ? /src\/pages\/index.astro .*src line/ : "Image",
          { exact: mode === "client" },
        )
        .fill("/images/updated.svg");
      await frame.getByRole("heading", { name: "Our opening hours" }).hover();
      await frame
        .getByRole("button", { name: "Move section up", exact: true })
        .click();
      await expect(page.getByLabel("Source editing draft")).toContainText(
        "Saved",
      );
      const footer = page.locator(".builder-site-footer");
      if (mode === "client") {
        await expect(footer).not.toContainText(
          /src\/|[Bb]ranch|[Cc]ommit|files changed/,
        );
        for (const title of await footer
          .locator("[title]")
          .evaluateAll((elements) =>
            elements.map((element) => element.getAttribute("title")),
          ))
          expect(title).not.toMatch(/src\/|fixture-stage|branch|commit/i);
        await expect(
          page.getByText("Where it comes from", { exact: true }),
        ).toHaveCount(0);
        await page
          .locator(".builder-site-selected")
          .getByRole("button", { name: "Page", exact: true })
          .click();
        await expect(
          page.getByText("Files involved", { exact: true }),
        ).toHaveCount(0);
      } else {
        await expect(footer).toContainText("Branch fixture-stage");
        await expect(footer).toContainText("src/pages/index.astro");
      }
      await page
        .getByRole("button", { name: "Review my changes", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "Review my changes" });
      const changes = dialog.getByRole("list", {
        name: "Before and after changes",
      });
      await expect(changes.locator(":scope > li")).toHaveCount(4);
      const change = (label: string) =>
        changes.locator(":scope > li").filter({
          has: page.getByRole("heading", { name: label, exact: true }),
        });
      await expect(change("Heading")).toContainText("Welcome to the garden");
      await expect(change("Heading")).toContainText("A garden for everyone");
      await expect(change("Link address")).toContainText("/visit/");
      await expect(change("Link address")).toContainText("/new-visit/");
      await expect(change("Image")).toContainText("original.svg");
      await expect(change("Image")).toContainText("updated.svg");
      const lists = change("Section order").getByRole("list");
      await expect(lists.nth(0).getByRole("listitem")).toHaveText([
        "Welcome to the garden",
        "Our opening hours",
      ]);
      await expect(lists.nth(1).getByRole("listitem")).toHaveText([
        "Our opening hours",
        "A garden for everyone",
      ]);
      if (mode === "client") {
        await expect(dialog).not.toContainText(/src\/|<html|fixture-stage/);
        await expect(
          dialog.getByText("Show the whole file", { exact: true }),
        ).toHaveCount(0);
      } else {
        await expect(
          dialog
            .locator("summary")
            .filter({ hasText: "src/pages/index.astro" }),
        ).toBeVisible();
        // The first file opens automatically; its full source stays collapsed.
        await expect(dialog.locator("pre")).not.toBeVisible();
        await dialog.getByText("Show the whole file", { exact: true }).click();
        await expect(dialog.locator("pre")).toContainText("<html>");
        await expect(dialog.locator("pre")).toContainText(
          "A garden for everyone",
        );
      }
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await dialog.evaluate((element) => {
          element.scrollTop = 0;
        });
        const bounds = await dialog.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(16);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 16);
        expect(
          await dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/launch-review-${mode}-${width}.png`,
        });
      }
      expect(
        await readFile(
          path.join(fixture.root, "src/pages/index.astro"),
          "utf8",
        ),
      ).toBe(source);
      const oldFrame = await page
        .locator('iframe[title="Website canvas"]')
        .getAttribute("src");
      await dialog
        .getByRole("button", {
          name: "Apply changes to the folder",
          exact: true,
        })
        .click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByLabel("Source editing draft")).toContainText(
        "Saved",
      );
      await expect(
        page.locator('iframe[title="Website canvas"]'),
      ).not.toHaveAttribute("src", oldFrame!);
      await expect(frame.getByRole("heading", { level: 1 })).toHaveText(
        "A garden for everyone",
      );
      const result = await readFile(
        path.join(fixture.root, "src/pages/index.astro"),
        "utf8",
      );
      expect(result).toContain("A garden for everyone");
      expect(result).toContain('href="/new-visit/"');
      expect(result).toContain('src="/images/updated.svg"');
      expect(result.indexOf("Our opening hours")).toBeLessThan(
        result.indexOf("A garden for everyone"),
      );
      await page
        .getByRole("button", { name: "Back to pages", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Edit existing /", exact: true }),
      ).toBeEnabled();
    } finally {
      releaseDraft();
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
}

test("a delayed review cannot apply an older edit after typing continues on the canvas", async ({
  page,
}) => {
  const fixture = await siteFixture(page, source, true);
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reached = false;
  try {
    await page.evaluate(
      (key) => localStorage.setItem(key, "client"),
      preferenceKey(fixture.project.id),
    );
    await fixture.open();
    const heading = page
      .frameLocator('iframe[title="Website canvas"]')
      .getByRole("heading", { level: 1 });
    await heading.dblclick();
    await heading.fill("First review text");
    await heading.press("Tab");
    await page.route("**/editor-api/builder-repository", async (route) => {
      if (
        route.request().postDataJSON().action === "repository-source-prepare" &&
        !reached
      ) {
        reached = true;
        await held;
      }
      await route.fallback();
    });
    await page
      .getByRole("button", { name: "Review my changes", exact: true })
      .click();
    await expect.poll(() => reached).toBe(true);
    await heading.dblclick();
    const newerSaved = page.waitForResponse((response) => {
      if (
        response.request().method() !== "POST" ||
        !response.url().endsWith("/editor-api/builder-repository")
      )
        return false;
      const body = response.request().postDataJSON();
      return (
        response.status() === 200 &&
        body.action === "repository-source-draft-save" &&
        Object.values(body.edits?.values || {}).includes(
          "The newer edit must survive",
        )
      );
    });
    await heading.fill("The newer edit must survive");
    await heading.press("Tab");
    await newerSaved;
    release();
    await expect(page.getByRole("alert")).toContainText("review");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      await readFile(path.join(fixture.root, "src/pages/index.astro"), "utf8"),
    ).toBe(source);
    await expect(heading).toHaveText("The newer edit must survive");
    await page
      .getByRole("button", { name: "Review my changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "The newer edit must survive",
    );
    await expect(page.getByRole("dialog")).not.toContainText(
      "First review text",
    );
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await rm(fixture.root, { recursive: true, force: true });
  }
});
