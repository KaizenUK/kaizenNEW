import { test, expect, type Page } from "./browser-fixture";
import { accountFixture, accountNew } from "./account-fixture";

async function capture(page: Page, name: string) {
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page.screenshot({
      path: `test-results/launch-signup-${name}-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function fillSignup(page: Page) {
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("new-person@example.test");
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Fixture New Person");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fixture-new-password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("fixture-new-password");
}
test("confirmed signup records acceptance and opens exactly one first website after an uncertain response", async ({
  page,
}) => {
  const f = await accountFixture(page, { signup: true });
  try {
    await fillSignup(page);
    await capture(page, "form");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Confirm your email", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "If this address can be registered",
    );
    expect(f.state.signupRequests).toEqual([
      {
        email: "new-person@example.test",
        name: "Fixture New Person",
        redirectTo: new URL("/builder/", page.url()).href,
      },
    ]);
    expect(
      (
        await f.db.query(
          "select * from builder_account_initializations where user_id=$1",
          [accountNew],
        )
      ).rows,
    ).toHaveLength(0);
    expect(f.state.bootstrapActors).toHaveLength(0);
    await capture(page, "confirmation");
    await f.openPasswordLink("signup");
    await expect(
      page.getByRole("heading", { name: "Before you open the Builder" }),
    ).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
    expect(f.state.bootstrapActors).toHaveLength(0);
    f.state.bootstrapFailureAfterCommit = true;
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Accept and open Builder", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Your first project could not be confirmed",
    );
    const records = (
      await f.db.query<any>(
        "select first_project_id from builder_account_initializations where user_id=$1",
        [accountNew],
      )
    ).rows;
    expect(records).toHaveLength(1);
    const id = records[0].first_project_id;
    expect(id).toBeTruthy();
    expect(id).not.toBe("kaizen");
    await capture(page, "retry");
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`project=${id}`));
    await expect(
      page.getByRole("heading", { name: "Pages", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Start here", exact: true }),
    ).toBeVisible();
    await capture(page, "first-project");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Pages", exact: true }),
    ).toBeVisible();
    expect(
      (
        await f.db.query(
          "select * from builder_project_members where user_id=$1",
          [accountNew],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await f.db.query(
          "select * from builder_legal_acceptances where user_id=$1",
          [accountNew],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await f.db.query<any>(
          "select first_project_id from builder_account_initializations where user_id=$1",
          [accountNew],
        )
      ).rows[0].first_project_id,
    ).toBe(id);
  } finally {
    await f.dispose();
  }
});
test("signup and resend failures preserve a recoverable confirmation flow without premature project creation", async ({
  page,
}) => {
  const f = await accountFixture(page, { signup: true });
  try {
    await fillSignup(page);
    f.state.signupFailure = true;
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "may have sent an email",
    );
    await expect(page.getByRole("alert")).not.toContainText("Private fixture");
    await page
      .getByRole("button", { name: "Back to sign in", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm your email", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Confirm your email", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Email address", { exact: true })
      .fill("new-person@example.test");
    f.state.confirmationFailure = true;
    await page
      .getByRole("button", { name: "Resend confirmation email", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Too many email requests",
    );
    f.state.confirmationFailure = false;
    await page
      .getByRole("button", { name: "Resend confirmation email", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "If this address is waiting for confirmation",
    );
    expect(f.state.confirmations).toHaveLength(2);
    expect(f.state.confirmations[1].redirectTo).toBe(
      new URL("/builder/", page.url()).href,
    );
    await capture(page, "resend");
    await page
      .getByRole("button", { name: "Back to sign in", exact: true })
      .click();
    await page
      .getByLabel("Email address", { exact: true })
      .fill("new-person@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("fixture-new-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "email is not confirmed yet",
    );
    expect(f.state.bootstrapActors).toHaveLength(0);
    expect(
      (
        await f.db.query(
          "select * from builder_account_initializations where user_id=$1",
          [accountNew],
        )
      ).rows,
    ).toHaveLength(0);
  } finally {
    await f.dispose();
  }
});
