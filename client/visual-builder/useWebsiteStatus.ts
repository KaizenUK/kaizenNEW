import { useEffect, useState, useSyncExternalStore } from "react";
import {
  readWebsiteStatus,
  type WebsiteStatus,
} from "../../shared/builderWebsiteStatus";
import { repositoryConnection } from "./repositoryConnection";
import { storage } from "./storage";

/** One project observation per open view; discard observations after edits or connection changes. */
export function useWebsiteStatus(refresh: unknown = 0) {
  const connection = useSyncExternalStore(
    repositoryConnection.subscribe,
    repositoryConnection.snapshot,
    repositoryConnection.snapshot,
  );
  const [observation, setObservation] = useState<{
    connection: typeof connection;
    refresh: unknown;
    value: WebsiteStatus;
  }>();
  useEffect(() => {
    if (
      repositoryConnection.mode !== "hosted" ||
      connection.status !== "connected"
    )
      return;
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    async function read() {
      try {
        const value = readWebsiteStatus(
          await storage.repository({ action: "repository-website-status" }),
        );
        if (current)
          setObservation(value ? { connection, refresh, value } : undefined);
      } catch {
        if (current) setObservation(undefined);
      } finally {
        if (current) timer = setTimeout(poll, 30000);
      }
    }
    function poll() {
      if (document.visibilityState === "visible") void read();
      else timer = setTimeout(poll, 30000);
    }
    void read();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [connection, refresh]);
  return observation?.connection === connection &&
    observation.refresh === refresh
    ? observation.value
    : undefined;
}
