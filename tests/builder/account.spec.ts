import { test, expect } from "./browser-fixture";
import {
  accountFixture,
  accountOwner,
  accountPerson,
  accountOtherOwner,
} from "./account-fixture";
import { repositoryAuthor } from "../../scripts/builder-hosted-auth";

test("the account page fixes missing authorship, confirms email/password changes, and keeps this session signed in", async ({
  page,
}) => {
  const fixture = await accountFixture(page);
  try {
    await expect(
      page.getByRole("heading", { name: "Account", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Add your name here before using Save to website.", {
        exact: true,
      }),
    ).toBeVisible();
    const before = await fixture.readUser(accountPerson);
    expect(() =>
      repositoryAuthor({
        id: accountPerson,
        expiresAt: Date.now() + 60000,
        email: before!.email,
      }),
    ).toThrow(/Open Account/);
    await page
      .getByRole("textbox", { name: "Your name", exact: true })
      .fill("Alex Garden");
    await page
      .getByRole("button", { name: "Save my name", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Your name", exact: true }),
    ).toContainText("Your name is saved");
    const after = await fixture.readUser(accountPerson);
    expect(
      repositoryAuthor({
        id: accountPerson,
        expiresAt: Date.now() + 60000,
        name: after!.user_metadata.full_name,
        email: after!.email,
      }),
    ).toEqual({ name: "Alex Garden", email: "alex@example.test" });
    await page
      .getByLabel("New email address", { exact: true })
      .fill("alex.new@example.test");
    await page
      .getByRole("button", { name: "Change my email", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Email address", exact: true }),
    ).toContainText("Waiting for confirmation of alex.new@example.test");
    expect((await fixture.readUser(accountPerson))!.email).toBe(
      "alex@example.test",
    );
    await page.screenshot({ path: "test-results/launch-account-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("region", { name: "Your name", exact: true })
      .scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    await page.screenshot({ path: "test-results/launch-account-phone.png" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    fixture.state.requireCode = true;
    async function passwords() {
      await page
        .getByLabel("New password", { exact: true })
        .fill("new-fixture-password");
      await page
        .getByLabel("Confirm new password", { exact: true })
        .fill("new-fixture-password");
    }
    await passwords();
    await page
      .getByRole("button", { name: "Change my password", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Password", exact: true }),
    ).toContainText("Confirm this password change");
    await page.getByRole("button", { name: "Send confirmation code" }).click();
    await expect(
      page.getByRole("region", { name: "Password", exact: true }),
    ).toContainText("A confirmation code has been requested");
    expect(fixture.state.codes).toEqual([accountPerson]);
    for (const [label, width] of [
      ["desktop", 1440],
      ["phone", 390],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page
        .getByRole("region", { name: "Password", exact: true })
        .scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.screenshot({
        path: `test-results/launch-account-password-${label}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await passwords();
    await page.getByLabel("Confirmation code", { exact: true }).fill("123456");
    await page
      .getByRole("button", { name: "Change my password", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Password", exact: true }),
    ).toContainText("Your password has changed");
    await expect(page.getByLabel("New password", { exact: true })).toHaveValue(
      "",
    );
    await page
      .getByRole("button", { name: "Sign out of other sessions" })
      .click();
    await expect(
      page.getByRole("region", { name: "Other devices" }),
    ).toContainText("You can keep using this window");
    expect(fixture.state.scopes).toEqual([
      { actor: accountPerson, scope: "others" },
    ]);
    await page.getByLabel("Type DELETE MY ACCOUNT").fill("DELETE MY ACCOUNT");
    await page
      .getByRole("button", { name: "Request account deletion", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Delete my account", exact: true }),
    ).toContainText("Waiting for another owner");
    await page.getByRole("button", { name: "Cancel deletion request" }).click();
    await expect(
      page.getByRole("region", { name: "Delete my account", exact: true }),
    ).toContainText("Your deletion request is cancelled");
    expect(fixture.state.deletions).toEqual([]);
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Your name", exact: true }),
    ).toHaveValue("Alex Garden");
  } finally {
    await fixture.dispose();
  }
});

test("each website owner confirms through the real deletion transactions, with an interrupted removal explicitly retried", async ({
  page,
}) => {
  const fixture = await accountFixture(page);
  try {
    await page.getByLabel("Type DELETE MY ACCOUNT").fill("DELETE MY ACCOUNT");
    await page
      .getByRole("button", { name: "Request account deletion", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Delete my account", exact: true }),
    ).toContainText("Your deletion request is saved");
    await fixture.switchAccount(accountOwner);
    const reviews = page.getByRole("region", {
      name: "Account requests to review",
    });
    await expect(reviews).toContainText("Garden website");
    await expect(reviews).not.toContainText("Other website");
    await reviews.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "test-results/launch-account-review-desktop.png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await reviews.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    await page.screenshot({
      path: "test-results/launch-account-review-phone.png",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await reviews
      .getByRole("button", { name: "Review deletion request" })
      .click();
    await expect(
      reviews.getByRole("group", { name: "Confirm account deletion" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Delete my account", exact: true })
        .getByRole("group", { name: "Confirm account deletion" }),
    ).toHaveCount(0);
    for (const [label, width] of [
      ["desktop", 1440],
      ["phone", 390],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page
        .getByRole("group", { name: "Confirm account deletion" })
        .scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.screenshot({
        path: `test-results/launch-account-confirm-${label}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("group", { name: "Confirm account deletion" })
      .getByRole("button", { name: "Confirm account deletion", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Delete my account", exact: true }),
    ).toContainText("Other website owners still need to confirm");
    expect(fixture.state.deletions).toEqual([]);
    await fixture.switchAccount(accountOtherOwner);
    await expect(reviews).toContainText("Other website");
    await expect(reviews).not.toContainText("Garden website");
    fixture.state.failDelete = true;
    await reviews
      .getByRole("button", { name: "Review deletion request" })
      .click();
    await page
      .getByRole("group", { name: "Confirm account deletion" })
      .getByRole("button", { name: "Confirm account deletion", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Account deletion has started" }),
    ).toContainText("project access has ended");
    expect(
      (
        await fixture.db.query(
          "select * from builder_project_members where user_id=$1",
          [accountPerson],
        )
      ).rows,
    ).toEqual([]);
    expect(await fixture.readUser(accountPerson)).not.toBeNull();
    fixture.state.failDelete = false;
    await page
      .getByRole("button", { name: "Refresh account requests" })
      .click();
    await reviews.getByRole("button", { name: "Finish deletion" }).click();
    await page
      .getByRole("group", { name: "Confirm account deletion" })
      .getByRole("button", { name: "Confirm account deletion", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Delete my account", exact: true }),
    ).toContainText("Account deletion is complete");
    expect(await fixture.readUser(accountPerson)).toBeNull();
    expect(
      (await fixture.db.query("select owner from storage.objects")).rows,
    ).toEqual([{ owner: accountPerson }]);
    expect(fixture.state.deletions).toEqual([accountPerson, accountPerson]);
    expect(
      (
        await fixture.db.query(
          "select status from builder_account_deletions where user_id=$1",
          [accountPerson],
        )
      ).rows,
    ).toEqual([{ status: "completed" }]);
  } finally {
    await fixture.dispose();
  }
});
