import {
  classifyDiagnosticError,
  type DiagnosticError,
  type DiagnosticSource,
} from "../../shared/builderDiagnostics";

let lastError: DiagnosticError | null = null;
let page: { screen: string; id?: string; route?: string } = { screen: "pages" };
let errorPage: typeof page | undefined;
const listeners = new Set<(error: DiagnosticError) => void>();
export const lastDiagnosticError = () => lastError;
export const diagnosticPage = () => errorPage || page;
export function setDiagnosticPage(value: typeof page) {
  if (value.screen !== "settings") page = value;
}
export function clearDiagnostics() {
  lastError = null;
  errorPage = undefined;
  page = { screen: "pages" };
}
export function recordBuilderError(
  error: unknown,
  source: DiagnosticSource = "browser",
) {
  lastError = classifyDiagnosticError(error, source);
  errorPage = { ...page };
  for (const listener of listeners) {
    try {
      listener(lastError);
    } catch {
      /* Reporting must never break editing. */
    }
  }
}
export function subscribeDiagnosticErrors(
  listener: (error: DiagnosticError) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function watchBrowserErrors() {
  const error = (event: ErrorEvent) =>
    recordBuilderError(event.error || event.message);
  const rejection = (event: PromiseRejectionEvent) =>
    recordBuilderError(event.reason);
  window.addEventListener("error", error);
  window.addEventListener("unhandledrejection", rejection);
  return () => {
    window.removeEventListener("error", error);
    window.removeEventListener("unhandledrejection", rejection);
  };
}
export function trackStorageErrors<
  T extends Record<string, (...args: any[]) => Promise<any>>,
>(methods: T): T {
  return Object.fromEntries(
    Object.entries(methods).map(([name, method]) => [
      name,
      async (...args: any[]) => {
        try {
          return await method.apply(methods, args);
        } catch (error) {
          recordBuilderError(
            error,
            name === "repository" ? "helper" : "workspace",
          );
          throw error;
        }
      },
    ]),
  ) as T;
}
