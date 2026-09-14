import React, { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { Workspace } from "../../shared/visualBuilder";
import type { StarterPlan } from "../../shared/builderStarter";
import { smallBusinessStarter } from "./starterSite";
import { Notice } from "./shell";
import PageThumbnail from "./PageThumbnail";

export default function StarterSiteDialog({
  workspace,
  siteName,
  disabled,
  onCreate,
}: {
  workspace: Workspace;
  siteName: string;
  disabled: boolean;
  onCreate: (plan: StarterPlan) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [theme, setTheme] = useState("light");
  const [plan, setPlan] = useState<StarterPlan>();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const saving = useRef(false),
    trigger = useRef<HTMLButtonElement>(null);
  async function create() {
    if (!plan || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await onCreate(plan);
      setOpen(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The starter could not be saved. Try again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (saving.current) return;
        if (next) {
          setPlan(smallBusinessStarter(workspace, siteName));
          setError("");
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
        <button ref={trigger} type="button" disabled={disabled}>
          Start with a website
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="builder-template-overlay" />
        <Dialog.Content
          className="builder-app builder-template-dialog builder-starter-dialog"
          data-theme={theme}
        >
          <header className="builder-template-header">
            <div>
              <Dialog.Title>Small business starter</Dialog.Title>
              <Dialog.Description>
                Create six editable pages with shared navigation and a footer.
                Replace the sample content, then preview and publish when ready.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close starter" disabled={busy}>
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>
          {error && <Notice tone="error">{error}</Notice>}
          {plan && (
            <>
              <div className="builder-starter-summary">
                <PageThumbnail
                  document={plan.pages[0].document}
                  workspace={{
                    ...workspace,
                    site: {
                      version: 0,
                      draft: plan.design,
                      published: null,
                      revisions: [],
                    },
                  }}
                  tone="#CFC8FF"
                  width={256}
                />
                <ul aria-label="Starter pages">
                  {plan.pages.map(({ id, document }) => (
                    <li key={id}>
                      {document.title}{" "}
                      <span className="builder-hint">/{document.slug}/</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="builder-template-toolbar">
                <Dialog.Close asChild>
                  <button type="button" disabled={busy}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  className="builder-primary"
                  disabled={busy}
                  onClick={() => void create()}
                >
                  {busy ? "Creating website…" : "Create starter site"}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
