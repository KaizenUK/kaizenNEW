import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";

/** Deliver only the newest session outside the SDK callback/lock. A late initial
 * read, queued reload or unmounted subscriber cannot restore old account data. */
export function observeAuthSession(
  auth: Pick<SupabaseClient["auth"], "getSession" | "onAuthStateChange">,
  accept: (
    event: AuthChangeEvent,
    session: Session | null,
    error?: unknown,
  ) => void,
) {
  let live = true,
    revision = 0;
  const deliver = (
    event: AuthChangeEvent,
    session: Session | null,
    error?: unknown,
  ) => {
    const current = ++revision;
    queueMicrotask(() => {
      if (live && current === revision) accept(event, session, error);
    });
  };
  const { data } = auth.onAuthStateChange((event, session) =>
    deliver(event, session),
  );
  const initial = revision;
  void auth
    .getSession()
    .then((result) => {
      if (live && initial === revision)
        deliver(
          "INITIAL_SESSION",
          result.error ? null : result.data.session,
          result.error,
        );
    })
    .catch((error) => {
      if (live && initial === revision) deliver("INITIAL_SESSION", null, error);
    });
  return () => {
    live = false;
    revision++;
    data.subscription.unsubscribe();
  };
}
