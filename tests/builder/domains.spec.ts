import { test, expect } from "./browser-fixture";
import { domainFixture } from "./domain-fixture";
import { accountPerson } from "./account-fixture";
import type { Page } from "./browser-fixture";
import { newDocument } from "../../client/visual-builder/starters";
import AxeBuilder from "@axe-core/playwright";

const domainPanel = (page: Page) =>
  page.getByRole("region", { name: "Website domain", exact: true });
async function addDomain(page: Page, hostname: string) {
  const panel = domainPanel(page);
  await panel
    .getByRole("textbox", { name: "Domain name", exact: true })
    .fill(hostname);
  await panel.getByRole("button", { name: "Add domain", exact: true }).click();
}

test("owner connects a domain, finds its release destination and confirms removal while preserving saved work", async ({
  page,
}, testInfo) => {
  const fixture = await domainFixture(page);
  const hostname = "garden.fixture.co.uk";
  try {
    const saved = await page.request.post(
      `/__builder-local?project=${fixture.project.id}`,
      {
        headers: { "X-Kaizen-Builder": "1" },
        data: {
          action: "save",
          id: crypto.randomUUID(),
          version: 0,
          document: newDocument("Saved garden page", "garden", false),
        },
      },
    );
    expect(saved.ok(), await saved.text()).toBe(true);
    await fixture.db.query(
      "update builder_project_workspaces set payload=jsonb_set(payload,'{pages}',$2::jsonb) where project_id=$1",
      [fixture.project.id, JSON.stringify([await saved.json()])],
    );
    await page.goto(`/builder/?project=${fixture.project.id}&view=settings`);
    const panel = page.getByRole("region", {
      name: "Website domain",
      exact: true,
    });
    await panel
      .getByRole("textbox", { name: "Domain name", exact: true })
      .fill(hostname);
    await panel
      .getByRole("button", { name: "Add domain", exact: true })
      .click();
    await expect(panel).toContainText("Waiting for DNS");
    await expect(panel).toContainText(`_kaizen-verification.${hostname}`);
    await expect(panel).toContainText("144.91.72.17");
    const originalDomain = await fixture.currentDomain();
    const workspace = (
      await fixture.db.query<any>(
        "select payload from builder_project_workspaces where project_id=$1",
        [fixture.project.id],
      )
    ).rows[0].payload;
    const screenshot = async (state: string) => {
      for (const [label, width] of [
        ["desktop", 1440],
        ["phone", 390],
      ] as const) {
        await page.setViewportSize({ width, height: 1100 });
        await panel.scrollIntoViewIfNeeded();
        await panel.screenshot({
          path: `test-results/launch-domain-${state}-${testInfo.project.name}-${label}.png`,
        });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          JSON.stringify(
            await page.evaluate(() =>
              [...document.querySelectorAll("body *")]
                .filter(
                  (element) =>
                    element.getBoundingClientRect().right > innerWidth,
                )
                .slice(-12)
                .map((element) => ({
                  tag: element.tagName,
                  className: element.className,
                  width: element.getBoundingClientRect().width,
                })),
            ),
          ),
        ).toBe(width);
      }
    };
    await screenshot("dns");
    const accessibility = await new AxeBuilder({ page })
      .include(".builder-domains")
      .analyze();
    expect(
      accessibility.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact || ""),
      ),
    ).toEqual([]);
    await panel
      .getByRole("button", { name: "Check domain", exact: true })
      .click();
    await expect(panel).toContainText("Checking domain");
    await fixture.advanceDomain("provisioning");
    await expect(panel).toContainText("Setting up HTTPS");
    await expect(
      panel.getByRole("link", { name: "Open website", exact: true }),
    ).toHaveCount(0);
    await fixture.advanceDomain("connected");
    await expect(panel).toContainText("HTTPS is ready");
    await expect(
      panel.getByRole("link", { name: "Open website", exact: true }),
    ).toHaveAttribute("href", `https://${hostname}`);
    await screenshot("connected");
    await expect(page.locator(".builder-project-identity")).toContainText(
      `https://${hostname}`,
    );
    await panel
      .getByRole("link", { name: "Open Releases", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Releases", exact: true }),
    ).toBeVisible();
    const destination = page.getByRole("combobox", {
      name: "Choose destination",
      exact: true,
    });
    await expect(destination).toContainText(hostname);
    await destination.selectOption(originalDomain.candidate_destination_id);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await panel
      .getByRole("button", { name: "Remove domain", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      panel.getByRole("group", { name: "Confirm domain removal" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      panel.getByRole("button", { name: "Confirm removal", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(
      panel.getByRole("button", { name: "Remove domain", exact: true }),
    ).toBeFocused();
    expect((await fixture.currentDomain()).operation).toBe("connect");
    await panel
      .getByRole("button", { name: "Remove domain", exact: true })
      .click();
    await screenshot("remove");
    await panel
      .getByRole("button", { name: "Confirm removal", exact: true })
      .click();
    await expect(panel).toContainText("Removing domain");
    await fixture.advanceDomain("removed");
    await expect(
      panel.getByRole("textbox", { name: "Domain name", exact: true }),
    ).toBeVisible();
    await panel.getByText("Removed domains", { exact: true }).click();
    await expect(panel.locator(".builder-domain-history")).toContainText(
      hostname,
    );
    expect(
      (
        await fixture.db.query<any>(
          "select payload from builder_project_workspaces where project_id=$1",
          [fixture.project.id],
        )
      ).rows[0].payload,
    ).toEqual(workspace);
    expect(
      (
        await fixture.db.query<any>(
          "select enabled from builder_client_destinations where id=$1",
          [originalDomain.candidate_destination_id],
        )
      ).rows[0].enabled,
    ).toBe(false);
    await page.getByRole("button", { name: "Pages", exact: true }).click();
    await expect(
      page.getByText("Saved garden page", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await panel
      .getByRole("textbox", { name: "Domain name", exact: true })
      .fill(hostname);
    await panel
      .getByRole("button", { name: "Add domain", exact: true })
      .click();
    await expect(panel).toContainText("Waiting for DNS");
    const fresh = await fixture.currentDomain();
    expect(fresh.id).not.toBe(originalDomain.id);
    expect(fresh.verification_token).not.toBe(
      originalDomain.verification_token,
    );
  } finally {
    await fixture.dispose();
  }
});

test("a lost add response recovers one domain and DNS or HTTPS failures remain retryable", async ({
  page,
}) => {
  const fixture = await domainFixture(page);
  try {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const panel = domainPanel(page);
    fixture.state.loseDomainResponse = true;
    await addDomain(page, "recovery.fixture.co.uk");
    await expect(panel).toContainText(
      "earlier domain request may have completed",
    );
    await expect(
      panel.getByRole("button", { name: "Add domain", exact: true }),
    ).toHaveCount(0);
    const original = await fixture.currentDomain();
    await panel
      .getByRole("button", { name: "Refresh domain status", exact: true })
      .click();
    await expect(panel).toContainText("Waiting for DNS");
    expect(
      (await fixture.db.query("select id from builder_domains")).rows,
    ).toHaveLength(1);
    expect(
      fixture.state.domainRequests.filter(
        (request) => request.action === "domain-add",
      ),
    ).toHaveLength(1);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as any).__domainCopied = value;
          },
        },
      });
    });
    await panel
      .getByRole("button", { name: "Copy TXT value", exact: true })
      .click();
    await expect(panel).toContainText("TXT value copied.");
    expect(await page.evaluate(() => (window as any).__domainCopied)).toBe(
      `kaizen-domain-verification=${original.verification_token}`,
    );
    await panel
      .getByRole("button", { name: "Check domain", exact: true })
      .click();
    await expect(panel).toContainText("Checking domain");
    await fixture.advanceDomain("ownership_missing");
    await expect(panel).toContainText("verification record was not found");
    await expect(
      panel.getByRole("link", { name: "Open website", exact: true }),
    ).toHaveCount(0);
    await panel
      .getByRole("button", { name: "Check domain", exact: true })
      .click();
    await expect(panel).toContainText("Checking domain");
    await fixture.advanceDomain("tls_pending");
    await expect(panel).toContainText("HTTPS is not ready yet");
    await expect(
      panel.getByRole("link", { name: "Open website", exact: true }),
    ).toHaveCount(0);
    await panel
      .getByRole("button", { name: "Check domain", exact: true })
      .click();
    await expect(panel).toContainText("Checking domain");
    await fixture.advanceDomain("connected");
    await expect(panel).toContainText("HTTPS is ready");
    expect((await fixture.currentDomain()).id).toBe(original.id);
  } finally {
    await fixture.dispose();
  }
});

