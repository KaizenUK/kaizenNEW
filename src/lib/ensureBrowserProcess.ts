const globalScope =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
      ? window
      : undefined;

if (globalScope && typeof (globalScope as { process?: unknown }).process === "undefined") {
  const processShim = {
    env: {},
    argv: [],
    browser: true,
    pid: 1,
    version: "",
    versions: {},
    cwd: () => "/",
    nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => {
      queueMicrotask(() => callback(...args));
    },
    on: () => undefined,
    off: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    emit: () => false,
  };

  Object.defineProperty(globalScope, "process", {
    value: processShim,
    configurable: true,
    enumerable: false,
    writable: true,
  });
}
