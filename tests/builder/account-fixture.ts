import { closeFixturePage, fixtureRoute } from "./fixture-routes";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { Page } from "./browser-fixture";
import { createAccountHandler } from "../../supabase/functions/_shared/builderAccounts";
export const accountOwner = "11111111-1111-4111-8111-111111111111",
  accountPerson = "22222222-2222-4222-8222-222222222222",
  accountOtherOwner = "33333333-3333-4333-8333-333333333333";
const beta = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const authOrigin = "https://account-fixture.supabase.test";

/** The browser uses the real Supabase SDK and Account UI. Only the provider's
 * HTTP boundary is fake; deletion RPCs execute the actual PostgreSQL migrations. */
export async function accountFixture(
  page: Page,
  options: {
    signedOut?: boolean;
    invited?: boolean;
    initialAccount?: string;
    initialView?: "account" | "pages";
    needsLegalAcceptance?: boolean;
  } = {},
) {
  const projectResponse = await page.request.post("/__builder-projects", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "create", name: "Garden website" },
  });
  if (!projectResponse.ok()) throw new Error(await projectResponse.text());
  const project = await projectResponse.json();
  const db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id)); alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ('${accountOwner}','owner@example.test',now(),'{"full_name":"Garden owner"}'),
    ('${accountPerson}','alex@example.test',now(),'{}'),
    ('${accountOtherOwner}','other-owner@example.test',now(),'{"full_name":"Second owner"}');`);
  for (const file of [
    "202609100001_visual_builder.sql",
    "202609100002_builder_site_design.sql",
    "202609100008_builder_releases.sql",
    "202609110001_builder_projects.sql",
    "202609120001_builder_project_capabilities.sql",
    "202609130001_builder_invitations.sql",
    "202609130002_builder_accounts.sql",
    "202609140001_builder_function_limits.sql",
    "202609140004_builder_legal_privacy.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  if (!options.needsLegalAcceptance)
    await db.exec(
      "insert into builder_legal_acceptances(user_id,version) select id,'2026-09-14' from auth.users",
    );
  await db.query(
    "insert into builder_projects(id,name) values($1,'Garden website'),($2,'Other website')",
    [project.id, beta],
  );
  await db.query(
    "insert into builder_project_members(project_id,user_id,role,can_publish) values($1,$3,'owner',false),($1,$4,'editor',true),($2,$5,'owner',true),($2,$4,'editor',false)",
    [project.id, beta, accountOwner, accountPerson, accountOtherOwner],
  );
  await db.query(
    "insert into storage.objects(bucket_id,name,owner) values('builder-project-files',$1,$2)",
    [`${project.id}/fixture-image`, accountPerson],
  );
  const state = {
    deletions: [] as string[],
    updates: [] as { actor: string; body: any }[],
    codes: [] as string[],
    scopes: [] as { actor: string; scope: string | null }[],
    pendingEmail: new Map<string, string>(),
    requireCode: false,
    failDelete: false,
    password: "fixture-current-password",
    loginError: undefined as string | undefined,
    resetFailure: false,
    resets: [] as { email: string; redirectTo: string | null }[],
  };
  const tokens = new Map<string, string>(),
    refreshes = new Map<string, string>();
  async function readUser(id: string) {
    const row = (
      await db.query<any>(
        "select * from auth.users where id=$1 and deleted_at is null",
        [id],
      )
    ).rows[0];
    return row
      ? {
          id,
          aud: "authenticated",
          role: "authenticated",
          email: row.email,
          new_email: state.pendingEmail.get(id),
          user_metadata: row.raw_user_meta_data,
          app_metadata: {},
          created_at: "2026-09-13T00:00:00Z",
        }
      : null;
  }
  async function session(id: string) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = [
      Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
      Buffer.from(
        JSON.stringify({ sub: id, role: "authenticated", exp }),
      ).toString("base64url"),
      Buffer.from("fixture-signature").toString("base64url"),
    ].join(".");
    const refresh = `fixture-refresh-${id}`;
    tokens.set(token, id);
    refreshes.set(refresh, id);
    return {
      access_token: token,
      refresh_token: refresh,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: exp,
      user: await readUser(id),
    };
  }
  const handler = createAccountHandler({
    headers: () => new Headers(),
    originAllowed: () => true,
    service: {
      auth: {
        getUser: async (token) => ({
          data: {
            user: tokens.has(token) ? await readUser(tokens.get(token)!) : null,
          },
          error: null,
        }),
        admin: {
          deleteUser: async (id, soft) => {
            if (!soft)
              throw new Error(
                "The fixture must preserve website ownership and history",
              );
            state.deletions.push(id);
            if (state.failDelete)
              return { error: { message: "Fixture Auth removal interrupted" } };
            await db.query(
              "update auth.users set deleted_at=now(),email=null,raw_user_meta_data='{}' where id=$1",
              [id],
            );
            return { error: null };
          },
        },
      },
      rpc: async (name, args) => {
        if (name === "builder_consume_function_limit")
          return {
            data: (
              await db.query<{ result: any }>(
                "select public.builder_consume_function_limit($1,$2) as result",
                [args.target_function, args.actor_id],
              )
            ).rows[0].result,
            error: null,
          };
        if (
          !/^builder_(?:account_deletion_(?:request|cancel|state|prepare|complete)|legal_(?:state|accept)|privacy_(?:projects|list|request|update))$/.test(
            name,
          )
        )
          throw new Error("Unexpected account RPC");
        const keys = Object.keys(args);
        if (
          keys.some(
            (key) =>
              ![
                "actor",
                "request",
                "target",
                "expected_version",
                "terms_hash",
                "privacy_hash",
                "confirmed",
                "inbox",
                "before_id",
                "request_kind",
                "request_details",
                "request_id",
                "next_status",
                "owner_response",
              ].includes(key),
          )
        )
          throw new Error("Unexpected RPC argument");
        try {
          return {
            data: (
              await db.query<{ result: any }>(
                `select public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(",")}) as result`,
                keys.map((key) => args[key]),
              )
            ).rows[0].result,
            error: null,
          };
        } catch (error) {
          return { data: null, error: { code: error.code } };
        }
      },
    },
  });
  await fixtureRoute(
    page,
    "**/client/visual-builder/builderMode.ts*",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "export const builderCloudEnabled=true;export const localBuilderRequested=false;",
      }),
  );
  await fixtureRoute(page, "**/client/lib/supabaseConfig.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export const supabaseUrl=${JSON.stringify(authOrigin)};export const supabaseKey='fixture-public-key';`,
    }),
  );
  await fixtureRoute(page, "**/editor-api/builder-repository", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "This fixture website has no repository connected." },
    }),
  );
  await fixtureRoute(page, `${authOrigin}/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
      "access-control-expose-headers": "x-supabase-api-version",
      "x-supabase-api-version": "2024-01-01",
    };
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ status, json, headers: cors });
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const bearer =
      request.headers().authorization?.replace(/^Bearer /, "") || "";
    const actor = tokens.get(bearer),
      user = actor ? await readUser(actor) : null;
    if (url.pathname === "/auth/v1/recover") {
      state.resets.push({
        email: request.postDataJSON().email,
        redirectTo: url.searchParams.get("redirect_to"),
      });
      await reply(
        state.resetFailure
          ? {
              code: "unexpected_failure",
              message: "Private fixture provider detail",
            }
          : {},
        state.resetFailure ? 503 : 200,
      );
      return;
    }
    if (
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "password"
    ) {
      const body = request.postDataJSON();
      const person = await readUser(accountPerson);
      const code =
        state.loginError ||
        (body.email !== person?.email || body.password !== state.password
          ? "invalid_credentials"
          : undefined);
      await reply(
        code
          ? { code, message: "Private fixture sign-in detail" }
          : await session(accountPerson),
        code ? 400 : 200,
      );
      return;
    }
    if (url.pathname === "/auth/v1/token") {
      const id = refreshes.get(request.postDataJSON().refresh_token);
      await reply(
        id && (await readUser(id))
          ? await session(id)
          : {
              code: "refresh_token_not_found",
              message: "Fixture session ended",
            },
        id && (await readUser(id)) ? 200 : 401,
      );
      return;
    }
    if (!actor || !user) {
      await reply({ code: "bad_jwt", message: "Fixture session ended" }, 401);
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      if (request.method() === "PUT") {
        const body = request.postDataJSON();
        state.updates.push({ actor, body });
        if (body.password && state.requireCode && body.nonce !== "123456") {
          await reply(
            {
              code: body.nonce
                ? "reauthentication_not_valid"
                : "reauthentication_needed",
              message: "Fixture confirmation required",
            },
            422,
          );
          return;
        }
        if (body.data)
          await db.query(
            "update auth.users set raw_user_meta_data=raw_user_meta_data||$2::jsonb where id=$1",
            [actor, JSON.stringify(body.data)],
          );
        if (body.password) state.password = body.password;
        if (body.email) state.pendingEmail.set(actor, body.email);
      }
      await reply(await readUser(actor));
      return;
    }
    if (url.pathname === "/auth/v1/reauthenticate") {
      state.codes.push(actor);
      await reply({});
      return;
    }
    if (url.pathname === "/auth/v1/logout") {
      state.scopes.push({ actor, scope: url.searchParams.get("scope") });
      await reply({});
      return;
    }
    if (url.pathname === "/functions/v1/builder-account") {
      const response = await handler(
        new Request(request.url(), {
          method: request.method(),
          headers: request.headers(),
          body: request.postData(),
        }),
      );
      await route.fulfill({
        status: response.status,
        body: await response.text(),
        headers: { ...cors, ...Object.fromEntries(response.headers) },
      });
      return;
    }
    if (url.pathname === "/functions/v1/builder-projects") {
      const input = request.postDataJSON();
      if (input.action === "list") {
        const rows = (
          await db.query<any>(
            "select p.id,p.name,m.role,m.can_publish from builder_projects p join builder_project_members m on m.project_id=p.id where m.user_id=$1",
            [actor],
          )
        ).rows;
        await reply(
          rows.map((row) => ({
            ...project,
            id: row.id,
            name: row.name,
            capabilities: {
              legacyWorkspace: false,
              hasInventory: false,
              publishPath: "worker",
            },
            access: { role: row.role, canPublish: row.can_publish },
          })),
        );
        return;
      }
      if (input.action === "load") {
        const response = await page.request.get(
          `/__builder-local?project=${project.id}`,
        );
        await reply(await response.json(), response.status());
        return;
      }
      if (input.action === "record-error") {
        await reply({ recorded: false });
        return;
      }
    }
    throw new Error(
      `Unhandled account fixture request: ${request.method()} ${url.pathname}`,
    );
  });
  if (options.invited)
    await db.query(
      "update auth.users set raw_user_meta_data=raw_user_meta_data||'{\"builder_password_set\":false}'::jsonb where id=$1",
      [accountPerson],
    );
  const initial = options.signedOut
    ? null
    : await session(options.initialAccount || accountPerson);
  await page.addInitScript((value) => {
    if (sessionStorage.getItem("account-fixture-seeded")) return;
    sessionStorage.setItem("account-fixture-seeded", "1");
    if (value && !localStorage.getItem("sb-account-fixture-auth-token"))
      localStorage.setItem(
        "sb-account-fixture-auth-token",
        JSON.stringify(value),
      );
  }, initial);
  const usedLinks = new Set<string>();
  let linkServer: Server | undefined;
  async function passwordLink(kind: string) {
    if (!["invite", "recovery", "expired"].includes(kind))
      throw new Error("Unknown fixture link");
    const destination = new URL(
      `/builder/?project=${project.id}&view=account&password=setup`,
      projectResponse.url(),
    );
    if (kind === "expired" || usedLinks.has(kind)) {
      destination.hash = new URLSearchParams({
        error: "access_denied",
        error_code: "otp_expired",
        error_description: "Email link is invalid or has expired",
      }).toString();
    } else {
      usedLinks.add(kind);
      const next = await session(accountPerson);
      destination.hash = new URLSearchParams({
        type: kind,
        access_token: next.access_token,
        refresh_token: next.refresh_token,
        token_type: next.token_type,
        expires_in: String(next.expires_in),
      }).toString();
    }
    return destination.href;
  }
  await page.goto(
    `/builder/?project=${project.id}${options.initialView === "pages" ? "" : "&view=account"}`,
  );
  return {
    db,
    state,
    project,
    readUser,
    async openPasswordLink(kind: "invite" | "recovery" | "expired") {
      // Exercise a real provider redirect: WebKit cannot fulfill an intercepted
      // route with 302. No production account, link or email is involved.
      if (!linkServer) {
        linkServer = createServer(async (request, response) => {
          try {
            const location = await passwordLink(
              new URL(request.url!, "http://fixture.invalid").pathname.slice(1),
            );
            response
              .writeHead(302, { location, "cache-control": "no-store" })
              .end();
          } catch {
            response.writeHead(400).end("Invalid fixture link");
          }
        });
        await new Promise<void>((resolve, reject) => {
          linkServer!.once("error", reject);
          linkServer!.listen(0, "127.0.0.1", resolve);
        });
      }
      const address = linkServer.address();
      if (!address || typeof address === "string")
        throw new Error("Fixture link server is unavailable");
      await page.goto(`http://127.0.0.1:${address.port}/${kind}`);
    },
    async switchAccount(id: string) {
      const next = await session(id);
      await page.evaluate(async (next) => {
        const { getSupabaseClient } = await import(
          "/client/lib/supabase.ts" as string
        );
        await getSupabaseClient().auth.setSession(next);
      }, next);
    },
    async dispose() {
      await closeFixturePage(page);
      if (linkServer) {
        linkServer.closeAllConnections();
        await new Promise<void>((resolve) =>
          linkServer!.close(() => resolve()),
        );
      }
      await db.close();
    },
  };
}
