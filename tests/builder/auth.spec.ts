import { test, expect, type Page } from "./browser-fixture";
import { accountFixture, accountPerson } from "./account-fixture";
async function capture(page: Page, state: string) {
  for (const [label, width, height] of [
    ["desktop", 1440, 1000],
    ["phone", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page.screenshot({
      path: `test-results/launch-auth-${state}-${label}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
test("an expired link offers a fresh reset request through the real SDK and preserves the website", async ({
  page,
}) => {
  const f = await accountFixture(page, { signedOut: true });
  try {
    await f.openPasswordLink("expired");
    await expect(page.getByRole("alert")).toContainText(
      "invalid or has expired",
    );
    await expect(
      page.getByRole("heading", { name: "Account", exact: true }),
    ).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("");
    await capture(page, "expired");
    await page
      .getByRole("button", { name: "Request a new password reset link" })
      .click();
    await page
      .getByLabel("Email address", { exact: true })
      .fill("alex@example.test");
    f.state.resetFailure = true;
    await page
      .getByRole("button", { name: "Send password reset link" })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "reset request" }),
    ).toContainText("may have sent an email");
    expect(f.state.resets).toHaveLength(1);
    f.state.resetFailure = false;
    await page
      .getByRole("button", { name: "Send password reset link" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "If this address has an account",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(f.state.resets).toHaveLength(2);
    const redirect = new URL(f.state.resets[1].redirectTo!);
    expect(redirect.origin).toBe(new URL(page.url()).origin);
    expect(redirect.searchParams.get("project")).toBe(f.project.id);
    expect(redirect.searchParams.get("password")).toBe("setup");
    await capture(page, "reset-requested");
  } finally {
    await f.dispose();
  }
});
test("a recovery link changes its account password once and a reused link preserves that sign-in", async ({
  page,
}) => {
  const f = await accountFixture(page, { signedOut: true });
  try {
    await f.openPasswordLink("recovery");
    await expect(
      page.getByRole("heading", { name: "Set your password", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Choose a password for alex@example.test.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByLabel("New password", { exact: true })
      .fill("new-recovery-password");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("new-recovery-password");
    await capture(page, "recovery");
    await page
      .getByRole("button", { name: "Save password and open builder" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Account", exact: true }),
    ).toBeVisible();
    expect(f.state.password).toBe("new-recovery-password");
    expect(f.state.updates).toHaveLength(1);
    expect(f.state.updates[0].actor).toBe(accountPerson);
    expect(
      (await f.readUser(accountPerson))!.user_metadata.builder_password_set,
    ).toBe(true);
    await f.openPasswordLink("recovery");
    await expect(
      page.getByRole("heading", { name: "This link could not be used" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Sign-in link unavailable" }),
    ).toContainText("still signed in as alex@example.test");
    await expect(page.getByLabel("New password", { exact: true })).toHaveCount(
      0,
    );
    await capture(page, "used");
    await page
      .getByRole("button", { name: "Continue with this account" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Account", exact: true }),
    ).toBeVisible();
    expect(f.state.updates).toHaveLength(1);
    expect(f.state.scopes).toHaveLength(0);
  } finally {
    await f.dispose();
  }
});
test("incorrect passwords and unfinished email confirmation have clear next steps without exposing provider text", async ({
  page,
}) => {
  const f = await accountFixture(page, { signedOut: true });
  try {
    await expect(
      page.getByRole("heading", { name: "Sign in to Kaizen Builder" }),
    ).toBeVisible();
    await page
      .getByLabel("Email address", { exact: true })
      .fill("alex@example.test");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "email address and password did not match",
    );
    await expect(page.getByRole("alert")).not.toContainText("Private fixture");
    await capture(page, "wrong-password");
    f.state.loginError = "email_not_confirmed";
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Open your latest confirmation or invitation email",
    );
    f.state.loginError = undefined;
    await page
      .getByLabel("Password", { exact: true })
      .fill("fixture-current-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Account", exact: true }),
    ).toBeVisible();
    expect(f.state.resets).toHaveLength(0);
    expect(f.state.updates).toHaveLength(0);
  } finally {
    await f.dispose();
  }
});
test("an invited account supplies its own name and password through the isolated real SDK before opening a website", async ({
  page,
}) => {
  const f = await accountFixture(page, { signedOut: true, invited: true });
  try {
    await f.openPasswordLink("invite");
    await expect(
      page.getByRole("heading", { name: "Set up your account" }),
    ).toBeVisible();
    await page.getByLabel("Your name", { exact: true }).fill("Alex Invited");
    await page
      .getByLabel("New password", { exact: true })
      .fill("invited-fixture-password");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("different-password");
    await page
      .getByRole("button", { name: "Save password and open builder" })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "passwords do not match",
    );
    expect(f.state.updates).toHaveLength(0);
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("invited-fixture-password");
    await page
      .getByRole("button", { name: "Save password and open builder" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Account", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Your name", exact: true }),
    ).toHaveValue("Alex Invited");
    expect((await f.readUser(accountPerson))!.user_metadata).toMatchObject({
      full_name: "Alex Invited",
      builder_password_set: true,
    });
    expect(f.state.updates).toHaveLength(1);
  } finally {
    await f.dispose();
  }
});
