import { test, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile, readFile, lstat } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import {
  bindClientStore,
  stageRelease,
  initialiseStore,
  checkLive,
} from "../../scripts/kaizen-releases.mjs";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";

test("Unity publishes a frozen client project, preserves newer drafts, rolls back and unpublishes through real Nginx", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  const run = promisify(execFile),
    binary = process.env.KAIZEN_NGINX_BINARY || "nginx";
  try {
    await run(binary, ["-v"], { windowsHide: true });
  } catch (error) {
    if (process.env.CI) throw error;
    test.skip(
      true,
      "Install Nginx or set KAIZEN_NGINX_BINARY for the real publication test.",
    );
  }
  const headers = { "X-Kaizen-Builder": "1" };
  const project = await (
    await page.request.post("/__builder-projects", {
      headers,
      data: { action: "create", name: "Published client fixture" },
    })
  ).json();
  const other = await (
    await page.request.post("/__builder-projects", {
      headers,
      data: { action: "create", name: "Unrelated publication fixture" },
    })
  ).json();
  const api = async (data: any) => {
    const response = await page.request.post(
      `/__builder-local?project=${project.id}`,
      { headers, data },
    );
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  const bytes = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70"><rect width="100" height="70" fill="purple"/></svg>',
  );
  const metadata = {
    id: randomUUID(),
    hash: createHash("sha256").update(bytes).digest("hex"),
    name: "client-logo.svg",
    path: "client-logo.svg",
    pack: "Client identity",
    mime: "image/svg+xml",
    kind: "icon",
    size: bytes.length,
    url: "",
    tags: [],
    favourite: false,
    createdAt: new Date().toISOString(),
  };
  const uploaded = await page.request.post(
    `/__builder-local?project=${project.id}&action=upload`,
    {
      headers: {
        ...headers,
        "X-Asset-Metadata": encodeURIComponent(JSON.stringify(metadata)),
        "Content-Type": metadata.mime,
      },
      data: bytes,
    },
  );
  expect(uploaded.ok()).toBe(true);
  const asset = await uploaded.json();
  const document = newDocument("Published about", "about", false),
    text = starterBlocks.Text(),
    menu = starterBlocks.Menu(),
    picture = starterBlocks.Image();
  text.props.text = "Reviewed original content";
  menu.props.links = [
    { label: "About", href: "/about/" },
    { label: "Contact", href: "/contact/" },
  ];
  picture.props.src = asset.url;
  picture.props.alt = "Client purple logo";
  document.data.content = [menu, text, picture];
  let saved = await api({
    action: "save",
    id: randomUUID(),
    version: 0,
    document,
  });
  const contact = newDocument("Client contact", "contact", false);
  const contactText = starterBlocks.Text();
  contactText.props.text = "Client contact page";
  contact.data.content = [menu, contactText];
  await api({
    action: "save",
    id: randomUUID(),
    version: 0,
    document: contact,
  });
  const prefix = path.resolve("test-results/builder-client-nginx");
  await mkdir(path.join(prefix, "logs"), { recursive: true });
  await mkdir(path.join(prefix, "temp"), { recursive: true });
  try {
    const pid = Number(
      await readFile(path.join(prefix, "logs/nginx.pid"), "utf8"),
    );
    try {
      process.kill(pid, 0);
      throw new Error(
        `An existing test Nginx process ${pid} still owns this prefix.`,
      );
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const root = await mkdtemp(path.join(prefix, "case-")),
    source = path.join(root, "baseline"),
    store = path.join(root, "store");
  await mkdir(source);
  await writeFile(
    path.join(source, "index.html"),
    "<!doctype html><h1>Initial destination</h1>",
  );
  const reservation = createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const port = (reservation.address() as any).port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`,
    client = {
      projectId: project.id,
      destinationId: randomUUID(),
      environment: "production",
      origin,
    };
  await bindClientStore({ store, client });
  const baseline = await stageRelease({ store, client, source, id: "initial" });
  await initialiseStore({ store, id: baseline.id });
  const forward = (value: string) => value.replace(/\\/g, "/");
  await writeFile(
    path.join(prefix, "nginx.conf"),
    `daemon off; master_process on; worker_processes 1; worker_shutdown_timeout 5s; pid logs/nginx.pid; error_log logs/error.log notice; events {worker_connections 128;} http {types {text/html html; text/css css; application/javascript js; image/svg+xml svg; application/json json;} access_log off; keepalive_timeout 1s; client_body_temp_path temp/client_body; proxy_temp_path temp/proxy; fastcgi_temp_path temp/fastcgi; uwsgi_temp_path temp/uwsgi; scgi_temp_path temp/scgi; server {listen 127.0.0.1:${port};server_name localhost;include "${forward(path.join(store, "active.conf"))}";index index.html;location / {try_files $uri $uri/ =404;}}}`,
  );
  await writeFile(
    path.resolve("test-results/builder-client-destinations.json"),
    JSON.stringify({
      schemaVersion: 1,
      destinations: [{ ...client, label: "Client production fixture", store }],
    }),
  );
  const nginx = (args: string[]) =>
    run(binary, ["-p", `${forward(prefix)}/`, "-c", "nginx.conf", ...args], {
      cwd: prefix,
      windowsHide: true,
      timeout: 15000,
    });
  await nginx(["-t"]);
  const child = spawn(
    binary,
    ["-p", `${forward(prefix)}/`, "-c", "nginx.conf"],
    { cwd: prefix, windowsHide: true, stdio: "ignore" },
  );
  let exited = false;
  child.on("exit", () => {
    exited = true;
  });
  try {
    await expect
      .poll(async () => {
        try {
          await checkLive(origin, baseline);
          return true;
        } catch {
          return false;
        }
      })
      .toBe(true);
    const denied = await page.request.post(
      `/__builder-local?project=${other.id}`,
      {
        headers,
        data: {
          action: "client-release-review",
          destinationId: client.destinationId,
          releaseAction: "publish",
        },
      },
    );
    expect(denied.ok()).toBe(false);
    await page.goto(`/builder/?project=${project.id}`);
    await page.getByRole("button").filter({ hasText: "/about/" }).click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Client releases", exact: true }),
    ).toBeVisible();
    saved = (
      await (
        await page.request.get(`/__builder-local?project=${project.id}`)
      ).json()
    ).pages.find((item) => item.id === saved.id);
    await page
      .getByLabel("Choose destination")
      .selectOption(client.destinationId);
    await page
      .getByRole("button", {
        name: "Review saved project for publication",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Review publication", exact: true }),
    ).toBeVisible();
    const startResponse = page.waitForResponse(
      (response) =>
        response.url().includes("__builder-local") &&
        (response.request().postData() || "").includes(
          '"action":"client-release-start"',
        ),
    );
    await page
      .getByRole("button", { name: "Publish reviewed project", exact: true })
      .click();
    const first = await (await startResponse).json();
    const newer = structuredClone(saved.draft);
    newer.data.content[1].props.text = "Newer draft retained";
    saved = await api({
      action: "save",
      id: saved.id,
      version: saved.version,
      document: newer,
    });
    const firstRow = page.locator(`[data-release-id="${first.id}"]`);
    await expect(firstRow.getByRole("status")).toContainText(
      "Verified release",
      { timeout: 60000 },
    );
    let workspace = await (
      await page.request.get(`/__builder-local?project=${project.id}`)
    ).json();
    expect(
      workspace.pages.find((item) => item.id === saved.id).draft.data.content[1]
        .props.text,
    ).toBe("Newer draft retained");
    expect(
      workspace.pages.find((item) => item.id === saved.id).published.data
        .content[1].props.text,
    ).toBe("Reviewed original content");
    const website = await context.newPage();
    const errors: string[] = [];
    website.on("pageerror", (error) => errors.push(error.message));
    website.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const width of [1440, 390]) {
      await website.setViewportSize({ width, height: 900 });
      await website.goto(`${origin}/about/`);
      await expect(
        website.getByText("Reviewed original content", { exact: true }),
      ).toBeVisible();
      await expect(
        website.getByRole("img", { name: "Client purple logo" }),
      ).toBeVisible();
      expect(
        await website.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390) {
        await website.locator(".kb-menu-mobile summary").focus();
        await website.keyboard.press("Enter");
      }
      await website.screenshot({
        path: `test-results/unity-published-client-${width}.png`,
        fullPage: true,
      });
      await website
        .locator(width === 390 ? ".kb-menu-mobile" : ".kb-menu-desktop")
        .getByRole("link", { name: "Contact", exact: true })
        .click();
      await expect(
        website.getByText("Client contact page", { exact: true }),
      ).toBeVisible();
    }
    expect(errors).toEqual([]);
    const invalid = structuredClone(saved.draft);
    invalid.data.content[2].props.src =
      "https://unregistered.example/missing.svg";
    saved = await api({
      action: "save",
      id: saved.id,
      version: saved.version,
      document: invalid,
    });
    await page
      .getByRole("button", {
        name: "Review saved project for publication",
        exact: true,
      })
      .click();
    const failureResponse = page.waitForResponse(
      (response) =>
        response.url().includes("__builder-local") &&
        (response.request().postData() || "").includes(
          '"action":"client-release-start"',
        ),
    );
    await page
      .getByRole("button", { name: "Publish reviewed project", exact: true })
      .click();
    const failed = await (await failureResponse).json();
    const failedRow = page.locator(`[data-release-id="${failed.id}"]`);
    await expect(failedRow.getByRole("status")).toContainText(
      "Failed before publication",
      { timeout: 60000 },
    );
    await expect(failedRow.getByRole("alert")).toContainText(
      "Import this media",
    );
    expect(await (await page.request.get(`${origin}/about/`)).text()).toContain(
      "Reviewed original content",
    );
    workspace = await (
      await page.request.get(`/__builder-local?project=${project.id}`)
    ).json();
    expect(
      workspace.pages.find((item) => item.id === saved.id).draft.data.content[2]
        .props.src,
    ).toBe("https://unregistered.example/missing.svg");
    const repaired = structuredClone(saved.draft);
    repaired.data.content[2].props.src = asset.url;
    saved = await api({
      action: "save",
      id: saved.id,
      version: saved.version,
      document: repaired,
    });
    await page
      .getByRole("button", {
        name: "Review saved project for publication",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Publish reviewed project", exact: true })
      .click();
    await expect
      .poll(
        async () => await (await page.request.get(`${origin}/about/`)).text(),
      )
      .toContain("Newer draft retained");
    await expect(
      firstRow.getByRole("button", { name: "Review restoring this release" }),
    ).toBeVisible();
    const second = (await api({ action: "client-release-list" })).jobs.find(
      (job) =>
        job.id !== first.id && job.action === "publish" && job.phase === "live",
    );
    expect(second).toBeDefined();
    const newest = structuredClone(saved.draft);
    newest.data.content[1].props.text = "Newest draft survives rollback";
    saved = await api({
      action: "save",
      id: saved.id,
      version: saved.version,
      document: newest,
    });
    await firstRow
      .getByRole("button", { name: "Review restoring this release" })
      .click();
    const rollbackResponse = page.waitForResponse(
      (response) =>
        response.url().includes("__builder-local") &&
        (response.request().postData() || "").includes(
          '"action":"client-release-start"',
        ),
    );
    await page
      .getByRole("button", { name: "Restore reviewed release", exact: true })
      .click();
    const rollback = await (await rollbackResponse).json();
    await expect(
      page.locator(`[data-release-id="${rollback.id}"]`).getByRole("status"),
    ).toContainText("Verified release", { timeout: 60000 });
    await expect
      .poll(
        async () => await (await page.request.get(`${origin}/about/`)).text(),
      )
      .toContain("Reviewed original content");
    let interrupted = false;
    try {
      await run(
        process.execPath,
        [
          "--import",
          "tsx",
          path.resolve("tests/builder/interrupt-client-publication.ts"),
          project.id,
          client.destinationId,
          second.id,
          binary,
        ],
        { cwd: process.cwd(), windowsHide: true, timeout: 30000 },
      );
    } catch (error) {
      expect(error.stdout, error.stderr).toContain(
        "INTERRUPTING_AFTER_NGINX_RELOAD",
      );
      interrupted = true;
    }
    expect(interrupted).toBe(true);
    const interruptedJob = (
      await api({ action: "client-release-list" })
    ).jobs.find((job) => job.rollbackOf === second.id);
    expect(interruptedJob).toMatchObject({
      phase: "recovery_required",
      recoveryAvailable: true,
    });
    let recoveryInterrupted = false;
    try {
      await run(
        process.execPath,
        [
          "--import",
          "tsx",
          path.resolve("tests/builder/interrupt-client-publication.ts"),
          project.id,
          client.destinationId,
          interruptedJob.id,
          binary,
          "--recover",
        ],
        { cwd: process.cwd(), windowsHide: true, timeout: 30000 },
      );
    } catch (error) {
      expect(error.stdout, error.stderr).toContain(
        "INTERRUPTING_RECOVERY_AFTER_NGINX_RELOAD",
      );
      recoveryInterrupted = true;
    }
    expect(recoveryInterrupted).toBe(true);
    const recoveryGuards = [
      path.resolve(
        "test-results/builder-browser-workspace/projects",
        project.id,
        "publication",
        `lock-${client.destinationId}.recovery`,
      ),
      path.join(store, ".activation-lock.recovery"),
    ];
    for (const guard of recoveryGuards)
      expect((await lstat(guard)).isDirectory()).toBe(true);
    const interruptedRow = page.locator(
      `[data-release-id="${interruptedJob.id}"]`,
    );
    await interruptedRow
      .getByRole("button", { name: "Check and reconcile interrupted release" })
      .click();
    await expect(interruptedRow.getByRole("status")).toContainText(
      "Verified release",
      { timeout: 60000 },
    );
    for (const guard of recoveryGuards)
      await expect
        .poll(async () =>
          lstat(guard).then(
            () => false,
            (error) => error.code === "ENOENT",
          ),
        )
        .toBe(true);
    expect(await (await page.request.get(`${origin}/about/`)).text()).toContain(
      "Newer draft retained",
    );
    workspace = await (
      await page.request.get(`/__builder-local?project=${project.id}`)
    ).json();
    expect(
      workspace.pages.find((item) => item.id === saved.id).draft.data.content[1]
        .props.text,
    ).toBe("Newest draft survives rollback");
    await page
      .getByRole("button", {
        name: "Review unpublishing this website",
        exact: true,
      })
      .click();
    const unpublishResponse = page.waitForResponse(
      (response) =>
        response.url().includes("__builder-local") &&
        (response.request().postData() || "").includes(
          '"action":"client-release-start"',
        ),
    );
    await page
      .getByRole("button", { name: "Unpublish reviewed website", exact: true })
      .click();
    const unpublished = await (await unpublishResponse).json();
    await expect(
      page.locator(`[data-release-id="${unpublished.id}"]`).getByRole("status"),
    ).toContainText("Verified release", { timeout: 60000 });
    await expect
      .poll(async () => (await page.request.get(`${origin}/about/`)).status())
      .toBe(404);
    await expect
      .poll(async () => {
        workspace = await (
          await page.request.get(`/__builder-local?project=${project.id}`)
        ).json();
        return workspace.pages.find((item) => item.id === saved.id).published;
      })
      .toBeNull();
    expect(
      workspace.pages.find((item) => item.id === saved.id).draft.data.content[1]
        .props.text,
    ).toBe("Newest draft survives rollback");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/unity-client-releases-${width}.png`,
        fullPage: true,
      });
    }
    await website.close();
  } finally {
    await nginx(["-s", "quit"]);
    for (let i = 0; !exited && i < 100; i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    if (!exited) throw new Error(`Nginx process ${child.pid} has not exited.`);
    await writeFile(
      path.resolve("test-results/builder-client-destinations.json"),
      JSON.stringify({ schemaVersion: 1, destinations: [] }),
    );
  }
});
