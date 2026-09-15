import { useEffect, useRef, useState } from "react";
import type { BuildJob, BuildPlan } from "../../scripts/builder-runner";
import type { SourceInspection } from "../../shared/builderSourceEditing";
import { activeProjectId } from "./projectStorage";
import { storage } from "./storage";
import { repositoryConnection } from "./repositoryConnection";
import { recordBuilderError } from "./diagnostics";

export type SourceFrame = {
  url: string;
  nonce: string;
  files: SourceInspection["files"];
};

export function useSiteBuild(inspection?: SourceInspection) {
  const [plan, setPlan] = useState<BuildPlan>();
  const [job, setJob] = useState<BuildJob>();
  const [frame, setFrame] = useState<SourceFrame>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const retryRequested = useRef(false);
  const key = `kaizen-build:${activeProjectId}:${inspection?.root}`;
  const consentKey = (value: BuildPlan) =>
    `kaizen-build-consent:${activeProjectId}:${value.root}:${value.sessionId}:${repositoryConnection.buildConsentScope()}`;
  const signature = (value: BuildPlan) =>
    JSON.stringify([value.command, value.scripts]);
  const fresh = (id: number) => generation.current === id;
  async function openFrame(value: BuildJob, id: number) {
    const next: SourceFrame = await storage.repository({
      action: "repository-source-frame",
      jobId: value.id,
      root: inspection!.root,
      route: inspection!.route,
    });
    if (JSON.stringify(next.files) !== JSON.stringify(inspection!.files))
      throw new Error(
        "The website files changed. Reopen this page to recover your edits.",
      );
    repositoryConnection.validateFrame(next.url, next.nonce);
    if (fresh(id)) {
      setFrame(next);
      setError("");
    }
  }
  async function follow(value: BuildJob, id: number) {
    while (fresh(id)) {
      setJob(value);
      if (value.status !== "building" && value.status !== "queued") {
        if (value.status === "cancelled") return;
        if (value.status === "failed")
          recordBuilderError("The website build failed.", "helper");
        if (value.status !== "succeeded")
          throw new Error(
            value.error ||
              "The preview build failed. Your edits are kept in the outline.",
          );
        if (!value.previewUrl)
          throw new Error(
            "The build finished, but its preview is unavailable. Check the helper connection before building again.",
          );
        await openFrame(value, id);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!fresh(id)) return;
      value = await storage.repository({
        action: "repository-build-status",
        jobId: value.id,
      });
    }
  }
  async function start(value: BuildPlan, id: number) {
    const next: BuildJob = await storage.repository({
      action: "repository-build-start",
      planId: value.id,
    });
    sessionStorage.setItem(key, next.id);
    if (fresh(id)) setPlan(undefined);
    await follow(next, id);
  }
  useEffect(() => {
    const id = ++generation.current;
    if (!inspection) return;
    const retry = retryRequested.current;
    retryRequested.current = false;
    setBusy(true);
    setError("");
    setPlan(undefined);
    setJob(undefined);
    setCancelling(false);
    void (async () => {
      const previous = sessionStorage.getItem(key);
      if (previous) {
        let value: BuildJob | undefined;
        try {
          value = await storage.repository({
            action: "repository-build-status",
            jobId: previous,
          });
        } catch {
          /* An unknown job needs a new reviewed build. Never retry a known failed or cancelled job on reopen. */
        }
        if (!fresh(id)) return;
        if (value) {
          if (
            value.status === "building" ||
            value.status === "queued" ||
            (!retry && ["failed", "cancelled"].includes(value.status))
          ) {
            await follow(value, id);
            return;
          }
          if (value.previewUrl) {
            try {
              await openFrame(value, id);
              if (fresh(id)) setJob(value);
              return;
            } catch {
              /* An expired snapshot or changed source needs a fresh command review. */
            }
          }
        }
      }
      if (!fresh(id)) return;
      const reviewed: BuildPlan = await storage.repository({
        action: "repository-build-review",
        root: inspection.root,
      });
      if (!fresh(id)) return;
      setPlan(reviewed);
      if (sessionStorage.getItem(consentKey(reviewed)) === signature(reviewed))
        await start(reviewed, id);
    })()
      .catch((e) => {
        if (fresh(id)) setError(e.message);
      })
      .finally(() => {
        if (fresh(id)) setBusy(false);
      });
    return () => {
      generation.current++;
    };
  }, [inspection, attempt]);
  return {
    plan,
    job,
    frame,
    busy,
    cancelling: cancelling || Boolean(job?.cancelling),
    error,
    retry: () => {
      retryRequested.current = true;
      setAttempt((n) => n + 1);
    },
    cancel: async () => {
      if (
        !job ||
        cancelling ||
        job.cancelling ||
        !["queued", "building"].includes(job.status)
      )
        return;
      const id = generation.current;
      setCancelling(true);
      try {
        // The existing poll remains authoritative until process shutdown and recovery finish.
        await storage.repository({
          action: "repository-build-stop",
          jobId: job.id,
        });
      } catch (e) {
        if (fresh(id)) setError(e.message);
      } finally {
        if (fresh(id)) setCancelling(false);
      }
    },
    build: async () => {
      if (!plan || busy) return;
      const id = generation.current;
      setBusy(true);
      setError("");
      try {
        sessionStorage.setItem(consentKey(plan), signature(plan));
        await start(plan, id);
      } catch (e) {
        if (fresh(id)) setError(e.message);
      } finally {
        if (fresh(id)) setBusy(false);
      }
    },
  };
}
