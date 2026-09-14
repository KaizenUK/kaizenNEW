import { test, expect, type Page } from "./browser-fixture";
import { createInvitationHandler } from "../../supabase/functions/_shared/builderInvitations";
const owner = "11111111-1111-4111-8111-111111111111",
  person = "22222222-2222-4222-8222-222222222222";
const project = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function invitationFixture(page: Page) {
  const state = {
    emails: [] as { email: string; options: any }[],
    updates: [] as any[],
    accountExists: false,
    confirmed: false,
    failCompletion: false,
    version: 1,
    members: [
      {
        user_id: owner,
        name: "Fixture Owner",
        email: "owner@example.test",
        role: "owner",
        can_publish: true,
        invitation_state: "active",
      },
    ],
  };
  const handler = createInvitationHandler({
    redirectOrigin: "https://builder.example.test",
    headers: () => new Headers(),
    originAllowed: () => true,
    service: {
      auth: {
        getUser: async () => ({ data: { user: { id: owner } }, error: null }),
        admin: {
          inviteUserByEmail: async (email, options) => {
            state.emails.push({ email, options });
            state.accountExists = true;
            return { data: { user: { id: person, email } }, error: null };
          },
        },
      },
      rpc: async (name, args) => {
        if (name === "builder_consume_function_limit")
          return { data: { allowed: true, retryAfter: 0 }, error: null };
        if (name === "builder_prepare_invitation")
          return {
            data: {
              email: args.address || "person@example.test",
              accountId: state.accountExists ? person : null,
              confirmed: state.confirmed,
              alreadyMember: state.members.some((m) => m.user_id === person),
              version: state.version,
            },
            error: null,
          };
        if (state.failCompletion) {
          state.failCompletion = false;
          return { data: null, error: { code: "40001" } };
        }
        if (args.add_member) {
          state.members.push({
            user_id: person,
            name: "",
            email: String(args.address),
            role: String(args.member_role),
            can_publish: Boolean(args.publish_permission),
            invitation_state: "invited",
          });
          state.version++;
        }
        return { data: Boolean(args.add_member), error: null };
      },
    },
  });
  await page
    .context()
    .route("**/client/visual-builder/builderMode.ts*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "export const builderCloudEnabled=true; export const localBuilderRequested=false;",
      }),
    );
  await page.context().route("**/client/lib/supabase.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
    const invited=new URLSearchParams(location.search).get('actor')==='invited';
    let session={refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,access_token:invited?'fixture-invited-token':'fixture-owner-token',user:{id:invited?'${person}':'${owner}',email:invited?'person@example.test':'owner@example.test',user_metadata:invited?{builder_password_set:false}:{full_name:'Fixture Owner'}}};
    const callbacks=new Set();
    async function invoke(name,options){const headers=new Headers({'content-type':'application/json',authorization:'Bearer '+session.access_token});new Headers(options.headers||{}).forEach((value,key)=>headers.set(key,value));const response=await fetch('/__invitation-api/'+name,{method:'POST',headers,body:JSON.stringify(options.body)});
      const data=await response.clone().json();return {data:response.ok?data:null,error:response.ok?null:{message:'Fixture request failed',context:response}};}
    const client={functions:{invoke},auth:{initialize:async()=>({error:null}),refreshSession:async()=>({data:{session},error:null}),getSession:async()=>({data:{session},error:null}),onAuthStateChange:fn=>{callbacks.add(fn);return {data:{subscription:{unsubscribe:()=>callbacks.delete(fn)}}}},
      updateUser:async update=>{await invoke('auth-update',{body:update});session={...session,user:{...session.user,user_metadata:{...session.user.user_metadata,...update.data}}};for(const fn of callbacks)fn('USER_UPDATED',session);return {data:{user:session.user},error:null};},
      signOut:async()=>{session=null;for(const fn of callbacks)fn('SIGNED_OUT',null);return {error:null};}}};
    export const getSupabaseClient=()=>client;
    export const createIsolatedSupabaseClient=()=>({auth:{setSession:async tokens=>({data:{user:tokens.access_token===session.access_token?session.user:null},error:null}),updateUser:client.auth.updateUser,stopAutoRefresh:async()=>{}}});
  `,
    }),
  );
  await page.context().route("**/__invitation-api/*", async (route) => {
    const request = route.request(),
      input = request.postDataJSON(),
      name = request.url().split("/").pop();
    if (name === "builder-invite") {
      const response = await handler(
        new Request(request.url(), {
          method: "POST",
          headers: request.headers(),
          body: JSON.stringify(input),
        }),
      );
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      });
      return;
    }
    if (name === "auth-update") {
      state.updates.push(input);
      state.confirmed = true;
      const member = state.members.find((m) => m.user_id === person);
      if (member) {
        member.name = input.data.full_name;
        member.invitation_state = "active";
      }
      await route.fulfill({ json: { updated: true } });
      return;
    }
    if (input.action === "list") {
      const user = request.headers().authorization?.includes("invited")
        ? person
        : owner;
      const membership = state.members.find((m) => m.user_id === user);
      await route.fulfill({
        json: membership
          ? [
              {
                id: project,
                name: "Garden website",
                archived: false,
                version: 1,
                capabilities: {
                  hasInventory: false,
                  legacyWorkspace: false,
                  publishPath: "worker",
                },
                destination: { kind: "unconfigured", label: "Not connected" },
                access: {
                  role: membership.role,
                  canPublish: membership.can_publish,
                },
              },
            ]
          : [],
      });
      return;
    }
    if (input.action === "members") {
      await route.fulfill({ json: state.members });
      return;
    }
    if (input.action === "set-member") {
      if (input.role === null)
        state.members = state.members.filter((m) => m.user_id !== input.userId);
      else {
        const member = state.members.find((m) => m.user_id === input.userId);
        if (member) {
          member.role = input.role;
          member.can_publish = input.canPublish;
        }
      }
      state.version++;
      await route.fulfill({ json: { updated: true } });
      return;
    }
    await route.fulfill({
      status: 400,
      json: { error: "Unexpected fixture action" },
    });
  });
  // Real Auth gate, dashboard, members screen, client transport and invitation
  // handler; only Supabase Auth/database are doubles. No email leaves this fixture.
  await page.context().route("**/__invitation-fixture?*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client/visual-builder/builder.css"><script>window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body style="margin:0"><div class="builder-app" data-theme="light"><div id="fixture" style="max-width:1100px;margin:auto"></div></div><script type="module">
    import React from '/test-results/builder-vite-cache/deps/react.js';import ReactDOM from '/test-results/builder-vite-cache/deps/react-dom_client.js';
    import BuilderAuth from '/client/visual-builder/BuilderAuth.tsx';import ProjectsView from '/client/visual-builder/ProjectsView.tsx';
    ReactDOM.createRoot(document.getElementById('fixture')).render(React.createElement(BuilderAuth,null,React.createElement(ProjectsView)));
  </script></body></html>`,
    }),
  );
  await page.goto("/__invitation-fixture?project=" + project);
  await page.getByText("Project access", { exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Access for owner@example.test" }),
  ).toBeVisible();
  return state;
}

