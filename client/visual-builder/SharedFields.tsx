import React, { useContext } from "react";
import { usePuck } from "@puckeditor/core";
import type { Block } from "../../shared/visualBuilder";
import { SiteContext } from "./SiteContext";
import RichText from "./RichText";
const labels = {
  text: "Text",
  html: "Formatted text",
  src: "Media URL",
  alt: "Image description",
  href: "Link",
  label: "Accessible name",
  poster: "Poster image",
  captions: "Captions file",
};

export function SharedChoice({ value, onChange }) {
  const site = useContext(SiteContext);
  return (
    <label className="builder-field">
      Shared component
      <select
        aria-label="Shared component"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="unselected">Choose a component…</option>
        {site?.components.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function InstanceOverrides({ value = {}, onChange }) {
  const site = useContext(SiteContext);
  const { selectedItem } = usePuck();
  const component = site?.components.find(
    (item) => item.id === selectedItem?.props.componentId,
  );
  if (!component) return <p>Choose a shared component first.</p>;
  const items: Block[] = [];
  function walk(nodes: Block[]) {
    for (const node of nodes) {
      items.push(node);
      walk(node.props.children || []);
    }
  }
  walk(component.blocks);
  return (
    <div className="builder-field">
      <p className="builder-hint">
        Changes here apply only to this instance. Empty overrides still replace
        shared text. Reset to follow the shared value again. Detach to change
        its structure.
      </p>
      {items.map((node) => {
        const fields = [
          "text",
          "html",
          "src",
          "alt",
          "href",
          "label",
          "poster",
          "captions",
        ].filter((key) => typeof node.props[key] === "string");
        return fields.length ? (
          <details key={node.props.id} data-instance-node={node.props.id}>
            <summary>
              {node.type} ·{" "}
              {String(
                node.props.text ||
                  node.props.label ||
                  node.props.alt ||
                  "Content",
              ).slice(0, 48)}
            </summary>
            {fields.map((key) => {
              const override = value[node.props.id]?.[key];
              return (
                <label key={key}>
                  {labels[key]}
                  {key === "html" ? (
                    <div
                      key={`${node.props.id}-${override === undefined ? "shared" : "override"}`}
                      className="builder-rich-override"
                      role="textbox"
                      aria-label="Formatted text"
                      aria-multiline="true"
                      contentEditable
                      suppressContentEditableWarning
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("a"))
                          event.preventDefault();
                      }}
                      onBlur={(event) =>
                        onChange({
                          ...value,
                          [node.props.id]: {
                            ...value[node.props.id],
                            html: event.currentTarget.innerHTML,
                          },
                        })
                      }
                    >
                      <RichText html={override ?? node.props.html} />
                    </div>
                  ) : (
                    <textarea
                      aria-label={labels[key]}
                      value={override ?? String(node.props[key])}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          [node.props.id]: {
                            ...value[node.props.id],
                            [key]: event.target.value,
                          },
                        })
                      }
                    />
                  )}
                  <small>
                    {override !== undefined
                      ? "Instance override"
                      : "Shared value"}
                  </small>
                  <button
                    type="button"
                    disabled={override === undefined}
                    aria-label={`Reset ${labels[key]} to shared`}
                    onClick={() => {
                      const next = {
                        ...value,
                        [node.props.id]: { ...value[node.props.id] },
                      };
                      delete next[node.props.id][key];
                      onChange(next);
                    }}
                  >
                    Reset to shared
                  </button>
                </label>
              );
            })}
          </details>
        ) : null;
      })}
    </div>
  );
}
