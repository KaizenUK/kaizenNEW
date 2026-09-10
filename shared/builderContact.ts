/** Public contact submission contract. Used by the edge function and isolated local receiver. */
export class ContactError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type ContactRecord = {
  name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  message: string;
  consent_to_gdpr: true;
  marketing_consent: boolean;
  source_page: string;
  user_agent: string;
};
export function validateContact(value: unknown): {
  id: string;
  record: ContactRecord;
  spam: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ContactError("Please check your form and try again.");
  const body = value as Record<string, unknown>;
  const field = (key: string, limit: number, required = false) => {
    if (body[key] !== undefined && typeof body[key] !== "string")
      throw new ContactError(`Invalid ${key}.`);
    const result = String(body[key] || "").trim();
    if ((required && !result) || result.length > limit || /\u0000/.test(result))
      throw new ContactError(`Please check ${key.replace(/_/g, " ")}.`);
    return result;
  };
  const id = field("request_id", 36, true);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    throw new ContactError("Please reload the page and try again.");
  const spam = !!field("company_address", 200);
  const email = field("email", 254, true).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))
    throw new ContactError("Please enter a valid email address.");
  if (body.consent_to_gdpr !== true)
    throw new ContactError("Please confirm the privacy notice before sending.");
  if (
    body.marketing_consent !== undefined &&
    typeof body.marketing_consent !== "boolean"
  )
    throw new ContactError("Invalid marketing preference.");
  const source = field("source_page", 1000);
  if (source && (!source.startsWith("/") || source.startsWith("//")))
    throw new ContactError("Invalid source page.");
  return {
    id,
    spam,
    record: {
      name: field("name", 100, true),
      last_name: field("last_name", 100) || null,
      email,
      phone: field("phone", 40) || null,
      website: field("website", 200) || null,
      message: field("message", 5000, true),
      consent_to_gdpr: true,
      marketing_consent: body.marketing_consent === true,
      source_page: source,
      user_agent: field("user_agent", 500),
    },
  };
}
export async function handleContactRequest(
  request: Request,
  options: {
    allowedOrigins: string[];
    submit: (id: string, record: ContactRecord) => Promise<void>;
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
      error: "This website is not connected to the contact service.",
    });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return json(405, { error: "Use the contact form to send a message." });
  if (
    !(request.headers.get("content-type") || "")
      .toLowerCase()
      .startsWith("application/json")
  )
    return json(415, { error: "Unsupported form request." });
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new ContactError("The form is empty.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16_384) {
        await reader.cancel();
        throw new ContactError("Your message is too long.", 413);
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
      throw new ContactError("Please check your form and try again.");
    }
    const { id, record, spam } = validateContact(value);
    if (!spam) await options.submit(id, record);
    return json(200, { ok: true });
  } catch (error) {
    const status = error instanceof ContactError ? error.status : 503;
    if (status === 429) headers.set("Retry-After", "600");
    return json(status, {
      error:
        error instanceof ContactError
          ? error.message
          : "We couldn’t save your message. Please try again shortly.",
    });
  }
}
