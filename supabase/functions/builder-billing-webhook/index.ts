import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { createBillingWebhookHandler } from "../_shared/builderBilling.ts";
const service = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
Deno.serve(
  createBillingWebhookHandler({ service, env: (key) => Deno.env.get(key) }),
);
