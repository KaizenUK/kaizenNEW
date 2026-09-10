import React, { useState, useRef } from "react";
import { RichTextMenu, type RichtextField } from "@puckeditor/core";
import { Link, Unlink } from "lucide-react";
import { safeUrl } from "../../shared/visualBuilder";

type Props = Parameters<NonNullable<RichtextField["renderMenu"]>>[0];
export default function RichTextToolbar({ children, editor, readOnly }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [newTab, setNewTab] = useState(false);
  const [error, setError] = useState("");
  const selection = useRef({ from: 0, to: 0 });
  const linkEditor = useRef(editor);
  function start(event: React.SyntheticEvent) {
    event.stopPropagation();
    if (!editor) return;
    linkEditor.current = editor;
    selection.current = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    setUrl(editor.getAttributes("link").href || "");
    setNewTab(editor.getAttributes("link").target === "_blank");
    setError("");
    setOpen(true);
  }
  function applyLink(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
    const href = safeUrl(url.trim());
    if (!href) {
      setError("Use a website URL, /page/, #section, email or telephone link.");
      return;
    }
    const active = editor && !editor.isDestroyed ? editor : linkEditor.current;
    if (!active || active.isDestroyed) {
      setError("Select the text again to add this link.");
      return;
    }
    if (
      selection.current.from === selection.current.to &&
      !active.isActive("link")
    ) {
      setError(
        "Select the words you want to link, then reopen the link editor.",
      );
      return;
    }
    active.view.dom.focus();
    const applied = active
      .chain()
      .setTextSelection(selection.current)
      .extendMarkRange("link")
      .setLink({
        href,
        target: newTab ? "_blank" : null,
        rel: newTab ? "noopener noreferrer" : null,
      })
      .run();
    if (!applied) {
      setError(
        "This link could not be applied. Check the address and try again.",
      );
      return;
    }
    setOpen(false);
  }
  return (
    <div className="builder-rich-toolbar" data-puck-rte-menu="">
      <RichTextMenu>
        {children}
        <RichTextMenu.Group>
          <RichTextMenu.Control
            title="Add or edit link"
            icon={<Link size={15} />}
            disabled={readOnly || !editor}
            onClick={start}
          />
          <RichTextMenu.Control
            title="Remove link"
            icon={<Unlink size={15} />}
            disabled={readOnly || !editor?.isActive("link")}
            onClick={(event) => {
              event.stopPropagation();
              if (!editor || editor.isDestroyed) return;
              editor.view.dom.focus();
              editor.chain().extendMarkRange("link").unsetLink().run();
            }}
          />
        </RichTextMenu.Group>
      </RichTextMenu>
      {open && (
        <form
          className="builder-rich-link"
          aria-label="Edit text link"
          onSubmit={applyLink}
        >
          <label>
            Link address
            <input
              aria-label="Link address"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… or /contact/"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={newTab}
              onChange={(e) => setNewTab(e.target.checked)}
            />{" "}
            Open in a new tab
          </label>
          {error && <p role="alert">{error}</p>}
          <div>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={applyLink}
            >
              Apply link
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                editor
                  ?.chain()
                  .focus()
                  .setTextSelection(selection.current)
                  .run();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
