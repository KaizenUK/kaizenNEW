import { test, expect } from "./browser-fixture";

test("hosted media presentation renews in a real browser without resetting open controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  // Only configuration/Auth/Storage are doubles. Exercise the actual provider,
  // renewal scheduler and renderer modules from the isolated development server.
  await page.route("**/client/lib/supabase.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
    export const createIsolatedSupabaseClient=()=>{throw new Error('Account changes are outside this fixture');};
    export function getSupabaseClient() { return {
      auth: {
        initialize: async () => ({error:null}),
        getSession: async () => ({data:{session:{user:{id:'fixture-owner'},access_token:'fixture-token'}},error:null}),
        onAuthStateChange: callback => {window.fixtureAuth=callback;return {data:{subscription:{unsubscribe(){}}}};}
      },
      functions: {invoke: async () => ({data:[{id:'11111111-1111-4111-8111-111111111111',capabilities:{hasInventory:false,legacyWorkspace:false,publishPath:'worker'}}],error:null})},
      storage: {from: () => ({createSignedUrl: async () => {
        window.fixtureSigns=(window.fixtureSigns||0)+1;
        if(window.fixtureDenied)return {data:null,error:{message:'Fixture access denied'}};
        return {data:{signedUrl:location.origin+'/__fixture-media?generation='+window.fixtureSigns},error:null};
      }})}
    }; }
  `,
    }),
  );
  await page.route("**/client/visual-builder/builderMode.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export const builderCloudEnabled = true;",
    }),
  );
  await page.route("**/__fixture-media?*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="purple"/></svg>',
    }),
  );
  await page.route("**/__hosted-media-fixture?*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client/visual-builder/builder.css"><script>window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="fixture"></div><script type="module">
    import React from '/test-results/builder-vite-cache/deps/react.js';
    import ReactDOM from '/test-results/builder-vite-cache/deps/react-dom_client.js';
    import {HostedMediaProvider} from '/client/visual-builder/HostedMediaProvider.tsx';
    import PublishedPage from '/client/visual-builder/Renderer.tsx';
    import {newDocument,starterBlocks} from '/client/visual-builder/starters.ts';
    import {projectMediaUrl,canonicalProjectData} from '/client/visual-builder/cloudProjects.ts';
    const canonical='/builder-project-media/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222';
    const signed=await projectMediaUrl(canonical), document=newDocument('Hosted media fixture','media',false), image=starterBlocks.Image(), menu=starterBlocks.Menu();
    image.props.src=signed;image.props.alt='Client fixture image';document.data.content=[menu,image];
    window.fixtureDocument=document;window.fixtureOriginal=JSON.stringify(document);window.fixtureCanonical=()=>canonicalProjectData(document);
    ReactDOM.createRoot(window.document.getElementById('fixture')).render(React.createElement(HostedMediaProvider,null,
      React.createElement('label',null,'Unsaved note',React.createElement('input',{defaultValue:'Original note'})),
      React.createElement(PublishedPage,{document})));
  </script></body></html>`,
    }),
  );
  await page.goto(
    "/__hosted-media-fixture?project=11111111-1111-4111-8111-111111111111",
  );
  const picture = page.getByAltText("Client fixture image");
  await expect(picture).toHaveAttribute("src", /generation=1$/);
  await page.getByLabel("Unsaved note").fill("Newer unsaved edit");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("summary").click();
  await page.clock.fastForward(51 * 60_000);
  await expect(picture).toHaveAttribute("src", /generation=2$/);
  await expect(page.locator("details")).toHaveAttribute("open", "");
  await expect(page.getByLabel("Unsaved note")).toHaveValue(
    "Newer unsaved edit",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.stringify((window as any).fixtureDocument) ===
        (window as any).fixtureOriginal,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    (window as any).fixtureDenied = true;
  });
  await page.clock.fastForward(61 * 60_000);
  await expect(page.getByRole("status")).toContainText("edits are unchanged");
  await expect(picture).toHaveCount(0);
  const notice = page.getByRole("status");
  await expect(notice).toHaveCSS("background-color", "rgb(27, 29, 33)");
  const bounds = await notice.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/hosted-media-retry-390.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    (window as any).fixtureDenied = false;
  });
  await page.getByRole("button", { name: "Retry media" }).click();
  await expect(picture).toBeVisible();
  await expect(page.getByLabel("Unsaved note")).toHaveValue(
    "Newer unsaved edit",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(picture).toBeVisible();
  expect(errors).toEqual([]);
});
