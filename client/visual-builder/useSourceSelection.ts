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
        setStatus(
          "Preview ready. Click any text in it to find that text here.",
        );
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
            : "That text can't be changed here. It may come from the CMS or from code. Use the full field list instead.",
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
      child.document.title = "Opening the preview";
      child.document.body.textContent =
        "Checking the preview matches the current files…";
      const jobId = sessionStorage.getItem(
        `kaizen-build:${activeProjectId}:${inspection.root}`,
      );
      if (!jobId)
        throw new Error(
          "Build a preview first (see Preview the website below).",
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
          "The website's files changed since you opened this. Close and reopen the editor, then build again.",
        );
      const url = new URL(preview.url);
      if (url.protocol !== "http:" || url.hostname !== "127.0.0.1")
        throw new Error("The helper returned an invalid preview address.");
      session.current = { nonce: preview.nonce, origin: url.origin };
      setStatus("Opening the preview…");
      timeout.current = setTimeout(
        () =>
          setError(
            "The preview did not connect. The page may block scripts, or the window was closed. Try again or use the field list.",
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
      setStatus("Showing all fields.");
    },
  };
}
