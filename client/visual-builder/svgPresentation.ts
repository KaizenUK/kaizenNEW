// Illustrator commonly stores fill/stroke in .st0/.st1 rules. Copy only static
// presentation values to SVG attributes before the sanitiser removes styles.
const paint =
  /^(?:[a-z]+|#[a-f\d]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d.% ,+-]+\)|url\(\s*#[\w.-]+\s*\))$/i;
const number = /^-?(?:\d+\.?\d*|\.\d+)(?:px|pt|em|%)?$/;
function allowed(property: string, value: string) {
  if (
    ["fill", "stroke", "color", "stop-color", "flood-color"].includes(property)
  )
    return paint.test(value);
  if (
    [
      "opacity",
      "fill-opacity",
      "stroke-opacity",
      "stop-opacity",
      "flood-opacity",
      "stroke-width",
      "stroke-miterlimit",
      "stroke-dashoffset",
      "font-size",
    ].includes(property)
  )
    return number.test(value);
  if (property === "stroke-dasharray")
    return (
      value === "none" ||
      value.split(/[ ,]+/).every((part) => number.test(part))
    );
  const choices: Record<string, string[]> = {
    "stroke-linecap": ["butt", "round", "square"],
    "stroke-linejoin": ["miter", "round", "bevel"],
    "fill-rule": ["nonzero", "evenodd"],
    "clip-rule": ["nonzero", "evenodd"],
    display: ["none", "inline"],
    visibility: ["visible", "hidden", "collapse"],
    "text-anchor": ["start", "middle", "end"],
    "font-weight": [
      "normal",
      "bold",
      "100",
      "200",
      "300",
      "400",
      "500",
      "600",
      "700",
      "800",
      "900",
    ],
  };
  return choices[property]?.includes(value) || false;
}

export function retainSvgPresentation(doc: Document) {
  const parser = document.createElement("span").style;
  const applied = new WeakMap<Element, Map<string, number>>();
  const apply = (
    element: Element,
    declarations: string,
    specificity: number,
  ) => {
    parser.cssText = declarations;
    const ranks = applied.get(element) || new Map<string, number>();
    for (let index = 0; index < parser.length; index++) {
      const property = parser.item(index),
        value = parser.getPropertyValue(property).trim();
      const rank =
        specificity +
        (parser.getPropertyPriority(property) === "important" ? 10000 : 0);
      if (allowed(property, value) && rank >= (ranks.get(property) || 0)) {
        element.setAttribute(property, value);
        ranks.set(property, rank);
      }
    }
    applied.set(element, ranks);
  };
  for (const style of doc.querySelectorAll("style")) {
    const css = (style.textContent || "").replace(/\/\*[\s\S]*?\*\//g, "");
    // Only flat, static selector rules are supported; no @import, @media or keyframes.
    if (css.includes("@")) continue;
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const selector of rule[1].split(",").map((value) => value.trim())) {
        if (
          !/^(?:[a-z][\w-]*)?(?:[.#][a-z_][\w-]*)*$/i.test(selector) ||
          !selector
        )
          continue;
        const specificity =
          (selector.match(/#/g)?.length || 0) * 100 +
          (selector.match(/\./g)?.length || 0) * 10 +
          (/^[a-z]/i.test(selector) ? 1 : 0);
        for (const element of doc.querySelectorAll(selector))
          apply(element, rule[2], specificity);
      }
    }
  }
  for (const element of doc.querySelectorAll("*")) {
    if (element.hasAttribute("style"))
      apply(element, element.getAttribute("style")!, 1000);
    // Local paint/filter references may remain; external resources may not.
    for (const attribute of [...element.attributes]) {
      if (
        /url\s*\(/i.test(attribute.value) &&
        !/^url\(\s*#[\w.-]+\s*\)$/i.test(attribute.value)
      )
        element.removeAttribute(attribute.name);
    }
  }
}
