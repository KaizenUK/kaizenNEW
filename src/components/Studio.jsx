import { Studio as SanityStudio } from "sanity";
import { useEffect, useState } from "react";
import config from "../../sanity.config";
import "../../sanity/studio.css";

const META_PANEL_STORAGE_KEY = "kaizen_studio_meta_panel_open";
const POST_STACK_CLASS = "kaizen-post-stack";
const MAIN_FIELD_CLASS = "kaizen-main-field";
const META_FIELD_CLASS = "kaizen-meta-field";

const POST_META_FIELDS = new Set([
  "field-slug",
  "field-excerpt",
  "field-mainImage",
  "field-coverImage",
  "field-seo",
  "field-seoStatsPanel",
  "field-author",
  "field-categories",
  "field-publishedAt",
  "field-readTime",
]);

const POST_MAIN_FIELDS = new Set(["field-title", "field-body"]);

function getFieldId(element) {
  return String(element.getAttribute("data-testid") ?? "").trim();
}

function annotatePostEditorStacks() {
  const stacks = Array.from(
    document.querySelectorAll(
      '[data-testid="document-panel-scroller"] [data-ui="Stack"]',
    ),
  );

  for (const stack of stacks) {
    const directFields = Array.from(stack.children).filter(
      (child) =>
        child instanceof HTMLElement &&
        getFieldId(child).startsWith("field-"),
    );

    if (!directFields.length) {
      stack.classList.remove(POST_STACK_CLASS);
      continue;
    }

    const hasBody = directFields.some((field) => getFieldId(field) === "field-body");
    const hasSeo = directFields.some((field) => getFieldId(field) === "field-seo");
    const isPostEditorStack = hasBody && hasSeo;

    if (!isPostEditorStack) {
      stack.classList.remove(POST_STACK_CLASS);
      for (const field of directFields) {
        field.classList.remove(MAIN_FIELD_CLASS, META_FIELD_CLASS);
      }
      continue;
    }

    stack.classList.add(POST_STACK_CLASS);

    for (const field of directFields) {
      const fieldId = getFieldId(field);
      field.classList.remove(MAIN_FIELD_CLASS, META_FIELD_CLASS);

      if (POST_META_FIELDS.has(fieldId)) {
        field.classList.add(META_FIELD_CLASS);
        continue;
      }

      if (POST_MAIN_FIELDS.has(fieldId)) {
        field.classList.add(MAIN_FIELD_CLASS);
      }
    }
  }
}

export default function Studio() {
  const [metaPanelOpen, setMetaPanelOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(META_PANEL_STORAGE_KEY);
      if (saved === "1") setMetaPanelOpen(true);
    } catch {
      // Ignore storage errors in hardened browser contexts.
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("studio-meta-open", metaPanelOpen);
    document.documentElement.classList.toggle("studio-meta-open", metaPanelOpen);
    try {
      window.localStorage.setItem(
        META_PANEL_STORAGE_KEY,
        metaPanelOpen ? "1" : "0",
      );
    } catch {
      // Ignore storage errors in hardened browser contexts.
    }
  }, [metaPanelOpen]);

  useEffect(() => {
    let rafId = 0;
    const scheduleAnnotate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        annotatePostEditorStacks();
      });
    };

    scheduleAnnotate();
    const observer = new MutationObserver(scheduleAnnotate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleAnnotate);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleAnnotate);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <SanityStudio config={config} />
      <button
        type="button"
        className={`studio-meta-toggle${metaPanelOpen ? " studio-meta-toggle--active" : ""}`}
        onClick={() => setMetaPanelOpen((value) => !value)}
        aria-label={metaPanelOpen ? "Hide post settings panel" : "Show post settings panel"}
        aria-expanded={metaPanelOpen}
        title={metaPanelOpen ? "Hide settings panel" : "Show settings panel"}
      >
        {metaPanelOpen ? "Hide Settings" : "Post Settings"}
      </button>
    </div>
  );
}
