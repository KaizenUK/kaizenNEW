import { useEffect, useRef, useState } from "react";
import type { BuildJob, BuildPlan } from "../../scripts/builder-runner";
import type { SourceInspection } from "../../shared/builderSourceEditing";
import { activeProjectId } from "./projectStorage";
import { storage } from "./storage";
import { companionConnection } from "./companionConnection";
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
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const key = `kaizen-build:${activeProjectId}:${inspection?.root}`;
  const consentKey = (value: BuildPlan) =>
    `kaizen-build-consent:${activeProjectId}:${value.root}:${value.sessionId}:${companionConnection.snapshot().expiresAt || "local"}`;
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
    const url = new URL(next.url);
    if (
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      !/^[a-f0-9]{64}$/.test(next.nonce)
    )
      throw new Error("The helper returned an invalid preview address.");
    if (fresh(id)) {
      setFrame(next);
      setError("");
    }
  }
  async function follow(value: BuildJob, id: number) {
    while (fresh(id)) {
      setJob(value);
      if (value.status !== "building") {
        if (value.status === "failed")
          recordBuilderError("The website build failed.", "helper");
        if (value.status !== "succeeded")
          throw new Error(
            value.error ||
              "The preview build failed. Your edits are kept in the outline.",
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
    setBusy(true);
    setError("");
    setPlan(undefined);
    void (async () => {
      const previous = sessionStorage.getItem(key);
      if (previous) {
        try {
          const value: BuildJob = await storage.repository({
            action: "repository-build-status",
            jobId: previous,
          });
          if (value.status === "building") {
            await follow(value, id);
            return;
          }
          if (value.previewUrl) {
            await openFrame(value, id);
            setJob(value);
            return;
          }
        } catch {
          /* A stale or expired snapshot needs a new reviewed build. */
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
    error,
    retry: () => setAttempt((n) => n + 1),
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
