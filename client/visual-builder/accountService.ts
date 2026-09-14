import { cloud } from "./storage";

/** Capture the authenticated account before the request and reject stale
 * results after account switches. No unverified actor is sent to the server. */
export async function builderAccountRequest(
  accountId: string,
  input: Record<string, unknown>,
): Promise<any> {
  if (!cloud) throw new Error("Sign in to manage your account.");
  async function session() {
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
  }
  const captured = await session();
  let result;
  try {
    result = await cloud.functions.invoke("builder-account", {
      body: input,
      headers: { Authorization: `Bearer ${captured.access_token}` },
    });
  } catch {
    throw new Error(
      "The request could not be confirmed. Refresh to check its status before trying again.",
    );
  }
  await session();
  if (result.error) {
    let message =
      "The request could not be confirmed. Refresh to check its status before trying again.";
    try {
      const body = await result.error.context?.clone().json();
      if (typeof body?.error === "string" && body.error.length <= 512)
        message = body.error;
    } catch {
      /* Preserve the unknown-outcome message. */
    }
    throw new Error(message);
  }
  return result.data;
}
