import Stripe from "npm:stripe@22.6.2";

export { Stripe };
export type PaidPlan = "plus" | "agency";
export type BillingConfig = {
  secretKey: string;
  webhookSecret: string;
  liveMode: boolean;
  origin: string;
  prices: Record<PaidPlan, string>;
  portalConfiguration: string;
};
export class BillingError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function billingConfig(
  env: (key: string) => string | undefined,
): BillingConfig {
  const secretKey = env("STRIPE_SECRET_KEY") || "";
  const webhookSecret = env("STRIPE_WEBHOOK_SECRET") || "";
  const mode = env("BUILDER_STRIPE_LIVE_MODE");
  const prices = {
    plus: env("BUILDER_STRIPE_PRICE_PLUS") || "",
    agency: env("BUILDER_STRIPE_PRICE_AGENCY") || "",
  };
  const portalConfiguration = env("BUILDER_STRIPE_PORTAL_CONFIGURATION") || "";
  const origin = env("PUBLIC_SITE_ORIGIN") || "";
  let validOrigin = false;
  try {
    const url = new URL(origin);
    validOrigin = url.protocol === "https:" && url.origin === origin;
  } catch {
    /* Configuration is reported without its contents. */
  }
  if (
    !validOrigin ||
    !["true", "false"].includes(mode || "") ||
    !secretKey.startsWith(mode === "true" ? "sk_live_" : "sk_test_") ||
    !webhookSecret.startsWith("whsec_") ||
    !/^bpc_[A-Za-z0-9]+$/.test(portalConfiguration) ||
    Object.values(prices).some(
      (price) => !/^price_[A-Za-z0-9]+$/.test(price),
    ) ||
    prices.plus === prices.agency
  )
    throw new BillingError(
      503,
      "Paid plans are not available yet. Your saved work is safe.",
    );
  return {
    secretKey,
    webhookSecret,
    liveMode: mode === "true",
    origin,
    prices,
    portalConfiguration,
  };
}
export function stripeClient(config: BillingConfig): Stripe {
  // The pinned SDK pins its compatible API version. Bound network time so a
  // reconciliation cannot silently extend its database lease indefinitely.
  return new Stripe(config.secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    timeout: 15000,
    maxNetworkRetries: 1,
  });
}
export function stripeRedirect(
  value: string | null | undefined,
  kind: "checkout" | "portal",
): string {
  try {
    const url = new URL(value || "");
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname ===
        (kind === "checkout" ? "checkout.stripe.com" : "billing.stripe.com")
    )
      return url.href;
  } catch {
    /* Never redirect to a URL supplied by a browser or an invalid provider reply. */
  }
  throw new BillingError(
    503,
    "The billing page could not be opened. Refresh billing and try again.",
  );
}
export type CheckoutAttempt = {
  id: string;
  user_id: string;
  plan_id: PaidPlan;
  price_id: string;
  session_id: string | null;
  state: "pending" | "open" | "complete" | "expired";
  created_at: string;
  expires_at: string;
};
export type BillingAccount = {
  user_id: string;
  customer_id: string | null;
  customer_attempt: string;
  customer_attempt_at: string | null;
  override_plan: string | null;
};
export function assertCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
  accountId: string,
  config: BillingConfig,
) {
  if (
    customer.deleted ||
    customer.metadata.builder_account_id !== accountId ||
    customer.livemode !== config.liveMode
  )
    throw new BillingError(
      503,
      "The billing account needs to be checked. Your saved work is safe.",
    );
}
export async function findOrCreateCustomer(
  stripe: Stripe,
  config: BillingConfig,
  account: BillingAccount,
  email: string,
): Promise<string> {
  if (account.customer_id) {
    const customer = await stripe.customers.retrieve(account.customer_id);
    assertCustomer(customer, account.user_id, config);
    return customer.id;
  }
  if (!/^[a-f0-9-]{36}$/.test(account.user_id))
    throw new BillingError(503, "Billing account unavailable.");
  // Recover a customer created before a lost response or failed database bind.
  // No email-based matching: accounts retain identity when email changes.
  const matches = await stripe.customers.search({
    query: `metadata['builder_account_id']:'${account.user_id}'`,
    limit: 2,
  });
  if (matches.has_more || matches.data.length > 1)
    throw new BillingError(
      503,
      "The billing account needs to be checked. Your saved work is safe.",
    );
  if (matches.data[0]) {
    assertCustomer(matches.data[0], account.user_id, config);
    return matches.data[0].id;
  }
  // Stripe may prune idempotency keys after 24 hours. An unresolved old attempt
  // must be recovered by a provider lookup, not repeated with a fresh key.
  const started = Date.parse(account.customer_attempt_at || "");
  if (!Number.isFinite(started) || Date.now() - started > 23 * 3600000)
    throw new BillingError(
      503,
      "An earlier billing setup needs to be checked before trying again.",
    );
  const customer = await stripe.customers.create(
    { email, metadata: { builder_account_id: account.user_id } },
    { idempotencyKey: `builder-customer-${account.customer_attempt}` },
  );
  assertCustomer(customer, account.user_id, config);
  return customer.id;
}
export async function priceCatalogue(stripe: Stripe, config: BillingConfig) {
  return await Promise.all(
    (Object.keys(config.prices) as PaidPlan[]).map(async (planId) => {
      const price = await stripe.prices.retrieve(config.prices[planId]);
      if (
        !price.active ||
        price.livemode !== config.liveMode ||
        price.type !== "recurring" ||
        price.recurring?.interval !== "month" ||
        price.recurring.interval_count !== 1 ||
        price.recurring.usage_type !== "licensed" ||
        price.currency !== "gbp" ||
        !Number.isSafeInteger(price.unit_amount) ||
        (price.unit_amount ?? 0) <= 0 ||
        price.billing_scheme !== "per_unit"
      )
        throw new BillingError(
          503,
          "Paid plans are being updated. Try again shortly.",
        );
      return {
        planId,
        amount: price.unit_amount!,
        currency: price.currency,
        interval: "month",
        taxBehavior: price.tax_behavior,
      };
    }),
  );
}
export function checkoutSnapshot(
  session: Stripe.Checkout.Session,
  attempt: CheckoutAttempt,
  customerId: string,
  config: BillingConfig,
) {
  if (
    session.customer !== customerId ||
    session.livemode !== config.liveMode ||
    session.mode !== "subscription" ||
    session.client_reference_id !== attempt.user_id ||
    session.metadata?.builder_checkout_attempt !== attempt.id ||
    session.metadata?.builder_account_id !== attempt.user_id ||
    session.line_items?.has_more ||
    session.line_items?.data.length !== 1 ||
    session.line_items.data[0].price?.id !== attempt.price_id ||
    session.line_items.data[0].quantity !== 1 ||
    !["open", "complete", "expired"].includes(session.status || "")
  )
    throw new BillingError(
      503,
      "Checkout details could not be verified. Refresh billing before trying again.",
    );
  return {
    id: session.id,
    customerId,
    attemptId: attempt.id,
    status: session.status!,
  };
}
export async function findCheckout(
  stripe: Stripe,
  config: BillingConfig,
  attempt: CheckoutAttempt,
  customerId: string,
): Promise<Stripe.Checkout.Session | null> {
  if (attempt.session_id) {
    const result = await stripe.checkout.sessions.retrieve(attempt.session_id, {
      expand: ["line_items"],
    });
    checkoutSnapshot(result, attempt, customerId, config);
    return result;
  }
  const candidates = await stripe.checkout.sessions.list({
    customer: customerId,
    created: { gte: Math.floor(Date.parse(attempt.created_at) / 1000) - 5 },
    limit: 100,
  });
  if (candidates.has_more)
    throw new BillingError(
      503,
      "The previous Checkout needs to be checked before trying again.",
    );
  const matches = candidates.data.filter(
    (s) => s.metadata?.builder_checkout_attempt === attempt.id,
  );
  if (matches.length > 1)
    throw new BillingError(
      503,
      "The previous Checkout needs to be checked before trying again.",
    );
  if (!matches.length) return null;
  const result = await stripe.checkout.sessions.retrieve(matches[0].id, {
    expand: ["line_items"],
  });
  checkoutSnapshot(result, attempt, customerId, config);
  return result;
}
export async function subscriptionSnapshot(
  stripe: Stripe,
  config: BillingConfig,
  actor: string,
  customerId: string,
) {
  const customer = await stripe.customers.retrieve(customerId);
  // Deletion is an authoritative provider result for this already-bound ID.
  // A deleted customer has no metadata to compare and cannot retain paid access.
  if (customer.deleted) return [];
  assertCustomer(customer, actor, config);
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  if (subscriptions.has_more)
    throw new BillingError(
      503,
      "The subscription history needs to be checked. Your saved work is safe.",
    );
  return subscriptions.data.map((subscription) => {
    const item = subscription.items.data[0];
    if (
      subscription.customer !== customerId ||
      subscription.livemode !== config.liveMode ||
      !item?.price?.id ||
      !Number.isSafeInteger(item.current_period_end)
    )
      throw new BillingError(
        503,
        "Subscription details could not be verified.",
      );
    // An unexpected price, multiple items or quantities never grant a paid plan.
    const planId =
      subscription.items.data.length === 1 &&
      !subscription.items.has_more &&
      item.quantity === 1 &&
      item.price.currency === "gbp" &&
      item.price.recurring?.interval === "month" &&
      item.price.recurring.interval_count === 1 &&
      item.price.recurring.usage_type === "licensed"
        ? ((Object.keys(config.prices) as PaidPlan[]).find(
            (plan) => config.prices[plan] === item.price.id,
          ) ?? null)
        : null;
    return {
      id: subscription.id,
      customerId,
      status: subscription.status,
      planId,
      priceId: item.price.id,
      periodEnd: new Date(item.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  });
}
