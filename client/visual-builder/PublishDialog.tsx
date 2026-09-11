import React, { useEffect, useRef } from "react";
import { Check, CircleAlert, Eye, Globe, X } from "lucide-react";
import type {
  BuilderPage,
  PageDocument,
  Workspace,
} from "../../shared/visualBuilder";
import { localMode } from "./storage";

/* Pre-flight shown before a page goes live: how it will look in search, plus the checks that matter. */

type Check = { ok: boolean; text: string };

export function publishChecks(
  document: PageDocument,
  workspace: Workspace,
): Check[] {
  const checks: Check[] = [];
  const title = document.title.trim();
  checks.push(
    title && title !== "Untitled page"
      ? { ok: true, text: `Page title: ${title}` }
      : { ok: false, text: "Give the page a real title in Page settings" },
  );
  checks.push(
    document.slug
      ? { ok: true, text: `Page URL is set: /${document.slug}/` }
      : { ok: false, text: "Set a page URL in Page settings" },
  );
  const components = workspace.site?.draft.components || [];
  if (
    components.some((item) => item.kind === "header" || item.kind === "footer")
  ) {
    const header = document.site?.headerId,
      footer = document.site?.footerId;
    checks.push(
      header || footer
        ? {
            ok: true,
            text:
              header && footer
                ? "Uses the shared site header and footer"
                : header
                  ? "Uses the shared site header"
                  : "Uses the shared site footer",
          }
        : { ok: false, text: "No shared header or footer selected" },
    );
  }
  checks.push(
    document.description.trim()
      ? { ok: true, text: "Search description is set" }
      : { ok: false, text: "Search description is empty" },
  );
  checks.push(
    document.noIndex
      ? { ok: false, text: "Hidden from search engines" }
      : { ok: true, text: "Visible to search engines" },
  );
  return checks;
}

export default function PublishDialog({
  document,
  page,
  workspace,
  busy,
  onCancel,
  onPublish,
  onPreview,
}: {
  document: PageDocument;
  page: BuilderPage;
  workspace: Workspace;
  busy: boolean;
  onCancel: () => void;
  onPublish: () => void;
  onPreview: () => void;
}) {
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    primary.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const checks = publishChecks(document, workspace);
  const warnings = checks.filter((check) => !check.ok).length;
  return (
    <div className="builder-modal-backdrop" onMouseDown={onCancel}>
      <div
        className="builder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="builder-publish-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="builder-modal-close"
          aria-label="Close"
          onClick={onCancel}
        >
          <X size={20} />
        </button>
        <h2 id="builder-publish-title" className="builder-modal-title">
          Publish “{document.title || "Untitled page"}”?
        </h2>
        <p className="builder-modal-lede">
          {page.published
            ? "This replaces the live version. "
            : "This is the first time the page goes live. "}
          Here is how it will appear in search, with a quick check first.
        </p>
        <div className="builder-seo-preview">
          <strong>{document.title || "Untitled page"}</strong>
          <small>kaizenweb.co.uk › {document.slug || "…"}</small>
          <p className={document.description ? "" : "builder-seo-empty"}>
            {document.description ||
              "No search description yet. Add one in Page settings."}
          </p>
        </div>
        <ul className="builder-checklist" aria-label="Publish checks">
          {checks.map((check) => (
            <li key={check.text} data-ok={check.ok}>
              <span aria-hidden="true">
                {check.ok ? <Check size={14} /> : <CircleAlert size={14} />}
              </span>
              {check.text}
            </li>
          ))}
        </ul>
        <p className="builder-hint">
          {warnings
            ? `${warnings} ${warnings === 1 ? "item" : "items"} worth a look. You can still publish now.`
            : "Everything checks out."}{" "}
          {localMode
            ? "Publishing updates your local site only."
            : "Publishing queues a release; the live site updates once its checks pass."}
        </p>
        <div className="builder-modal-actions">
          <button
            ref={primary}
            type="button"
            className="builder-primary"
            disabled={busy}
            onClick={onPublish}
          >
            <Globe size={16} />
            {busy ? "Publishing…" : "Publish now"}
          </button>
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="builder-modal-secondary"
            disabled={busy}
            onClick={onPreview}
          >
            <Eye size={16} /> Preview first
          </button>
        </div>
      </div>
    </div>
  );
}
