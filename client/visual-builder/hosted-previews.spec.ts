import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { request as httpRequest } from "node:http";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import {
  hostedHelperFixture,
  helperProject,
  helperOtherProject,
  helperOwner,
  helperEditor,
  helperToken,
} from "../../tests/builder/hosted-helper-fixture";
import {
  hostedPreviewCookie,
  hostedFrameCookie,
} from "../../scripts/builder-hosted-previews";
import {
  hostedPreviewHtml,
  hostedPreviewJs,
  hostedPreviewCss,
} from "../../scripts/builder-hosted-preview-content";

const origin = "https://builder.example";
const script = `import {mkdirSync,writeFileSync} from 'node:fs'; mkdirSync('dist/contact',{recursive:true}); writeFileSync('dist/index.html','<html><head><script type="module" src="/main.js"></script></head><body><h1>Hosted original</h1><a href="contact/">Contact</a></body></html>'); writeFileSync('dist/main.js','export const privateValue="private snapshot"'); writeFileSync('dist/contact/index.html','<h1>Contact page</h1>');`;
let api: Awaited<ReturnType<typeof hostedHelperFixture>>,
  url: string,
  jobId: string;
const cookie = (headers: Headers) => headers.get("set-cookie")!.split(";")[0];
const get = (
  target: string,
  headers: Record<string, string> = {},
  method = "GET",
) =>
  fetch(api.helper.origin + new URL(target, origin).pathname, {
    method,
    headers,
    redirect: "manual",
  });
async function session(actor = helperOwner) {
  const connected = await api.send({ action: "repository-connect" }, actor);
  expect(connected.status).toBe(200);
  expect(connected.body.previewSession).toBe(true);
  return cookie(connected.headers);
}
async function envelope(editor: string, target = url) {
  const response = await get(target, { Cookie: editor });
  expect(response.status).toBe(200);
  const text = await response.text();
  return {
    response,
    html: Buffer.from(
      /data-kaizen-html="([^"]+)"/.exec(text)![1],
      "base64",
    ).toString(),
    bootstrap: /src="([^"]+)"/.exec(text)![1],
  };
}
async function frame(editor: string) {
  const page = await envelope(editor);
  const response = await get(page.bootstrap, { Origin: "null" });
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain(
    "Secure; HttpOnly; SameSite=None; Partitioned;",
  );
  return {
    ...page,
    cookie: cookie(response.headers),
    prefix: page.bootstrap.split("/__kaizen-session/")[0],
  };
}
beforeAll(async () => {
  api = await hostedHelperFixture(undefined, script, origin);
  await session();
  const plan = await api.send({ action: "repository-build-review" });
  const start = await api.send({
    action: "repository-build-start",
    planId: plan.body.id,
  });
  expect(start.status).toBe(200);
  jobId = start.body.id;
  await vi.waitFor(
    async () => {
      const result = await api.send({
        action: "repository-build-status",
        jobId,
      });
      url = result.body.previewUrl;
      expect(result.body.status).toBe("succeeded");
    },
    { timeout: 15000 },
  );
  expect(url).toMatch(
    new RegExp(
      `^${origin}/editor-preview/${helperProject}/${jobId}/[a-f0-9]{64}/$`,
    ),
  );
}, 30000);
afterEach(() => {
  vi.restoreAllMocks();
  api.outage(false);
  api.beforeMembership();
  api.archived.clear();
  api.members.get(helperProject)!.add(helperOwner);
});
afterAll(async () => {
  await api?.close();
});

