import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { cloud, localMode } from "./storage";
import { activeProjectId } from "./projectStorage";
import { Card, Notice } from "./shell";

export type BuilderViewMode = "client" | "developer";
type ViewState = {
  mode: BuilderViewMode;
  canChoose: boolean;
  loading: boolean;
  error: string;
  preferenceNotice: string;
  choose: (mode: BuilderViewMode) => void;
};
const ViewContext = createContext<ViewState>({
  mode: "client",
  canChoose: false,
  loading: true,
  error: "",
  preferenceNotice: "",
  choose() {},
});
export const useBuilderViewMode = () => useContext(ViewContext);
export const viewPreferenceKey = (account: string, project: string) =>
  `kaizen-builder-view:${account}:${project}`;

/** A display preference never grants edit, owner or publish permission. */
export function resolveViewMode(
  role: unknown,
  preference: unknown,
  local = false,
): BuilderViewMode {
  return local || role === "owner"
    ? preference === "client"
      ? "client"
      : "developer"
    : "client";
}
function readPreference(key: string): BuilderViewMode | undefined {
  try {
    const value = localStorage.getItem(key);
    return value === "client" || value === "developer" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function BuilderViewProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [identity, setIdentity] = useState<{ session: Session | null }>();
  const [access, setAccess] = useState<{
    identity: typeof identity;
    role?: string;
    error: string;
  }>();
  const [refresh, setRefresh] = useState(0);
  const epoch = useRef(0);
  const [preference, setPreference] = useState<{
    key: string;
    mode?: BuilderViewMode;
    notice: string;
  }>();
  const key = viewPreferenceKey(
    localMode ? "local" : identity?.session?.user.id || "signed-out",
    activeProjectId,
  );

  useEffect(() => {
    if (localMode || !cloud) return;
    let live = true;
    let authSequence = 0;
    const change = (session: Session | null) => {
      authSequence++;
      epoch.current++;
      setAccess(undefined);
      setIdentity({ session });
    };
    // Subscribe first: a late initial read must not restore the previous account.
    const { data } = cloud.auth.onAuthStateChange((_event, session) => {
      if (live) change(session);
    });
    const initial = authSequence;
    void cloud.auth
      .getSession()
      .then((result) => {
        if (live && authSequence === initial)
          change(result.error ? null : result.data.session);
      })
      .catch(() => {
        if (live && authSequence === initial) change(null);
      });
    return () => {
      live = false;
      epoch.current++;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const reload = () => {
      epoch.current++;
      setAccess(undefined);
      setRefresh((value) => value + 1);
    };
    window.addEventListener("builder-projects-changed", reload);
    window.addEventListener("focus", reload);
    return () => {
      window.removeEventListener("builder-projects-changed", reload);
      window.removeEventListener("focus", reload);
    };
  }, []);

  useEffect(() => {
    if (localMode || !cloud || !identity?.session) return;
    let live = true;
    const current = epoch.current;
    // Do not use the unscoped project cache for a role: bind this read to the
    // captured account, and discard it after sign-out, account change or refresh.
    void cloud.functions
      .invoke("builder-projects", {
        body: { action: "list" },
        headers: { Authorization: `Bearer ${identity.session.access_token}` },
      })
      .then(({ data, error }) => {
        if (!live || current !== epoch.current) return;
        if (error || !Array.isArray(data))
          throw new Error("Project access unavailable");
        const project = data.find(
          (item) => item?.id === activeProjectId && !item.archived,
        );
        setAccess({
          identity,
          role: project?.access?.role,
          error: project ? "" : "Your project access could not be confirmed.",
        });
      })
      .catch(() => {
        if (live && current === epoch.current)
          setAccess({
            identity,
            error:
              "Your project access could not be checked. Reload to try again.",
          });
      });
    return () => {
      live = false;
    };
  }, [identity, refresh]);

  useEffect(() => {
    const read = () =>
      setPreference({ key, mode: readPreference(key), notice: "" });
    read();
    const changed = (event: StorageEvent) => {
      if (event.key === key || event.key === null) read();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [key]);

  const currentAccess = access?.identity === identity ? access : undefined;
  const canChoose = localMode || currentAccess?.role === "owner";
  const remembered = preference?.key === key ? preference : undefined;
  const mode = resolveViewMode(
    currentAccess?.role,
    remembered?.mode,
    localMode,
  );
  const choose = (mode: BuilderViewMode) => {
    if (!canChoose || (mode !== "client" && mode !== "developer")) return;
    let notice = "";
    try {
      localStorage.setItem(key, mode);
    } catch {
      notice =
        "Your view has changed for this visit. This browser could not remember it.";
    }
    setPreference({ key, mode, notice });
  };
  return (
    <ViewContext.Provider
      value={{
        mode,
        canChoose,
        choose,
        loading:
          !localMode &&
          Boolean(cloud) &&
          (!identity || Boolean(identity.session && !currentAccess)),
        error: currentAccess?.error || "",
        preferenceNotice: remembered?.notice || "",
      }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export function BuilderViewSettings() {
  const { mode, canChoose, loading, error, preferenceNotice, choose } =
    useBuilderViewMode();
  return (
    <Card title="Your view" ariaLabel="Your view">
      {loading ? (
        <p role="status">Checking your project access…</p>
      ) : (
        <>
          <p>{mode === "developer" ? "Developer view" : "Client view"}</p>
          {canChoose ? (
            <>
              <label className="builder-checkbox">
                <input
                  type="checkbox"
                  checked={mode === "developer"}
                  onChange={(event) =>
                    choose(event.target.checked ? "developer" : "client")
                  }
                />
                Show developer details
              </label>
              <p>
                Turn this off for a simpler view of your pages and preview. Your
                permission to publish stays the same.
              </p>
              <small>
                Remembered for this account and website in this browser.
              </small>
            </>
          ) : (
            <p>
              Your pages and preview use the client view. Publishing follows
              your project permissions.
            </p>
          )}
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {preferenceNotice && <Notice>{preferenceNotice}</Notice>}
    </Card>
  );
}
