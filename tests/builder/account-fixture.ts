import { closeFixturePage, fixtureRoute } from "./fixture-routes";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { Page } from "./browser-fixture";
import { bootstrapAccount } from "../../supabase/functions/_shared/builderSignup";
import { createAccountHandler } from "../../supabase/functions/_shared/builderAccounts";
import { domainProjectAction } from "../../supabase/functions/_shared/builderDomains";
import { clientPublicationAction } from "../../supabase/functions/_shared/clientPublication";
export const accountOwner = "11111111-1111-4111-8111-111111111111",
  accountPerson = "22222222-2222-4222-8222-222222222222",
  accountOtherOwner = "33333333-3333-4333-8333-333333333333";
export const accountNew = "44444444-4444-4444-8444-444444444444";
const beta = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const authOrigin = "https://account-fixture.supabase.test";

/** The browser uses the real Supabase SDK and Account UI. Only the provider's
 * HTTP boundary is fake; deletion RPCs execute the actual PostgreSQL migrations. */
export async function accountFixture(
  page: Page,
  options: {
    signedOut?: boolean;
    signup?: boolean;
    invited?: boolean;
    initialAccount?: string;
    initialView?: "account" | "pages";
    needsLegalAcceptance?: boolean;
    billing?: boolean;
    domains?: boolean;
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
    create table public.contact_form_submissions(name text,last_name text,email text,phone text,website text,message text,marketing_consent boolean,consent_to_gdpr boolean,source_page text,user_agent text);
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ('${accountOwner}','owner@example.test',now(),'{"full_name":"Garden owner"}'),
    ('${accountPerson}','alex@example.test',now(),'{}'),
    ('${accountOtherOwner}','other-owner@example.test',now(),'{"full_name":"Second owner"}');`);
  const billingMigrations = [
    "202609150002_builder_billing.sql",
    "202609150003_builder_plan_limits.sql",
    "202609150004_builder_repository_billing.sql",
    "202609150005_builder_repository_usage.sql",
    "202609150006_builder_repository_outputs.sql",
    "202609150007_builder_billing_recovery.sql",
  ];
  const skipped = new Set([
    "202609120003_builder_error_retention.sql",
    "202609140002_builder_function_limit_retention.sql",
    "202609140005_builder_privacy_retention.sql",
    "202609150008_builder_billing_retention.sql",
    ...billingMigrations,
    "202609150009_builder_domains.sql",
  ]);
  for (const file of (await readdir("supabase/migrations")).sort()) {
    if (
      !/^\d+_(?:visual_builder|builder_.*)\.sql$/.test(file) ||
      skipped.has(file)
    )
      continue;
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
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
  // Existing owners receive the same migration backfill as production. New
  // fixture signups and invited editors retain normal Free account behavior.
  for (const file of [...billingMigrations, "202609150009_builder_domains.sql"])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  const state = {
    domainRequests: [] as {
      actor: string;
      action: string;
      domainId?: string;
    }[],
    domainSetupAvailable: !!options.domains,
    loseDomainResponse: false,
    billingRequests: [] as { actor: string; action: string; plan?: string }[],
    billingAvailable: !!options.billing,
    loseCheckoutResponse: false,
    checkoutSessions: [] as string[],
    signupRequests: [] as {
      email: string;
      name: string;
      redirectTo: string | null;
    }[],
    confirmations: [] as { email: string; redirectTo: string | null }[],
    bootstrapActors: [] as string[],
    signupFailure: false,
    confirmationFailure: false,
    bootstrapFailureAfterCommit: false,
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
          email_confirmed_at: row.email_confirmed_at,
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
    if (url.pathname === "/auth/v1/signup") {
      const body = request.postDataJSON();
      state.signupRequests.push({
        email: body.email,
        name: body.data?.full_name,
        redirectTo: url.searchParams.get("redirect_to"),
      });
      if (!options.signup)
        throw new Error("Unexpected signup outside its fixture");
      if (!(await readUser(accountNew))) {
        await db.query(
          "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
          [accountNew, body.email, JSON.stringify(body.data)],
        );
        state.password = body.password;
      }
      await reply(
        state.signupFailure
          ? {
              code: "unexpected_failure",
              message: "Private fixture signup detail",
            }
          : await readUser(accountNew),
        state.signupFailure ? 503 : 200,
      );
      return;
    }
    if (url.pathname === "/auth/v1/resend") {
      const body = request.postDataJSON();
      if (body.type !== "signup")
        throw new Error("Unexpected confirmation type");
      state.confirmations.push({
        email: body.email,
        redirectTo: url.searchParams.get("redirect_to"),
      });
      await reply(
        state.confirmationFailure
          ? {
              code: "over_email_send_rate_limit",
              message: "Private fixture resend detail",
            }
          : {},
        state.confirmationFailure ? 429 : 200,
      );
      return;
    }
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
      const loginActor = options.signup ? accountNew : accountPerson;
      const person = await readUser(loginActor);
      const code =
        state.loginError ||
        (person && !person.email_confirmed_at
          ? "email_not_confirmed"
          : undefined) ||
        (body.email !== person?.email || body.password !== state.password
          ? "invalid_credentials"
          : undefined);
      await reply(
        code
          ? { code, message: "Private fixture sign-in detail" }
          : await session(loginActor),
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
    if (url.pathname === "/functions/v1/builder-billing") {
      const input = request.postDataJSON();
      state.billingRequests.push({
        actor,
        action: input.action,
        ...(input.plan ? { plan: input.plan } : {}),
      });
      const prices = [
        {
          planId: "plus",
          amount: 1900,
          currency: "gbp",
          interval: "month",
          taxBehavior: "exclusive",
        },
        {
          planId: "agency",
          amount: 5900,
          currency: "gbp",
          interval: "month",
          taxBehavior: "exclusive",
        },
      ];
      try {
        await db.query("select builder_billing_account($1)", [actor]);
        if (
          ["checkout", "portal", "close-checkout"].includes(input.action) &&
          !state.billingAvailable
        ) {
          await reply({ error: "Paid plans are not available yet." }, 503);
          return;
        }
        if (input.action === "checkout") {
          if (!["plus", "agency"].includes(input.plan))
            throw new Error("Choose an available plan");
          // Synthetic provider observations feed the actual durable database
          // transitions. The separate Edge suite verifies real SDK/signatures.
          await db.query("select builder_billing_bind_customer($1,$2)", [
            actor,
            `cus_${actor.replaceAll("-", "")}`,
          ]);
          await db.query(
            "update builder_billing_accounts set verified_at=clock_timestamp() where user_id=$1",
            [actor],
          );
          const attempt = (
            await db.query<any>(
              "select builder_billing_checkout_begin($1,$2,$3) as result",
              [actor, input.plan, `price_${input.plan}`],
            )
          ).rows[0].result;
          const sessionId = `cs_test_${attempt.id.replaceAll("-", "")}`;
          await db.query(
            "select builder_billing_checkout_record($1,$2,$3,'open')",
            [actor, attempt.id, sessionId],
          );
          state.checkoutSessions.push(sessionId);
          if (state.loseCheckoutResponse) {
            state.loseCheckoutResponse = false;
            await reply(
              {
                error:
                  "The earlier request may have completed. Refresh billing before trying again.",
              },
              503,
            );
            return;
          }
          await reply({
            url: `https://checkout.stripe.com/c/pay/${sessionId}`,
          });
          return;
        }
        if (input.action === "portal") {
          await reply({ url: "https://billing.stripe.com/p/session/fixture" });
          return;
        }
        if (input.action === "close-checkout") {
          const attempt = (
            await db.query<any>(
              "select builder_billing_pending_checkout($1) as result",
              [actor],
            )
          ).rows[0].result;
          if (attempt)
            await db.query(
              "select builder_billing_checkout_record($1,$2,$3,'expired')",
              [actor, attempt.id, attempt.session_id],
            );
        }
        if (input.action === "refresh")
          await db.query(
            "update builder_billing_accounts set verified_at=clock_timestamp() where user_id=$1",
            [actor],
          );
        const result = (
          await db.query<any>("select builder_billing_summary($1) as result", [
            actor,
          ])
        ).rows[0].result;
        await reply({
          ...result,
          available: state.billingAvailable,
          prices: state.billingAvailable ? prices : [],
        });
      } catch (error) {
        await reply({ error: error.message }, 409);
      }
      return;
    }
    if (url.pathname === "/functions/v1/builder-projects") {
      const input = request.postDataJSON();
      if (
        [
          "domain-state",
          "domain-add",
          "domain-verify",
          "domain-remove",
        ].includes(input.action)
      ) {
        state.domainRequests.push({
          actor,
          action: input.action,
          domainId: input.domainId,
        });
        const result = await domainProjectAction({
          projectId: input.projectId,
          actor,
          input,
          configuration: state.domainSetupAvailable
            ? JSON.stringify({
                workerId: "fixture-domains",
                ipv4: ["144.91.72.17"],
                ipv6: [],
                reservedHostnames: ["kaizenweb.co.uk"],
              })
            : undefined,
          service: {
            rpc: async (name, args) => {
              if (
                !["builder_domain_state", "builder_domain_request"].includes(
                  name,
                )
              )
                throw new Error("Unexpected domain RPC");
              try {
                const entries = Object.entries(args);
                const data = (
                  await db.query<any>(
                    `select ${name}(${entries.map(([key], index) => `${key}=>$${index + 1}`).join(",")}) as value`,
                    entries.map(([, value]) => value),
                  )
                ).rows[0].value;
                return { data, error: null };
              } catch (error) {
                return {
                  data: null,
                  error: { code: error.code, message: error.message },
                };
              }
            },
          },
        });
        if (
          state.loseDomainResponse &&
          input.action !== "domain-state" &&
          result.status === 200
        ) {
          state.loseDomainResponse = false;
          await reply(
            {
              error:
                "The earlier domain request may have completed. Refresh its status before trying again.",
            },
            503,
          );
        } else await reply(result.body, result.status);
        return;
      }
      if (input.action === "client-release-list") {
        const data = await clientPublicationAction({
          actor,
          projectId: input.projectId,
          input,
          service: {},
          user: {
            rpc: async (name, args) => {
              if (name !== "builder_client_history")
                throw new Error("Unexpected release RPC");
              try {
                const data = await db.transaction(async (tx) => {
                  await tx.query(
                    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",
                    [actor],
                  );
                  await tx.exec("set local role authenticated");
                  return (
                    await tx.query<any>(
                      "select builder_client_history($1,$2) as value",
                      [args.target, args.before_job],
                    )
                  ).rows[0].value;
                });
                return { data, error: null };
              } catch (error) {
                return { data: null, error: { message: error.message } };
              }
            },
          },
        });
        await reply(data);
        return;
      }
      if (
        input.action === "project-billing" ||
        input.action === "take-billing"
      ) {
        try {
          if (input.action === "take-billing") {
            if (input.confirm !== true)
              throw new Error("Confirm using your own plan");
            await db.query("select builder_take_project_billing($1,$2)", [
              input.projectId,
              actor,
            ]);
          }
          await reply(
            (
              await db.query<any>(
                "select builder_project_billing_summary($1,$2) as result",
                [input.projectId, actor],
              )
            ).rows[0].result,
          );
        } catch (error) {
          await reply({ error: error.message }, 409);
        }
        return;
      }
      if (input.action === "bootstrap") {
        state.bootstrapActors.push(actor);
        const response = await bootstrapAccount(
          {
            rpc: async (name, args) => {
              if (name !== "builder_bootstrap_account")
                throw new Error("Unexpected bootstrap RPC");
              try {
                return {
                  data: (
                    await db.query<any>(
                      "select builder_bootstrap_account($1) as result",
                      [args.actor],
                    )
                  ).rows[0].result,
                  error: null,
                };
              } catch (failure) {
                return { data: null, error: { code: failure.code } };
              }
            },
          },
          actor,
        );
        if (state.bootstrapFailureAfterCommit && response.status === 200) {
          state.bootstrapFailureAfterCommit = false;
          await reply(
            {
              error:
                "Your first project could not be confirmed. Retry to check its status.",
            },
            503,
          );
        } else await reply(response.body, response.status);
        return;
      }
      if (input.action === "list") {
        const rows = (
          await db.query<any>(
            "select p.id,p.name,p.archived,p.version,m.role,m.can_publish from builder_projects p join builder_project_members m on m.project_id=p.id where m.user_id=$1",
            [actor],
          )
        ).rows;
        const destinations = (
          await db.query<any>(
            "select project_id,environment,origin from builder_client_destinations where enabled",
          )
        ).rows;
        await reply(
          rows.map((row) => ({
            ...project,
            id: row.id,
            name: row.name,
            archived: row.archived,
            version: row.version,
            ...(destinations.some(
              (destination) => destination.project_id === row.id,
            )
              ? {
                  destination: {
                    kind: "client-configured",
                    label: destinations
                      .filter(
                        (destination) => destination.project_id === row.id,
                      )
                      .map(
                        (destination) =>
                          `${destination.environment}: ${destination.origin}`,
                      )
                      .join(" · "),
                  },
                }
              : {}),
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
  const initial =
    options.signedOut || options.signup
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
    if (!["invite", "recovery", "expired", "signup"].includes(kind))
      throw new Error("Unknown fixture link");
    const destination = new URL(
      kind === "signup"
        ? "/builder/"
        : `/builder/?project=${project.id}&view=account&password=setup`,
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
      if (kind === "signup")
        await db.query(
          "update auth.users set email_confirmed_at=now() where id=$1",
          [accountNew],
        );
      const next = await session(
        kind === "signup" ? accountNew : accountPerson,
      );
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
    options.signup
      ? "/builder/"
      : `/builder/?project=${project.id}${options.initialView === "pages" ? "" : "&view=account"}`,
  );
  return {
    db,
    state,
    project,
    readUser,
    async openPasswordLink(kind: "invite" | "recovery" | "expired" | "signup") {
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
