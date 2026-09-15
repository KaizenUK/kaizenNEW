/** Disposable child for client retirement recovery tests. It begins removal
 * with its real process identity, then is killed while holding the store lock. */
import { readFile } from "node:fs/promises";
import {
  clientRetirementWorker,
  maintainClientReleases,
} from "../../scripts/builder-client-release-maintenance";
import {
  retirementAdapters,
  retirementDatabase,
} from "../../client/visual-builder/releaseRetirementFixture";

const config = JSON.parse(await readFile(process.argv[2], "utf8"));
const connection = retirementDatabase(config.databaseFile, config.now, {
  [config.scope]: config.destination.store,
});
await maintainClientReleases(
  {
    environment: config.environment,
    destination: config.destination,
    workerId: config.workerId,
    connection,
    clientWorker: await clientRetirementWorker({
      workerId: config.workerId,
      destination: config.destination,
    }),
  },
  {
    ...retirementAdapters,
    now: () => config.now,
    afterRemove: async (relative: string) => {
      if (relative === config.killAfter) process.kill(process.pid, "SIGKILL");
    },
  },
);
throw new Error("The retirement child was expected to be killed.");
