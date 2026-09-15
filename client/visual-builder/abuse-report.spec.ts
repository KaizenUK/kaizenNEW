import { expect, it } from "vitest";
import {
  handleAbuseReportRequest,
  validateAbuseReport,
} from "../../shared/builderAbuseReport";
import { abuseOperatorCommand } from "../../scripts/builder-abuse-operator";

const id = "11111111-1111-4111-8111-111111111111";
const valid = {
  request_id: id,
  website: "HTTPS://Client.Example.test/login?token=secret",
  category: "phishing",
  details: "This page asks visitors for bank passwords.",
  contact: "Reporter@Example.test",
};

it("accepts only a bounded report about an https website and keeps just its origin", () => {
  expect(validateAbuseReport(valid)).toEqual({
    id,
    spam: false,
    report: {
      origin: "https://client.example.test",
      category: "phishing",
      details: valid.details,
      contact: "reporter@example.test",
    },
  });
  expect(
    validateAbuseReport({ ...valid, contact: "" }).report.contact,
  ).toBeNull();
  for (const [change, message] of [
    [{ website: "http://client.example.test" }, /starting with https/],
    [
      { website: "https://user:pass@client.example.test" },
      /starting with https/,
    ],
    [{ category: "annoying" }, /what is wrong/],
    [{ details: "bad" }, /at least a sentence/],
    [{ details: "x".repeat(4001) }, /check the report/],
    [{ contact: "not-an-address" }, /valid email/],
    [{ request_id: "not-a-uuid" }, /reload the page/],
    [
      { details: "Contains a \u0000 control character here" },
      /check the report/,
    ],
  ] as const)
    expect(() => validateAbuseReport({ ...valid, ...change })).toThrow(message);
  expect(validateAbuseReport({ ...valid, company_address: "bot" }).spam).toBe(
    true,
  );
});

it("refuses foreign origins, wrong methods and oversized bodies before submitting", async () => {
  const submitted: unknown[] = [];
  const options = {
    allowedOrigins: ["https://kaizen.example.test"],
    submit: async (...args: unknown[]) => {
      submitted.push(args);
    },
  };
  const post = (body: string, origin = "https://kaizen.example.test") =>
    handleAbuseReportRequest(
      new Request("https://functions.example.test/builder-report", {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body,
      }),
      options,
    );
  expect(
    (await post(JSON.stringify(valid), "https://evil.example.test")).status,
  ).toBe(403);
  expect((await post("x".repeat(20000))).status).toBe(413);
  const spam = await post(JSON.stringify({ ...valid, company_address: "bot" }));
  expect(spam.status).toBe(200);
  expect(submitted).toHaveLength(0);
  const accepted = await post(JSON.stringify(valid));
  expect(accepted.status).toBe(200);
  expect(await accepted.json()).toMatchObject({ ok: true });
  expect(submitted).toHaveLength(1);
});

it("parses only complete operator commands with a named operator and reason", () => {
  const project = "22222222-2222-4222-8222-222222222222";
  expect(abuseOperatorCommand(["list"])).toEqual({
    rpc: "builder_operator_reports",
    input: { report_status: "open" },
  });
  expect(
    abuseOperatorCommand([
      "takedown",
      project,
      "--operator",
      "sean",
      "--reason",
      "Confirmed phishing",
      "--report",
      id,
    ]),
  ).toEqual({
    rpc: "builder_operator_suspend",
    input: {
      target: project,
      report: id,
      operator: "sean",
      reason: "Confirmed phishing",
      takedown: true,
    },
  });
  for (const args of [
    ["takedown", project, "--reason", "No operator"],
    ["suspend", "kaizen", "--operator", "sean", "--reason", "Not a UUID"],
    ["restore", project, "--operator", "sean"],
    ["list", "--status", "everything"],
    ["purge", project],
    [
      "suspend",
      project,
      "--operator",
      "sean",
      "--reason",
      "x",
      "--reason",
      "y",
    ],
  ])
    expect(() => abuseOperatorCommand(args)).toThrow(/Use one of/);
});
