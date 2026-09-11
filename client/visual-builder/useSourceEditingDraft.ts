import { useEffect, useRef, useState } from "react";
import { storage } from "./storage";
import type {
  SourceDraft,
  SourceEdits,
  SourceInspection,
} from "../../shared/builderSourceEditing";

export function useSourceEditingDraft(inspection?: SourceInspection) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [ready, setReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [stale, setStale] = useState<SourceEdits>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const version = useRef(0),
    persisted = useRef("null");
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
        if (
          draft.edits &&
          JSON.stringify(draft.edits.inspection.files) !==
            JSON.stringify(inspection.files)
        ) {
          setStale(draft.edits);
          setStatus(
            "Repository source changed. Your saved editing draft is retained below.",
          );
        } else {
          setValues(draft.edits?.values || {});
          setOrders(draft.edits?.orders || {});
          setStatus(
            draft.edits
              ? "Restored saved editing draft."
              : "No unapplied edits.",
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
        new Error(error || "The editing draft could not be saved."),
      );
    const work = async () => {
      while (pending.current) {
        const next = pending.current;
        if (next.text === persisted.current) {
          pending.current = undefined;
          break;
        }
        if (mounted.current) setStatus("Saving editing draft…");
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
          if (mounted.current) {
            setStatus(
              saved.edits
                ? "Editing draft saved on this computer."
                : "No unapplied edits.",
            );
            setError("");
          }
        } catch (e) {
          blocked.current = true;
          if (mounted.current) {
            setError(e.message);
            setStatus(
              "Editing draft not saved. Keep this window open or download your edits.",
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
      return Promise.reject(
        new Error("Wait for the saved editing draft to load."),
      );
    if (stale)
      return Promise.reject(
        new Error("Recover or discard the saved edits before continuing."),
      );
    const edits =
      Object.keys(values).length || Object.keys(orders).length
        ? { inspection, values, orders }
        : null;
    pending.current = { edits, text: JSON.stringify(edits) };
    return drain();
  }
  useEffect(() => {
    if (ready && !stale) void flush().catch(() => {});
  }, [ready, stale, values, orders]);
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
    setValues({});
    setOrders({});
    setStale(undefined);
    setError("");
    setStatus("Saved editing draft discarded; original source is unchanged.");
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify(stale || { inspection, values, orders }, null, 2)],
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
