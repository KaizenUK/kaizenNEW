import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { BuilderProject } from "../../shared/builderProjects";
import type { ClientPublicationJob } from "../../shared/builderClientPublication";
import type { PageDocument, Workspace } from "../../shared/visualBuilder";
import { repositoryConnection } from "./repositoryConnection";
import { storage } from "./storage";
import {
  firstRunEligible,
  firstRunKey,
  firstRunSteps,
  newProjectWorkspace,
  previewDigest,
  readFirstRun,
  type FirstRunProgress,
} from "./firstRun";

export function useFirstRun({
  account,
  projectId,
  project,
  workspace,
  visible,
}: {
  account?: string;
  projectId: string;
  project?: BuilderProject;
  workspace?: Workspace;
  visible: boolean;
}) {
  useSyncExternalStore(
    repositoryConnection.subscribe,
    repositoryConnection.snapshot,
    repositoryConnection.snapshot,
  );
  const eligible = firstRunEligible(
    project,
    Boolean(repositoryConnection.preferredRoot()),
  );
  const key = account ? firstRunKey(account, projectId) : undefined;
  const currentKey = useRef(key);
  const epoch = useRef(0);
  const previewSequence = useRef(0);
  if (currentKey.current !== key) epoch.current++;
  currentKey.current = key;
  const [stored, setStored] = useState<{
    key: string;
    progress?: FirstRunProgress;
  }>();
  const progress = stored && stored.key === key ? stored.progress : undefined;
  const [notice, setNotice] = useState("");
  const [publication, setPublication] = useState<{
    key: string;
    jobs: ClientPublicationJob[];
    error: string;
  }>();
  const [preview, setPreview] = useState<{ key: string; digest: string }>();
  const memory = useRef(stored);
  memory.current = stored;

  const persist = useCallback((scope: string, next: FirstRunProgress) => {
    if (scope !== currentKey.current) return;
    const value = { key: scope, progress: next };
    memory.current = value;
    setStored(value);
    try {
      localStorage.setItem(scope, JSON.stringify(next));
      setNotice("");
    } catch {
      setNotice(
        "This browser could not remember your checklist. It will last for this visit only.",
      );
    }
  }, []);

  useEffect(() => {
    setNotice("");
    setPublication(undefined);
    setPreview(undefined);
    if (!key) {
      setStored(undefined);
      return;
    }
    try {
      setStored({ key, progress: readFirstRun(localStorage.getItem(key)) });
    } catch {
      setStored({ key });
      setNotice(
        "This browser could not remember your checklist. It will last for this visit only.",
      );
    }
    const changed = (event: StorageEvent) => {
      if (event.key === key || event.key === null)
        setStored({ key, progress: readFirstRun(event.newValue) });
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [key]);

  useEffect(() => {
    if (
      key &&
      stored?.key === key &&
      !progress &&
      eligible &&
      workspace &&
      newProjectWorkspace(workspace)
    )
      persist(key, { schemaVersion: 1, enrolled: true, dismissed: false });
  }, [key, stored?.key, progress, eligible, workspace, persist]);

  const previewPage = workspace?.pages.find(
    (page) => page.id === progress?.preview?.pageId,
  );
  useEffect(() => {
    let live = true;
    setPreview(undefined);
    if (key && workspace && previewPage)
      void previewDigest(previewPage.draft, workspace)
        .then((digest) => {
          if (live && currentKey.current === key) setPreview({ key, digest });
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, workspace, previewPage]);

  useEffect(() => {
    let live = true;
    let sequence = 0;
    if (
      !key ||
      !eligible ||
      !progress ||
      progress.dismissed ||
      !visible ||
      !workspace?.pages.length
    )
      return;
    const refresh = async () => {
      const request = ++sequence;
      try {
        const data = await storage.clientPublication({
          action: "client-release-list",
          before: null,
        });
        if (live && request === sequence && currentKey.current === key)
          setPublication({
            key,
            jobs: [...(data.currentJobs || []), ...data.jobs],
            error: "",
          });
      } catch {
        if (live && request === sequence && currentKey.current === key)
          setPublication({
            key,
            jobs: [],
            error:
              "Publication progress could not be checked. Open Releases to try again.",
          });
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      window.removeEventListener("focus", refresh);
    };
  }, [
    key,
    eligible,
    Boolean(progress),
    progress?.dismissed,
    visible,
    workspace,
  ]);

  const recordPreview = useCallback(
    async (pageId: string, document: PageDocument, source: Workspace) => {
      const scope = key;
      if (!scope || !eligible || !memory.current?.progress) return;
      const generation = epoch.current;
      const sequence = ++previewSequence.current;
      try {
        const digest = await previewDigest(document, source);
        if (
          scope !== currentKey.current ||
          generation !== epoch.current ||
          sequence !== previewSequence.current ||
          memory.current?.key !== scope ||
          !memory.current.progress
        )
          return;
        persist(scope, {
          ...memory.current.progress,
          preview: { pageId, digest },
        });
      } catch {
        if (
          scope === currentKey.current &&
          generation === epoch.current &&
          sequence === previewSequence.current
        )
          setNotice(
            "Your preview opened, but this browser could not remember that step.",
          );
      }
    },
    [key, eligible, persist],
  );

  const matches = Boolean(
    key && preview?.key === key && preview.digest === progress?.preview?.digest,
  );
  return {
    available: Boolean(eligible && progress && workspace),
    dismissed: progress?.dismissed || false,
    notice: key && stored?.key === key ? notice : "",
    publicationError:
      publication && publication.key === key ? publication.error : "",
    steps:
      project && workspace
        ? firstRunSteps(
            project,
            workspace,
            matches,
            publication && publication.key === key ? publication.jobs : [],
          )
        : [],
    previewPage: previewPage || workspace?.pages[0],
    recordPreview,
    dismiss: (dismissed: boolean) => {
      if (key && progress) persist(key, { ...progress, dismissed });
    },
  };
}
