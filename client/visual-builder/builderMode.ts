/** Explicit fallback on the loopback helper, never on the hosted production app. */
const loopback =
  import.meta.env.DEV &&
  typeof location !== "undefined" &&
  ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
function requested() {
  if (!loopback) return false;
  const query = new URLSearchParams(location.search).get("local");
  try {
    if (query === "1") sessionStorage.setItem("kaizen-local-builder", "1");
    if (query === "0") sessionStorage.removeItem("kaizen-local-builder");
    return sessionStorage.getItem("kaizen-local-builder") === "1";
  } catch {
    return query === "1";
  }
}
export const localBuilderRequested = requested();
export const builderCloudEnabled =
  import.meta.env.VITE_BUILDER_CLOUD === "1" && !localBuilderRequested;
