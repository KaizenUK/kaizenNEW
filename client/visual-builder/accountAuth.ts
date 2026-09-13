import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { supabaseUrl, supabaseKey } from "../lib/supabaseConfig";
import { cloud } from "./storage";
import { accountName, accountEmail } from "../../shared/builderAccount";

export type AccountAction =
  | { action: "name"; name: string }
  | { action: "email"; email: string }
  | {
      action: "password";
      password: string;
      confirmation: string;
      nonce?: string;
    }
  | { action: "reauthenticate" }
  | { action: "signout-others" };
export class AccountChangeError extends Error {
  constructor(
    message: string,
    readonly code = "account_change_failed",
  ) {
    super(message);
  }
}
function accountError(error: {
  code?: string;
  status?: number;
}): AccountChangeError {
  const code = error.code || "account_change_failed";
  const messages: Record<string, string> = {
    invalid_jwt:
      "Your sign-in is invalid. Sign in again to update your account.",
    bad_jwt: "Your sign-in is invalid. Sign in again to update your account.",
    reauthentication_needed:
      "Confirm this password change with a code from your email.",
    reauthentication_not_valid:
      "That confirmation code is invalid or expired. Request another code and try again.",
    same_password: "Choose a password different from your current password.",
    weak_password:
      "This password was not accepted. Choose a stronger password with at least 12 characters.",
    email_exists:
      "This email address could not be used. Check it or choose another address.",
    user_already_exists:
      "This email address could not be used. Check it or choose another address.",
    email_address_invalid: "Enter a valid email address.",
    over_email_send_rate_limit:
      "Too many email requests. Wait before trying again.",
    over_request_rate_limit:
      "Too many account requests. Wait before trying again.",
  };
  return new AccountChangeError(
    messages[code] ||
      (error.status === 401
        ? "Your sign-in expired. Sign in again to update your account."
        : "The account change could not be confirmed. Refresh your details before trying again."),
    code,
  );
}
type MainClient = Pick<SupabaseClient, "auth">;
type Dependencies = {
  main: MainClient | null;
  isolated: () => Pick<SupabaseClient, "auth">;
  redirectTo: string;
};
const defaults = (): Dependencies => ({
  main: cloud,
  isolated: () =>
    createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `kaizen-account-operation-${crypto.randomUUID()}`,
      },
    }),
  redirectTo: new URL("/builder/?view=account", location.origin).href,
});

/** Isolating the captured session keeps an in-flight edit tied to the account
 * that submitted it, even if another tab signs in as somebody else. */
export async function changeAccount(
  expectedAccount: string,
  input: AccountAction,
  dependencies = defaults(),
): Promise<{ user?: User; notice: string }> {
  const main = dependencies.main;
  if (!main) throw new AccountChangeError("Sign in to manage your account.");
  const captured = await main.auth.getSession();
  const session = captured.data.session;
  if (
    captured.error ||
    !session ||
    session.user.id !== expectedAccount ||
    !session.refresh_token
  )
    throw new AccountChangeError(
      "Your signed-in account changed. Refresh before trying again.",
    );
  if (!session.expires_at || session.expires_at <= Date.now() / 1000 + 5)
    throw new AccountChangeError(
      "Your sign-in is being refreshed. Refresh your details before trying again.",
    );
  if (input.action === "name" && !accountName(input.name))
    throw new AccountChangeError(
      "Add your name using 1–200 characters, without brackets or control characters.",
    );
  if (input.action === "email" && !accountEmail(input.email))
    throw new AccountChangeError("Enter a valid email address.");
  if (input.action === "password") {
    if (input.password.length < 12)
      throw new AccountChangeError(
        "Use at least 12 characters for your password.",
      );
    if (input.password !== input.confirmation)
      throw new AccountChangeError("The passwords do not match.");
    if (input.nonce && !/^\d{6}$/.test(input.nonce))
      throw new AccountChangeError(
        "Enter the six-digit confirmation code from your email.",
      );
  }
  const isolated = dependencies.isolated();
  try {
    const signed = await isolated.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (signed.error) throw accountError(signed.error);
    if (signed.data.user?.id !== expectedAccount)
      throw new AccountChangeError(
        "Your signed-in account changed. Refresh before trying again.",
      );
    const current = await main.auth.getSession();
    if (current.error || current.data.session?.user.id !== expectedAccount)
      throw new AccountChangeError(
        "Your signed-in account changed. Refresh before trying again.",
      );
    let notice: string, user: User | undefined;
    if (input.action === "signout-others") {
      const result = await isolated.auth.signOut({ scope: "others" });
      if (result.error) throw accountError(result.error);
      notice =
        "Other sessions have been signed out. A window already open may stay signed in until its current sign-in expires. You can keep using this window.";
    } else if (input.action === "reauthenticate") {
      const result = await isolated.auth.reauthenticate();
      if (result.error) throw accountError(result.error);
      notice =
        "A confirmation code has been requested. Check your account email, then enter the latest code with your new password.";
    } else {
      const result = await isolated.auth.updateUser(
        input.action === "name"
          ? { data: { full_name: accountName(input.name)! } }
          : input.action === "email"
            ? { email: accountEmail(input.email)! }
            : {
                password: input.password,
                ...(input.nonce ? { nonce: input.nonce } : {}),
              },
        input.action === "email"
          ? { emailRedirectTo: dependencies.redirectTo }
          : undefined,
      );
      if (result.error) throw accountError(result.error);
      if (result.data.user?.id !== expectedAccount)
        throw new AccountChangeError(
          "The account change returned unexpected details. Refresh before trying again.",
        );
      user = result.data.user;
      notice =
        input.action === "name"
          ? "Your name is saved. Return to the website editor and try Save to website again."
          : input.action === "password"
            ? "Your password has changed. Use the new password next time you sign in."
            : user.email?.toLowerCase() ===
                  accountEmail(input.email)!.toLowerCase() && !user.new_email
              ? "Your email address has changed. Use this address next time you sign in."
              : "Your email change has been requested. Check your email for confirmation; you may need to confirm from both your current and new addresses. Keep using your current address until the change is confirmed.";
    }
    const after = await main.auth.getSession();
    if (after.error || after.data.session?.user.id !== expectedAccount)
      throw new AccountChangeError(
        "The previous account may have been updated. Your signed-in account changed; refresh your details.",
      );
    if (user) {
      // No captured refresh token is passed to the shared client: it must never
      // replace a newer account session with the one that started this operation.
      try {
        const fresh = await main.auth.refreshSession();
        if (fresh.error) throw fresh.error;
        if (fresh.data.session?.user.id !== expectedAccount)
          throw new AccountChangeError(
            "The previous account was updated. Your signed-in account changed; refresh your details.",
          );
      } catch (error) {
        if (error instanceof AccountChangeError) throw error;
        notice +=
          " Your sign-in details could not refresh; reload the Account page to check them.";
      }
    }
    return { user, notice };
  } catch (error) {
    if (error instanceof AccountChangeError) throw error;
    throw new AccountChangeError(
      "The account change could not be confirmed. Refresh your details before trying again.",
    );
  } finally {
    await isolated.auth.stopAutoRefresh();
  }
}

export async function verifiedAccount(
  session: Session,
  main = cloud,
): Promise<User> {
  if (!main) throw new AccountChangeError("Sign in to manage your account.");
  const result = await main.auth.getUser(session.access_token);
  if (result.error) throw accountError(result.error);
  if (result.data.user?.id !== session.user.id)
    throw new AccountChangeError(
      "Your signed-in account changed. Refresh your details.",
    );
  return result.data.user;
}
