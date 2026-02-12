import { Studio as SanityStudio } from "sanity";
import { useEffect, useState } from "react";
import config from "../../sanity.config";
import "../../sanity/studio.css";

const META_PANEL_STORAGE_KEY = "kaizen_studio_meta_panel_open";
const POST_STACK_CLASS = "kaizen-post-stack";
const MAIN_FIELD_CLASS = "kaizen-main-field";
const META_FIELD_CLASS = "kaizen-meta-field";
const MAIN_EDITOR_FIELDS = new Set(["field-title", "field-body", "field-content"]);
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

function getTopLevelGridItem(fieldElement, stackElement) {
  let current = fieldElement;
  while (current && current.parentElement && current.parentElement !== stackElement) {
    current = current.parentElement;
  }
  if (current && current.parentElement === stackElement) {
    return current;
  }
  return null;
}

function isVisibleElement(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.closest('[aria-hidden="true"], [hidden], [data-hidden="true"]')) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function annotatePostEditorStacks() {
  const stacks = Array.from(
    document.querySelectorAll(
      '[data-testid="document-panel-scroller"] [data-ui="Stack"]',
    ),
  );

  let hasPostEditorStack = false;

  for (const stack of stacks) {
    if (!(stack instanceof HTMLElement)) continue;
    const hasMainField = Array.from(MAIN_EDITOR_FIELDS).some((fieldId) =>
      Boolean(stack.querySelector(`[data-testid="${fieldId}"]`)),
    );
    const hasMetaField = Array.from(POST_META_FIELDS).some((fieldId) =>
      Boolean(stack.querySelector(`[data-testid="${fieldId}"]`)),
    );
    const isPostEditorStack = hasMainField && hasMetaField;

    const gridItems = Array.from(stack.children).filter(
      (child) => child instanceof HTMLElement,
    );

    if (!isPostEditorStack) {
      stack.classList.remove(POST_STACK_CLASS);
      for (const item of gridItems) {
        item.classList.remove(MAIN_FIELD_CLASS, META_FIELD_CLASS);
      }
      continue;
    }

    hasPostEditorStack = hasPostEditorStack || isVisibleElement(stack);
    stack.classList.add(POST_STACK_CLASS);

    for (const item of gridItems) {
      item.classList.remove(MAIN_FIELD_CLASS, META_FIELD_CLASS);
    }

    for (const fieldId of MAIN_EDITOR_FIELDS) {
      const fieldElement = stack.querySelector(`[data-testid="${fieldId}"]`);
      if (!(fieldElement instanceof HTMLElement)) continue;
      const gridItem = getTopLevelGridItem(fieldElement, stack);
      if (gridItem) gridItem.classList.add(MAIN_FIELD_CLASS);
    }

    for (const fieldId of POST_META_FIELDS) {
      const fieldElement = stack.querySelector(`[data-testid="${fieldId}"]`);
      if (!(fieldElement instanceof HTMLElement)) continue;
      const gridItem = getTopLevelGridItem(fieldElement, stack);
      if (gridItem) {
        gridItem.classList.add(META_FIELD_CLASS);
      }
    }
  }

  return hasPostEditorStack;
}

export default function Studio() {
  const [metaPanelOpen, setMetaPanelOpen] = useState(false);
  const [showMetaToggle, setShowMetaToggle] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(META_PANEL_STORAGE_KEY);
      if (saved === "1") setMetaPanelOpen(true);
    } catch {
      // Ignore storage errors in hardened browser contexts.
    }
  }, []);

  useEffect(() => {
    const shouldOpen = showMetaToggle && metaPanelOpen;
    document.body.classList.toggle("studio-meta-open", shouldOpen);
    document.documentElement.classList.toggle("studio-meta-open", shouldOpen);
    try {
      window.localStorage.setItem(
        META_PANEL_STORAGE_KEY,
        metaPanelOpen ? "1" : "0",
      );
    } catch {
      // Ignore storage errors in hardened browser contexts.
    }
  }, [metaPanelOpen, showMetaToggle]);

  useEffect(() => {
    let rafId = 0;
    const scheduleAnnotate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const hasPostEditorStack = annotatePostEditorStacks();
        const hasDocumentForm = Boolean(
          document.querySelector('[data-testid="document-panel"]'),
        );
        const shouldShowToggle = hasDocumentForm && hasPostEditorStack;
        setShowMetaToggle(shouldShowToggle);
      });
    };

    scheduleAnnotate();
    const observer = new MutationObserver(scheduleAnnotate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleAnnotate);
    window.addEventListener("hashchange", scheduleAnnotate);
    window.addEventListener("popstate", scheduleAnnotate);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleAnnotate);
      window.removeEventListener("hashchange", scheduleAnnotate);
      window.removeEventListener("popstate", scheduleAnnotate);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <SanityStudio config={config} />
      {showMetaToggle && (
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
      )}
    </div>
  );
}
