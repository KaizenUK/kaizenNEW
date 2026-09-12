import { useEffect, useRef, useState } from "react";
import { storage } from "./storage";
import { activeProjectId } from "./projectStorage";
import { companionConnection } from "./companionConnection";
import type {
  SourceDraft,
  SourceEdits,
  SourceInspection,
} from "../../shared/builderSourceEditing";

export function useSourceEditingDraft(inspection?: SourceInspection) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [assets, setAssets] = useState<NonNullable<SourceEdits["assets"]>>([]);
  const [ready, setReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [stale, setStale] = useState<SourceEdits>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const version = useRef(0),
    persisted = useRef("null");
  const recoveryKey = inspection
    ? `kaizen-source-recovery:${JSON.stringify([companionConnection.recoveryIdentity(), activeProjectId, inspection.root, inspection.route])}`
    : "";
  const pending = useRef<
    { edits: SourceEdits | null; text: string } | undefined
  >(undefined);
  const running = useRef<Promise<void> | undefined>(undefined);
  const blocked = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!inspection) return;
    let current = true;
    setReady(false);
    setError("");
    storage
      .repository({
        action: "repository-source-draft-read",
        root: inspection.root,
        route: inspection.route,
      })
      .then((draft: SourceDraft) => {
        if (!current) return;
        version.current = draft.version;
        persisted.current = JSON.stringify(draft.edits);
        blocked.current = false;
        let recovery:
          | { version: number; edits: SourceEdits | null }
          | undefined;
        try {
          recovery =
            JSON.parse(localStorage.getItem(recoveryKey) || "null") ||
            undefined;
        } catch {
          /* Preserve helper draft if browser storage is unavailable. */
        }
        if (
          recovery?.edits &&
          recovery.edits.inspection.root === inspection.root &&
          recovery.edits.inspection.route === inspection.route
        ) {
          if (
            recovery.version !== draft.version &&
            JSON.stringify(recovery.edits) !== JSON.stringify(draft.edits)
          ) {
            setStale(recovery.edits);
            setReady(true);
            setStatus(
              "A newer helper draft exists. Your browser edits are kept for recovery.",
            );
            return;
          }
          draft = { ...draft, edits: recovery.edits };
        }
        if (
          draft.edits &&
          JSON.stringify(draft.edits.inspection.files) !==
            JSON.stringify(inspection.files)
        ) {
          setStale(draft.edits);
          setStatus(
            "The website's files changed since you edited them. Your edits are kept below.",
          );
        } else {
          setValues(draft.edits?.values || {});
          setOrders(draft.edits?.orders || {});
          setAssets(draft.edits?.assets || []);
          setStale(undefined);
          setStatus(
            draft.edits ? "Restored your saved edits." : "No changes yet.",
          );
        }
        setReady(true);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [inspection, loadAttempt]);
  function drain(): Promise<void> {
    if (running.current) return running.current;
    if (blocked.current)
      return Promise.reject(
        new Error(error || "Your edits could not be saved."),
      );
    const work = async () => {
      while (pending.current) {
        const next = pending.current;
        if (next.text === persisted.current) {
          pending.current = undefined;
          try {
            localStorage.removeItem(recoveryKey);
          } catch {
            /* Already saved by the helper. */
          }
          break;
        }
        try {
          localStorage.setItem(
            recoveryKey,
            JSON.stringify({ version: version.current, edits: next.edits }),
          );
        } catch {
          /* Report any helper save failure below. */
        }
        if (mounted.current) setStatus("Saving edits…");
        try {
          const saved: SourceDraft = await storage.repository({
            action: "repository-source-draft-save",
            root: inspection!.root,
            route: inspection!.route,
            version: version.current,
            edits: next.edits,
          });
          version.current = saved.version;
          persisted.current = next.text;
          if (pending.current === next) pending.current = undefined;
          if (!pending.current)
            try {
              localStorage.removeItem(recoveryKey);
            } catch {
              /* Helper has saved the draft. */
            }
          if (mounted.current) {
            setStatus(
              saved.edits
                ? "Edits saved on this computer. Not applied to the website yet."
                : "No changes yet.",
            );
            setError("");
          }
        } catch (e) {
          blocked.current = true;
          if (mounted.current) {
            setError(e.message);
            setStatus(
              "Edits not saved. Keep this window open or download them.",
            );
          }
          throw e;
        }
      }
    };
    running.current = work().finally(() => {
      running.current = undefined;
    });
    return running.current;
  }
  function flush() {
    if (!inspection || !ready)
      return Promise.reject(new Error("Wait for your saved edits to load."));
    if (stale)
      return Promise.reject(
        new Error("Recover or discard the saved edits before continuing."),
      );
    const edits =
      Object.keys(values).length || Object.keys(orders).length || assets.length
        ? { inspection, values, orders, ...(assets.length ? { assets } : {}) }
        : null;
    pending.current = { edits, text: JSON.stringify(edits) };
    try {
      localStorage.setItem(
        recoveryKey,
        JSON.stringify({ version: version.current, edits }),
      );
    } catch {
      /* Helper save remains authoritative; failures still keep this window open. */
    }
    return drain();
  }
  useEffect(() => {
    if (ready && !stale) void flush().catch(() => {});
  }, [ready, stale, values, orders, assets]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current || running.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function discardStale() {
    const saved: SourceDraft = await storage.repository({
      action: "repository-source-draft-save",
      root: inspection!.root,
      route: inspection!.route,
      version: version.current,
      edits: null,
    });
    version.current = saved.version;
    persisted.current = "null";
    pending.current = undefined;
    blocked.current = false;
    try {
      localStorage.removeItem(recoveryKey);
    } catch {
      /* Helper draft was discarded. */
    }
    setValues({});
    setOrders({});
    setAssets([]);
    setStale(undefined);
    setError("");
    setStatus("Saved edits discarded. The website's files are unchanged.");
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            stale || {
              inspection,
              values,
              orders,
              ...(assets.length ? { assets } : {}),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kaizen-source-edits.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return {
    values,
    setValues,
    orders,
    setOrders,
    assets,
    setAssets,
    ready,
    stale,
    error,
    status,
    version,
    flush,
    discardStale,
    download,
    reload: () => {
      pending.current = undefined;
      location.reload();
    },
    retry: () => {
      if (!ready) {
        setLoadAttempt((attempt) => attempt + 1);
        return Promise.resolve();
      }
      blocked.current = false;
      return flush();
    },
  };
}
