import React from "react";
import { createRoot } from "react-dom/client";
import Panel from "../../client/visual-builder/ReleasesPanel";
import { storage } from "../../client/visual-builder/storage";
import type { ReleaseStatus } from "../../shared/builderReleases";
import type { BuilderPage } from "../../shared/visualBuilder";

/** Browser-only controlled service boundary for the shipped release UI. No real publication calls. */
export function mountReleasePanel(rows: ReleaseStatus[], draft: BuilderPage) {
  const state = { rows, calls: [] as unknown[], error: false };
  (window as any).__releaseTest = state;
  storage.releases = async () => {
    if (state.error) throw new Error("Release service temporarily unavailable");
    return structuredClone(state.rows);
  };
  storage.load = async () => ({ pages: [draft], assets: [], saved: [] });
  storage.releaseAction = async (body) => {
    state.calls.push(body);
    return {
      release: state.rows[0],
      message: "Release request saved; deployment queued.",
    };
  };
  const root = document.createElement("div");
  root.className = "builder-app builder-dashboard";
  document.body.replaceChildren(root);
  createRoot(root).render(
    <main>
      <Panel
        workspace={{ pages: [draft], assets: [], saved: [] }}
        onClose={() => undefined}
      />
    </main>,
  );
}

/** Controlled release metadata rendered by the real client panel. */
export async function mountClientReleaseStatuses(
  jobs: import("../../shared/builderClientPublication").ClientPublicationJob[],
  suspension: {
    state: "suspended" | "taken_down";
    since: string;
  } | null = null,
) {
  const { default: ClientPublications } =
    await import("../../client/visual-builder/ClientPublications");
  storage.clientPublication = async () => ({
    jobs: structuredClone(jobs),
    destinations: jobs
      .filter((job) => job.active)
      .map((job) => job.destination),
    nextCursor: null,
    suspension,
  });
  const root = document.createElement("div");
  root.className = "builder-app builder-dashboard";
  document.body.replaceChildren(root);
  createRoot(root).render(
    <main>
      <ClientPublications onChanged={() => undefined} />
    </main>,
  );
}

export async function mountStatusPages(pages: BuilderPage[]) {
  const { default: PagesView } =
    await import("../../client/visual-builder/PagesView");
  const root = document.createElement("div");
  root.className = "builder-app builder-dashboard";
  document.body.replaceChildren(root);
  createRoot(root).render(
    <main>
      <PagesView
        onUseTemplate={async () => {}}
        onCreateStarter={async () => {}}
        workspace={{ pages, assets: [], saved: [] }}
        localMode={false}
        loading={false}
        error=""
        creating={false}
        onCreate={() => undefined}
        onOpen={() => undefined}
        onRetry={() => undefined}
      />
    </main>,
  );
}
