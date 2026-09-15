import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { createBillingHandler } from "../_shared/builderBilling.ts";
import { getCorsHeaders, isOriginAllowed } from "../_shared/editorAuth.ts";
const service = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
Deno.serve(
  createBillingHandler({
    service,
    env: (key) => Deno.env.get(key),
    headers: getCorsHeaders,
    originAllowed: isOriginAllowed,
  }),
);
