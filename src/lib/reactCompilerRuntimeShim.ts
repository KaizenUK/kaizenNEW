import * as React from "react";

type UseMemoCacheDispatcher = {
  useMemoCache: (size: number) => unknown[];
};

type ReactClientInternals = {
  H: UseMemoCacheDispatcher | null;
};

type ReactWithClientInternals = typeof React & {
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: ReactClientInternals;
};

const INVALID_HOOK_CALL_MESSAGE =
  "Invalid hook call. Hooks can only be called inside of the body of a function component. " +
  "See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.";

/**
 * ESM shim for `react/compiler-runtime`.
 *
 * Some dependencies (Sanity Studio internals) import `{ c }` from
 * `react/compiler-runtime`, but the published React runtime entry is CJS.
 * This shim provides the same `c(size)` contract without relying on CJS
 * named-export interop in the browser.
 */
export function c(size: number): unknown[] {
  const dispatcher =
    (React as ReactWithClientInternals)
      .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?.H ??
    null;

  if (!dispatcher) {
    throw new Error(INVALID_HOOK_CALL_MESSAGE);
  }

  return dispatcher.useMemoCache(size);
}

export default { c };
