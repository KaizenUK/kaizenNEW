import { cloud } from "./storage";
import {
  billingRedirect,
  isBillingSummary,
  type BillingSummary,
  isProjectBillingSummary,
  type ProjectBillingSummary,
} from "../../shared/builderBilling";
export type BillingAction =
  | "summary"
  | "refresh"
  | "checkout"
  | "portal"
  | "close-checkout";
export type BillingReply = { summary: BillingSummary } | { url: string };
async function authenticatedBillingRequest(
  accountId: string,
  endpoint: "builder-billing" | "builder-projects",
  body: Record<string, unknown>,
): Promise<unknown> {
  if (!cloud) throw new Error("Sign in to manage billing.");
  const session = async () => {
    try {
      const result = await cloud!.auth.getSession();
      if (result.error || result.data.session?.user.id !== accountId)
        throw new Error();
      return result.data.session;
    } catch {
      throw new Error(
        "Your signed-in account changed or could not be checked. Refresh before trying again.",
      );
    }
  };
  const captured = await session();
  let result: Awaited<ReturnType<typeof cloud.functions.invoke>>;
  try {
    result = await cloud.functions.invoke(endpoint, {
      body,
      headers: { Authorization: `Bearer ${captured.access_token}` },
    });
  } catch {
    throw new Error(
      "The billing request could not be confirmed. Refresh billing before trying again.",
    );
  }
  await session();
  if (result.error) {
    let message =
      "The billing request could not be confirmed. Refresh billing before trying again.";
    try {
      const body = await result.error.context?.clone().json();
      if (typeof body?.error === "string" && body.error.length <= 512)
        message = body.error;
    } catch {
      /* Retain unknown-outcome wording. */
    }
    throw new Error(message);
  }
  return result.data;
}
export async function billingRequest(
  accountId: string,
  action: BillingAction,
  plan?: "plus" | "agency",
): Promise<BillingReply> {
  const data = await authenticatedBillingRequest(accountId, "builder-billing", {
    action,
    ...(plan ? { plan } : {}),
  });
  if (action === "checkout" || action === "portal") {
    const value = data;
    const url =
      value && typeof value === "object" && "url" in value
        ? value.url
        : undefined;
    return { url: billingRedirect(url, action) };
  }
  if (!isBillingSummary(data))
    throw new Error(
      "Billing details could not be checked. Refresh billing to try again.",
    );
  return { summary: data };
}
export async function projectBillingRequest(
  accountId: string,
  projectId: string,
  takeBilling = false,
): Promise<ProjectBillingSummary> {
  const data = await authenticatedBillingRequest(
    accountId,
    "builder-projects",
    {
      action: takeBilling ? "take-billing" : "project-billing",
      projectId,
      ...(takeBilling ? { confirm: true } : {}),
    },
  );
  if (!isProjectBillingSummary(data))
    throw new Error(
      "Website billing details could not be checked. Refresh website billing before trying again.",
    );
  return data;
}
