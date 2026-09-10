import { describe, expect, it, vi } from "vitest";
import {
  ContactError,
  handleContactRequest,
  validateContact,
} from "../../shared/builderContact";

const record = () => ({
  request_id: crypto.randomUUID(),
  name: " Alex ",
  email: "Alex@EXAMPLE.ORG",
  message: "A new website",
  consent_to_gdpr: true,
  marketing_consent: false,
  source_page: "/new-site/",
  company_address: "",
});
const request = (body: unknown, origin = "https://example.org") =>
  new Request("https://receiver.example.org", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
describe("builder contact receiver", () => {
  it("validates required fields and consent and maps the existing enquiry contract", () => {
    const { record: result } = validateContact(record());
    expect(result).toMatchObject({
      name: "Alex",
      email: "alex@example.org",
      phone: null,
      last_name: null,
      marketing_consent: false,
      consent_to_gdpr: true,
    });
    for (const change of [
      { name: " " },
      { email: "wrong" },
      { message: "x".repeat(5001) },
      { consent_to_gdpr: false },
      { marketing_consent: "true" },
      { source_page: "https://wrong.test" },
      { request_id: "invalid" },
    ])
      expect(() => validateContact({ ...record(), ...change })).toThrow();
  });
  it("accepts allowed submissions, drops the honeypot, and refuses unapproved origins", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const options = { allowedOrigins: ["https://example.org"], submit };
    const response = await handleContactRequest(request(record()), options);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(
      (
        await handleContactRequest(
          request({ ...record(), company_address: "bot" }),
          options,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await handleContactRequest(
          request(record(), "https://unapproved.test"),
          options,
        )
      ).status,
    ).toBe(403);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("bounds request bodies and reports persistence failure without disclosing internals", async () => {
    const submit = vi
      .fn()
      .mockRejectedValue(new Error("private database details"));
    const options = { allowedOrigins: ["https://example.org"], submit };
    expect(
      (
        await handleContactRequest(
          request({ message: "x".repeat(17000) }),
          options,
        )
      ).status,
    ).toBe(413);
    expect(submit).not.toHaveBeenCalled();
    const failure = await handleContactRequest(request(record()), options);
    expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain("private database");
    submit.mockRejectedValue(new ContactError("Too many messages", 429));
    const limited = await handleContactRequest(request(record()), options);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("600");
  });
});