test("an owner invites by email, resends, edits permissions and removes access by name", async ({
  page,
}) => {
  const state = await invitationFixture(page);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("person@example.test");
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  const member = page.getByRole("group", {
    name: "Access for person@example.test",
    exact: true,
  });
  await expect(member).toContainText("Invitation pending");
  await expect(member).toContainText("Editor · Cannot publish");
  expect(state.emails).toHaveLength(1);
  expect(state.emails[0].options.redirectTo).toContain(
    "/builder/?password=setup&project=" + project,
  );
  await member.getByRole("button", { name: "Resend invitation" }).click();
  await expect(page.getByRole("status")).toContainText("latest email link");
  expect(state.emails).toHaveLength(2);
  await member.getByRole("button", { name: "Edit access" }).click();
  await page.getByLabel("Allow publishing").check();
  await page.getByRole("button", { name: "Save access", exact: true }).click();
  await expect(member).toContainText("Editor · May publish");
  await expect(
    page.getByRole("button", { name: "Send invitation", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".builder-project-members")).not.toContainText(
    person,
  );
  await page.screenshot({
    path: "test-results/launch-invitations-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await member.scrollIntoViewIfNeeded();
  expect(
    (await page.getByLabel("Email address", { exact: true }).boundingBox())!
      .width,
  ).toBeGreaterThan(200);
  expect(
    (await page
      .getByRole("combobox", { name: "Role", exact: true })
      .boundingBox())!.width,
  ).toBeGreaterThan(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: "test-results/launch-invitations-phone.png",
    fullPage: true,
  });
  await member
    .getByRole("button", { name: "Remove access", exact: true })
    .click();
  await expect(member).toContainText("Their account and work will remain");
  expect(state.members).toHaveLength(2);
  await member.getByRole("button", { name: "Confirm removal" }).click();
  await expect(member).toHaveCount(0);
  expect(state.accountExists).toBe(true);
  expect(state.emails).toHaveLength(2);
  await expect(
    page
      .getByRole("group", { name: "Access for owner@example.test" })
      .getByRole("button", { name: "Remove access", exact: true }),
  ).toBeDisabled();
});

test("an invited person sets their own name and password before opening their project", async ({
  page,
  context,
}) => {
  const state = await invitationFixture(page);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("person@example.test");
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Access for person@example.test" }),
  ).toBeVisible();
  const invited = await context.newPage();
  await invited.goto(
    "/__invitation-fixture?password=setup&actor=invited&project=" + project,
  );
  await expect(
    invited.getByRole("heading", { name: "Set up your account" }),
  ).toBeVisible();
  await expect(
    invited.getByRole("heading", { name: "Projects", exact: true }),
  ).toHaveCount(0);
  await invited.getByLabel("Your name", { exact: true }).fill("Alex Fixture");
  await invited
    .getByLabel("New password", { exact: true })
    .fill("fixture-password-123");
  await invited
    .getByLabel("Confirm password", { exact: true })
    .fill("fixture-password-123");
  await invited.screenshot({
    path: "test-results/launch-invited-account-desktop.png",
  });
  await invited.setViewportSize({ width: 390, height: 844 });
  expect(
    await invited.evaluate(() => document.documentElement.scrollWidth),
  ).toBe(390);
  await invited.screenshot({
    path: "test-results/launch-invited-account-phone.png",
    fullPage: true,
  });
  await invited
    .getByLabel("Confirm password", { exact: true })
    .fill("different-password");
  await invited
    .getByRole("button", { name: "Save password and open builder" })
    .click();
  await expect(invited.getByRole("alert")).toContainText("do not match");
  expect(state.updates).toHaveLength(0);
  await invited
    .getByLabel("Confirm password", { exact: true })
    .fill("fixture-password-123");
  await invited
    .getByRole("button", { name: "Save password and open builder" })
    .click();
  await expect(
    invited.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await expect(
    invited.getByRole("article", { name: "Garden website", exact: true }),
  ).toBeVisible();
  await expect(
    invited.getByText("Project access", { exact: true }),
  ).toHaveCount(0);
  expect(state.updates).toEqual([
    {
      password: "fixture-password-123",
      data: { builder_password_set: true, full_name: "Alex Fixture" },
    },
  ]);
  expect(new URL(invited.url()).searchParams.get("project")).toBe(project);
  expect(new URL(invited.url()).searchParams.has("password")).toBe(false);
  await page.getByRole("button", { name: "Refresh members" }).click();
  await expect(
    page.getByRole("group", { name: "Access for person@example.test" }),
  ).toContainText("Alex Fixture");
  await expect(
    page.getByRole("group", { name: "Access for person@example.test" }),
  ).toContainText("Account ready");
  await invited.close();
});

test("an incomplete invitation stays visible as an error and never sends itself again", async ({
  page,
}) => {
  const state = await invitationFixture(page);
  state.failCompletion = true;
  await page
    .getByLabel("Email address", { exact: true })
    .fill("person@example.test");
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "An email may already have been sent",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Project access has not been confirmed",
  );
  expect(state.emails).toHaveLength(1);
  expect(state.members).toHaveLength(1);
  await page.getByRole("button", { name: "Refresh members" }).click();
  await expect(
    page.getByRole("group", { name: "Access for person@example.test" }),
  ).toHaveCount(0);
  expect(state.emails).toHaveLength(1);
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    "person@example.test",
  );
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Access for person@example.test" }),
  ).toBeVisible();
  expect(state.emails).toHaveLength(2);
});
