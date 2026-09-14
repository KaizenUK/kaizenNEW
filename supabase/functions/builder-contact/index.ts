import { checkFunctionLimit } from "../_shared/functionLimits.ts";
import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import {
  ContactError,
  handleContactRequest,
} from "../../../shared/builderContact.ts";

import {
  DEFAULT_CONTACT_ORIGINS,
  parseAllowedOrigins,
} from "../../../shared/builderOrigins.ts";

const allowedOrigins = parseAllowedOrigins(
  Deno.env.get("BUILDER_CONTACT_ORIGINS"),
  DEFAULT_CONTACT_ORIGINS,
  "BUILDER_CONTACT_ORIGINS",
);
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const service = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
// Keyed hashes avoid storing IP addresses or another copy of contact details in the retry ledger.
const hashKey = crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(serviceKey),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
async function hash(value: string) {
  const bytes = await crypto.subtle.sign(
    "HMAC",
    await hashKey,
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
Deno.serve((request) =>
  handleContactRequest(request, {
    allowedOrigins,
    beforeRead: (headers) =>
      checkFunctionLimit(service, "builder-contact", headers),
    async submit(id, record) {
      const { error } = await service.rpc("builder_submit_contact", {
        request_id: id,
        request_fingerprint: await hash(JSON.stringify(record)),
        sender_hash: await hash(record.email),
        contact: record,
      });
      if (error) {
        if (error.message.includes("Contact rate limit"))
          throw new ContactError(
            "Too many messages. Please wait ten minutes and try again.",
            429,
          );
        if (error.message.includes("Contact request conflict"))
          throw new ContactError(
            "This request has changed. Reload the page before sending it again.",
            409,
          );
        // Never expose database details to visitors.
        console.error("Builder contact persistence failed", error.code);
        throw new ContactError(
          "We couldn’t save your message. Please try again shortly.",
          503,
        );
      }
    },
  }),
);