describe("private hosted snapshot delivery", () => {
  it("requires an opaque server session, uses a one-use frame grant, and reads frozen output only", async () => {
    const connected = await api.send({ action: "repository-connect" });
    const header = connected.headers.get("set-cookie")!;
    expect(header).toMatch(
      new RegExp(
        `^${hostedPreviewCookie}=[a-f0-9]{64}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=\\d+$`,
      ),
    );
    expect(header).not.toContain(helperToken());
    const view = await frame(cookie(connected.headers));
    expect(view.bootstrap).not.toContain(new URL(url).pathname);
    expect(view.html).toContain(
      `src="${view.prefix}/main.js" crossorigin="use-credentials"`,
    );
    expect(view.response.headers.get("access-control-allow-origin")).toBeNull();
    expect(view.response.headers.get("content-security-policy")).toContain(
      "sandbox allow-scripts;",
    );
    for (const rule of [
      "connect-src 'none'",
      "form-action 'none'",
      "frame-src 'none'",
      `frame-ancestors ${origin}`,
    ])
      expect(view.response.headers.get("content-security-policy")).toContain(
        rule,
      );
    expect(view.response.headers.get("content-security-policy")).not.toContain(
      "allow-same-origin",
    );
    expect(view.response.headers.get("cache-control")).toBe(
      "private, no-store",
    );
    expect(view.response.headers.get("referrer-policy")).toBe("no-referrer");
    expect((await get(view.bootstrap, { Origin: "null" })).status).toBe(401);
    await writeFile(
      path.join(api.folders.root(helperProject), "dist/main.js"),
      "changed after snapshot",
    );
    const asset = await get(view.prefix + "/main.js", {
      Cookie: view.cookie,
      Origin: "null",
    });
    expect(asset.status).toBe(200);
    expect(asset.headers.get("access-control-allow-origin")).toBe("null");
    expect(asset.headers.get("access-control-allow-credentials")).toBe("true");
    expect(await asset.text()).toContain("private snapshot");
    const head = await get(
      view.prefix + "/main.js",
      { Cookie: view.cookie, Origin: "null" },
      "HEAD",
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    const redirected = await get(view.prefix + "/contact", {
      Cookie: view.cookie,
    });
    expect(redirected.status).toBe(308);
    expect(redirected.headers.get("location")).toBe(view.prefix + "/contact/");
  });

  it("rejects anonymous, forged, legacy, duplicate and other-account cookies, including null-origin attacks with the public URL", async () => {
    const editor = await session();
    for (const value of [
      "",
      "kaizen_studio_auth=1",
      `${hostedPreviewCookie}=${"a".repeat(64)}`,
      `${editor}; ${editor}`,
      await session(helperEditor),
    ])
      expect((await get(url, { Cookie: value })).status).toBe(401);
    expect((await get(url, { Cookie: editor, Origin: "null" })).status).toBe(
      401,
    );
    expect(
      (await get(url, { Cookie: editor, Origin: "https://hostile.example" }))
        .status,
    ).toBe(403);
    // Knowing the shared document URL cannot reveal or authorize the private asset namespace.
    expect(
      (await get(url + "main.js", { Cookie: editor, Origin: "null" })).status,
    ).toBe(401);
    const privateFrame = await frame(editor);
    for (const value of [editor, `${hostedFrameCookie}=${"b".repeat(64)}`])
      expect(
        (
          await get(privateFrame.prefix + "/main.js", {
            Cookie: value,
            Origin: "null",
          })
        ).status,
      ).toBe(401);
    const different = await frame(editor);
    expect(
      (
        await get(different.prefix + "/main.js", {
          Cookie: privateFrame.cookie,
          Origin: "null",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await get(url.replace(helperProject, helperOtherProject), {
          Cookie: editor,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api.send(
          { action: "repository-build-status", jobId },
          helperEditor,
        )
      ).status,
    ).toBe(410);
  });

  it("rechecks membership, archived state and Auth on every document, bootstrap and asset read", async () => {
    const editor = await session();
    const view = await frame(editor),
      pending = await envelope(editor);
    api.members.get(helperProject)!.delete(helperOwner);
    for (const [target, headers] of [
      [url, { Cookie: editor }],
      [view.prefix + "/main.js", { Cookie: view.cookie, Origin: "null" }],
      [pending.bootstrap, { Origin: "null" }],
    ] as const)
      expect((await get(target, headers)).status).toBe(403);
    api.members.get(helperProject)!.add(helperOwner);
    api.archived.add(helperProject);
    expect((await get(url, { Cookie: editor })).status).toBe(403);
    api.archived.clear();
    api.outage(true);
    const failed = await get(view.prefix + "/main.js", {
      Cookie: view.cookie,
      Origin: "null",
    });
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("fixture outage credential");
  });

  it("revokes all frame credentials on sign-out and ignores a stale logout belonging to another account", async () => {
    const editor = await session(),
      view = await frame(editor);
    const revoke = (account: string, requestOrigin = origin) =>
      fetch(api.helper.origin + "/editor-api/builder-repository", {
        method: "DELETE",
        headers: {
          Cookie: editor,
          Origin: requestOrigin,
          "X-Kaizen-Preview-Account": account,
        },
      });
    expect((await revoke(helperOwner, "https://hostile.example")).status).toBe(
      403,
    );
    const stale = await revoke(helperEditor);
    expect(stale.status).toBe(204);
    expect(stale.headers.get("set-cookie")).toBeNull();
    expect((await get(url, { Cookie: editor })).status).toBe(200);
    expect((await revoke(helperOwner)).headers.get("set-cookie")).toContain(
      "Max-Age=0",
    );
    expect((await get(url, { Cookie: editor })).status).toBe(401);
    expect(
      (
        await get(view.prefix + "/main.js", {
          Cookie: view.cookie,
          Origin: "null",
        })
      ).status,
    ).toBe(401);
    const racing = await session();
    api.beforeMembership(async () => {
      api.service.previews!.revoke(racing, helperOwner);
    });
    expect((await get(url, { Cookie: racing })).status).toBe(401);
  });

  it("expires sessions at token expiry and rejects old bootstrap grants", async () => {
    const editor = await session(),
      pending = await envelope(editor);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 31000);
    expect((await get(pending.bootstrap, { Origin: "null" })).status).toBe(401);
    vi.restoreAllMocks();
    const expiresAt = Math.floor(Date.now() / 1000) + 10;
    const token = helperToken(helperOwner, expiresAt);
    const actor = await api.service.access.verify(token);
    const shortCookie = api.service
      .previews!.issue(undefined, actor, token)
      .split(";")[0];
    vi.spyOn(Date, "now").mockReturnValue((expiresAt + 1) * 1000);
    expect((await get(url, { Cookie: shortCookie })).status).toBe(401);
  });

  it("rejects raw traversal, encoded separators, malformed paths and unsafe methods before serving bytes", async () => {
    const editor = await session();
    const raw = (suffix: string) =>
      new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          api.helper.origin,
          { path: new URL(url).pathname + suffix, headers: { Cookie: editor } },
          (res) => {
            res.resume();
            res.on("end", () => resolve(res.statusCode!));
          },
        );
        req.on("error", reject);
        req.end();
      });
    for (const suffix of [
      "../.env",
      "%2e%2e/.env",
      "%252e%252e/.env",
      "x%2fy",
      "x%5cy",
      "%00",
      "%zz",
      "file:private",
    ])
      expect(await raw(suffix), suffix).toBe(400);
    expect((await get(url, { Cookie: editor }, "POST")).status).toBe(405);
    const view = await frame(editor);
    expect(
      (await get(view.prefix + "/.env", { Cookie: view.cookie })).status,
    ).toBe(404);
    const boot = await envelope(editor);
    expect((await get(boot.bootstrap, { Origin: "null" }, "HEAD")).status).toBe(
      401,
    );
    expect((await get(boot.bootstrap, { Origin: "null" })).status).toBe(401);
  });

  it("binds source bridges to fresh source checks and removes preview URLs when the build stops", async () => {
    const root = api.folders.root(helperProject);
    const sourceBefore = await readFile(
      path.join(root, "src/pages/index.astro"),
      "utf8",
    );
    const response = await api.send({
      action: "repository-source-frame",
      route: "src/pages/index.astro",
      jobId,
    });
    expect(response.status).toBe(200);
    const view = await frameForSource(response.body.url, await session());
    const bridge = await get(view.prefix + "/__kaizen-canvas.js", {
      Cookie: view.cookie,
      Origin: "null",
    });
    expect(bridge.status).toBe(200);
    const script = await bridge.text();
    expect(script).toContain(response.body.nonce);
    expect(script).toContain(view.prefix);
    expect(
      await readFile(path.join(root, "src/pages/index.astro"), "utf8"),
    ).toBe(sourceBefore);
    await writeFile(
      path.join(root, "src/pages/index.astro"),
      sourceBefore + "\n<p>Changed source</p>",
    );
    expect(
      (
        await api.send({
          action: "repository-source-frame",
          route: "src/pages/index.astro",
          jobId,
        })
      ).status,
    ).toBe(409);
    await api.send({ action: "repository-build-stop", jobId });
    expect((await get(url, { Cookie: await session() })).status).toBe(410);
    expect(
      (await api.send({ action: "repository-build-status", jobId })).body
        .previewUrl,
    ).toBeUndefined();
  });
});
async function frameForSource(target: string, editor: string) {
  const page = await envelope(editor, target);
  const response = await get(page.bootstrap, { Origin: "null" });
  expect(response.status).toBe(200);
  return {
    cookie: cookie(response.headers),
    prefix: page.bootstrap.split("/__kaizen-session/")[0],
  };
}

describe("frozen hosted preview transformations", () => {
  const prefix = "/editor-preview/project/build/private";
  it("rebases root module imports and Astro literals while retaining relative imports, comments and external URLs", () => {
    const input = `// import '/comment.js'\nimport('/entry.js'); import('./chunk.js');const astro='/component.js'; const remote='https://cdn.example/file.js'; const text='/'; const label='/about'; const nav={href:'/contact/'};`;
    const output = hostedPreviewJs(input, prefix);
    expect(output).toContain(`import("${prefix}/entry.js")`);
    expect(output).toContain(`import('./chunk.js')`);
    expect(output).toContain(`astro="${prefix}/component.js"`);
    expect(output).toContain("// import '/comment.js'");
    expect(output).toContain("https://cdn.example/file.js");
    expect(output).toContain("const text='/'");
    expect(output).toContain("const label='/about'");
    expect(output).toContain(`href:"${prefix}/contact/"`);
  });
  it("embeds only bounded local snapshot fonts and preserves malformed or remote font URLs", () => {
    const files = new Map([["/font.woff2", Buffer.from("font")]]);
    expect(
      hostedPreviewCss(
        "@font-face{src:url('../font.woff2')}",
        prefix,
        "/css/site.css",
        files,
      ),
    ).toContain("data:font/woff2;base64,Zm9udA==");
    for (const value of [
      "https://cdn.example/font.woff2",
      "/%zz.woff2",
      "/absent.woff2",
    ])
      expect(
        hostedPreviewCss(`a{src:url('${value}')}`, prefix, "/style.css", files),
      ).not.toContain("base64");
    const huge = new Map([["/font.woff2", Buffer.alloc(6 * 1024 * 1024)]]);
    expect(
      hostedPreviewCss("a{src:url('/font.woff2')}", prefix, "/style.css", huge),
    ).not.toContain("base64");
  });
  it("credentials local assets and inline imports, preserves public images, removes stale integrity/base and adds the private base", () => {
    const html = hostedPreviewHtml(
      `<html><head><base href="https://outside.example/"><script type="module">import('/entry.js')</script><script src="./local.js" integrity="old"></script></head><body><img src="https://cdn.example/picture.png"><img src="/picture.png"></body></html>`,
      prefix,
      "/index.html",
      new Map(),
      "bridge",
      origin + prefix + "/",
    );
    expect(html).toContain(`<base href="${origin}${prefix}/">`);
    expect(html).not.toContain("outside.example");
    expect(html).not.toContain("integrity");
    expect(html).toContain(
      '<script type="module" crossorigin="use-credentials">',
    );
    expect(html).toContain('<img src="https://cdn.example/picture.png">');
    expect(html).toContain(
      `src="${prefix}/picture.png" crossorigin="use-credentials"`,
    );
    expect(html).toContain(`src="${prefix}/__kaizen-canvas.js"`);
  });
});
