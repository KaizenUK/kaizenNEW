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

function getTopLevelGridItem(fieldElement, container) {
  let current = fieldElement;
  while (current && current.parentElement && current.parentElement !== container) {
    current = current.parentElement;
  }
  if (current && current.parentElement === container) {
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

/**
 * Find the form container that holds all the post/page fields.
 * Instead of relying on [data-ui="Stack"] (which may not exist in
 * Sanity v5), walk up from known fields to find their common parent.
 */
function findFormContainer(scroller) {
  // Find one main field and one meta field
  const bodyField = scroller.querySelector(
    '[data-testid="field-body"], [data-testid="field-content"]',
  );
  const metaField = scroller.querySelector('[data-testid="field-slug"]');
  if (!bodyField || !metaField) return null;

  // Walk up from the meta field to find the nearest ancestor that also
  // contains the body field, and where both are in different direct children.
  let candidate = metaField.parentElement;
  while (candidate && candidate !== scroller) {
    if (candidate.contains(bodyField)) {
      const bodyWrapper = getTopLevelGridItem(bodyField, candidate);
      const metaWrapper = getTopLevelGridItem(metaField, candidate);
      if (bodyWrapper && metaWrapper && bodyWrapper !== metaWrapper) {
        return candidate;
      }
    }
    candidate = candidate.parentElement;
  }
  return null;
}

function annotatePostEditorStacks() {
  const scroller = document.querySelector(
    '[data-testid="document-panel-scroller"]',
  );
  if (!scroller) return false;

  // Remove stale annotations from any previously annotated containers.
  const prevStacks = scroller.querySelectorAll(`.${POST_STACK_CLASS}`);
  for (const prev of prevStacks) {
    prev.classList.remove(POST_STACK_CLASS);
    for (const child of prev.children) {
      if (child instanceof HTMLElement) {
        child.classList.remove(MAIN_FIELD_CLASS, META_FIELD_CLASS);
      }
    }
  }

  const container = findFormContainer(scroller);
  if (!container) return false;

  // Verify it has both field types
  const hasMainField = Array.from(MAIN_EDITOR_FIELDS).some((id) =>
    Boolean(container.querySelector(`[data-testid="${id}"]`)),
  );
  const hasMetaField = Array.from(POST_META_FIELDS).some((id) =>
    Boolean(container.querySelector(`[data-testid="${id}"]`)),
  );
  if (!hasMainField || !hasMetaField) return false;

  container.classList.add(POST_STACK_CLASS);

  // Clear any existing annotations on children
  for (const child of container.children) {
    if (child instanceof HTMLElement) {
      child.classList.remove(MAIN_FIELD_CLASS, META_FIELD_CLASS);
    }
  }

  // Annotate main field wrappers
  for (const fieldId of MAIN_EDITOR_FIELDS) {
    const el = container.querySelector(`[data-testid="${fieldId}"]`);
    if (!(el instanceof HTMLElement)) continue;
    const wrapper = getTopLevelGridItem(el, container);
    if (wrapper) wrapper.classList.add(MAIN_FIELD_CLASS);
  }

  // Annotate meta field wrappers
  for (const fieldId of POST_META_FIELDS) {
    const el = container.querySelector(`[data-testid="${fieldId}"]`);
    if (!(el instanceof HTMLElement)) continue;
    const wrapper = getTopLevelGridItem(el, container);
    if (wrapper) wrapper.classList.add(META_FIELD_CLASS);
  }

  return isVisibleElement(container);
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
