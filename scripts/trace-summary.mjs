import fs from "node:fs";
import path from "node:path";

const tracesDir = path.resolve(process.cwd(), "traces");

function toMs(microseconds) {
  return Number((microseconds / 1000).toFixed(2));
}

function findRendererMain(events) {
  const thread = events.find(
    (event) =>
      event.name === "thread_name" &&
      event.args &&
      event.args.name === "CrRendererMain",
  );

  if (thread) {
    return { pid: thread.pid, tid: thread.tid };
  }

  const fallback = events.find((event) => event.name === "RunTask");
  if (fallback) {
    return { pid: fallback.pid, tid: fallback.tid };
  }

  return null;
}

function summarizeTrace(tracePath) {
  const raw = fs.readFileSync(tracePath, "utf8");
  const parsed = JSON.parse(raw);
  const events = parsed.traceEvents || parsed;
  const mainThread = findRendererMain(events);

  if (!mainThread) {
    return { file: path.basename(tracePath), error: "No renderer thread found" };
  }

  const mainEvents = events.filter(
    (event) => event.pid === mainThread.pid && event.tid === mainThread.tid,
  );

  const values = (name) =>
    mainEvents
      .filter((event) => event.name === name && typeof event.dur === "number")
      .map((event) => event.dur);

  const summarizeDurations = (durations) => {
    const total = durations.reduce((sum, value) => sum + value, 0);
    const max = durations.reduce((acc, value) => Math.max(acc, value), 0);
    return {
      count: durations.length,
      sumMs: toMs(total),
      maxMs: toMs(max),
      over50ms: durations.filter((value) => value > 50000).length,
    };
  };

  const longTasks = mainEvents
    .filter((event) => typeof event.dur === "number" && event.dur > 50000)
    .map((event) => ({
      name: event.name,
      durMs: toMs(event.dur),
      url: event.args?.data?.url || event.args?.url || null,
    }));

  return {
    file: path.basename(tracePath),
    mtimeMs: fs.statSync(tracePath).mtimeMs,
    mainThread,
    runTask: summarizeDurations(values("RunTask")),
    evaluateScript: summarizeDurations(values("EvaluateScript")),
    functionCall: summarizeDurations(values("FunctionCall")),
    layout: summarizeDurations(values("Layout")),
    longTasks,
  };
}

function readJson(jsonPath) {
  const raw = fs.readFileSync(jsonPath, "utf8");
  return JSON.parse(raw);
}

function isTracePayload(parsed) {
  if (Array.isArray(parsed)) return true;
  return Array.isArray(parsed?.traceEvents);
}

function isLighthousePayload(parsed) {
  return Boolean(parsed?.categories && parsed?.audits);
}

function summarizeLighthouse(lhPath, parsed) {
  const category = (id) => {
    const score = parsed?.categories?.[id]?.score;
    return typeof score === "number" ? Number((score * 100).toFixed(0)) : null;
  };

  const metricValue = (id) => {
    const v = parsed?.audits?.[id]?.numericValue;
    return typeof v === "number" ? Number(v.toFixed(0)) : null;
  };

  return {
    file: path.basename(lhPath),
    performance: category("performance"),
    accessibility: category("accessibility"),
    bestPractices: category("best-practices"),
    seo: category("seo"),
    fcpMs: metricValue("first-contentful-paint"),
    lcpMs: metricValue("largest-contentful-paint"),
    tbtMs: metricValue("total-blocking-time"),
    cls: parsed?.audits?.["cumulative-layout-shift"]?.numericValue ?? null,
  };
}

function formatDelta(current, previous, label) {
  const diff = current - previous;
  const sign = diff > 0 ? "+" : "";
  return `${label}: ${current.toFixed(2)}ms (${sign}${diff.toFixed(2)}ms vs previous)`;
}

if (!fs.existsSync(tracesDir)) {
  console.error("No traces directory found at", tracesDir);
  process.exit(1);
}

const allFiles = fs
  .readdirSync(tracesDir)
  .map((name) => path.join(tracesDir, name));

const jsonFiles = allFiles
  .filter((name) => name.toLowerCase().endsWith(".json"))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

const traceFiles = [];
const lighthouseJsonFiles = [];

for (const file of jsonFiles) {
  try {
    const parsed = readJson(file);
    if (isTracePayload(parsed)) {
      traceFiles.push(file);
      continue;
    }
    if (isLighthousePayload(parsed)) {
      lighthouseJsonFiles.push({ file, parsed });
    }
  } catch {
    // Ignore malformed JSON files in traces/
  }
}

