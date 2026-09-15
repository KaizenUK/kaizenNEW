import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProblemReport } from "../../shared/builderDiagnostics";
import { validProjectId } from "../../shared/builderProjects";
import { diagnosticPage, subscribeDiagnosticErrors } from "./diagnostics";

type Identity = { user: { id: string }; access_token: string };
/** Best effort only: no persistent queue, raw errors, retries, or reporting of reporter failures. */
export function startErrorReporting(
  client: Pick<SupabaseClient, "auth" | "functions">,
  context: {
    projectId: string;
    userAgent: string;
    helper: () => { local: boolean; status: string };
  },
) {
  if (!validProjectId(context.projectId)) return () => {};
  let session: Identity | null = null;
  let generation = 0;
  let authEvents = 0;
  let stopped = false;
  let attempts: number[] = [];
  const seen = new Map<string, number>();
  const pending = new Set<AbortController>();
  const accept = (next: Identity | null) => {
    if (stopped) return;
    if (session?.user.id !== next?.user.id) {
      generation++;
      attempts = [];
      seen.clear();
      for (const controller of pending) controller.abort();
    }
    session = next;
  };
  const { data } = client.auth.onAuthStateChange((_event, next) => {
    authEvents++;
    accept(next);
  });
  const initialEvents = authEvents;
  void client.auth
    .getSession()
    .then(({ data }) => {
      if (initialEvents === authEvents) accept(data.session);
    })
    .catch(() => {
      /* Editing and sign-in handle their own errors. */
    });

  const unsubscribe = subscribeDiagnosticErrors((error) => {
    if (!session || stopped) return;
    // Capture identity and page before hashing can yield to navigation or an account change.
    const identity = session;
    const version = generation;
    const page = { ...diagnosticPage() };
    const helper = context.helper();
    const now = Date.now();
    attempts = attempts.filter((at) => at > now - 3_600_000);
    if (attempts.length >= 20 || pending.size >= 2) return;
    const key = JSON.stringify([
      error.source,
      error.category,
      page.screen,
      page.id,
      page.route?.split(/[?#]/)[0],
    ]);
    if ((seen.get(key) || 0) > now - 60_000) return;
    seen.set(key, now);
    for (const [key, at] of seen) if (at <= now - 60_000) seen.delete(key);
    attempts.push(now);
    const controller = new AbortController();
    pending.add(controller);
    const timeout = setTimeout(() => controller.abort(), 5_000);
    void (async () => {
      const report = await buildProblemReport({
        projectId: context.projectId,
        page,
        userAgent: context.userAgent,
        helper,
        lastError: error,
      });
      if (stopped || generation !== version || controller.signal.aborted)
        return;
      await client.functions.invoke("builder-projects", {
        body: { action: "record-error", projectId: context.projectId, report },
        // Pin this event to its account even if the SDK session changes before the fetch.
        headers: { Authorization: `Bearer ${identity.access_token}` },
        signal: controller.signal,
      });
    })()
      .catch(() => {
        /* A reporting outage must never cause a reporting loop. */
      })
      .finally(() => {
        clearTimeout(timeout);
        pending.delete(controller);
      });
  });
  return () => {
    stopped = true;
    generation++;
    unsubscribe();
    data.subscription.unsubscribe();
    for (const controller of pending) controller.abort();
    pending.clear();
    session = null;
    seen.clear();
    attempts = [];
  };
}
