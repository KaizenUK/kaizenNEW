import React, { useContext, useEffect, useState } from "react";
import { ContentContext } from "./ContentContext";
import type { ContentBinding } from "../../shared/visualBuilder";

export function ContentConnection() {
  const content = useContext(ContentContext);
  return (
    <div className="builder-content-connection">
      <p>
        Published Sanity posts. Edit articles in Studio; the next site
        deployment refreshes connected content.
      </p>
      {content.status === "error" && <p role="alert">{content.error}</p>}
      {content.catalogue && (
        <p>
          {content.catalogue.posts.length} posts ·{" "}
          {content.catalogue.categories.length} categories
          {content.catalogue.truncated
            ? " · Catalogue limit reached; publishing will stop until the integration is narrowed."
            : ""}
        </p>
      )}
      <button
        type="button"
        disabled={content.status === "loading"}
        onClick={() => void content.load?.().catch(() => {})}
      >
        {content.status === "loading"
          ? "Loading Sanity…"
          : "Refresh Sanity content"}
      </button>
    </div>
  );
}
export function CategoryField({
  value,
  onChange,
  id,
}: {
  value?: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const { catalogue } = useContext(ContentContext);
  return (
    <>
      <ContentConnection />
      <select
        id={id}
        aria-label="Post category"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All categories</option>
        {value && !catalogue?.categories.some((item) => item.id === value) && (
          <option value={value}>Unavailable category — choose another</option>
        )}
        {catalogue?.categories.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
    </>
  );
}
export function ContentBindingField({
  value,
  onChange,
  type,
}: {
  value?: ContentBinding;
  onChange: (value?: ContentBinding, ui?: { field: { focus: string } }) => void;
  type: string;
}) {
  const content = useContext(ContentContext);
  const update = (next?: ContentBinding) =>
    onChange(next, { field: { focus: "builder-style:content-binding" } });
  const [open, setOpen] = useState(!!value);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if ((open || value) && content.status === "idle")
      void content.load?.().catch(() => {});
  }, [open, value, content.status, content.load]);
  const fields =
    type === "Image"
      ? [["image", "Post image"]]
      : type === "Button"
        ? [["link", "Article URL"]]
        : [
            ["title", "Title"],
            ["excerpt", "Summary"],
            ["author", "Author name"],
            ["publishedAt", "Publication date"],
          ];
  if (!open && !value)
    return (
      <button type="button" onClick={() => setOpen(true)}>
        Connect to Sanity
      </button>
    );
  const posts =
    content.catalogue?.posts.filter(
      (post) =>
        post.id === value?.postId ||
        post.title.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  return (
    <div className="builder-content-binding">
      <ContentConnection />
      <input
        aria-label="Find a Sanity post"
        placeholder="Find a post…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <label>
        Linked post
        <select
          aria-label="Linked post"
          value={value?.postId || ""}
          onChange={(event) => {
            if (event.target.value)
              update({
                postId: event.target.value,
                field: (value?.field ||
                  fields[0][0]) as ContentBinding["field"],
              });
          }}
        >
          <option value="">Choose a post</option>
          {value && !posts.some((post) => post.id === value.postId) && (
            <option value={value.postId}>Missing or unpublished post</option>
          )}
          {posts.map((post) => (
            <option key={post.id} value={post.id}>
              {post.title}
            </option>
          ))}
        </select>
      </label>
      {value && (
        <>
          <label>
            Content field
            <select
              aria-label="Content field"
              value={value.field}
              onChange={(event) =>
                update({
                  ...value,
                  field: event.target.value as ContentBinding["field"],
                })
              }
            >
              {fields.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p>
            Connected content comes from Sanity. Use manual content to restore
            the values you entered in this block.
          </p>
          <button
            type="button"
            onClick={() => {
              update(undefined);
              setOpen(false);
            }}
          >
            Use manual content
          </button>
        </>
      )}
    </div>
  );
}
