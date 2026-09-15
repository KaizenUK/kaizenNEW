import { checkFunctionLimit } from "../_shared/functionLimits.ts";
import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import {
  AbuseReportError,
  handleAbuseReportRequest,
} from "../../../shared/builderAbuseReport.ts";
import {
  DEFAULT_CONTACT_ORIGINS,
  parseAllowedOrigins,
} from "../../../shared/builderOrigins.ts";

const allowedOrigins = parseAllowedOrigins(
  Deno.env.get("BUILDER_REPORT_ORIGINS"),
  DEFAULT_CONTACT_ORIGINS,
  "BUILDER_REPORT_ORIGINS",
);
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const service = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
// Keyed hashes limit repeat reports without storing a raw network address.
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
  handleAbuseReportRequest(request, {
    allowedOrigins,
    beforeRead: (headers) =>
      checkFunctionLimit(service, "builder-report", headers),
    async submit(id, report) {
      const network =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";
      const { error } = await service.rpc("builder_submit_abuse_report", {
        request_id: id,
        request_fingerprint: await hash(JSON.stringify(report)),
        reporter_hash: await hash(`report:${network}`),
        report,
      });
      if (!error) return;
      const message = String(error.message || "");
      if (/Report rate limit|intake is full/.test(message))
        throw new AbuseReportError(
          "Too many reports were sent. Please wait an hour and try again.",
          429,
        );
      if (message.includes("not hosted by Kaizen"))
        throw new AbuseReportError(
          "That address is not a website hosted by Kaizen.",
          404,
        );
      if (message.includes("Report request conflict"))
        throw new AbuseReportError(
          "This report has changed. Reload the page before sending it again.",
          409,
        );
      if (message.includes("Invalid report"))
        throw new AbuseReportError("Please check the report and try again.");
      throw new Error("Report service unavailable");
    },
  }),
);
