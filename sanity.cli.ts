import "dotenv/config";
import { defineCliConfig } from "sanity/cli";

const projectId =
  process.env.SANITY_PROJECT_ID ??
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  process.env.PUBLIC_SANITY_PROJECT_ID ??
  "";

const dataset =
  process.env.SANITY_DATASET ??
  process.env.NEXT_PUBLIC_SANITY_DATASET ??
  process.env.PUBLIC_SANITY_DATASET ??
  "production";

if (!projectId) {
  throw new Error(
    "Missing Sanity projectId. Set SANITY_PROJECT_ID (or NEXT_PUBLIC_SANITY_PROJECT_ID) in your .env file.",
  );
}

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
  deployment: {
    appId: "ehitndlu7r8vr9d7c6eraoq5",
    autoUpdates: true,
  },
});
