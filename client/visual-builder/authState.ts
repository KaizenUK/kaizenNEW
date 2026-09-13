import { validProjectId } from "../../shared/builderProjects";
export const unavailableAuthLink =
  "This invitation or reset link is no longer available. It may have expired or already been used. If you already set a password, sign in. Otherwise request a new password reset link.";
export const missingAuthLink =
  "This page needs a fresh invitation or reset link to set a password. If you already set one, sign in. Otherwise request a new password reset link.";
export function authErrorMessage(
  error: unknown,
  action: "check" | "signin" | "reset" | "setup" | "signout" = "signin",
) {
  const value =
    error && typeof error === "object"
      ? (error as {
          code?: string;
          name?: string;
          status?: number;
          details?: { code?: string };
        })
      : {};
  const code = value.code || value.details?.code;
  const messages: Record<string, string> = {
    invalid_credentials:
      "That email address and password did not match. Check them, or reset your password.",
    email_not_confirmed:
      "Your email is not confirmed yet. Open your latest invitation email to finish setup, or ask the website owner to resend it.",
    invite_not_found: unavailableAuthLink,
    otp_expired:
      "This link is invalid or has expired. A link already used will not work again. Sign in with your password, or request a new password reset link.",
    flow_state_expired:
      "This sign-in link has expired. Request a new link and open it in the same browser.",
    flow_state_not_found:
      "This sign-in link cannot be completed. It may have been used already or opened in a different browser. Request a new link and open it in the same browser.",
    bad_code_verifier:
      "This sign-in link could not be verified in this browser. Request a new link and open it in the same browser.",
    over_email_send_rate_limit:
      "Too many email requests. Wait before requesting another link.",
    over_request_rate_limit:
      "Too many sign-in attempts. Wait before trying again.",
    weak_password:
      "This password was not accepted. Choose a stronger password with at least 12 characters.",
    same_password: "Choose a password different from your current password.",
    reauthentication_needed:
      "A fresh password reset link is needed. Sign out and request a new link before changing this password.",
    reauthentication_not_valid:
      "This password confirmation is no longer valid. Sign out and request a new password reset link.",
    session_expired:
      "Your sign-in has expired. Sign in again, or request a new password reset link.",
    session_not_found:
      "Your sign-in has ended. Sign in again, or request a new password reset link.",
    refresh_token_not_found:
      "Your sign-in has ended. Sign in again, or request a new password reset link.",
    refresh_token_already_used:
      "Your sign-in has ended. Sign in again, or request a new password reset link.",
    bad_jwt:
      "Your sign-in could not be verified. Sign in again, or request a new password reset link.",
    user_banned:
      "This account cannot sign in. Contact the website owner for help.",
    signup_disabled:
      "This builder is invitation-only. Ask the website owner for an invitation.",
  };
  if (code && messages[code]) return messages[code];
  if (value.name === "AuthSessionMissingError")
    return messages.session_not_found;
  return {
    check: "Your sign-in could not be checked. Reload this page to try again.",
    signin:
      "Sign-in could not be confirmed. Check your connection and try again.",
    reset:
      "The reset request could not be confirmed. It may have sent an email; check your inbox before requesting another link.",
    setup:
      "The password change could not be confirmed. Keep this page open and check your connection before trying again.",
    signout:
      "Sign-out could not be confirmed. Check your connection and try again.",
  }[action];
}
export function passwordResetRedirect(href: string) {
  const current = new URL(href),
    next = new URL("/builder/?password=setup", current.origin);
  const project = current.searchParams.get("project");
  if (validProjectId(project)) next.searchParams.set("project", project);
  return next.href;
}
