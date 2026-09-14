import { drainRepositoryRoutes, expect, type Page } from "./browser-fixture";
import { BUILDER_TEST_ORIGIN } from "./ports";
import { BUILDER_LEGAL } from "../../shared/builderLegal";

export const hostedRepositoryTests =
  process.env.BUILDER_TEST_REPOSITORY_TRANSPORT === "hosted";
export const repositoryApiPattern = hostedRepositoryTests
  ? "**/editor-api/builder-repository"
  : "**/__builder-local**";

/** Only auth and HTTP/proxy boundaries are fixtures. Repository, drafts, Git, builds,
 * and snapshot bytes come from the existing helper in its isolated test workspace. */
export async function openSiteProject(
  page: Page,
  project: { id: string },
  root: string,
  hostedWorkspace = false,
  repositoryService?: {
    origin: string;
    accessToken: string;
    direct?: boolean;
    editorOrigin?: string;
  },
) {
  const hosted = hostedRepositoryTests || hostedWorkspace;
  if (hosted) {
    drainRepositoryRoutes.add(page);
    const prefix = `/editor-preview/${project.id}`;
    const ports = new Set<string>();
    const session = {
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "fixture@example.invalid",
        user_metadata: {},
      },
      access_token: repositoryService?.accessToken || "fixture-hosted-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    if (hostedWorkspace)
      await page.route("**/client/visual-builder/builderMode.ts*", (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body: "export const builderCloudEnabled=true;export const localBuilderRequested=false;",
        }),
      );
    else
      await page.route("**/client/visual-builder/repositoryMode.ts*", (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body: "export const repositoryMode='hosted';",
        }),
      );
    await page.route("**/client/lib/supabase.ts*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `let session=${JSON.stringify(session)};const listeners=new Set();const client={auth:{initialize:async()=>({error:null}),getSession:async()=>({data:{session}}),refreshSession:async()=>({data:{session}}),signOut:async()=>{session=null;for(const fn of listeners)fn('SIGNED_OUT',null);return {error:null}},onAuthStateChange:callback=>{listeners.add(callback);return {data:{subscription:{unsubscribe:()=>listeners.delete(callback)}}}}},functions:{invoke:async(name,options)=>{if(name==='builder-account'){if(options.body.action!=='legal-state')throw new Error('Unexpected account mutation in hosted repository fixture');return {data:{legal:${JSON.stringify({ ...BUILDER_LEGAL, acceptedAt: "2026-09-14T00:00:00Z" })}},error:null};}const response=await fetch('/__fixture-projects',{method:'POST',headers:{'Content-Type':'application/json',...options.headers},body:JSON.stringify(options.body)});return {data:await response.json(),error:response.ok?null:{message:'Fixture project request failed'}};}}};export const getSupabaseClient=()=>client;export const createIsolatedSupabaseClient=()=>{throw new Error('Account changes are outside this fixture');};`,
      }),
    );
    if (hostedWorkspace)
      await page.route("**/__fixture-projects", async (route) => {
        const input = route.request().postDataJSON();
        if (input.action === "record-error") {
          await route.fulfill({ json: { recorded: false } });
          return;
        }
        if (input.action === "list") {
          const response = await page.request.get("/__builder-projects");
          const items = await response.json();
          await route.fulfill({
            json: items
              .filter((item: any) => item.id === project.id)
              .map((item: any) => ({
                ...item,
                access: { role: "owner", canPublish: true },
              })),
          });
          return;
        }
        expect(input.projectId).toBe(project.id);
        const response =
          input.action === "load"
            ? await page.request.get(`/__builder-local?project=${project.id}`)
            : await page.request.post(
                `/__builder-local?project=${project.id}`,
                { headers: { "X-Kaizen-Builder": "1" }, data: input },
              );
        await route.fulfill({
          status: response.status(),
          json: await response.json(),
        });
      });
    const rewrite = (value: any): any => {
      if (
        typeof value === "string" &&
        /^http:\/\/127\.0\.0\.1:\d+\/__kaizen-/.test(value)
      ) {
        const url = new URL(value);
        ports.add(url.port);
        return `${BUILDER_TEST_ORIGIN}${prefix}/${url.port}${url.pathname}${url.search}`;
      }
      if (Array.isArray(value)) return value.map(rewrite);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, rewrite(item)]),
        );
      return value;
    };
    await page.route("**/editor-api/builder-repository", async (route) => {
      if (repositoryService?.direct) {
        await route.continue();
        return;
      }
      const input = route.request().postDataJSON();
      expect(route.request().headers().authorization).toBe(
        `Bearer ${session.access_token}`,
      );
      expect(input.projectId).toBe(project.id);
      if (repositoryService) {
        const response = await page.request.post(
          `${repositoryService.origin}/editor-api/builder-repository`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              Origin: "https://builder.example",
            },
            data: input,
          },
        );
        await route.fulfill({
          status: response.status(),
          json: await response.json(),
        });
        return;
      }
      if (input.action === "repository-connect") {
        await route.fulfill({
          json: {
            projectId: project.id,
            root,
            expiresAt: session.expires_at * 1000,
          },
        });
        return;
      }
      if (input.action === "repository-website-status") {
        await route.fulfill({
          json: {
            state: "saved",
            head: "a".repeat(40),
            draftRoutes: [],
            detail: "Saved in the fixture website folder.",
            checkedAt: new Date().toISOString(),
          },
        });
        return;
      }
      if (input.action === "repository-inspect-current") {
        input.action = "repository-inspect";
        input.root = root;
      }
      const response = await page.request.post(
        `/__builder-local?project=${project.id}`,
        {
          headers: { "X-Kaizen-Builder": "1", Origin: BUILDER_TEST_ORIGIN },
          data: input,
        },
      );
      await route.fulfill({
        status: response.status(),
        json: rewrite(await response.json()),
      });
    });
    if (!repositoryService?.direct)
      await page.context().route(`**${prefix}/**`, async (route) => {
        const url = new URL(route.request().url());
        const [port, ...parts] = url.pathname
          .slice(prefix.length + 1)
          .split("/");
        if (!ports.has(port))
          throw new Error(
            "A fixture preview must come from this project's build response.",
          );
        const response = await page.request.get(
          `http://127.0.0.1:${port}/${parts.join("/")}${url.search}`,
          { maxRedirects: 0 },
        );
        const headers = {
          ...response.headers(),
          "access-control-allow-origin": "*",
        };
        delete headers["content-length"];
        delete headers["content-encoding"];
        if (headers.location?.startsWith("/"))
          headers.location = `${prefix}/${port}${headers.location}`;
        const type = headers["content-type"] || "";
        let body = await response.body();
        if (/html|css|javascript/.test(type))
          body = Buffer.from(
            body
              .toString("utf8")
              .replace(
                /\/__kaizen-(?:preview|source|source-script)\//g,
                (match) => `${prefix}/${port}${match}`,
              ),
          );
        await route.fulfill({ status: response.status(), headers, body });
      });
  }
  await page.goto(
    `${repositoryService?.editorOrigin || ""}/builder/?project=${project.id}`,
  );
  await page.evaluate(
    ({ id, root, hosted }) =>
      localStorage.setItem(
        `kaizen-native-repository:${id}`,
        hosted ? "/stale-local-folder-must-not-be-used" : root,
      ),
    { id: project.id, root, hosted },
  );
}
