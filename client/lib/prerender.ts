export const isReactSnapPrerender = (): boolean => {
  if (typeof navigator === "undefined") return false;
  if (navigator.userAgent.includes("ReactSnap")) return true;

  if (typeof window !== "undefined") {
    const win = window as Window & { __PRERENDER_INJECTED?: boolean };
    if (win.__PRERENDER_INJECTED) return true;
  }

  return false;
};
