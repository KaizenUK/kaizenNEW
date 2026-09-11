import { expect, it } from "vitest";
import {
  clientHistoryPage,
  type ClientPublicationJob,
} from "../../shared/builderClientPublication";

it("pages local history stably with tied timestamps, concurrent new releases and a current job outside the page", () => {
  const jobs = Array.from(
    { length: 125 },
    (_, index) =>
      ({
        id: `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
        createdAt: "2026-01-01T00:00:00.000Z",
        phase: "failed",
        active: index === 0,
      }) as ClientPublicationJob,
  );
  jobs[1].phase = "recovery_required";
  const first = clientHistoryPage(jobs);
  expect(first.jobs).toHaveLength(50);
  expect(first.currentJobs.map((job) => job.id)).toEqual([
    jobs[1].id,
    jobs[0].id,
  ]);
  const newer = {
    ...jobs[2],
    id: crypto.randomUUID(),
    createdAt: "2027-01-01T00:00:00.000Z",
  };
  const second = clientHistoryPage([newer, ...jobs], first.nextCursor);
  const third = clientHistoryPage([newer, ...jobs], second.nextCursor);
  const ids = [...first.jobs, ...second.jobs, ...third.jobs].map(
    (job) => job.id,
  );
  expect(ids).toHaveLength(125);
  expect(new Set(ids).size).toBe(125);
  expect(third.nextCursor).toBeNull();
  expect(() => clientHistoryPage(jobs, crypto.randomUUID())).toThrow(
    "Invalid release history cursor",
  );
  expect(() => clientHistoryPage(jobs, "not-a-cursor")).toThrow(
    "Invalid release history cursor",
  );
});
