import { useEffect, useRef, useState } from "react";
import type { SourceInspection } from "../../shared/builderSourceEditing";
import { storage } from "./storage";
import { activeProjectId } from "./projectStorage";

export function useSourceSelection(inspection?: SourceInspection) {
  const [ids, setIds] = useState<string[] | undefined>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const popup = useRef<Window | null>(null);
  const session = useRef<{ nonce: string; origin: string } | undefined>(
    undefined,
  );
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const receive = (event: MessageEvent) => {
      if (
        !session.current ||
        event.source !== popup.current ||
        event.origin !== session.current.origin ||
        event.data?.nonce !== session.current.nonce
      )
        return;
      if (event.data.type === "kaizen-source-ready") {
        clearTimeout(timeout.current);
        setError("");
        setStatus("Rendered selection is ready in the preview window.");
      } else if (
        event.data.type === "kaizen-source-select" &&
        Array.isArray(event.data.ids)
      ) {
        const valid = [...new Set(event.data.ids)].filter(
          (id): id is string =>
            typeof id === "string" &&
            Boolean(inspection?.fields.some((field) => field.id === id)),
        );
        setIds(valid);
        setStatus(
          valid.length
            ? `${valid.length} matching source fields. Choose the intended field; shared or repeated content may have multiple matches.`
            : "No editable literal matched this selection. Use the full field list or its original data source.",
        );
      }
    };
    window.addEventListener("message", receive);
    return () => {
      mounted.current = false;
      clearTimeout(timeout.current);
      popup.current?.close();
      window.removeEventListener("message", receive);
    };
  }, [inspection]);
  async function open() {
    if (!inspection) return;
    setError("");
    setIds(undefined);
    setStatus("");
    popup.current?.close();
    session.current = undefined;
    clearTimeout(timeout.current);
    // Open synchronously with the user's click so the browser can permit the window.
    const child = window.open("about:blank", "_blank");
    popup.current = child;
    if (!child) {
      setError("Allow the preview window in your browser, then try again.");
      return;
    }
    try {
      child.document.title = "Opening source selection";
      child.document.body.textContent =
        "Checking the built page against the current source…";
      const jobId = sessionStorage.getItem(
        `kaizen-build:${activeProjectId}:${inspection.root}`,
      );
      if (!jobId)
        throw new Error(
          "Use Build & local preview to review and run this repository’s build first.",
        );
      const preview = await storage.repository({
        action: "repository-source-preview",
        jobId,
        root: inspection.root,
        route: inspection.route,
      });
      if (!mounted.current || child.closed || popup.current !== child) {
        child.close();
        return;
      }
      if (JSON.stringify(preview.files) !== JSON.stringify(inspection.files))
        throw new Error(
          "Source changed since opening this editor. Reopen the source editor and rebuild.",
        );
      const url = new URL(preview.url);
      if (url.protocol !== "http:" || url.hostname !== "127.0.0.1")
        throw new Error(
          "The companion returned an invalid local preview address.",
        );
      session.current = { nonce: preview.nonce, origin: url.origin };
      setStatus("Opening rendered selection…");
      timeout.current = setTimeout(
        () =>
          setError(
            "Selection did not connect. The page may block preview scripts, or the window was closed. Reopen the selector or use source fields.",
          ),
        15000,
      );
      child.location.replace(url.href);
    } catch (e) {
      child.close();
      if (mounted.current) setError(e.message);
    }
  }
  return {
    ids,
    status,
    error,
    open,
    clear: () => {
      setIds(undefined);
      setStatus("Showing all source fields.");
    },
  };
}
