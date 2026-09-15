import { cloud } from "./storage";
import {
  readWebsiteDomainState,
  type WebsiteDomainState,
} from "../../shared/builderDomains";
export type DomainRequest =
  | { action: "domain-state" }
  | { action: "domain-add"; domainId: string; hostname: string }
  | { action: "domain-verify"; domainId: string; version: number }
  | {
      action: "domain-remove";
      domainId: string;
      version: number;
      confirm: true;
    };

export async function websiteDomainRequest(
  accountId: string,
  projectId: string,
  input: DomainRequest,
): Promise<WebsiteDomainState> {
  if (!cloud) throw new Error("Sign in to manage website domains.");
  const currentSession = async () => {
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
  const session = await currentSession();
  let reply: Awaited<ReturnType<typeof cloud.functions.invoke>>;
  try {
    reply = await cloud.functions.invoke("builder-projects", {
      body: { ...input, projectId },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    throw new Error(
      "The domain request could not be confirmed. Refresh its status before trying again.",
    );
  }
  await currentSession();
  if (reply.error) {
    let message =
      "The domain request could not be confirmed. Refresh its status before trying again.";
    try {
      const body = await reply.error.context?.clone().json();
      if (typeof body?.error === "string" && body.error.length <= 512)
        message = body.error;
    } catch {
      /* Keep unknown-outcome wording. */
    }
    throw new Error(message);
  }
  return readWebsiteDomainState(reply.data, projectId);
}
