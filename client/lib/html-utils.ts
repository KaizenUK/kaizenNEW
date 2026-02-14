/**
 * Decode HTML entities in text
 * Handles: &#8217; &amp; &quot; &lt; &gt; etc.
 */
export function decodeHtmlEntities(html: string): string {
  if (!html) return "";

  // Create a temporary DOM element to decode entities
  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  const decoded = textarea.value;

  return decoded;
}

/**
 * Strip HTML tags from text
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Decode HTML entities and strip tags
 */
export function decodeAndStrip(html: string): string {
  if (!html) return "";
  return decodeHtmlEntities(stripHtmlTags(html));
}
