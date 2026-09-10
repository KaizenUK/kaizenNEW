import React, { useMemo, useRef, useState } from "react";
import { sectionPresets } from "./sectionPresets";
import { newDocument } from "./starters";
import { previewHtml } from "./previewHtml";
import type { Block, Theme } from "../../shared/visualBuilder";

export default function SectionLibrary({
  theme,
  onInsert,
}: {
  theme: Theme;
  onInsert: (block: Block) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(sectionPresets[0].id);
  const [mobile, setMobile] = useState(false);
  const preset = sectionPresets.find((item) => item.id === active)!;
  const html = useMemo(() => {
    const document = newDocument(preset.name, "section-preview", false);
    document.theme = theme;
    document.data.content = [preset.create()];
    return previewHtml(document);
  }, [preset, theme]);
  return (
    <>
      <button
        className="builder-section-library-open"
        onClick={() => dialog.current?.showModal()}
      >
        Browse section designs <small>8 editable variations</small>
      </button>
      <dialog
        ref={dialog}
        className="builder-section-library"
        aria-labelledby="builder-section-library-title"
      >
        <header>
          <div>
            <h2 id="builder-section-library-title">Section designs</h2>
            <p>
              Preview a design, then add it to your page. Every element stays
              editable.
            </p>
          </div>
          <button
            onClick={() => dialog.current?.close()}
            aria-label="Close section designs"
          >
            Close
          </button>
        </header>
        <div className="builder-section-library-body">
          <nav aria-label="Section designs">
            {sectionPresets.map((item) => (
              <button
                key={item.id}
                aria-pressed={active === item.id}
                onClick={() => setActive(item.id)}
              >
                <small>{item.category}</small>
                {item.name}
              </button>
            ))}
          </nav>
          <div className="builder-section-library-preview">
            <div className="builder-row">
              <strong>{preset.name}</strong>
              <button aria-pressed={!mobile} onClick={() => setMobile(false)}>
                Wide
              </button>
              <button aria-pressed={mobile} onClick={() => setMobile(true)}>
                Mobile
              </button>
            </div>
            <p>{preset.description}</p>
            <div className="builder-section-library-frame">
              <iframe
                title="Section design preview"
                sandbox="allow-scripts"
                srcDoc={html}
                style={{ width: mobile ? 390 : "100%" }}
              />
            </div>
            <p className="builder-hint">
              Added beside your selection, or inside a selected container.
              Sample copy, images and links can be replaced.
            </p>
            <button
              className="builder-primary"
              onClick={() => {
                onInsert(preset.create());
                dialog.current?.close();
              }}
            >
              Add {preset.name}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
