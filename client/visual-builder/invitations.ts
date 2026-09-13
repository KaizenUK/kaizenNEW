import { getSupabaseClient } from "../lib/supabase";

export type InvitationResult = {
  kind: "invited" | "resent" | "added" | "already-member";
  emailRequested: boolean;
};
export const invitationNotice = (result: InvitationResult) =>
  ({
    invited:
      "Invitation requested. They can use the email link to set up their account and open this project.",
    resent:
      "A new invitation was requested. Ask them to use the latest email link. Their project access is unchanged.",
    added:
      "Project access added. This person already has an account and can sign in; no invitation email was needed.",
    "already-member":
      "This person already has project access. Use Edit access to change their role or publishing permission.",
  })[result.kind];

export async function inviteProjectMember(
  input:
    | {
        action: "invite";
        projectId: string;
        email: string;
        role: "owner" | "editor";
        canPublish: boolean;
      }
    | { action: "resend"; projectId: string; userId: string },
): Promise<InvitationResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Invitations need the hosted builder.");
  const { data: initial, error: sessionError } = await client.auth.getSession();
  if (sessionError || !initial.session)
    throw new Error("Sign in to manage invitations.");
  let result;
  try {
    result = await client.functions.invoke("builder-invite", {
      body: input,
      headers: { Authorization: `Bearer ${initial.session.access_token}` },
    });
  } catch {
    throw new Error(
      "The invitation could not be confirmed. Refresh the member list before trying again.",
    );
  }
  const { data, error } = result;
  const { data: current, error: currentError } = await client.auth.getSession();
  if (currentError || current.session?.user.id !== initial.session.user.id)
    throw new Error(
      "Your account changed. Refresh the project before continuing.",
    );
  if (error) {
    let message =
      "The invitation could not be confirmed. Refresh the member list before trying again.";
    try {
      const result = await error.context?.clone().json();
      if (typeof result?.error === "string") message = result.error;
    } catch {
      /* A lost response must not automatically send another email. */
    }
    throw new Error(message);
  }
  if (
    !data ||
    !["invited", "resent", "added", "already-member"].includes(data.kind) ||
    typeof data.emailRequested !== "boolean"
  )
    throw new Error(
      "The invitation result could not be confirmed. Refresh the member list before trying again.",
    );
  return data;
}
