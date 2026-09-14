import React, { useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Eye, Monitor, Smartphone, Sparkles, X } from "lucide-react";
import type { PageDocument, Workspace } from "../../shared/visualBuilder";
import { newId } from "../../shared/visualBuilder";
import {
  initialSiteState,
  resolveSiteDocument,
} from "../../shared/builderSite";
import { materializeImages } from "../../shared/builderImages";
import {
  pageTemplates,
  templateDocument,
  templateSlug,
  type PageTemplateId,
} from "./starters";
import PageThumbnail from "./PageThumbnail";
import { previewHtml } from "./previewHtml";
import { Notice } from "./shell";

type Choice = {
  template: (typeof pageTemplates)[number];
  pageId: string;
  document: PageDocument;
};

export default function PageTemplateGallery({
  workspace,
  siteName,
  reserveExisting,
  websitePaths,
  disabled,
  onUse,
}: {
  workspace: Workspace;
  siteName?: string;
  reserveExisting: boolean;
  websitePaths?: string[];
  disabled: boolean;
  onUse: (pageId: string, document: PageDocument) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [theme, setTheme] = useState("light");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selected, setSelected] = useState<PageTemplateId>();
  const [width, setWidth] = useState(1280);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const saving = useRef(false);
  const previewWorkspace = useMemo(
    () =>
      workspace.site ? workspace : { ...workspace, site: initialSiteState() },
    [workspace],
  );
  const choice = choices.find((item) => item.template.id === selected);
  const rendered = useMemo(() => {
    if (!choice) return;
    try {
      return {
        html: previewHtml(
          materializeImages(
            resolveSiteDocument(choice.document, previewWorkspace.site?.draft),
            workspace.assets,
          ),
        ),
        error: "",
      };
    } catch {
      return {
        html: "",
        error:
          "This preview could not be loaded. Close the gallery and try again.",
      };
    }
  }, [choice, previewWorkspace.site?.draft, workspace.assets]);

  async function useTemplate(item: Choice) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await onUse(item.pageId, item.document);
      setOpen(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The page could not be created. Try again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function preview(id?: PageTemplateId) {
    setSelected(id);
    setError("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (saving.current) return;
        if (next) {
          setChoices(
            pageTemplates.map((template) => ({
              template,
              pageId: newId(),
              document: templateDocument(template.id, {
                siteName,
                useSiteTheme: !reserveExisting,
                slug: templateSlug(
                  template.id,
                  workspace,
                  reserveExisting,
                  websitePaths,
                ),
              }),
            })),
          );
          setSelected(undefined);
          setError("");
          setWidth(1280);
          setTheme(
            trigger.current
              ?.closest("[data-theme]")
              ?.getAttribute("data-theme") || "light",
          );
        }
        setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          className="builder-banner-secondary"
          disabled={disabled}
        >
          <Sparkles size={18} aria-hidden="true" /> Browse templates
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="builder-template-overlay" />
        <Dialog.Content
          className="builder-app builder-template-dialog"
          data-theme={theme}
        >
          <header className="builder-template-header">
            <div>
              <Dialog.Title ref={heading} tabIndex={-1}>
                {choice
                  ? `Preview · ${choice.template.name}`
                  : "Page templates"}
              </Dialog.Title>
              <Dialog.Description>
                {choice
                  ? "Use template adds a draft. Replace the sample content and check its links before publishing."
                  : "Choose a starting point, preview it, then make it your own."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close templates"
                disabled={busy}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>
          {error && <Notice tone="error">{error}</Notice>}
          {choice ? (
            <>
              <div className="builder-template-toolbar">
                <button type="button" onClick={() => preview()} disabled={busy}>
                  <ArrowLeft size={16} aria-hidden="true" /> All templates
                </button>
                <div role="group" aria-label="Template preview width">
                  {[
                    { width: 1280, label: "Desktop", Icon: Monitor },
                    { width: 390, label: "Phone", Icon: Smartphone },
                  ].map(({ width: value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={width === value}
                      onClick={() => setWidth(value)}
                    >
                      <Icon size={16} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="builder-primary"
                  onClick={() => void useTemplate(choice)}
                  disabled={busy || !rendered?.html}
                >
                  {busy ? "Creating page…" : "Use template"}
                </button>
              </div>
              {rendered?.error ? (
                <Notice tone="error">{rendered.error}</Notice>
              ) : (
                <div className="builder-template-preview">
                  <iframe
                    key={choice.template.id}
                    title={`${choice.template.name} template preview`}
                    sandbox="allow-scripts"
                    srcDoc={rendered?.html}
                    style={{ width, maxWidth: "100%" }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="builder-template-grid">
              {choices.map((item) => (
                <article
                  className="builder-template-card"
                  key={item.template.id}
                  aria-label={`${item.template.name} template`}
                >
                  <button
                    className="builder-template-image"
                    type="button"
                    aria-label={`Preview ${item.template.name}`}
                    onClick={() => preview(item.template.id)}
                    disabled={busy}
                  >
                    <PageThumbnail
                      document={item.document}
                      workspace={previewWorkspace}
                      tone={item.template.tone}
                      width={256}
                    />
                  </button>
                  <h3>{item.template.name}</h3>
                  <p>{item.template.description}</p>
                  <div>
                    <button
                      type="button"
                      onClick={() => preview(item.template.id)}
                      disabled={busy}
                    >
                      <Eye size={16} aria-hidden="true" />
                      Preview
                    </button>
                    <button
                      type="button"
                      className="builder-primary"
                      onClick={() => void useTemplate(item)}
                      disabled={busy}
                    >
                      {busy ? "Creating page…" : "Use template"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
