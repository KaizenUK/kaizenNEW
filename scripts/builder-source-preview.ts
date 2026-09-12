import type {
  SourceField,
  SourceInspection,
} from "../shared/builderSourceEditing";
import { canvasScript } from "./builder-source-canvas";

/** The frame talks only to its editor. It has no helper capability or endpoint. */
export function sourceEditingScript(
  inspection: SourceInspection,
  nonce: string,
  parentOrigin: string,
) {
  return canvasScript(inspection, nonce, parentOrigin);
}

/** Only static file routes have a deterministic built URL. */
export function sourcePreviewPath(route: string) {
  if (
    !/^src\/pages\/[\w./-]+\.astro$/.test(route) ||
    route.split("/").includes("..")
  )
    throw new Error(
      "Rendered selection currently supports static Astro page routes. Use source fields for dynamic routes.",
    );
  const name = route
    .slice("src/pages/".length, -".astro".length)
    .replace(/(^|\/)index$/, "");
  return `/${name}`.replace(/\/$/, "") + "/";
}

/** This bridge can select field IDs only; it cannot apply source edits or run companion commands. */
export function sourceSelectionScript(
  fields: SourceField[],
  nonce: string,
  parentOrigin: string,
) {
  const config = JSON.stringify({ fields, nonce, parentOrigin }).replace(
    /</g,
    "\\u003c",
  );
  return (
    `const kaizenSelection = ${config};\n` +
    String.raw`
(() => {
  const {fields, nonce, parentOrigin} = kaizenSelection;
  const send = (type, ids = []) => window.opener?.postMessage({type, nonce, ids}, parentOrigin);
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const host = document.createElement('div');
  host.setAttribute('data-kaizen-source-toolbar', '');
  host.style.cssText = 'all:initial;font:14px system-ui;position:fixed;bottom:16px;left:16px;right:16px;z-index:2147483647';
  const shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = '<style>:host{font:14px system-ui}div{background:#11272c;color:white;padding:14px;border:2px solid #4fe3bd;border-radius:10px;box-shadow:0 4px 24px #0008}button{font:inherit;background:#4fe3bd;color:#10252a;padding:8px;border:0;border-radius:5px;margin-right:10px;cursor:pointer}p{margin:8px 0 0}</style><div><button type="button" aria-pressed="true">Selection on</button><span>Click page content to find its source fields.</span><p>This is the last built page. Apply source edits and rebuild to see changes. Selection off restores page interactions.</p></div>';
  document.body.append(host);
  const toggle = shadow.querySelector('button'), status = shadow.querySelector('span');
  const outline = document.createElement('div');
  outline.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #00b894;z-index:2147483646;display:none;box-sizing:border-box';
  document.body.append(outline);
  let enabled = true;
  toggle.addEventListener('click', () => {
    enabled = !enabled;
    toggle.textContent = enabled ? 'Selection on' : 'Selection off';
    toggle.setAttribute('aria-pressed', String(enabled));
    outline.style.display = 'none';
  });
  function candidates(target) {
    const texts = new Set(), links = new Set(), images = new Set();
    let element = target;
    for (let depth = 0; element && element !== document.body && depth < 4; depth++, element = element.parentElement) {
      if (['SCRIPT','STYLE','NOSCRIPT'].includes(element.tagName)) break;
      const text = normalize(element.textContent);
      if (text.length <= 20000) texts.add(text);
      for (const node of element.childNodes) if (node.nodeType === Node.TEXT_NODE) texts.add(normalize(node.textContent));
      for (const attr of ['alt','title','placeholder','aria-label']) if (element.hasAttribute(attr)) texts.add(normalize(element.getAttribute(attr)));
      if (element.hasAttribute('href')) links.add(element.getAttribute('href'));
      for (const attr of ['src','poster']) if (element.hasAttribute(attr)) images.add(element.getAttribute(attr));
    }
    return fields.filter(field => normalize(field.value) && (field.kind === 'link' ? links.has(field.value) : field.kind === 'image' ? images.has(field.value) : texts.has(normalize(field.value)))).map(field => field.id);
  }
  document.addEventListener('pointermove', event => {
    if (!enabled || !(event.target instanceof Element) || event.composedPath().includes(host)) { outline.style.display = 'none'; return; }
    const ids = candidates(event.target);
    if (!ids.length) { outline.style.display = 'none'; return; }
    const rect = event.target.getBoundingClientRect();
    Object.assign(outline.style, {display:'block',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
  }, true);
  document.addEventListener('click', event => {
    if (!enabled || !(event.target instanceof Element) || event.composedPath().includes(host)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const ids = candidates(event.target);
    status.textContent = ids.length ? ids.length + ' matching source field(s). Choose the intended field in the editor.' : 'No literal source field matched. This content may be computed, transformed or supplied by a CMS.';
    send('kaizen-source-select', ids);
  }, true);
  send('kaizen-source-ready');
})();
`
  );
}
