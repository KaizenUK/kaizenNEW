import { builderCloudEnabled } from "./builderMode";
// The choice is fixed for this project tab. Changing helpers opens another document
// so pending drafts, reviewed plans and builds cannot be redirected to a different folder.
export const repositoryMode = !builderCloudEnabled
  ? "local"
  : typeof location !== "undefined" &&
      new URLSearchParams(location.search).get("helper") === "local"
    ? "companion"
    : "hosted";
