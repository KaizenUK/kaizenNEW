import { useEffect, useRef, useState } from "react";
import type { SourceInspection } from "../../shared/builderSourceEditing";
import { storage } from "./storage";
import { activeProjectId } from "./projectStorage";
import { repositoryConnection } from "./repositoryConnection";

export function useSourceSelection(inspection?: SourceInspection) {
  const [ids, setIds] = useState<string[] | undefined>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const popup = useRef<Window | null>(null);
  const session = useRef<
    { nonce: string; origin: string; target: Window } | undefined
  >(undefined);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const receiveRef = useRef<(event: MessageEvent) => void>(() => {});
  useEffect(() => {
    mounted.current = true;
    const receive = (event: MessageEvent) => {
      if (
        !session.current ||
        event.source !== session.current.target ||
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
    receiveRef.current = receive;
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
      const url = repositoryConnection.validateFrame(
        preview.url,
        preview.nonce,
      );
      session.current = {
        nonce: preview.nonce,
        origin: repositoryConnection.frameOrigin(url.href),
        target: child,
      };
      setStatus("Opening the preview…");
      timeout.current = setTimeout(
        () =>
          setError(
            "The preview did not connect. The page may block scripts, or the window was closed. Try again or use the field list.",
          ),
        15000,
      );
      if (repositoryConnection.frameSandbox === "allow-scripts") {
        // Keep the popup's document trusted too; project scripts only run in its opaque frame.
        child.document.body.textContent = "";
        child.document.body.style.margin = "0";
        const frame = child.document.createElement("iframe");
        frame.title = "Website preview";
        frame.setAttribute("sandbox", repositoryConnection.frameSandbox);
        frame.style.cssText = "border:0;width:100vw;height:100vh;display:block";
        frame.src = url.href;
        child.document.body.append(frame);
        session.current.target = frame.contentWindow!;
        child.addEventListener("message", receiveRef.current);
      } else child.location.replace(url.href);
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
