import type { SupabaseClient } from "@supabase/supabase-js";

export function readAuthLink(href: string) {
  const url = new URL(href),
    hash = new URLSearchParams(url.hash.slice(1));
  const value = (key: string) => hash.get(key) ?? url.searchParams.get(key);
  const has = (key: string) => hash.has(key) || url.searchParams.has(key);
  const type = value("type");
  const setupRequested =
    url.searchParams.get("password") === "setup" ||
    type === "invite" ||
    type === "recovery";
  const errorCode = value("error_code");
  return {
    setupRequested,
    callback:
      has("access_token") ||
      has("code") ||
      has("error") ||
      has("error_code") ||
      has("error_description"),
    failed: has("error") || has("error_code") || has("error_description"),
    errorCode:
      errorCode && /^[a-z_]{1,64}$/.test(errorCode) ? errorCode : undefined,
  };
}
// Capture intent before the SDK consumes the URL. Never copy a token or a
// provider's error description into the UI state or an additional store.
const initialLink =
  typeof location === "undefined" ? null : readAuthLink(location.href);
export const initialAuthLink = () => initialLink;
let recoveryAccount: string | undefined;
export const passwordRecoveryAccount = () => recoveryAccount;
export function finishPasswordRecovery(account: string) {
  if (recoveryAccount === account) recoveryAccount = undefined;
}
/** Attach immediately when the shared client is created, before its asynchronous
 * initialization can emit a recovery event ahead of the React auth screen. */
export function trackPasswordRecovery(auth: SupabaseClient["auth"]) {
  auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") recoveryAccount = session?.user.id;
    else if (recoveryAccount !== session?.user.id) recoveryAccount = undefined;
  });
}

export function cleanAuthLink(href: string) {
  const url = new URL(href),
    hash = new URLSearchParams(url.hash.slice(1));
  const keys = [
    "password",
    "access_token",
    "refresh_token",
    "token_type",
    "expires_in",
    "expires_at",
    "provider_token",
    "provider_refresh_token",
    "error",
    "error_code",
    "error_description",
    "code",
  ];
  const authHash =
    keys.some((key) => hash.has(key)) ||
    ["invite", "recovery", "signup", "email_change"].includes(
      hash.get("type") || "",
    );
  for (const key of keys) url.searchParams.delete(key);
  if (
    ["invite", "recovery", "signup", "email_change"].includes(
      url.searchParams.get("type") || "",
    )
  )
    url.searchParams.delete("type");
  if (authHash) url.hash = "";
  return url;
}
