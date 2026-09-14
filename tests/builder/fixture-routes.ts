import type { Page } from "@playwright/test";

const pendingRoutes = new WeakMap<Page, Set<Promise<void>>>();

/** Keep fixture services and API response bodies alive until intercepted work ends. */
export async function fixtureRoute(
  page: Page,
  pattern: Parameters<Page["route"]>[0],
  handler: Parameters<Page["route"]>[1],
  options: { context?: boolean; times?: number } = {},
) {
  let pending = pendingRoutes.get(page);
  if (!pending) pendingRoutes.set(page, (pending = new Set()));
  const requests = pending;
  await (options.context ? page.context() : page).route(
    pattern,
    async (route, request) => {
      let finish!: () => void;
      const complete = new Promise<void>((resolve) => {
        finish = resolve;
      });
      requests.add(complete);
      try {
        await handler(route, request);
      } finally {
        requests.delete(complete);
        finish();
      }
    },
    { times: options.times },
  );
}

export async function closeFixturePage(page: Page) {
  // Stop the page generating requests before draining. Removing routes on an
  // open page can continue a slow request while its fixture handler is replying.
  if (!page.isClosed()) await page.close();
  const pending = pendingRoutes.get(page);
  while (pending?.size) await Promise.all([...pending]);
}
