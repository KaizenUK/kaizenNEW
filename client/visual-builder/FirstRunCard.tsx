import React from "react";
import { ArrowRight, Check, Circle, X } from "lucide-react";
import { Notice } from "./shell";
import type { FirstRunStep } from "./firstRun";
import type { useFirstRun } from "./useFirstRun";

export default function FirstRunCard({
  checklist,
  onStep,
  creating,
}: {
  checklist: ReturnType<typeof useFirstRun>;
  onStep: (step: FirstRunStep) => void;
  creating: boolean;
}) {
  if (!checklist.available) return null;
  const { steps, dismissed, notice, publicationError } = checklist;
  return (
    <>
      {dismissed ? (
        <button
          type="button"
          className="builder-first-run-restore"
          onClick={() => checklist.dismiss(false)}
        >
          Show start here
        </button>
      ) : (
        <section
          className="builder-first-run"
          aria-labelledby="builder-first-run-title"
        >
          <header>
            <div>
              <h2 id="builder-first-run-title">Start here</h2>
              <span role="status">
                {steps.filter((step) => step.complete).length} of 5 complete
              </span>
            </div>
            <button
              type="button"
              aria-label="Dismiss start here"
              onClick={() => checklist.dismiss(true)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <ol>
            {steps.map((step) => (
              <li
                key={step.id}
                data-step={step.id}
                data-complete={step.complete}
              >
                <span
                  role="img"
                  aria-label={step.complete ? "Complete" : "To do"}
                >
                  {step.complete ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    <Circle size={18} aria-hidden="true" />
                  )}
                </span>
                <button
                  type="button"
                  disabled={
                    (step.id === "page" && creating) ||
                    ((step.id === "preview" || step.id === "publish") &&
                      !checklist.previewPage)
                  }
                  onClick={() => onStep(step.id)}
                >
                  {step.label}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          {publicationError && <Notice>{publicationError}</Notice>}
        </section>
      )}
      {notice && <Notice>{notice}</Notice>}
    </>
  );
}
