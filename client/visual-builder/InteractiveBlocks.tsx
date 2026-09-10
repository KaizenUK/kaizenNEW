import React from "react";
import ContactBlock from "./ContactBlock";
import {
  safeUrl,
  type Block,
  type ContentItem,
  type MenuLink,
} from "../../shared/visualBuilder";

/** Static React markup with native controls and a small optional progressive enhancement. */
export default function InteractiveBlock({ block }: { block: Block }) {
  const { type, props } = block;
  const id = `kb-${props.id}`;
  if (type === "ContactForm") return <ContactBlock block={block} />;
  if (type === "Menu") {
    const links = (props.links || []) as MenuLink[];
    const list = () => (
      <ul>
        {links.map((link, index) => (
          <li key={index}>
            <a href={safeUrl(link.href) || "#"}>{link.label}</a>
          </li>
        ))}
      </ul>
    );
    return (
      <nav
        className="kb-menu-inner"
        aria-label={String(props.label || "Main navigation")}
      >
        <a className="kb-menu-brand" href={safeUrl(props.href) || "/"}>
          {props.text || "Your brand"}
        </a>
        <div className="kb-menu-desktop">{list()}</div>
        <details className="kb-menu-mobile" data-kb-menu="">
          <summary>
            Menu <span aria-hidden="true">☰</span>
          </summary>
          {list()}
        </details>
      </nav>
    );
  }
  if (type === "Accordion")
    return (
      <div className="kb-accordion-inner">
        {((props.items || []) as ContentItem[]).map((item, index) => (
          <details key={index}>
            <summary>{item.title}</summary>
            <div className="kb-item-copy">{item.content}</div>
          </details>
        ))}
      </div>
    );
  if (type === "Tabs") {
    const items = (props.items || []) as ContentItem[];
    return (
      <div
        data-kb-tabs=""
        aria-label={String(props.label || "More information")}
      >
        <div className="kb-tab-buttons" data-kb-tablist="" hidden>
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              id={`${id}-tab-${index}`}
              data-kb-tab=""
              aria-controls={`${id}-panel-${index}`}
            >
              {item.title}
            </button>
          ))}
        </div>
        {items.map((item, index) => (
          <section
            key={index}
            id={`${id}-panel-${index}`}
            data-kb-panel=""
            className="kb-tab-panel"
          >
            <h3 className="kb-tab-heading">{item.title}</h3>
            <div className="kb-item-copy">{item.content}</div>
          </section>
        ))}
      </div>
    );
  }
  if (type === "Video")
    return safeUrl(props.src, true) ? (
      <figure className="kb-video-inner">
        <video
          controls
          playsInline
          preload="none"
          poster={safeUrl(props.poster, true) || undefined}
          aria-label={String(props.label || "Video")}
        >
          <source src={safeUrl(props.src, true)} />
          {safeUrl(props.captions, true) && (
            <track
              kind="captions"
              src={safeUrl(props.captions, true)}
              srcLang={String(props.captionLanguage || "en")}
              label="Captions"
              default
            />
          )}
          <a href={safeUrl(props.src, true)}>Download video</a>
        </video>
        {props.text && <figcaption>{props.text}</figcaption>}
      </figure>
    ) : (
      <div className="kb-placeholder">
        Add an MP4 or WebM video URL in settings.
      </div>
    );
  return null;
}
