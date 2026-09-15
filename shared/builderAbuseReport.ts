/** Public report about a website hosted by Kaizen. The service stores a keyed
 * hash of the reporter, never a raw IP address; an optional reply address is
 * kept only so the operator can respond. */
export class AbuseReportError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const abuseCategories = [
  "phishing",
  "malware",
  "spam",
  "illegal",
  "copyright",
  "other",
] as const;
export type AbuseReport = {
  origin: string;
  category: (typeof abuseCategories)[number];
  details: string;
  contact: string | null;
};
const checkAgain = () =>
  new AbuseReportError("Please check the report and try again.");

export function validateAbuseReport(value: unknown): {
  id: string;
  report: AbuseReport;
  spam: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw checkAgain();
  const body = value as Record<string, unknown>;
  const text = (key: string, limit: number) => {
    if (body[key] !== undefined && typeof body[key] !== "string")
      throw checkAgain();
    const result = String(body[key] || "").trim();
    if (result.length > limit || /\u0000/.test(result)) throw checkAgain();
    return result;
  };
  const id = text("request_id", 36).toLowerCase();
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      id,
    )
  )
    throw new AbuseReportError("Please reload the page and try again.");
  const spam = !!text("company_address", 200);
  let origin: string;
  try {
    const url = new URL(text("website", 300));
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error();
    origin = url.origin.toLowerCase();
  } catch {
    throw new AbuseReportError(
      "Enter the website's full address, starting with https://.",
    );
  }
  const category = text("category", 20);
  if (!(abuseCategories as readonly string[]).includes(category))
    throw new AbuseReportError("Choose what is wrong with the website.");
  const details = text("details", 4000);
  if (details.length < 10)
    throw new AbuseReportError("Describe the problem in at least a sentence.");
  const contact = text("contact", 254).toLowerCase() || null;
  if (contact && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact))
    throw new AbuseReportError(
      "Enter a valid email address, or leave it empty.",
    );
  return {
    id,
    spam,
    report: {
      origin,
      category: category as AbuseReport["category"],
      details,
      contact,
    },
  };
}

export async function handleAbuseReportRequest(
  request: Request,
  options: {
    allowedOrigins: string[];
    beforeRead?: (headers: Headers) => Promise<Response | undefined>;
    submit: (id: string, report: AbuseReport) => Promise<void>;
  },
): Promise<Response> {
  const origin = request.headers.get("origin") || "";
  const allowed = options.allowedOrigins.includes(origin);
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  if (allowed) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!allowed)
    return json(403, {
      error: "Reports can only be sent from the Kaizen report page.",
    });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return json(405, { error: "Use the report form to send a report." });
  if (
    !(request.headers.get("content-type") || "")
      .toLowerCase()
      .startsWith("application/json")
  )
    return json(415, { error: "Unsupported report request." });
  const limited = await options.beforeRead?.(headers);
  if (limited) return limited;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw checkAgain();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16_384) {
        await reader.cancel();
        throw new AbuseReportError("The report is too long.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw checkAgain();
    }
    const { id, report, spam } = validateAbuseReport(value);
    if (!spam) await options.submit(id, report);
    return json(200, {
      ok: true,
      message:
        "Thank you. Kaizen will review this report. The website stays unchanged unless the review finds a problem.",
    });
  } catch (error) {
    const status = error instanceof AbuseReportError ? error.status : 503;
    if (status === 429) headers.set("Retry-After", "3600");
    return json(status, {
      error:
        error instanceof AbuseReportError
          ? error.message
          : "We couldn't save your report. Please try again shortly.",
    });
  }
}