if (traceFiles.length === 0) {
  console.error("No trace JSON files found in traces/");
  process.exit(1);
}

const lighthousePdfs = allFiles
  .filter((name) => name.toLowerCase().endsWith(".pdf"))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  .map((fullPath) => {
    const stats = fs.statSync(fullPath);
    return {
      file: path.basename(fullPath),
      sizeKb: Number((stats.size / 1024).toFixed(1)),
      modified: new Date(stats.mtimeMs).toISOString(),
    };
  });

const selected = traceFiles.slice(0, 2);
const summaries = selected.map(summarizeTrace);

console.log("Trace Summary");
console.log("-------------");
for (const item of summaries) {
  console.log(`File: ${item.file}`);
  console.log(
    `  RunTask sum/max: ${item.runTask.sumMs.toFixed(2)}ms / ${item.runTask.maxMs.toFixed(2)}ms (>${50}ms tasks: ${item.runTask.over50ms})`,
  );
  console.log(
    `  EvaluateScript max: ${item.evaluateScript.maxMs.toFixed(2)}ms`,
  );
  console.log(
    `  FunctionCall sum/max: ${item.functionCall.sumMs.toFixed(2)}ms / ${item.functionCall.maxMs.toFixed(2)}ms`,
  );
  console.log(
    `  Layout sum/max: ${item.layout.sumMs.toFixed(2)}ms / ${item.layout.maxMs.toFixed(2)}ms`,
  );
}

if (summaries.length > 1) {
  const current = summaries[0];
  const previous = summaries[1];
  console.log("");
  console.log(`Delta (${current.file} vs ${previous.file})`);
  console.log("--------------------------------");
  console.log(
    formatDelta(current.runTask.sumMs, previous.runTask.sumMs, "RunTask total"),
  );
  console.log(
    formatDelta(
      current.functionCall.sumMs,
      previous.functionCall.sumMs,
      "FunctionCall total",
    ),
  );
  console.log(
    formatDelta(current.layout.sumMs, previous.layout.sumMs, "Layout total"),
  );
  console.log(
    formatDelta(
      current.evaluateScript.maxMs,
      previous.evaluateScript.maxMs,
      "EvaluateScript max",
    ),
  );
}

if (lighthousePdfs.length > 0) {
  console.log("");
  console.log("Lighthouse PDFs found");
  console.log("---------------------");
  for (const file of lighthousePdfs) {
    console.log(
      `${file.file} (${file.sizeKb} KB, modified ${file.modified})`,
    );
  }
  console.log(
    "Note: PDF scores are not parsed yet. If you export Lighthouse JSON reports, I can compare category scores automatically.",
  );
}

if (lighthouseJsonFiles.length > 0) {
  const latest = lighthouseJsonFiles.slice(0, 2).map(({ file, parsed }) =>
    summarizeLighthouse(file, parsed),
  );
  console.log("");
  console.log("Lighthouse JSON");
  console.log("----------------");
  for (const item of latest) {
    console.log(
      `${item.file} | Perf ${item.performance} | Acc ${item.accessibility} | BP ${item.bestPractices} | SEO ${item.seo}`,
    );
    console.log(
      `  FCP ${item.fcpMs}ms | LCP ${item.lcpMs}ms | TBT ${item.tbtMs}ms | CLS ${item.cls}`,
    );
  }

  if (latest.length > 1) {
    const cur = latest[0];
    const prev = latest[1];
    const delta = (a, b) => {
      if (a === null || b === null) return "n/a";
      const d = a - b;
      return `${d > 0 ? "+" : ""}${d}`;
    };
    console.log("");
    console.log(`Lighthouse Delta (${cur.file} vs ${prev.file})`);
    console.log("-------------------------------------------");
    console.log(`Performance: ${delta(cur.performance, prev.performance)}`);
    console.log(`Accessibility: ${delta(cur.accessibility, prev.accessibility)}`);
    console.log(`Best Practices: ${delta(cur.bestPractices, prev.bestPractices)}`);
    console.log(`SEO: ${delta(cur.seo, prev.seo)}`);
    console.log(`FCP: ${delta(cur.fcpMs, prev.fcpMs)}ms`);
    console.log(`LCP: ${delta(cur.lcpMs, prev.lcpMs)}ms`);
    console.log(`TBT: ${delta(cur.tbtMs, prev.tbtMs)}ms`);
  }
}
