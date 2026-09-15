import assert from "node:assert/strict";

Deno.test(
  "billing handlers use real Auth/Stripe SDKs and signed provider events at a fixture HTTP boundary",
  async (test) => {
    const actor = "22222222-2222-4222-8222-222222222222",
      foreign = "33333333-3333-4333-8333-333333333333";
    const api = "https://billing-fixture.supabase.test",
      origin = "https://builder.example.test";
    const environment: Record<string, string> = {
      SUPABASE_URL: api,
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
      ALLOWED_STUDIO_ORIGINS: origin,
      PUBLIC_SITE_ORIGIN: origin,
      STRIPE_SECRET_KEY: "sk_test_fixture",
      STRIPE_WEBHOOK_SECRET: "whsec_fixture_signature_only",
      BUILDER_STRIPE_LIVE_MODE: "false",
      BUILDER_STRIPE_PRICE_PLUS: "price_plus",
      BUILDER_STRIPE_PRICE_AGENCY: "price_agency",
      BUILDER_STRIPE_PORTAL_CONFIGURATION: "bpc_fixture",
    };
    const prior = new Map(
      Object.keys(environment).map((key) => [key, Deno.env.get(key)]),
    );
    const originalFetch = globalThis.fetch,
      descriptor = Object.getOwnPropertyDescriptor(Deno, "serve")!;
    const handlers: Array<(request: Request) => Promise<Response>> = [];
    const calls: Array<{
      path: string;
      method: string;
      body: any;
      idempotency: string | null;
    }> = [];
    const now = Math.floor(Date.now() / 1000);
    const account = {
      user_id: actor,
      customer_id: "cus_fixture",
      customer_attempt: "44444444-4444-4444-8444-444444444444",
      customer_attempt_at: new Date().toISOString(),
      override_plan: null,
    };
    const attempt = {
      id: "55555555-5555-4555-8555-555555555555",
      user_id: actor,
      plan_id: "plus",
      price_id: "price_plus",
      session_id: null,
      state: "pending",
      created_at: new Date().toISOString(),
      expires_at: new Date((now + 3600) * 1000).toISOString(),
    };
    let deletedCustomer = false;
    let confirmed = true,
      expired = false,
      wrongCustomer = false,
      busy = false,
      leaseFailure = false,
      providerFailure = false;
    let customerSearch = false,
      customerAttemptOld = false,
      currentStatus = "active",
      currentPrice = "price_plus",
      currentQuantity = 1;
    let checkoutExisting = false,
      checkoutState = "open",
      redirectOverride = "",
      checkoutNetworkLoss = 0,
      pending = false;
    const price = (id: string) => ({
      id,
      object: "price",
      active: true,
      livemode: false,
      type: "recurring",
      currency: "gbp",
      unit_amount: id === "price_plus" ? 1900 : 5900,
      billing_scheme: "per_unit",
      tax_behavior: "unspecified",
      recurring: {
        interval: "month",
        interval_count: 1,
        usage_type: "licensed",
      },
    });
    const customer = () => ({
      id: "cus_fixture",
      object: "customer",
      livemode: false,
      email: "fixture@example.test",
      metadata: { builder_account_id: wrongCustomer ? foreign : actor },
    });
    const session = () => ({
      id: "cs_test_fixture",
      object: "checkout.session",
      customer: "cus_fixture",
      livemode: false,
      mode: "subscription",
      status: checkoutState,
      client_reference_id: actor,
      metadata: {
        builder_account_id: actor,
        builder_checkout_attempt: attempt.id,
      },
      line_items: {
        object: "list",
        has_more: false,
        data: [
          {
            id: "li_fixture",
            object: "item",
            price: price("price_plus"),
            quantity: 1,
          },
        ],
      },
      url:
        redirectOverride || "https://checkout.stripe.com/c/pay/cs_test_fixture",
    });
    const list = (data: any[]) => ({ object: "list", has_more: false, data });
    const reset = () => {
      deletedCustomer = false;
      calls.length = 0;
      confirmed = true;
      expired = false;
      wrongCustomer = false;
      busy = false;
      leaseFailure = false;
      providerFailure = false;
      customerSearch = false;
      customerAttemptOld = false;
      currentStatus = "active";
      currentPrice = "price_plus";
      currentQuantity = 1;
      checkoutExisting = false;
      checkoutState = "open";
      redirectOverride = "";
      checkoutNetworkLoss = 0;
      pending = false;
    };
    try {
      for (const [key, value] of Object.entries(environment))
        Deno.env.set(key, value);
      Object.defineProperty(Deno, "serve", {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        writable: true,
        value: (handler: (request: Request) => Promise<Response>) => {
          handlers.push(handler);
        },
      });
      globalThis.fetch = async (input, init) => {
        const request = new Request(input, init),
          url = new URL(request.url),
          text = request.method === "POST" ? await request.text() : "";
        const body =
          url.origin === api
            ? text
              ? JSON.parse(text)
              : null
            : Object.fromEntries(new URLSearchParams(text));
        calls.push({
          path: url.pathname,
          method: request.method,
          body,
          idempotency: request.headers.get("idempotency-key"),
        });
        if (url.origin === api) {
          if (url.pathname === "/auth/v1/user") {
            assert.equal(
              request.headers.get("authorization"),
              "Bearer fixture-session",
            );
            return expired
              ? Response.json({ message: "Fixture expired" }, { status: 401 })
              : Response.json({
                  id: actor,
                  email: "fixture@example.test",
                  aud: "authenticated",
                  created_at: new Date().toISOString(),
                  email_confirmed_at: confirmed
                    ? new Date().toISOString()
                    : null,
                });
          }
          assert.equal(
            request.headers.get("authorization"),
            "Bearer fixture-service-key",
          );
          switch (url.pathname.split("/").at(-1)) {
            case "builder_consume_function_limit":
              return Response.json({ allowed: true, retryAfter: 0 });
            case "builder_billing_summary":
              assert.equal(body.actor, actor);
              return Response.json({
                plan: { id: "free" },
                hasCustomer: true,
                subscriptions: [],
                plans: [],
              });
            case "builder_billing_account":
            case "builder_billing_customer_begin":
              assert.equal(body.actor, actor);
              return Response.json({
                ...account,
                customer_id: customerSearch ? null : account.customer_id,
                customer_attempt_at: customerAttemptOld
                  ? new Date(Date.now() - 25 * 3600000).toISOString()
                  : account.customer_attempt_at,
              });
            case "builder_billing_bind_customer":
              assert.deepEqual(body, { actor, stripe_customer: "cus_fixture" });
              return Response.json(null);
            case "builder_billing_claim":
              assert.equal(body.stripe_customer, "cus_fixture");
              return Response.json(
                busy
                  ? { status: "busy" }
                  : {
                      status: "claimed",
                      accountId: actor,
                      token: "66666666-6666-4666-8666-666666666666",
                      pendingCheckout: pending
                        ? {
                            ...attempt,
                            session_id: checkoutExisting
                              ? "cs_test_fixture"
                              : null,
                          }
                        : null,
                    },
              );
            case "builder_billing_finish":
              assert.equal(body.actor, actor);
              return leaseFailure
                ? Response.json(
                    { code: "P0409", message: "Private database lease detail" },
                    { status: 400 },
                  )
                : Response.json(null);
            case "builder_billing_release":
              return Response.json(null);
            case "builder_billing_checkout_begin":
              assert.deepEqual(body, {
                actor,
                selected_plan: "plus",
                stripe_price: "price_plus",
              });
              return Response.json(attempt);
            case "builder_billing_checkout_record":
              assert.equal(body.actor, actor);
              assert.equal(body.attempt_id, attempt.id);
              return Response.json(null);
            case "builder_billing_pending_checkout":
              return Response.json({
                ...attempt,
                session_id: "cs_test_fixture",
              });
            default:
              throw new Error(`Unexpected fixture RPC: ${url.pathname}`);
          }
        }
        assert.equal(
          url.origin,
          "https://api.stripe.com",
          "No real account/provider network access is allowed",
        );
        assert.equal(
          request.headers.get("authorization"),
          "Bearer sk_test_fixture",
        );
        assert.match(
          request.headers.get("stripe-version") || "",
          /^2026-\d{2}-\d{2}\.dahlia$/,
        );
        if (providerFailure)
          return Response.json(
            {
              error: {
                type: "api_error",
                message: "Fixture private provider failure",
              },
            },
            { status: 503 },
          );
        if (url.pathname.startsWith("/v1/prices/"))
          return Response.json(price(url.pathname.split("/").at(-1)!));
        if (url.pathname === "/v1/customers/search") {
          assert.equal(
            url.searchParams.get("query"),
            `metadata['builder_account_id']:'${actor}'`,
          );
          return Response.json({
            object: "search_result",
            has_more: false,
            data: customerAttemptOld ? [customer()] : [],
          });
        }
        if (url.pathname === "/v1/customers" && request.method === "POST") {
          assert.equal(body["metadata[builder_account_id]"], actor);
          return Response.json(customer());
        }
        if (url.pathname === "/v1/customers/cus_fixture")
          return Response.json(
            deletedCustomer
              ? { id: "cus_fixture", object: "customer", deleted: true }
              : customer(),
          );
        if (url.pathname === "/v1/subscriptions") {
          if (currentStatus === "none") return Response.json(list([]));
          assert.equal(url.searchParams.get("customer"), "cus_fixture");
          assert.equal(url.searchParams.get("status"), "all");
          return Response.json(
            list([
              {
                id: "sub_fixture",
                object: "subscription",
                customer: "cus_fixture",
                livemode: false,
                status: currentStatus,
                cancel_at_period_end: false,
                items: list([
                  {
                    id: "si_fixture",
                    price: price(currentPrice),
                    quantity: currentQuantity,
                    current_period_end: now + 86400,
                  },
                ]),
              },
            ]),
          );
        }
        if (
          url.pathname === "/v1/checkout/sessions" &&
          request.method === "GET"
        )
          return Response.json(list(checkoutExisting ? [session()] : []));
        if (
          url.pathname === "/v1/checkout/sessions" &&
          request.method === "POST"
        ) {
          assert.equal(body.mode, "subscription");
          assert.equal(body.customer, "cus_fixture");
          assert.equal(body.client_reference_id, actor);
          assert.equal(body["line_items[0][price]"], "price_plus");
          assert.equal(body["line_items[0][quantity]"], "1");
          assert.equal(
            body.success_url,
            `${origin}/builder/?view=account&billing=returned`,
          );
          assert.equal(
            body.cancel_url,
            `${origin}/builder/?view=account&billing=cancelled`,
          );
          assert.equal(
            body.expires_at,
            String(Math.floor(Date.parse(attempt.expires_at) / 1000)),
          );
          assert.equal(body["metadata[builder_checkout_attempt]"], attempt.id);
          assert.equal(
            body["subscription_data[metadata][builder_account_id]"],
            actor,
          );
          if (checkoutNetworkLoss-- > 0)
            throw new TypeError(
              "Fixture response lost after provider accepted Checkout",
            );
          return Response.json(session());
        }
        if (url.pathname === "/v1/checkout/sessions/cs_test_fixture/expire") {
          checkoutState = "expired";
          return Response.json(session());
        }
        if (url.pathname === "/v1/checkout/sessions/cs_test_fixture")
          return Response.json(session());
        if (url.pathname === "/v1/billing_portal/sessions") {
          assert.equal(body.customer, "cus_fixture");
          assert.equal(body.configuration, "bpc_fixture");
          assert.equal(
            body.return_url,
            `${origin}/builder/?view=account&billing=returned`,
          );
          return Response.json({
            id: "bps_fixture",
            object: "billing_portal.session",
            url:
              redirectOverride ||
              "https://billing.stripe.com/p/session/fixture",
          });
        }
        throw new Error(`Unexpected fixture Stripe request: ${url.pathname}`);
      };
      await import("../../supabase/functions/builder-billing/index.ts");
      await import("../../supabase/functions/builder-billing-webhook/index.ts");
      assert.equal(handlers.length, 2);
      const send = (
        action: string,
        extra: Record<string, unknown> = {},
        headers: Record<string, string> = {},
      ) =>
        handlers[0](
          new Request(api + "/functions/v1/builder-billing", {
            method: "POST",
            headers: {
              Origin: origin,
              Authorization: "Bearer fixture-session",
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify({ action, ...extra }),
          }),
        );
      const event = (overrides = {}) => ({
        id: "evt_fixture",
        object: "event",
        livemode: false,
        type: "customer.subscription.updated",
        created: now - 5000,
        data: {
          object: {
            id: "sub_fixture",
            object: "subscription",
            customer: "cus_fixture",
            status: "canceled",
          },
        },
        ...overrides,
      });
      const signed = async (raw: string, stamp = now) => {
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(environment.STRIPE_WEBHOOK_SECRET),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const signature = new Uint8Array(
          await crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(`${stamp}.${raw}`),
          ),
        );
        return `t=${stamp},v1=${Array.from(signature, (n) => n.toString(16).padStart(2, "0")).join("")}`;
      };
      const webhook = async (
        value = event(),
        extra: Record<string, string> = {},
      ) => {
        const raw = JSON.stringify(value);
        return handlers[1](
          new Request(api + "/functions/v1/builder-billing-webhook", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "stripe-signature": await signed(raw),
              ...extra,
            },
            body: raw,
          }),
        );
      };
      await test.step("rejects wrong origins, missing/expired/unconfirmed Auth and oversized bodies before provider actions", async () => {
        reset();
        assert.equal(
          (
            await send(
              "checkout",
              {},
              { Origin: "https://attacker.example.test" },
            )
          ).status,
          403,
        );
        assert.equal(calls.length, 0);
        assert.equal(
          (await send("portal", {}, { Authorization: "" })).status,
          401,
        );
        assert.equal(calls.length, 0);
        expired = true;
        assert.equal((await send("portal")).status, 401);
        expired = false;
        confirmed = false;
        assert.equal((await send("checkout")).status, 401);
        confirmed = true;
        assert.equal(
          (await send("summary", { padding: "x".repeat(5000) })).status,
          413,
        );
        assert.equal(calls.filter((c) => c.path.startsWith("/v1/")).length, 0);
      });
      await test.step("summary and configured prices do not expose Stripe customer IDs or private configuration", async () => {
        reset();
        const result = await send("summary", { actor: foreign });
        assert.equal(result.status, 200);
        const body = await result.json();
        assert.equal(body.available, true);
        assert.deepEqual(
          body.prices.map((p: any) => [p.planId, p.amount]),
          [
            ["plus", 1900],
            ["agency", 5900],
          ],
        );
        assert.doesNotMatch(
          JSON.stringify(body),
          /cus_fixture|sk_test_fixture|whsec_|customer_attempt/,
        );
        Deno.env.delete("STRIPE_SECRET_KEY");
        const unavailable = await send("summary");
        assert.equal(unavailable.status, 200);
        assert.equal((await unavailable.json()).available, false);
        Deno.env.set("STRIPE_SECRET_KEY", environment.STRIPE_SECRET_KEY);
      });
      await test.step("Checkout uses only verified identity, server price/return URLs and a durable idempotency key", async () => {
        reset();
        currentStatus = "none";
        const result = await send("checkout", {
          plan: "plus",
          actor: foreign,
          customer: "cus_other",
          price: "price_cheaper",
          returnUrl: "https://attacker.example.test",
        });
        assert.equal(result.status, 200);
        assert.equal(
          (await result.json()).url,
          "https://checkout.stripe.com/c/pay/cs_test_fixture",
        );
        const created = calls.find(
          (c) => c.path === "/v1/checkout/sessions" && c.method === "POST",
        )!;
        assert.equal(created.idempotency, `builder-checkout-${attempt.id}`);
        assert.equal(
          calls.filter((c) =>
            c.path.endsWith("builder_billing_checkout_record"),
          ).length,
          1,
        );
      });
      await test.step("the real SDK retries a lost Checkout response with the same idempotency key", async () => {
        reset();
        currentStatus = "none";
        checkoutNetworkLoss = 1;
        const result = await send("checkout", { plan: "plus" });
        assert.equal(result.status, 200);
        const creates = calls.filter(
          (c) => c.path === "/v1/checkout/sessions" && c.method === "POST",
        );
        assert.equal(creates.length, 2);
        assert.equal(creates[0].idempotency, creates[1].idempotency);
        assert.deepEqual(creates[0].body, creates[1].body);
      });
      await test.step("recovers an existing customer or Checkout after lost database binding without creating a second one", async () => {
        reset();
        currentStatus = "none";
        customerSearch = true;
        customerAttemptOld = true;
        checkoutExisting = true;
        const result = await send("checkout", { plan: "plus" });
        assert.equal(result.status, 200);
        assert.equal(
          calls.filter(
            (c) =>
              c.method === "POST" &&
              ["/v1/customers", "/v1/checkout/sessions"].includes(c.path),
          ).length,
          0,
        );
      });
      await test.step("creates a first customer with the stored attempt key and immutable account metadata", async () => {
        reset();
        customerSearch = true;
        currentStatus = "none";
        const result = await send("checkout", { plan: "plus" });
        assert.equal(result.status, 200);
        const created = calls.filter(
          (c) => c.path === "/v1/customers" && c.method === "POST",
        );
        assert.equal(created.length, 1);
        assert.equal(
          created[0].idempotency,
          `builder-customer-${account.customer_attempt}`,
        );
        assert.equal(created[0].body["metadata[builder_account_id]"], actor);
      });
      await test.step("portal and explicit Checkout closing remain scoped to the verified account", async () => {
        reset();
        assert.equal(
          (
            await send("portal", {
              customer: "cus_other",
              configuration: "bpc_other",
            })
          ).status,
          200,
        );
        const result = await send("close-checkout");
        assert.equal(result.status, 200);
        const closed = calls.find((c) => c.path.endsWith("/expire"))!;
        assert.equal(
          closed.idempotency,
          `builder-close-checkout-${attempt.id}`,
        );
        assert.equal(
          calls.find((c) => c.path.endsWith("builder_billing_checkout_record"))!
            .body.next_state,
          "expired",
        );
      });
      await test.step("rejects mismatched customer metadata and unsafe provider redirects without exposing private errors", async () => {
        reset();
        wrongCustomer = true;
        assert.equal((await send("portal")).status, 503);
        assert.equal(
          calls.filter((c) => c.path === "/v1/billing_portal/sessions").length,
          0,
        );
        reset();
        redirectOverride =
          "https://billing.stripe.com.attacker.example.test/session";
        const result = await send("portal");
        assert.equal(result.status, 503);
        assert.doesNotMatch(await result.text(), /attacker/);
      });
      await test.step("valid signed delayed events fetch current provider state instead of trusting embedded subscription snapshots", async () => {
        reset();
        const result = await webhook();
        assert.equal(result.status, 200);
        const commit = calls.find((c) =>
          c.path.endsWith("builder_billing_finish"),
        )!.body;
        assert.equal(commit.subscriptions[0].status, "active");
        assert.equal(commit.subscriptions[0].planId, "plus");
        assert.equal(commit.delivery_id, "evt_fixture");
        assert.equal(commit.actor, actor);
        assert.equal(commit.stripe_customer, "cus_fixture");
      });
      await test.step("an authoritative deleted customer removes paid entitlement instead of retaining an old snapshot", async () => {
        reset();
        deletedCustomer = true;
        assert.equal((await webhook()).status, 200);
        assert.deepEqual(
          calls.find((c) => c.path.endsWith("builder_billing_finish"))!.body
            .subscriptions,
          [],
        );
        assert.equal(
          calls.filter((c) => c.path === "/v1/subscriptions").length,
          0,
        );
      });
      await test.step("unknown prices and quantities never grant a paid plan", async () => {
        reset();
        currentPrice = "price_unknown";
        assert.equal((await webhook()).status, 200);
        assert.equal(
          calls.find((c) => c.path.endsWith("builder_billing_finish"))!.body
            .subscriptions[0].planId,
          null,
        );
        reset();
        currentQuantity = 2;
        assert.equal((await webhook()).status, 200);
        assert.equal(
          calls.find((c) => c.path.endsWith("builder_billing_finish"))!.body
            .subscriptions[0].planId,
          null,
        );
      });
      await test.step("rejects invalid, expired, tampered, opposite-mode and Connect signatures before database processing", async () => {
        reset();
        assert.equal(
          (await webhook(event(), { "stripe-signature": "t=0,v1=forged" }))
            .status,
          400,
        );
        const raw = JSON.stringify(event());
        assert.equal(
          (
            await webhook(event(), {
              "stripe-signature": await signed(raw, now - 301),
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await webhook(event(), {
              "stripe-signature": await signed(raw + " "),
            })
          ).status,
          400,
        );
        assert.equal((await webhook(event({ livemode: true }))).status, 400);
        assert.equal(
          (await webhook(event({ account: "acct_foreign" }))).status,
          400,
        );
        assert.equal(calls.length, 0);
      });
      await test.step("bounds raw webhook bytes and rejects compressed bodies before signature verification", async () => {
        reset();
        const tooLarge = await webhook(
          event({ padding: "x".repeat(1024 * 1024) }),
        );
        assert.equal(tooLarge.status, 413);
        assert.equal(
          (await webhook(event(), { "Content-Encoding": "gzip" })).status,
          415,
        );
        assert.equal(calls.length, 0);
      });
      await test.step("busy, failed provider reads and expired database leases remain retryable and never acknowledge success", async () => {
        reset();
        busy = true;
        assert.equal((await webhook()).status, 503);
        assert.equal(calls.filter((c) => c.path.startsWith("/v1/")).length, 0);
        reset();
        providerFailure = true;
        const result = await webhook();
        assert.equal(result.status, 503);
        assert.doesNotMatch(await result.text(), /private provider/);
        assert.equal(
          calls.filter((c) => c.path.endsWith("builder_billing_finish")).length,
          0,
        );
        assert.equal(
          calls.filter((c) => c.path.endsWith("builder_billing_release"))
            .length,
          1,
        );
        reset();
        leaseFailure = true;
        const stale = await webhook();
        assert.equal(stale.status, 409);
        assert.doesNotMatch(await stale.text(), /Private database/);
      });
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(Deno, "serve", descriptor);
      for (const [key, value] of prior) {
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      }
    }
  },
);