test("domain controls follow owner publishing permission and allow removal after archival", async ({
  page,
}) => {
  const fixture = await domainFixture(page, false);
  try {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const panel = domainPanel(page);
    await expect(panel).toContainText("An owner with publishing permission");
    await expect(
      panel.getByRole("button", { name: "Add domain", exact: true }),
    ).toHaveCount(0);
    await fixture.db.query(
      "update builder_project_members set role='owner',can_publish=false where project_id=$1 and user_id=$2",
      [fixture.project.id, accountPerson],
    );
    await panel
      .getByRole("button", { name: "Refresh domain status", exact: true })
      .click();
    await expect(panel).toContainText("An owner with publishing permission");
    await expect(
      panel.getByRole("button", { name: "Add domain", exact: true }),
    ).toHaveCount(0);
    await fixture.db.query(
      "update builder_project_members set can_publish=true where project_id=$1 and user_id=$2",
      [fixture.project.id, accountPerson],
    );
    await panel
      .getByRole("button", { name: "Refresh domain status", exact: true })
      .click();
    await addDomain(page, "archived.fixture.co.uk");
    await expect(panel).toContainText("Waiting for DNS");
    await fixture.db.query(
      "update builder_projects set archived=true where id=$1",
      [fixture.project.id],
    );
    await panel
      .getByRole("button", { name: "Refresh domain status", exact: true })
      .click();
    await expect(panel).toContainText("This website is archived");
    await expect(
      panel.getByRole("button", { name: "Check domain", exact: true }),
    ).toHaveCount(0);
    await panel
      .getByRole("button", { name: "Remove domain", exact: true })
      .click();
    await panel
      .getByRole("button", { name: "Confirm removal", exact: true })
      .click();
    await expect(panel).toContainText("Removing domain");
    // Already-authorized cleanup must finish even after the requester loses access.
    await fixture.db.query(
      "update builder_project_members set role='editor',can_publish=false where project_id=$1 and user_id=$2",
      [fixture.project.id, accountPerson],
    );
    await fixture.advanceDomain("removed");
    await expect(panel).toContainText("No domain is connected");
    await expect(panel).toContainText("An owner with publishing permission");
    await expect(
      panel.getByRole("button", { name: "Add domain", exact: true }),
    ).toHaveCount(0);
  } finally {
    await fixture.dispose();
  }
});

