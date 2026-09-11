import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PageDocument, Workspace } from "../../shared/visualBuilder";
import { resolveSiteDocument } from "../../shared/builderSite";
import { materializeImages } from "../../shared/builderImages";
import { previewHtml } from "./previewHtml";

/* A live, read-only miniature of a page draft. Rendered only once the row scrolls into view. */

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 960;

function useInView<T extends HTMLElement>() {
  const node = useRef<T>(null);
  const [inView, setInView] = useState(
    typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    if (inView || !node.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node.current);
    return () => observer.disconnect();
  }, [inView]);
  return [node, inView] as const;
}

export default function PageThumbnail({
  document,
  workspace,
  tone,
  width = 96,
}: {
  document: PageDocument;
  workspace: Workspace;
  tone: string;
  width?: number;
}) {
  const [node, inView] = useInView<HTMLDivElement>();
  const html = useMemo(() => {
    if (!inView) return "";
    try {
      const shared = resolveSiteDocument(document, workspace.site?.draft);
      return previewHtml(materializeImages(shared, workspace.assets));
    } catch {
      return "";
    }
  }, [inView, document, workspace.site, workspace.assets]);
  const height = Math.round((width * FRAME_HEIGHT) / FRAME_WIDTH);
  const scale = width / FRAME_WIDTH;
  return (
    <div
      ref={node}
      className="builder-thumb"
      style={{ width, height, background: tone }}
      aria-hidden="true"
    >
      {html ? (
        <iframe
          tabIndex={-1}
          title=""
          sandbox=""
          loading="lazy"
          srcDoc={html}
          style={{
            width: FRAME_WIDTH,
            height: FRAME_HEIGHT,
            transform: `scale(${scale})`,
          }}
        />
      ) : (
        <svg viewBox="0 0 96 72" className="builder-thumb-placeholder">
          <rect x="10" y="8" width="20" height="3" rx="1.5" />
          <rect x="10" y="20" width="34" height="6" rx="2" />
          <rect x="10" y="30" width="30" height="6" rx="2" />
          <rect x="10" y="50" width="16" height="7" rx="3" />
          <rect x="52" y="20" width="34" height="38" rx="4" opacity="0.5" />
        </svg>
      )}
    </div>
  );
}
