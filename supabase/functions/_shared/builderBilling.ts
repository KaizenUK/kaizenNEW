import type { SupabaseClient } from "npm:@supabase/supabase-js@2.98.0";
import { checkFunctionLimit } from "./functionLimits.ts";
import { nativeOperationRequest } from "./builderNativeOperations.ts";
import {
  helperSignatureHeader,
  helperSignatureKey,
  verifyHelperBilling,
} from "../../../shared/builderHelperSignature.ts";
import {
  isRepositoryBillingState,
  isRepositoryUsageSample,
  isRepositoryUsageState,
} from "../../../shared/builderRepositoryBilling.ts";
import { validProjectId } from "../../../shared/builderProjects.ts";
import {
  readJsonObject,
  readRawJsonBody,
  RequestBodyError,
} from "./requestBody.ts";
import {
  Stripe,
  BillingError,
  billingConfig,
  stripeClient,
  stripeRedirect,
  findOrCreateCustomer,
  priceCatalogue,
  subscriptionSnapshot,
  findCheckout,
  checkoutSnapshot,
  type BillingConfig,
  type BillingAccount,
  type CheckoutAttempt,
  type PaidPlan,
} from "./stripeBilling.ts";

type Dependencies = {
  service: SupabaseClient;
  env: (key: string) => string | undefined;
  headers: (request: Request) => Headers;
  originAllowed: (request: Request) => boolean;
  // Tests replace only the HTTP provider boundary on the actual pinned SDK.
  stripe?: (config: BillingConfig) => Stripe;
};
const safeDatabaseMessages = new Set([
  "A confirmed, active account is required",
  "Account deletion has started",
  "Your private beta access does not need a subscription",
  "Choose an available plan",
  "Refresh billing before opening Checkout",
  "Use Manage billing to change your existing subscription",
  "Accept the current documents before subscribing",
  "Close your current Checkout before choosing another plan",
  "Refresh billing before closing this Checkout",
  "Current website publishing permission is required",
  "The reviewed staging output has not been measured. Check its deployment before publishing",
  "Current website editing permission is required",
  "An active website is required to check storage",
  "Website storage changed. Refresh it before retrying",
  "Set up the website billing owner before saving",
  "This website exceeds its current plan. Reduce its pages or files, or ask the billing owner to upgrade",
  "This publication review belongs to different website changes",
  "Refresh this publication before retrying its billing allowance",
  "The monthly publishing limit is reached. Ask the billing owner to upgrade or wait for the next calendar month",
  "Reconcile the earlier publication allowance before retrying",
  "Start with a new publication review",
  "Check the pending repository publication before publishing again",
  "This publication billing observation is stale or belongs to different changes",
  "This publication attempt has already finished",
  "This website exceeds its current plan. Ask the billing owner to reduce usage or upgrade before publishing",
]);
async function rpc<T>(
  service: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await service.rpc(name, args);
  if (error) {
    const message = safeDatabaseMessages.has(error.message)
      ? `${error.message}.`
      : "Billing could not be updated. Refresh billing and try again.";
    throw new BillingError(
      error.code === "P0401"
        ? 401
        : error.code === "P0403"
          ? 403
          : error.code === "P0409"
            ? 409
            : error.code === "P0429"
              ? 429
              : 503,
      message,
    );
  }
  return data as T;
}
function response(headers: Headers, status: number, value: unknown) {
  const outgoing = new Headers(headers);
  outgoing.set("Content-Type", "application/json");
  outgoing.set("Cache-Control", "no-store");
  outgoing.set("X-Content-Type-Options", "nosniff");
  if (status === 503 || status === 409) outgoing.set("Retry-After", "5");
  return new Response(JSON.stringify(value), { status, headers: outgoing });
}
function failure(headers: Headers, error: unknown) {
  if (error instanceof BillingError || error instanceof RequestBodyError)
    return response(headers, error.status, { error: error.message });
  return response(headers, 503, {
    error:
      "Billing is temporarily unavailable. An earlier request may have completed. Refresh billing before trying again.",
  });
}
type Claim = {
  status: "unrelated" | "done" | "busy" | "claimed";
  accountId?: string;
  token?: string;
  pendingCheckout?: CheckoutAttempt | null;
};
export async function reconcileBilling(
  service: SupabaseClient,
  stripe: Stripe,
  config: BillingConfig,
  customerId: string,
  eventId: string,
  kind: string,
) {
  const claim = await rpc<Claim>(service, "builder_billing_claim", {
    stripe_customer: customerId,
    delivery_id: eventId,
    delivery_kind: kind,
  });
  if (claim?.status === "unrelated" || claim?.status === "done") return;
  if (claim?.status === "busy")
    throw new BillingError(
      503,
      "Billing is being refreshed. Try again shortly.",
    );
  if (claim?.status !== "claimed" || !claim.accountId || !claim.token)
    throw new BillingError(503, "Billing refresh could not start.");
  try {
    const subscriptions = await subscriptionSnapshot(
      stripe,
      config,
      claim.accountId,
      customerId,
    );
    const checkouts = [];
    if (claim.pendingCheckout) {
      const current = await findCheckout(
        stripe,
        config,
        claim.pendingCheckout,
        customerId,
      );
      if (current)
        checkouts.push(
          checkoutSnapshot(current, claim.pendingCheckout, customerId, config),
        );
    }
    await rpc(service, "builder_billing_finish", {
      actor: claim.accountId,
      stripe_customer: customerId,
      lease: claim.token,
      delivery_id: eventId,
      subscriptions,
      checkouts,
    });
  } catch (error) {
    // A failed release never clears a newer worker's lease. Uncertain failures
    // leave the event retryable; the response must not acknowledge completion.
    await rpc(service, "builder_billing_release", {
      actor: claim.accountId,
      lease: claim.token,
    }).catch(() => undefined);
    throw error;
  }
}
async function recordCheckout(
  service: SupabaseClient,
  actor: string,
  snapshot: ReturnType<typeof checkoutSnapshot>,
) {
  await rpc(service, "builder_billing_checkout_record", {
    actor,
    attempt_id: snapshot.attemptId,
    stripe_session: snapshot.id,
    next_state: snapshot.status,
  });
}
async function openCheckout(
  deps: Dependencies,
  stripe: Stripe,
  config: BillingConfig,
  actor: string,
  email: string,
  plan: PaidPlan,
) {
  const account = await rpc<BillingAccount>(
    deps.service,
    "builder_billing_customer_begin",
    { actor },
  );
  const customer = await findOrCreateCustomer(stripe, config, account, email);
  await rpc(deps.service, "builder_billing_bind_customer", {
    actor,
    stripe_customer: customer,
  });
  await reconcileBilling(
    deps.service,
    stripe,
    config,
    customer,
    `refresh_${crypto.randomUUID()}`,
    "refresh",
  );
  const attempt = await rpc<CheckoutAttempt>(
    deps.service,
    "builder_billing_checkout_begin",
    { actor, selected_plan: plan, stripe_price: config.prices[plan] },
  );
  let session = await findCheckout(stripe, config, attempt, customer);
  if (!session) {
    if (Date.parse(attempt.expires_at) <= Date.now()) {
      await rpc(deps.service, "builder_billing_checkout_expire_empty", {
        actor,
        attempt_id: attempt.id,
      });
      throw new BillingError(
        409,
        "The previous Checkout has closed. Choose your plan again.",
      );
    }
    session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer,
        client_reference_id: actor,
        line_items: [{ price: attempt.price_id, quantity: 1 }],
        success_url: `${config.origin}/builder/?view=account&billing=returned`,
        cancel_url: `${config.origin}/builder/?view=account&billing=cancelled`,
        expires_at: Math.floor(Date.parse(attempt.expires_at) / 1000),
        metadata: {
          builder_account_id: actor,
          builder_checkout_attempt: attempt.id,
        },
        subscription_data: { metadata: { builder_account_id: actor } },
        expand: ["line_items"],
      },
      { idempotencyKey: `builder-checkout-${attempt.id}` },
    );
  }
  await recordCheckout(
    deps.service,
    actor,
    checkoutSnapshot(session, attempt, customer, config),
  );
  if (session.status !== "open") {
    await reconcileBilling(
      deps.service,
      stripe,
      config,
      customer,
      `refresh_${crypto.randomUUID()}`,
      "refresh",
    );
    throw new BillingError(
      409,
      "That Checkout has finished. Refresh billing to see your current plan.",
    );
  }
  return stripeRedirect(session.url, "checkout");
}
export function createBillingHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const headers = deps.headers(request);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (!deps.originAllowed(request))
      return response(headers, 403, { error: "Forbidden origin" });
    if (request.method !== "POST")
      return response(headers, 405, { error: "Method not allowed" });
    const token = /^Bearer ([^\s]{1,8192})$/i.exec(
      request.headers.get("Authorization") || "",
    )?.[1];
    if (!token)
      return response(headers, 401, { error: "Sign in to manage billing." });
    try {
      const globalLimit = await checkFunctionLimit(
        deps.service,
        "builder-billing",
        headers,
      );
      if (globalLimit) return globalLimit;
      const input = await readJsonObject(request, 4096);
      if (input.action === "native-operation-end")
        return response(
          headers,
          200,
          await nativeOperationRequest({
            service: deps.service,
            request,
            input,
            token,
            secret: deps.env("BUILDER_HOSTED_BILLING_KEY") || "",
          }),
        );
      const { data, error } = await deps.service.auth.getUser(token);
      if (error || !data.user?.email || !data.user.email_confirmed_at)
        return response(headers, 401, {
          error: "Confirm your email and sign in to manage billing.",
        });
      const actor = data.user.id;
      const userLimit = await checkFunctionLimit(
        deps.service,
        "builder-billing",
        headers,
        actor,
      );
      if (userLimit) return userLimit;
      if (
        typeof input.action === "string" &&
        input.action.startsWith("native-operation-")
      )
        return response(
          headers,
          200,
          await nativeOperationRequest({
            service: deps.service,
            request,
            input,
            token,
            actor,
            secret: deps.env("BUILDER_HOSTED_BILLING_KEY") || "",
          }),
        );
      if (
        input.action === "repository-reserve" ||
        input.action === "repository-settle" ||
        input.action === "repository-usage-read" ||
        input.action === "repository-usage-write"
      ) {
        let key: CryptoKey;
        try {
          key = await helperSignatureKey(
            deps.env("BUILDER_HOSTED_BILLING_KEY") || "",
          );
        } catch {
          throw new BillingError(
            503,
            "Repository billing is not configured. Ask the operator to finish the hosted setup.",
          );
        }
        if (
          !(await verifyHelperBilling(
            key,
            request.headers.get(helperSignatureHeader) || "",
            input,
            token,
          ))
        )
          throw new BillingError(
            403,
            "Only the hosted helper can report repository publication billing.",
          );
        if (
          input.action === "repository-usage-read" ||
          input.action === "repository-usage-write"
        ) {
          const write = input.action === "repository-usage-write";
          if (
            typeof input.projectId !== "string" ||
            !validProjectId(input.projectId) ||
            Object.keys(input).some(
              (key) =>
                !(
                  write
                    ? [
                        "action",
                        "projectId",
                        "version",
                        "channel",
                        "sample",
                        "operation",
                      ]
                    : ["action", "projectId"]
                ).includes(key),
            ) ||
            (write &&
              (!Number.isSafeInteger(input.version) ||
                (input.version as number) < 0 ||
                typeof input.channel !== "string" ||
                !isRepositoryUsageSample(input.channel, input.sample) ||
                !["observe", "reserve", "publish"].includes(
                  String(input.operation),
                ) ||
                !["source", "preview"].includes(input.channel)))
          )
            throw new BillingError(400, "Invalid website storage request.");
          const result = await rpc(
            deps.service,
            write
              ? "builder_repository_usage_write"
              : "builder_repository_usage_read",
            {
              target: input.projectId,
              actor,
              ...(write
                ? {
                    expected_version: input.version,
                    channel: input.channel,
                    sample: input.sample,
                    operation: input.operation,
                  }
                : {}),
            },
          );
          if (!isRepositoryUsageState(result))
            throw new BillingError(
              503,
              "Website storage could not be confirmed. Refresh before retrying.",
            );
          return response(headers, 200, result);
        }
        const hash = (value: unknown) =>
          typeof value === "string" &&
          /^([a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
        if (
          typeof input.projectId !== "string" ||
          !validProjectId(input.projectId) ||
          typeof input.reviewId !== "string" ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
            input.reviewId,
          ) ||
          typeof input.binding !== "string" ||
          !/^[a-f0-9]{64}$/.test(input.binding) ||
          !hash(input.commit) ||
          !hash(input.base) ||
          typeof input.stagingArtifact !== "string" ||
          !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(input.stagingArtifact) ||
          !Number.isSafeInteger(input.attempt) ||
          (input.attempt as number) < 1 ||
          Object.keys(input).some(
            (k) =>
              ![
                "action",
                "projectId",
                "reviewId",
                "binding",
                "commit",
                "base",
                "stagingArtifact",
                "attempt",
                "outcome",
              ].includes(k),
          ) ||
          (input.action === "repository-settle"
            ? !["sent", "live", "failed"].includes(String(input.outcome))
            : input.outcome !== undefined)
        )
          throw new BillingError(400, "Invalid repository billing request.");
        const args = {
          target: input.projectId,
          actor,
          request_id: input.reviewId,
          binding: input.binding,
          commit_hash: input.commit,
          expected_attempt: input.attempt,
          staged_artifact: input.stagingArtifact,
        };
        const result =
          input.action === "repository-reserve"
            ? await rpc(deps.service, "builder_repository_publish_begin", {
                ...args,
                base_hash: input.base,
              })
            : await rpc(deps.service, "builder_repository_publish_settle", {
                ...args,
                base_hash: input.base,
                outcome: input.outcome,
              });
        if (!isRepositoryBillingState(result))
          throw new BillingError(
            503,
            "Repository billing could not be confirmed. Check publication status before retrying.",
          );
        return response(headers, 200, result);
      }
      if (
        ![
          "summary",
          "refresh",
          "checkout",
          "portal",
          "close-checkout",
        ].includes(String(input.action))
      )
        return response(headers, 400, { error: "Choose a billing action." });
      // Always derive identity from verified Auth. Neither customer IDs, account
      // IDs, prices nor return URLs in a browser request are used.
      const summary = async () =>
        rpc<Record<string, unknown>>(deps.service, "builder_billing_summary", {
          actor,
        });
      let config: BillingConfig;
      try {
        config = billingConfig(deps.env);
      } catch (error) {
        if (input.action === "summary")
          return response(headers, 200, {
            ...(await summary()),
            available: false,
            prices: [],
          });
        throw error;
      }
      const stripe = (deps.stripe || stripeClient)(config);
      if (input.action === "summary")
        return response(headers, 200, {
          ...(await summary()),
          available: true,
          prices: await priceCatalogue(stripe, config),
        });
      const account = await rpc<BillingAccount>(
        deps.service,
        "builder_billing_account",
        { actor },
      );
      if (input.action === "checkout") {
        if (input.plan !== "plus" && input.plan !== "agency")
          return response(headers, 400, { error: "Choose an available plan." });
        if (account.override_plan)
          return response(headers, 409, {
            error: "Your private beta access does not need a subscription.",
          });
        await priceCatalogue(stripe, config);
        return response(headers, 200, {
          url: await openCheckout(
            deps,
            stripe,
            config,
            actor,
            data.user.email,
            input.plan,
          ),
        });
      }
      if (input.action === "refresh") {
        if (account.customer_id)
          await reconcileBilling(
            deps.service,
            stripe,
            config,
            account.customer_id,
            `refresh_${crypto.randomUUID()}`,
            "refresh",
          );
        return response(headers, 200, {
          ...(await summary()),
          available: true,
          prices: await priceCatalogue(stripe, config),
        });
      }
      if (!account.customer_id)
        return response(headers, 409, {
          error: "This account has no billing subscription to manage.",
        });
      const customer = await findOrCreateCustomer(
        stripe,
        config,
        account,
        data.user.email,
      );
      if (input.action === "portal") {
        // The explicit server-owned configuration restricts the catalogue and
        // cancellation behavior; the browser cannot choose a different one.
        const portal = await stripe.billingPortal.sessions.create({
          customer,
          configuration: config.portalConfiguration,
          return_url: `${config.origin}/builder/?view=account&billing=returned`,
        });
        return response(headers, 200, {
          url: stripeRedirect(portal.url, "portal"),
        });
      }
      const attempt = await rpc<CheckoutAttempt | null>(
        deps.service,
        "builder_billing_pending_checkout",
        { actor },
      );
      if (attempt) {
        let session = await findCheckout(stripe, config, attempt, customer);
        if (!session) {
          if (Date.parse(attempt.expires_at) > Date.now())
            throw new BillingError(
              409,
              "The earlier Checkout may still be opening. Refresh billing before closing it.",
            );
          await rpc(deps.service, "builder_billing_checkout_expire_empty", {
            actor,
            attempt_id: attempt.id,
          });
        } else {
          if (session.status === "open") {
            await stripe.checkout.sessions.expire(
              session.id,
              {},
              { idempotencyKey: `builder-close-checkout-${attempt.id}` },
            );
            session = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ["line_items"],
            });
          }
          await recordCheckout(
            deps.service,
            actor,
            checkoutSnapshot(session, attempt, customer, config),
          );
        }
      }
      await reconcileBilling(
        deps.service,
        stripe,
        config,
        customer,
        `refresh_${crypto.randomUUID()}`,
        "refresh",
      );
      return response(headers, 200, {
        ...(await summary()),
        available: true,
        prices: await priceCatalogue(stripe, config),
      });
    } catch (error) {
      return failure(headers, error);
    }
  };
}
const supportedEvents = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "checkout.session.completed",
  "checkout.session.expired",
]);
export function createBillingWebhookHandler(
  deps: Pick<Dependencies, "service" | "env" | "stripe">,
) {
  return async (request: Request): Promise<Response> => {
    const headers = new Headers();
    if (request.method !== "POST")
      return response(headers, 405, { error: "Method not allowed" });
    const signature = request.headers.get("stripe-signature");
    if (!signature || signature.length > 4096)
      return response(headers, 400, { error: "Invalid webhook signature." });
    try {
      const config = billingConfig(deps.env),
        stripe = (deps.stripe || stripeClient)(config);
      const raw = await readRawJsonBody(request, 1024 * 1024);
      let event: Stripe.Event;
      try {
        event = await stripe.webhooks.constructEventAsync(
          raw,
          signature,
          config.webhookSecret,
          undefined,
          Stripe.createSubtleCryptoProvider(),
        );
      } catch {
        return response(headers, 400, { error: "Invalid webhook signature." });
      }
      // This is a single-account integration: Connect/organisation events and
      // opposite-mode deliveries must never affect the account catalogue.
      if (event.livemode !== config.liveMode || event.account || event.context)
        return response(headers, 400, {
          error: "Unexpected webhook account or mode.",
        });
      if (!supportedEvents.has(event.type))
        return response(headers, 200, { received: true });
      const customer = (
        event.data.object as Stripe.Subscription | Stripe.Checkout.Session
      ).customer;
      if (
        typeof customer !== "string" ||
        !/^cus_[A-Za-z0-9]{1,120}$/.test(customer)
      )
        return response(headers, 400, { error: "Invalid webhook customer." });
      const limited = await checkFunctionLimit(
        deps.service,
        "builder-billing-webhook",
        headers,
      );
      if (limited) return limited;
      await reconcileBilling(
        deps.service,
        stripe,
        config,
        customer,
        event.id,
        event.type,
      );
      return response(headers, 200, { received: true });
    } catch (error) {
      return failure(headers, error);
    }
  };
}