test("an additional domain preserves the existing publication destination on removal", async ({
  page,
}) => {
  const fixture = await domainFixture(page);
  const destinationId = crypto.randomUUID();
  try {
    await fixture.db.query(
      "insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id) values($1,$2,'production','https://original.fixture.co.uk','Existing website','client-worker','baseline')",
      [destinationId, fixture.project.id],
    );
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const panel = domainPanel(page);
    await addDomain(page, "additional.fixture.co.uk");
    await expect(panel).toContainText(
      "Your existing website address will keep working",
    );
    await panel
      .getByRole("button", { name: "Check domain", exact: true })
      .click();
    await expect(panel).toContainText("Checking domain");
    await fixture.advanceDomain("connected");
    await expect(panel).toContainText(
      "additional address for your existing published website",
    );
    await expect(
      panel.getByRole("link", { name: "Open Releases", exact: true }),
    ).toHaveCount(0);
    await panel
      .getByRole("button", { name: "Remove domain", exact: true })
      .click();
    await expect(
      panel.getByRole("group", { name: "Confirm domain removal" }),
    ).toContainText("Your existing website address will keep working");
    await panel
      .getByRole("button", { name: "Confirm removal", exact: true })
      .click();
    await expect(panel).toContainText("Removing domain");
    await fixture.advanceDomain("removed");
    await expect(
      panel.getByRole("button", { name: "Add domain", exact: true }),
    ).toBeVisible();
    expect(
      (
        await fixture.db.query(
          "select id,origin,active_artifact_id,enabled from builder_client_destinations where project_id=$1",
          [fixture.project.id],
        )
      ).rows,
    ).toEqual([
      {
        id: destinationId,
        origin: "https://original.fixture.co.uk",
        active_artifact_id: "baseline",
        enabled: true,
      },
    ]);
  } finally {
    await fixture.dispose();
  }
});

test("Releases directs a website without a destination to domain settings", async ({
  page,
}) => {
  const fixture = await domainFixture(page);
  try {
    await page.getByRole("button", { name: "Releases", exact: true }).click();
    await page
      .getByRole("button", { name: "Open domain settings", exact: true })
      .click();
    await expect(
      domainPanel(page).getByRole("textbox", {
        name: "Domain name",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      fixture.state.domainRequests.every(
        (request) => request.action === "domain-state",
      ),
    ).toBe(true);
  } finally {
    await fixture.dispose();
  }
});
