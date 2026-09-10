import React, { useContext, useEffect } from "react";
import {
  safeUrl,
  type Block,
  type ContentPost,
} from "../../shared/visualBuilder";
import {
  displayContentDate,
  selectContentPosts,
} from "../../shared/builderContent";
import { ContentContext } from "./ContentContext";

export default function ContentListBlock({ block }: { block: Block }) {
  const content = useContext(ContentContext),
    p = block.props;
  useEffect(() => {
    if (!Array.isArray(p.records) && content.status === "idle")
      void content.load?.().catch(() => {});
  }, [p.records, content.status, content.load]);
  let posts: ContentPost[];
  try {
    if (Array.isArray(p.records)) posts = p.records as ContentPost[];
    else if (content.catalogue)
      posts = selectContentPosts(block, content.catalogue);
    else
      return (
        <div className="kb-placeholder">
          {content.error ||
            (content.status === "loading"
              ? "Loading Sanity posts…"
              : "Connect Sanity in the listing settings to show published posts.")}
        </div>
      );
  } catch (error) {
    return <div className="kb-placeholder">{(error as Error).message}</div>;
  }
  return (
    <div className={`kb-content-inner kb-content-${p.variant}`}>
      {p.text && <h2>{p.text}</h2>}
      {posts.length ? (
        <div className="kb-content-grid">
          {posts.map((post) => (
            <article className="kb-content-card" key={post.id}>
              {p.showImages === "yes" && safeUrl(post.image, true) && (
                <a
                  className="kb-content-image"
                  href={safeUrl(post.href) || "#"}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <img
                    src={safeUrl(post.image, true)}
                    alt={post.alt || ""}
                    loading="lazy"
                  />
                </a>
              )}
              <div className="kb-content-copy">
                {(p.showDates === "yes" || p.showAuthors === "yes") && (
                  <div className="kb-content-meta">
                    {p.showDates === "yes" && post.publishedAt && (
                      <time dateTime={post.publishedAt}>
                        {displayContentDate(post.publishedAt)}
                      </time>
                    )}
                    {p.showAuthors === "yes" && post.author && (
                      <span>{post.author}</span>
                    )}
                  </div>
                )}
                <h3>
                  <a href={safeUrl(post.href) || "#"}>{post.title}</a>
                </h3>
                {p.showExcerpts === "yes" && post.excerpt && (
                  <p>{post.excerpt}</p>
                )}
                <a
                  className="kb-content-more"
                  href={safeUrl(post.href) || "#"}
                  aria-label={`Read ${post.title}`}
                >
                  {String(p.linkLabel || "Read article")}{" "}
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="kb-content-empty">
          {String(p.emptyText || "No published posts in this category yet.")}
        </p>
      )}
    </div>
  );
}
