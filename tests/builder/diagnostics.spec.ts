import { test, expect } from "./browser-fixture";
import { readFile } from "node:fs/promises";

test("hosted failures report safely without interrupting Settings, and stop at sign-out", async ({
  page,
  context,
}) => {
  const project = "11111111-1111-4111-8111-111111111111";
  const received: { body: any; authorization: string | undefined }[] = [];
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/client/visual-builder/builderMode.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export const builderCloudEnabled=true; export const localBuilderRequested=false;",
    }),
  );
  // Only identity/catalogue and the remote API are fixtures. Mount the real signed-in
  // builder, storage wrapper, browser listener, reporter and Settings UI.
  await page.route("**/client/lib/supabase.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `const callbacks=new Set();let session={user:{id:'22222222-2222-4222-8222-222222222222',email:'fixture@example.invalid',user_metadata:{}},access_token:'fixture-private-access-token'};
      window.fixtureSignOut=()=>{session=null;for(const fn of callbacks)fn('SIGNED_OUT',null)};
      const client={auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:fn=>{callbacks.add(fn);return {data:{subscription:{unsubscribe:()=>callbacks.delete(fn)}}}},signOut:async()=>window.fixtureSignOut()},
      functions:{invoke:async(name,options)=>{
        const action=options.body.action;
        if(action==='list') return {data:[{id:'${project}',name:'Beta fixture',archived:false,version:1,capabilities:{hasInventory:false,legacyWorkspace:false,publishPath:'worker'},access:{role:'owner',canPublish:true},destination:{kind:'unconfigured',label:'Not connected'}}],error:null};
        if(action==='record-error') {const response=await fetch('/__fixture-error-sink',{method:'POST',headers:{'Content-Type':'application/json',...options.headers},body:JSON.stringify(options.body),signal:options.signal});return {data:await response.json(),error:response.ok?null:{message:'Network report unavailable'}};}
        return {data:null,error:{message:'Network failed: fixture-private-workspace-token'}};
      }}};
      export const getSupabaseClient=()=>client;`,
    }),
  );
  await page.route("**/__fixture-error-sink", async (route) => {
    received.push({
      body: route.request().postDataJSON(),
      authorization: route.request().headers().authorization,
    });
    await route.fulfill({
      status: received.length === 1 ? 200 : 503,
      json: { recorded: received.length === 1 },
    });
  });
  await page.goto(`/builder/?project=${project}`);
  await expect.poll(() => received.length).toBe(1);
  expect(received[0].body).toMatchObject({
    action: "record-error",
    projectId: project,
    report: { lastError: { category: "network", source: "workspace" } },
  });
  expect(received[0].authorization).toBe("Bearer fixture-private-access-token");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText(/Safe error summaries are sent/)).toBeVisible();
  await page.evaluate(async () => {
    const { storage } = await import(
      "/client/visual-builder/storage.ts" as string
    );
    try {
      await storage.repository({
        action: "repository-git-status",
        root: "/fixture-only",
      });
    } catch {
      /* Actual helper access failure is observed by the storage wrapper. */
    }
  });
  await expect
    .poll(() =>
      received.some((item) => item.body.report.lastError.source === "helper"),
    )
    .toBe(true);
  await page.evaluate(() =>
    window.dispatchEvent(
      new ErrorEvent("error", {
        error: new Error("Build failed: fixture-private-browser-token"),
      }),
    ),
  );
  await expect
    .poll(() =>
      received.some((item) => item.body.report.lastError.source === "browser"),
    )
    .toBe(true);
  expect(JSON.stringify(received.map((item) => item.body))).not.toContain(
    "fixture-private",
  );
  await page
    .getByRole("button", { name: "Report a problem", exact: true })
    .click();
  await expect(page.getByText(/Report copied/)).toBeVisible();
  expect(
    await page.evaluate(() => navigator.clipboard.readText()),
  ).not.toContain("fixture-private");
  await page.screenshot({
    path: "test-results/launch-error-reporting-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("heading", { name: "Settings", exact: true })
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await page.screenshot({
    path: "test-results/launch-error-reporting-phone.png",
  });
  await page.evaluate(() => (window as any).fixtureSignOut());
  await expect(
    page.getByRole("heading", { name: "Sign in to Kaizen Builder" }),
  ).toBeVisible();
  const count = received.length;
  await page.evaluate(() =>
    window.dispatchEvent(
      new ErrorEvent("error", {
        error: new Error("Network failed after sign-out"),
      }),
    ),
  );
  // A UI action yields the event loop without a fixed sleep or an unbounded retry.
  await page.getByLabel("Email address").fill("next@example.invalid");
  expect(received).toHaveLength(count);
});

test("private beta settings copy a safe problem report and offer a matching download", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/builder/");
  await expect(page.getByText("Private beta", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const api = await import("/client/visual-builder/diagnostics.ts" as string);
    api.setDiagnosticPage({
      screen: "website-editor",
      route: "/about/?token=fixture-private-token",
    });
    api.recordBuilderError(
      new Error("Build failed with fixture-private-token"),
      "helper",
    );
  });
  await page
    .getByRole("button", { name: "Report a problem", exact: true })
    .click();
  await expect(page.getByText(/Report copied/)).toBeVisible();
  const reportText = await page.evaluate(() => navigator.clipboard.readText());
  const report = JSON.parse(reportText);
  expect(report.projectId).toBe("kaizen");
  expect(report.page.screen).toBe("website-editor");
  expect(report.page.routeHash).toMatch(/^[0-9a-f]{64}$/);
  expect(report.lastError.category).toBe("build");
  expect(reportText).not.toContain("fixture-private-token");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download report", exact: true })
    .click();
  expect(await readFile((await (await download).path())!, "utf8")).toBe(
    reportText,
  );
  await page.screenshot({
    path: "test-results/launch-beta-settings-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("heading", { name: "Settings", exact: true })
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await page.screenshot({
    path: "test-results/launch-beta-settings-phone.png",
  });
});

test("a failed workspace can still produce a report when clipboard access is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Clipboard unavailable");
        },
      },
      configurable: true,
    }),
  );
  await page.route("**/__builder-local?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Network failed: fixture-private-key" }),
    }),
  );
  await page.goto("/builder/");
  await expect(
    page
      .getByText("Network failed: fixture-private-key", { exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText(/Project details are unavailable/)).toBeVisible();
  await page
    .getByRole("button", { name: "Report a problem", exact: true })
    .click();
  await expect(page.getByText(/Download it instead/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download report", exact: true })
    .click();
  const text = await readFile((await (await download).path())!, "utf8");
  expect(JSON.parse(text).lastError.category).toBe("network");
  expect(text).not.toContain("fixture-private-key");
});
