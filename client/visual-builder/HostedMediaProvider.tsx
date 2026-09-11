import React, {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { getSupabaseClient } from "../lib/supabase";
import { MediaContext } from "./MediaContext";
import {
  hostedProject,
  presentProjectMedia,
  projectMediaVersion,
  refreshProjectMedia,
  setProjectMediaAccount,
  subscribeProjectMedia,
} from "./cloudProjects";

export function HostedMediaProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const version = useSyncExternalStore(
    subscribeProjectMedia,
    projectMediaVersion,
    () => 0,
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const projection = useMemo(
    () =>
      <T,>(value: T): T =>
        hostedProject ? presentProjectMedia(value) : value,
    [version],
  );
  useEffect(() => {
    if (!hostedProject) return;
    let active = true,
      running = false;
    const refresh = async (force = false) => {
      if (running) return;
      running = true;
      try {
        await refreshProjectMedia(force);
        if (active) setError("");
      } catch (error) {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Project media could not be refreshed.",
          );
      } finally {
        running = false;
      }
    };
    const client = getSupabaseClient();
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      setProjectMediaAccount(session?.user.id);
      if (active) setError("");
    }).data.subscription;
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(() => void refresh(), 60_000);
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    if (retry) void refresh(true);
    return () => {
      active = false;
      clearInterval(timer);
      subscription?.unsubscribe();
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [retry]);
  return (
    <MediaContext.Provider value={projection}>
      {children}
      {error && (
        <div className="builder-toast builder-media-toast" role="status">
          <span>{error}</span>
          <button onClick={() => setRetry((value) => value + 1)}>
            Retry media
          </button>
        </div>
      )}
    </MediaContext.Provider>
  );
}
