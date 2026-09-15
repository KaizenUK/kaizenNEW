import { expect, it } from "vitest";
import {
  clientDeploymentMessage,
  clientSaveError,
  clientSaveMessage,
} from "./repositorySaveCopy";
import { ACCOUNT_SETUP_MESSAGE } from "../../shared/builderAccount";
import type { RepositorySaveStatus } from "../../shared/builderRepositorySave";

it("distinguishes an unconfirmed send, saved change and staging outcome without rendering technical messages", () => {
  const value: RepositorySaveStatus = {
    planId: "p",
    projectId: "p",
    phase: "committed",
    branch: "private-branch",
    files: ["src/private.tsx"],
    commit: "abcdef123456",
    destinationUrl: "https://stage.example",
    message: "Commit abcdef123456 on private-branch",
  };
  expect(clientSaveMessage(value)).toContain("has not been confirmed");
  expect(clientSaveMessage({ ...value, phase: "saved" })).toContain(
    "Check staging",
  );
  expect(clientSaveMessage({ ...value, phase: "recovery_required" })).toContain(
    "has not been repeated",
  );
  expect(clientDeploymentMessage("succeeded", "reported")).toContain(
    "Open staging to check",
  );
  expect(clientDeploymentMessage("failed")).toContain("could not be updated");
  expect(clientDeploymentMessage("unavailable")).toContain(
    "could not be checked",
  );
  for (const phase of [
    "applied",
    "committed",
    "saved",
    "recovery_required",
  ] as const)
    expect(clientSaveMessage({ ...value, phase })).not.toMatch(
      /branch|commit|src\/|abcdef/,
    );
});

it("keeps account setup actionable and maps technical failures without echoing diagnostics", () => {
  expect(clientSaveError(ACCOUNT_SETUP_MESSAGE)).toBe(ACCOUNT_SETUP_MESSAGE);
  expect(
    clientSaveError("Files are already staged: src/private.tsx"),
  ).toContain("Other changes");
  expect(clientSaveError("The remote branch moved: private-branch")).toContain(
    "website changed",
  );
  expect(clientSaveError("The push was rejected: private-branch")).toContain(
    "could not be confirmed",
  );
  expect(
    clientSaveError("The commit did not finish: src/private.tsx"),
  ).toContain("owner's attention");
  expect(
    clientSaveError(
      "Unexpected src/private.tsx on private-branch abcdef123456",
    ),
  ).not.toMatch(/private|abcdef/);
});
