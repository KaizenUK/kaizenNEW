import { builderCloudEnabled } from "./builderMode";
// Public routing configuration only. No API key is shipped in published forms.
import { activeProjectId } from "./projectStorage";
const configured = import.meta.env.VITE_BUILDER_FORM_ENDPOINT;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const builderFormEndpoint =
  activeProjectId !== "kaizen"
    ? ""
    : configured ||
      (import.meta.env.DEV && !builderCloudEnabled
        ? "/__builder-contact"
        : supabaseUrl
          ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/builder-contact`
          : "");
