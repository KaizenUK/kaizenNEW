import { test, expect } from "./browser-fixture";
import {
  accountFixture,
  accountPerson,
  accountOwner,
  accountOtherOwner,
} from "./account-fixture";
import { fixtureRoute } from "./fixture-routes";

test("account billing recovers one unfinished Checkout and reads the resulting plan on return", async ({
  page,
}) => {
  const fixture = await accountFixture(page, { billing: true });
  try {
    await expect(
      page.getByRole("heading", { name: "Current plan: Free" }),
    ).toBeVisible();
    const original = page.url();
    await fixtureRoute(page, "https://checkout.stripe.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>Fixture Stripe Checkout</h1>",
      }),
    );
    fixture.state.loseCheckoutResponse = true;
    await page
      .getByRole("button", { name: "Choose Plus", exact: true })
      .click();
    await expect(
      page.getByText(/earlier request may have completed/),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Refresh billing", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Reopen Plus Checkout" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Choose Agency" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Reopen Plus Checkout" }).click();
    await expect(
      page.getByRole("heading", { name: "Fixture Stripe Checkout" }),
    ).toBeVisible();
    expect(new Set(fixture.state.checkoutSessions).size).toBe(1);
    expect(
      (await fixture.db.query("select * from builder_billing_checkouts")).rows,
    ).toHaveLength(1);
    await fixture.db.query(
      "update builder_billing_checkouts set state='complete' where user_id=$1",
      [accountPerson],
    );
    await fixture.db.query(
      "insert into builder_subscriptions(id,user_id,plan_id,price_id,status,period_end,cancel_at_period_end) values('sub_fixture',$1,'plus','price_plus','active',now()+interval '1 month',false)",
      [accountPerson],
    );
    await page.goto(original + "&billing=returned&paid=true&plan=agency");
    await expect(
      page.getByRole("heading", { name: "Current plan: Plus" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Current plan: Agency" }),
    ).toHaveCount(0);
    expect(fixture.state.billingRequests.at(-1)?.action).toBe("refresh");
    await expect(page.getByRole("button", { name: "Choose Plus" })).toHaveCount(
      0,
    );
    await fixtureRoute(page, "https://billing.stripe.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>Fixture customer portal</h1>",
      }),
    );
    await page
      .getByRole("button", { name: "Manage billing", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Fixture customer portal" }),
    ).toBeVisible();
  } finally {
    await fixture.dispose();
  }
});

test("billing displays prices on desktop and phone and closes Checkout without buying another plan", async ({
  page,
}, testInfo) => {
  const fixture = await accountFixture(page, { billing: true });
  try {
    await expect(
      page.getByRole("heading", { name: "Current plan: Free" }),
    ).toBeVisible();
    for (const [label, width] of [
      ["desktop", 1440],
      ["phone", 390],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page
        .getByRole("heading", { name: "Plan and billing", exact: true })
        .scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.locator(".builder-billing").screenshot({
        path: `test-results/launch-billing-${testInfo.project.name}-${label}.png`,
      });
    }
    fixture.state.loseCheckoutResponse = true;
    await page
      .getByRole("button", { name: "Choose Plus", exact: true })
      .click();
    await expect(
      page.getByText(/earlier request may have completed/),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Refresh billing", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Close unfinished Checkout" })
      .click();
    await expect(page.getByText(/Checkout has closed/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Choose Agency" }),
    ).toBeEnabled();
    expect(
      (
        await fixture.db.query<any>(
          "select state from builder_billing_checkouts",
        )
      ).rows,
    ).toEqual([{ state: "expired" }]);
  } finally {
    await fixture.dispose();
  }
});

test("website owners confirm taking billing while editors see only website usage", async ({
  page,
}, testInfo) => {
  const fixture = await accountFixture(page, { billing: true });
  try {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const panel = page.getByRole("region", { name: "Website plan and usage" });
    await expect(panel).toContainText("another owner’s plan");
    await expect(
      panel.getByRole("button", { name: "Use my plan for this website" }),
    ).toHaveCount(0);
    await fixture.db.query(
      "update builder_project_members set role='owner' where project_id=$1 and user_id=$2",
      [fixture.project.id, accountPerson],
    );
    await panel
      .getByRole("button", { name: "Refresh website billing" })
      .click();
    await panel
      .getByRole("button", { name: "Use my plan for this website" })
      .click();
    await expect(
      page.getByRole("group", { name: "Confirm website billing" }),
    ).toBeFocused();
    for (const [label, width] of [
      ["desktop", 1440],
      ["phone", 390],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await panel.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await panel.screenshot({
        path: `test-results/launch-website-billing-${testInfo.project.name}-${label}.png`,
      });
    }
    await page.getByRole("button", { name: "Confirm use of my plan" }).click();
    await expect(panel).toContainText("This website now uses your plan");
    expect(
      (
        await fixture.db.query<any>(
          "select user_id from builder_project_billing where project_id=$1",
          [fixture.project.id],
        )
      ).rows,
    ).toEqual([{ user_id: accountPerson }]);
    await expect(panel).toContainText("Website plan: Free");
    await panel.getByRole("link", { name: "Manage my plan" }).click();
    await expect(
      page.getByRole("heading", { name: "Current plan: Free" }),
    ).toBeVisible();
    await fixture.switchAccount(accountOwner);
    await expect(
      page.getByRole("heading", { name: "Current plan: Private beta" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose Plus" })).toHaveCount(
      0,
    );
  } finally {
    await fixture.dispose();
  }
});

test("a smaller account cannot take a second website and can retry after another owner takes its first", async ({
  page,
}) => {
  const fixture = await accountFixture(page, { billing: true });
  try {
    await fixture.db.query(
      "update builder_project_members set role='owner' where user_id=$1",
      [accountPerson],
    );
    const other = (
      await fixture.db.query<any>(
        "select project_id from builder_project_members where user_id=$1 and project_id<>$2",
        [accountPerson, fixture.project.id],
      )
    ).rows[0].project_id;
    await fixture.db.query("select builder_take_project_billing($1,$2)", [
      other,
      accountPerson,
    ]);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const panel = page.getByRole("region", { name: "Website plan and usage" });
    await panel
      .getByRole("button", { name: "Use my plan for this website" })
      .click();
    await panel.getByRole("button", { name: "Confirm use of my plan" }).click();
    await expect(panel).toContainText("website limit is reached");
    expect(
      (
        await fixture.db.query<any>(
          "select user_id from builder_project_billing where project_id=$1",
          [fixture.project.id],
        )
      ).rows[0].user_id,
    ).toBe(accountOwner);
    await fixture.db.query("select builder_take_project_billing($1,$2)", [
      other,
      accountOtherOwner,
    ]);
    await panel
      .getByRole("button", { name: "Refresh website billing" })
      .click();
    await panel
      .getByRole("button", { name: "Use my plan for this website" })
      .click();
    await panel.getByRole("button", { name: "Confirm use of my plan" }).click();
    await expect(panel).toContainText("This website now uses your plan");
  } finally {
    await fixture.dispose();
  }
});
