import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { createInvitationHandler } from "../_shared/builderInvitations.ts";
import {
  getCorsHeaders,
  getPublicSiteOrigin,
  isOriginAllowed,
} from "../_shared/editorAuth.ts";

const service = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
Deno.serve(
  createInvitationHandler({
    service,
    redirectOrigin:
      Deno.env.get("BUILDER_INVITE_REDIRECT_ORIGIN") || getPublicSiteOrigin(),
    headers: getCorsHeaders,
    originAllowed: isOriginAllowed,
  }),
);
