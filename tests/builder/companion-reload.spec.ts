import { test, expect } from "./browser-fixture";
import { createServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { builderCompanionUiPlugin } from "../../scripts/builder-companion-ui";

test("M1-T4: the approved helper window survives development reloads and still disconnects explicitly", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-helper-reload-"));
  const parentOrigin = "https://builder.example";
  // This fixture isolates the window lifecycle. companion.spec.ts exercises
  // the same UI with real folder approval, capabilities and filesystem edits.
  const token = "fixture-token";
  let connected = false,
    disconnects = 0;
  const server = await createServer({
    configFile: false,
    envDir: false,
    root,
    server: { host: "127.0.0.1", port: 0, strictPort: true },
    plugins: [
      builderCompanionUiPlugin(process.cwd()),
      {
        name: "isolated-companion-lifecycle-fixture",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const pathname = new URL(req.url!, "http://localhost").pathname;
            if (pathname === "/control") {
              res.setHeader("Content-Type", "text/html");
              res.end(
                await server.transformIndexHtml(
                  "/control",
                  "<html><body><h1>Development page</h1></body></html>",
                ),
              );
              return;
            }
            if (
              !["/__builder-companion", "/__builder-local"].includes(pathname)
            )
              return next();
            let text = "";
            for await (const chunk of req) text += chunk;
            const input = text ? JSON.parse(text) : {};
            res.setHeader("Content-Type", "application/json");
            if (req.method === "GET")
              res.end(JSON.stringify({ origins: [parentOrigin], root }));
            else if (
              pathname === "/__builder-companion" &&
              input.action === "connect"
            ) {
              connected = true;
              res.end(
                JSON.stringify({
                  token,
                  root,
                  projectId: "fixture",
                  expiresAt: Date.now() + 7200000,
                }),
              );
            } else if (
              pathname === "/__builder-companion" &&
              input.action === "disconnect"
            ) {
              connected = false;
              disconnects++;
              res.end("{}");
            } else if (connected && input.connection === token)
              res.end(
                JSON.stringify({
                  message: "Folder connection is still active",
                }),
              );
            else {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "Not connected" }));
            }
          });
        },
      },
    ],
  });
  try {
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === "string")
      throw new Error("Missing fixture port");
    const helperOrigin = `http://127.0.0.1:${address.port}`;
    const channel = randomUUID();
    await context.grantPermissions(["local-network-access"], {
      origin: parentOrigin,
    });
    await page.route(`${parentOrigin}/**`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<html><body><button id="open">Connect helper</button><button id="probe">Check connection</button><p id="status"></p><script>
        let helper;
        const channel=${JSON.stringify(channel)}, helperOrigin=${JSON.stringify(helperOrigin)};
        document.querySelector('#open').onclick=()=>helper=window.open(helperOrigin+'/builder/companion/#channel='+channel+'&origin='+encodeURIComponent(location.origin));
        document.querySelector('#probe').onclick=()=>helper.postMessage({type:'kaizen-companion-request',channel,id:${JSON.stringify(randomUUID())},input:{action:'probe'}},helperOrigin);
        addEventListener('message',event=>{
          if(event.source!==helper||event.origin!==helperOrigin||event.data.channel!==channel)return;
          if(event.data.type==='kaizen-companion-ready')helper.postMessage({type:'kaizen-companion-init',channel,identity:{origin:location.origin,accountId:'fixture',projectId:'fixture',projectName:'Reload fixture'}},helperOrigin);
          if(event.data.type==='kaizen-companion-connected')document.querySelector('#status').textContent='Connected';
          if(event.data.type==='kaizen-companion-result')document.querySelector('#status').textContent=event.data.result?.message||event.data.error;
          if(event.data.type==='kaizen-companion-ping')helper.postMessage({type:'kaizen-companion-pong',channel},helperOrigin);
        });
      </script></body></html>`,
      }),
    );
    await page.goto(parentOrigin);
    const opened = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Connect helper" }).click();
    const helper = await opened;
    await expect(
      helper.getByRole("button", { name: "Allow this folder" }),
    ).toBeVisible();
    await helper.getByRole("button", { name: "Allow this folder" }).click();
    await expect(page.locator("#status")).toHaveText("Connected");
    let navigations = 0;
    helper.on("framenavigated", () => navigations++);
    expect(await helper.locator('script[src*="/@vite/client"]').count()).toBe(
      0,
    );
    const html = await (
      await fetch(`${helperOrigin}/builder/companion/`)
    ).text();
    expect(html).toContain("/__builder-companion-ui/");
    expect(html).not.toContain("/@vite/client");
    const control = await context.newPage();
    await control.goto(`${helperOrigin}/control`);
    await expect(control.getByRole("heading")).toHaveText("Development page");
    await expect.poll(() => server.ws.clients.size).toBeGreaterThan(0);
    const reloaded = control.waitForEvent("framenavigated");
    server.ws.send({ type: "full-reload", path: "*" });
    await reloaded;
    await page.getByRole("button", { name: "Check connection" }).click();
    await expect(page.locator("#status")).toHaveText(
      "Folder connection is still active",
    );
    expect(navigations).toBe(0);
    expect(disconnects).toBe(0);
    await helper
      .getByRole("button", { name: "Stop sharing this folder" })
      .click();
    await expect.poll(() => disconnects).toBe(1);
    expect(connected).toBe(false);
    await helper.close();
    await control.close();
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
