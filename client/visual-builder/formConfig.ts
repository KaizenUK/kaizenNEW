// Public routing configuration only. No API key is shipped in published forms.
const configured = import.meta.env.VITE_BUILDER_FORM_ENDPOINT;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const builderFormEndpoint =
  configured ||
  (import.meta.env.DEV && import.meta.env.VITE_BUILDER_CLOUD !== "1"
    ? "/__builder-contact"
    : supabaseUrl
      ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/builder-contact`
      : "");
