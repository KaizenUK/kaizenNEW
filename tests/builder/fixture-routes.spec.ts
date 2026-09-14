import { createServer } from "node:http";
import { test, expect } from "./browser-fixture";
import { closeFixturePage, fixtureRoute } from "./fixture-routes";

test("fixture cleanup waits for overlapping responses after the page closes", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end("<title>Isolated route fixture</title>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture port");
  const origin = `http://127.0.0.1:${address.port}`;
  const started: string[] = [],
    completed: string[] = [];
  try {
    await page.goto(origin);
    await fixtureRoute(page, `${origin}/*.json`, async (route) => {
      const name = new URL(route.request().url()).pathname;
      started.push(name);
      await held;
      // Read through the still-live API context, as the hosted fixtures do.
      const response = await page.request.get(origin);
      expect(await response.text()).toContain("Isolated route fixture");
      await route.fulfill({ json: { name } });
      completed.push(name);
    });
    await page.evaluate(() => {
      // Closing the page cancels its fetches; handler failures still fail the test.
      void fetch("/first.json").catch(() => {});
      void fetch("/second.json").catch(() => {});
    });
    await expect.poll(() => started.length).toBe(2);
    let drained = false;
    const closing = closeFixturePage(page).then(() => {
      drained = true;
    });
    await expect.poll(() => page.isClosed()).toBe(true);
    expect(drained).toBe(false);
    release();
    await closing;
    expect(completed.sort()).toEqual(["/first.json", "/second.json"]);
  } finally {
    release();
    await closeFixturePage(page);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
