import { test, expect } from "./browser-fixture";
import {
  accountFixture,
  accountOwner,
  accountPerson,
  accountOtherOwner,
} from "./account-fixture";
import { BUILDER_LEGAL } from "../../shared/builderLegal";

test("first sign-in requires explicit versioned acceptance and preserves its original record on reload", async ({
  page,
}, testInfo) => {
  const fixture = await accountFixture(page, { needsLegalAcceptance: true });
  try {
    await expect(
      page.getByRole("heading", { name: "Before you open the Builder" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Account", exact: true }),
    ).toHaveCount(0);
    const accept = page.getByRole("button", {
      name: "Accept and open Builder",
    });
    await expect(accept).toBeDisabled();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(
      page.getByRole("link", { name: "Terms of Service", exact: true }),
    ).toHaveAttribute("href", BUILDER_LEGAL.termsUrl);
    await expect(
      page.getByRole("link", { name: "Privacy Policy", exact: true }),
    ).toHaveAttribute("href", BUILDER_LEGAL.privacyUrl);
    expect(
      (await fixture.db.query("select * from builder_legal_acceptances")).rows,
    ).toEqual([]);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.screenshot({
        path: `test-results/legal-acceptance-${testInfo.project.name}-${width}.png`,
      });
    }
    await page.getByRole("checkbox").check();
    await accept.click();
    await expect(
      page.getByRole("heading", { name: "Account", exact: true }),
    ).toBeVisible();
    const records = await fixture.db.query(
      "select user_id,version,accepted_at from builder_legal_acceptances",
    );
    expect(records.rows).toHaveLength(1);
    expect(records.rows[0]).toMatchObject({
      user_id: accountPerson,
      version: BUILDER_LEGAL.version,
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Account", exact: true }),
    ).toBeVisible();
    expect(
      (
        await fixture.db.query(
          "select user_id,version,accepted_at from builder_legal_acceptances",
        )
      ).rows,
    ).toEqual(records.rows);
    await fixture.switchAccount(accountOwner);
    await expect(
      page.getByRole("heading", { name: "Before you open the Builder" }),
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    expect(
      (
        await fixture.db.query(
          "select user_id,version,accepted_at from builder_legal_acceptances",
        )
      ).rows,
    ).toEqual(records.rows);
  } finally {
    await fixture.dispose();
  }
});

test("personal-data requests reach only their current owner and record a response without removing account or website data", async ({
  page,
}, testInfo) => {
  const fixture = await accountFixture(page);
  try {
    const mine = page.getByRole("region", {
      name: "My personal data",
      exact: true,
    });
    const reviews = page.getByRole("region", {
      name: "Personal-data requests to review",
      exact: true,
    });
    await expect(
      mine.getByRole("button", { name: "Send personal-data request" }),
    ).toBeDisabled();
    await mine
      .getByLabel("What is this request about?")
      .selectOption(fixture.project.id);
    await mine
      .getByLabel("Help us find the relevant information")
      .fill("A copy of my Garden website account information, please.");
    await mine
      .getByRole("button", { name: "Send personal-data request" })
      .click();
    await expect(mine.getByRole("article")).toContainText("Received");
    await mine.getByLabel("What is this request about?").selectOption("");
    await mine.getByLabel("What would you like?").selectOption("erasure");
    await mine
      .getByLabel("Help us find the relevant information")
      .fill("Please review removal of my old Builder profile information.");
    await mine
      .getByRole("button", { name: "Send personal-data request" })
      .click();
    const accountRequest = mine.getByRole("article", {
      name: "Erasure request for Builder account",
    });
    await expect(accountRequest).toContainText("Kaizen reviews this request");
    await accountRequest
      .getByRole("button", { name: "Cancel request" })
      .click();
    await expect(accountRequest).toContainText("Cancelled");
    await fixture.switchAccount(accountOtherOwner);
    await expect(reviews).toContainText(
      "There are no requests for websites you own",
    );
    await fixture.switchAccount(accountOwner);
    await expect(reviews.getByRole("article")).toHaveCount(1);
    await expect(reviews.getByRole("article")).toContainText(
      "alex@example.test",
    );
    await expect(reviews).not.toContainText("old Builder profile");
    await reviews.getByRole("button", { name: "Review request" }).click();
    const response = reviews.getByRole("form", {
      name: "Respond to personal-data request",
    });
    await expect(
      response.getByLabel("Response to the requester"),
    ).toBeFocused();
    await response
      .getByLabel("Response to the requester")
      .fill("Synthetic data copy delivered securely in this fixture.");
    await response.getByLabel("Request status").selectOption("fulfilled");
    await expect(
      response.getByRole("button", { name: "Record response" }),
    ).toBeDisabled();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await response.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.screenshot({
        path: `test-results/privacy-owner-${testInfo.project.name}-${width}.png`,
      });
    }
    await response.getByRole("checkbox").check();
    await response.getByRole("button", { name: "Record response" }).click();
    await expect(reviews.getByRole("article")).toContainText("Completed");
    await fixture.switchAccount(accountPerson);
    await expect(
      mine.getByRole("article", {
        name: "Data copy request for Garden website",
      }),
    ).toContainText("Synthetic data copy delivered securely");
    await page.reload();
    await expect(
      mine.getByRole("article", {
        name: "Data copy request for Garden website",
      }),
    ).toContainText("Completed");
    expect(await fixture.readUser(accountPerson)).not.toBeNull();
    expect(
      (await fixture.db.query("select * from storage.objects")).rows,
    ).toHaveLength(1);
    expect(fixture.state.deletions).toEqual([]);
    expect(
      (
        await fixture.db.query(
          "select status from builder_privacy_requests order by requested_at",
        )
      ).rows,
    ).toEqual([{ status: "fulfilled" }, { status: "cancelled" }]);
  } finally {
    await fixture.dispose();
  }
});

test("public versioned documents are readable before sign-in at desktop and phone widths", async ({
  page,
}, testInfo) => {
  for (const [name, url] of [
    ["Terms of Service", BUILDER_LEGAL.termsUrl],
    ["Privacy Policy", BUILDER_LEGAL.privacyUrl],
  ]) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Kaizen Web Ltd", { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByRole("main")).toContainText(BUILDER_LEGAL.version);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.screenshot({
        path: `test-results/legal-${name.startsWith("Terms") ? "terms" : "privacy"}-${testInfo.project.name}-${width}.png`,
      });
    }
  }
});
