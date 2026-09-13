import type { RepositorySaveStatus } from "../../shared/builderRepositorySave";
import { ACCOUNT_SETUP_MESSAGE } from "../../shared/builderAccount";

export function clientSaveMessage(status: RepositorySaveStatus) {
  switch (status.phase) {
    case "applied":
      return "Your reviewed changes are ready. Save to website to send them to staging.";
    case "committed":
      return "Your changes are kept, but sending them to staging has not been confirmed.";
    case "saved":
      return "Your changes have been sent. Check staging before publishing.";
    case "recovery_required":
      return "Saving was interrupted. Ask the website owner to check it before continuing. Your changes are kept; saving has not been repeated.";
  }
}

export function clientDeploymentMessage(
  state: NonNullable<RepositorySaveStatus["release"]>["state"],
) {
  switch (state) {
    case "waiting":
      return "Waiting for staging to start updating.";
    case "queued":
      return "The staging update is queued.";
    case "building":
      return "Staging is updating.";
    case "succeeded":
      return "Staging finished updating. Open staging to check your changes.";
    case "failed":
      return "Staging could not be updated. Your saved changes are kept. Ask the website owner for help.";
    case "unavailable":
      return "The staging update could not be checked. Open staging, or check the saved state again.";
  }
}

/** Keep operator diagnostics in developer view; give clients an action without raw paths or Git output. */
export function clientSaveError(message: string) {
  if (message === ACCOUNT_SETUP_MESSAGE) return message;
  if (
    /branch moved|source changed|files changed|applied.*changed/i.test(message)
  )
    return "The website changed after your review. Your edits are kept. Ask the website owner to reconcile the changes before saving.";
  if (/already staged|merge or rebase/i.test(message))
    return "Other changes need the website owner's review before you can save. Your edits are kept.";
  if (/interrupted|operator check|commit did not finish/i.test(message))
    return "Saving needs the website owner's attention before you try again. Your changes are kept. Check the saved state.";
  if (/push|remote/i.test(message))
    return "Sending your changes could not be confirmed. Check the saved state, or ask the website owner for help before retrying.";
  if (/sign in|session.*expired|not connected|reconnect/i.test(message))
    return "Reconnect to the website, then check the saved state before trying again.";
  if (/permission|access|membership/i.test(message))
    return "Your access could not be confirmed. Ask the website owner to check your access.";
  if (/commit message/i.test(message))
    return "Enter a change summary of up to 2,000 characters.";
  return "Saving could not be confirmed. Check the saved state, or ask the website owner for help.";
}
