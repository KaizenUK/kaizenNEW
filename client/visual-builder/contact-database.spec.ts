import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

describe("contact enquiry transaction", () => {
  let db: PGlite;
  const contact = {
    name: "Alex",
    email: "alex@example.org",
    message: "A new website",
    consent_to_gdpr: true,
    marketing_consent: false,
    source_page: "/demo/",
  };
  beforeAll(async () => {
    db = await PGlite.create();
    // Existing production-owned enquiry table is represented with its current client field contract.
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.contact_form_submissions (name text,last_name text,email text,phone text,website text,message text,marketing_consent boolean,consent_to_gdpr boolean,source_page text,user_agent text);`);
    await db.exec(
      await readFile(
        "supabase/migrations/202609100003_builder_contact.sql",
        "utf8",
      ),
    );
  }, 30_000);
  beforeEach(async () => {
    await db.exec(
      "reset role; truncate contact_form_submissions,builder_contact_requests",
    );
  });
  afterAll(async () => {
    await db?.close();
  });
  const submit = (
    id = crypto.randomUUID(),
    hash = "a".repeat(64),
    sender = "b".repeat(64),
  ) =>
    db.query("select builder_submit_contact($1::uuid,$2,$3,$4::jsonb)", [
      id,
      hash,
      sender,
      JSON.stringify(contact),
    ]);
  it("stores one enquiry for repeated requests and rejects changed retries", async () => {
    const id = crypto.randomUUID();
    await db.exec("set role service_role");
    await submit(id);
    await submit(id);
    await expect(submit(id, "c".repeat(64))).rejects.toThrow(
      "Contact request conflict",
    );
    await db.exec("reset role");
    expect(
      (await db.query("select * from contact_form_submissions")).rows,
    ).toHaveLength(1);
  });
  it("limits bursts and rolls back the retry ledger if enquiry storage fails", async () => {
    for (let i = 0; i < 5; i++) await submit();
    await expect(submit()).rejects.toThrow("Contact rate limit");
    expect(
      (await db.query("select * from contact_form_submissions")).rows,
    ).toHaveLength(5);
    await db.exec(
      "truncate contact_form_submissions,builder_contact_requests; alter table contact_form_submissions add constraint failure_fixture check (name <> 'Alex')",
    );
    await expect(submit()).rejects.toThrow();
    expect(
      (await db.query("select * from builder_contact_requests")).rows,
    ).toHaveLength(0);
    await db.exec(
      "alter table contact_form_submissions drop constraint failure_fixture",
    );
  });
  it("prevents visitors from reading the ledger or bypassing the validated receiver", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(submit()).rejects.toThrow("permission denied");
      await expect(
        db.query("select * from builder_contact_requests"),
      ).rejects.toThrow("permission denied");
      await db.exec("reset role");
    }
  });
});
