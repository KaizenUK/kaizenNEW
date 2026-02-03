import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";

type MetricsState = {
  lcp: string;
  cls: string;
  tbt: string;
  lcpMs: number | null;
  tbtMs: number | null;
  clsValue: number | null;
};

const KAIZEN_LOGO_URL =
  "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fba236b579fed416bb066c58fd3c3e06d?format=webp&width=800&height=1200";

const defaultMetrics: MetricsState = {
  lcp: "",
  cls: "",
  tbt: "",
  lcpMs: null,
  tbtMs: null,
  clsValue: null,
};

function getScoreColor(score: number) {
  if (score < 50) return { r: 220, g: 38, b: 38 };
  if (score < 90) return { r: 234, g: 88, b: 12 };
  return { r: 22, g: 163, b: 74 };
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metricVerdict(
  key: "lcp" | "tbt" | "cls",
  metrics: MetricsState,
): { label: string; detail: string } {
  if (key === "lcp") {
    const seconds = metrics.lcpMs != null ? metrics.lcpMs / 1000 : null;
    if (seconds == null) {
      return { label: "Unknown", detail: "Aim for 2.5s" };
    }
    if (seconds <= 2.5) return { label: "Fast", detail: "On target (≤ 2.5s)" };
    if (seconds <= 4)
      return { label: "Slow", detail: "Too slow – aim for 2.5s" };
    return { label: "Very slow", detail: "Critical – aim for 2.5s" };
  }

  if (key === "tbt") {
    const ms = metrics.tbtMs;
    if (ms == null) {
      return { label: "Unknown", detail: "Aim for 200ms" };
    }
    if (ms <= 200) return { label: "Responsive", detail: "On target (≤ 200ms)" };
    if (ms <= 600)
      return { label: "Laggy", detail: "Too laggy – aim for 200ms" };
    return { label: "Frozen", detail: "Critical – aim for 200ms" };
  }

  const cls = metrics.clsValue;
  if (cls == null) {
    return { label: "Unknown", detail: "Aim for 0.1" };
  }
  if (cls <= 0.1) return { label: "Stable", detail: "On target (≤ 0.1)" };
  if (cls <= 0.25) return { label: "Jumpy", detail: "Too jumpy – aim for 0.1" };
  return { label: "Chaotic", detail: "Critical – aim for 0.1" };
}

async function imageUrlToPngDataUrl(imageUrl: string) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Failed to download logo");

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load logo image"));
      el.src = blobUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create canvas context");

    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export default function SpeedScanner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  // Data State
  const [score, setScore] = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState("");
  const [metrics, setMetrics] = useState<MetricsState>(defaultMetrics);

  // Gate State
  const [email, setEmail] = useState("");
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const [auditedUrl, setAuditedUrl] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // API Key (kept out of git; configured via env)
  const API_KEY = useMemo(() => {
    return (import.meta as any).env?.VITE_PAGESPEED_API_KEY as
      | string
      | undefined;
  }, []);

  const buildAuditUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  async function runAudit() {
    const auditUrl = buildAuditUrl(url);
    if (!auditUrl) return;

    setLoading(true);
    setScore(null);
    setScreenshot("");
    setMetrics(defaultMetrics);
    setStatusMsg("Connecting to Google Lighthouse...");

    setAuditedUrl(auditUrl);
    setIsEmailSubmitted(false);
    setEmailError("");
    setEmail("");

    try {
      setTimeout(() => setStatusMsg("Measuring Load Speeds..."), 1000);
      setTimeout(() => setStatusMsg("Analyzing Stability..."), 2000);

      if (!API_KEY) {
        throw new Error("Missing API key");
      }

      const res = await fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
          auditUrl,
        )}&category=PERFORMANCE&strategy=MOBILE&key=${API_KEY}`,
      );
      const data = await res.json();

      if (data.error) throw new Error(data.error.message);

      const lighthouseScore =
        data.lighthouseResult.categories.performance.score * 100;
      setScore(Math.round(lighthouseScore));

      const lcpAudit = data.lighthouseResult.audits[
        "largest-contentful-paint"
      ];
      const clsAudit = data.lighthouseResult.audits["cumulative-layout-shift"];
      const tbtAudit = data.lighthouseResult.audits["total-blocking-time"];

      setMetrics({
        lcp: lcpAudit?.displayValue ?? "",
        cls: clsAudit?.displayValue ?? "",
        tbt: tbtAudit?.displayValue ?? "",
        lcpMs: safeNumber(lcpAudit?.numericValue),
        tbtMs: safeNumber(tbtAudit?.numericValue),
        clsValue: safeNumber(clsAudit?.numericValue),
      });

      const base64Image =
        data.lighthouseResult.audits["final-screenshot"].details.data;
      setScreenshot(base64Image);

      setLoading(false);
      setStatusMsg("");
    } catch (err) {
      setStatusMsg("Error: Could not scan URL. Please check the link.");
      setLoading(false);
    }
  }

  function handleUnlock() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("Lead Captured:", normalizedEmail, {
        url: auditedUrl,
        score,
        metrics,
      });
    }

    setIsEmailSubmitted(true);
    setEmailError("");
  }

  async function downloadPDF() {
    if (score === null) return;

    setPdfLoading(true);

    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const date = new Date().toLocaleDateString("en-GB");
      const year = new Date().getFullYear();

      const kaizenDark = { r: 2, g: 6, b: 23 };
      const kaizenCyan = { r: 6, g: 182, b: 212 };
      const textGrey = { r: 80, g: 80, b: 80 };

      const targetUrl = auditedUrl || buildAuditUrl(url);
      const scoreColor = getScoreColor(score);

      let logoPng: string | null = null;
      try {
        logoPng = await imageUrlToPngDataUrl(KAIZEN_LOGO_URL);
      } catch {
        logoPng = null;
      }

      const drawHeader = (pageTitle: string) => {
        doc.setFillColor(kaizenDark.r, kaizenDark.g, kaizenDark.b);
        doc.rect(0, 0, 210, 36, "F");

        doc.setFillColor(kaizenCyan.r, kaizenCyan.g, kaizenCyan.b);
        doc.rect(0, 36, 210, 1, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("Kaizen Web", 16, 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(pageTitle, 16, 28);

        doc.setFontSize(10);
        doc.text(`Date: ${date}`, 150, 18);
        doc.text("Status: Mobile Audit", 150, 28);

        if (logoPng) {
          doc.addImage(logoPng, "PNG", 178, 8, 22, 22);
        }
      };

      const wrapText = (text: string, x: number, y: number, width: number) => {
        const lines = doc.splitTextToSize(text, width);
        doc.text(lines, x, y);
        return lines.length;
      };

      // --- PAGE 1 ---
      drawHeader("Performance Audit & Fix Plan");

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`Audit Target: ${targetUrl}`, 16, 52);

      // Score + executive summary
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(16, 58, 178, 34, 5, 5, "F");

      doc.setDrawColor(scoreColor.r, scoreColor.g, scoreColor.b);
      doc.setLineWidth(1.2);
      doc.circle(33, 75, 12, "S");

      doc.setTextColor(scoreColor.r, scoreColor.g, scoreColor.b);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(String(score), 33, 78, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text("/100", 33, 85, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);

      if (score < 50) {
        doc.text("Result: CRITICAL FAIL", 52, 73);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(textGrey.r, textGrey.g, textGrey.b);
        doc.text("Google is likely penalising this page on mobile.", 52, 80);
        doc.text("You can lose a large chunk of mobile visitors.", 52, 86);
      } else if (score < 90) {
        doc.text("Result: NEEDS IMPROVEMENT", 52, 73);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(textGrey.r, textGrey.g, textGrey.b);
        doc.text("Usable, but slower than it should be.", 52, 80);
        doc.text("Speed-ups here typically lift enquiries + ranking.", 52, 86);
      } else {
        doc.text("Result: EXCELLENT", 52, 73);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(textGrey.r, textGrey.g, textGrey.b);
        doc.text("This page is in the top band for mobile performance.", 52, 80);
      }

      // Section: What we found
      doc.setDrawColor(190, 190, 190);
      doc.line(16, 102, 194, 102);

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("1. What We Found (Plain English)", 16, 112);

      const boxY = 118;
      const boxH = 46;
      const gap = 6;
      const boxW = (178 - gap * 2) / 3;

      const metricCards: Array<{
        title: string;
        metricKey: "lcp" | "tbt" | "cls";
        value: string;
        label: string;
        helper: string;
      }> = [
        {
          title: "SPEED (LCP)",
          metricKey: "lcp",
          value: metrics.lcp || "-",
          label: metricVerdict("lcp", metrics).label,
          helper: metricVerdict("lcp", metrics).detail,
        },
        {
          title: "INTERACTIVITY (TBT)",
          metricKey: "tbt",
          value: metrics.tbt || "-",
          label: metricVerdict("tbt", metrics).label,
          helper: metricVerdict("tbt", metrics).detail,
        },
        {
          title: "STABILITY (CLS)",
          metricKey: "cls",
          value: metrics.cls || "-",
          label: metricVerdict("cls", metrics).label,
          helper: metricVerdict("cls", metrics).detail,
        },
      ];

      metricCards.forEach((card, idx) => {
        const x = 16 + idx * (boxW + gap);

        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, boxY, boxW, boxH, 4, 4, "F");

        doc.setFillColor(kaizenCyan.r, kaizenCyan.g, kaizenCyan.b);
        doc.rect(x, boxY, boxW, 2, "F");

        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(card.title, x + 4, boxY + 9);

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(card.value, x + 4, boxY + 20);

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(card.label, x + 4, boxY + 30);

        doc.setTextColor(textGrey.r, textGrey.g, textGrey.b);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        wrapText(card.helper, x + 4, boxY + 38, boxW - 8);
      });

      // Section: What this means
      doc.setDrawColor(190, 190, 190);
      doc.line(16, 172, 194, 172);

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("2. What This Means For You", 16, 182);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(textGrey.r, textGrey.g, textGrey.b);

      if (score < 50) {
        wrapText(
          "Your website is currently failing Google’s Core Web Vitals. In practice, that means lower visibility in search and more mobile visitors leaving before they become enquiries.",
          16,
          192,
          178,
        );
      } else if (score < 90) {
        wrapText(
          "Your site is usable, but it’s slower than it needs to be. Speed improvements usually increase enquiries (people stay longer) and help your Google ranking.",
          16,
          192,
          178,
        );
      } else {
        wrapText(
          "Your site is in great shape. This report is still useful as proof of performance and as a checklist to keep things fast as you add new pages.",
          16,
          192,
          178,
        );
      }

      // Footer
      doc.setDrawColor(225, 225, 225);
      doc.line(16, 287, 194, 287);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `© ${year} Kaizen Web. Confidential performance audit.`,
        16,
        293,
      );
      doc.text("Page 1 of 2", 194, 293, { align: "right" });

      // --- PAGE 2 ---
      doc.addPage();
      drawHeader("Evidence Snapshot & Action Plan");

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("3. Evidence Snapshot", 16, 52);

      // Screenshot container
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(16, 58, 90, 170, 6, 6, "F");

      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Mobile screenshot", 16, 236);

      if (screenshot) {
        const imageFormat = screenshot.startsWith("data:image/png")
          ? "PNG"
          : "JPEG";
        doc.addImage(screenshot, imageFormat as any, 20, 64, 82, 158);
      }

      // Action plan
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("4. Immediate Fix Plan", 114, 52);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(textGrey.r, textGrey.g, textGrey.b);
      wrapText(
        "These are the highest impact fixes we normally implement first. They’re chosen to improve speed quickly without breaking the design.",
        114,
        60,
        80,
      );

      const planStartY = 80;
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(114, planStartY, 80, 110, 6, 6, "F");

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Priority actions", 118, planStartY + 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(textGrey.r, textGrey.g, textGrey.b);

      const fixes =
        score < 50
          ? [
              "• Replace oversized images with WebP/AVIF",
              "• Remove heavy scripts & tracking bloat",
              "• Fix layout shifts (image sizes, fonts)",
              "• Reduce render-blocking CSS",
              "• Improve server response / caching",
            ]
          : score < 90
            ? [
                "• Compress + modernise images (WebP)",
                "• Split JavaScript and remove unused code",
                "• Defer non-critical scripts",
                "• Preload key fonts to prevent jumping",
                "• Cache static assets aggressively",
              ]
            : [
                "• Keep images compressed and sized",
                "• Audit new plugins/scripts regularly",
                "• Keep animations lightweight",
                "• Maintain cache headers",
                "• Re-test monthly after updates",
              ];

      let fixY = planStartY + 22;
      fixes.forEach((fix) => {
        const lines = doc.splitTextToSize(fix, 74);
        doc.text(lines, 118, fixY);
        fixY += lines.length * 5.5 + 2;
      });

      // CTA box
      doc.setFillColor(240, 248, 255);
      doc.roundedRect(114, 200, 80, 28, 6, 6, "F");
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Want this fixed for you?", 118, 212);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(textGrey.r, textGrey.g, textGrey.b);
      doc.text("Reply with this PDF and we'll", 118, 219);
      doc.text("send a clear, fixed-price plan.", 118, 225);

      // Footer
      doc.setDrawColor(225, 225, 225);
      doc.line(16, 287, 194, 287);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `© ${year} Kaizen Web. All rights reserved.`,
        16,
        293,
      );
      doc.text("Page 2 of 2", 194, 293, { align: "right" });

      doc.save("kaizen-audit-report.pdf");
    } finally {
      setPdfLoading(false);
    }
  }

  const shouldGate = score !== null && score < 90 && !isEmailSubmitted;

  const speedVerdict = metricVerdict("lcp", metrics);
  const tbtVerdict = metricVerdict("tbt", metrics);
  const clsVerdict = metricVerdict("cls", metrics);

  return (
    <section
      id="live-performance-scanner"
      className="relative py-16 md:py-20 bg-gray-950 text-white overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_10%_10%,rgba(6,182,212,0.12),transparent_55%),radial-gradient(circle_at_90%_90%,rgba(59,130,246,0.10),transparent_60%)]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="w-full max-w-4xl mx-auto p-8 rounded-3xl border border-cyan-500/20 bg-slate-900/60 backdrop-blur-xl shadow-[0_0_50px_-15px_rgba(6,182,212,0.2)] relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 blur-sm" />

          <div className="text-center mb-8 relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Don&apos;t Guess. Test.
            </h2>
            <p className="text-slate-400 text-lg">
              Enter your URL. Watch the audit run in real-time.
            </p>
          </div>

          {/* Input Section */}
          <div className="flex flex-col md:flex-row gap-4 relative z-10 mb-8 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center font-mono text-sm text-slate-500">
                https://
              </div>
              <input
                type="text"
                inputMode="url"
                placeholder="yourwebsite.com"
                value={url}
                onChange={(e) => {
                  const next = e.target.value
                    .trimStart()
                    .replace(/^https?:\/\//i, "")
                    .replace(/^\/+/, "");
                  setUrl(next);
                }}
                className="w-full px-6 py-4 pl-[108px] rounded-full bg-black/40 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600"
              />
            </div>
            <button
              onClick={runAudit}
              disabled={loading}
              className="px-8 py-4 rounded-full font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? "Scanning..." : "Run Audit"}
            </button>
          </div>

          {loading && statusMsg && (
            <div className="text-center text-cyan-400 animate-pulse font-mono text-sm mb-4">
              {statusMsg}
            </div>
          )}

          {!loading && statusMsg.startsWith("Error") && (
            <div className="text-center font-mono text-sm mb-4 text-red-300">
              {statusMsg}
            </div>
          )}

          {/* RESULT SECTION */}
          {score !== null && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-black/20 p-8 rounded-2xl border border-white/5 mt-8 relative overflow-hidden">
              {/* SCREENSHOT */}
              <div className="relative mx-auto border-[6px] border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl max-w-[200px] bg-slate-800">
                {screenshot ? (
                  <img
                    src={screenshot}
                    alt="Site Screenshot"
                    className="w-full h-auto object-cover"
                  />
                ) : (
                  <div className="w-full h-32 bg-slate-700 animate-pulse" />
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
              </div>

              {/* RIGHT SIDE */}
              <div className="text-center md:text-left flex flex-col items-center md:items-start z-10 w-full">
                {/* Score */}
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-slate-800 bg-slate-900 relative mb-4 shadow-lg">
                  <span
                    className={`text-4xl font-black ${
                      score < 50
                        ? "text-red-500"
                        : score < 90
                          ? "text-orange-500"
                          : "text-green-500"
                    }`}
                  >
                    {score}
                  </span>
                </div>

                <div className="relative w-full">
                  {/* Blurred details behind the gate */}
                  <div
                    className={
                      shouldGate
                        ? "blur-sm select-none pointer-events-none opacity-60"
                        : ""
                    }
                  >
                    <h3 className="text-2xl text-white font-bold mb-2">
                      {score < 90 ? "Consultant Report Ready" : "Excellent Score!"}
                    </h3>
                    <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                      {score < 90
                        ? "Unlock the full PDF fix plan (plain English + metrics)."
                        : "Download a polished PDF report for your records."}
                    </p>

                    <div className="rounded-xl bg-black/25 border border-white/5 p-4 mb-5">
                      <div className="text-xs font-mono tracking-[0.25em] text-cyan-300 uppercase mb-3">
                        Core Web Vitals (Plain English)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                          <div className="text-[11px] text-slate-400 font-mono">
                            Load Speed
                          </div>
                          <div className="text-white font-bold">
                            {metrics.lcp || "-"}
                          </div>
                          <div className="text-slate-400 text-xs">
                            {speedVerdict.label} · {speedVerdict.detail}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                          <div className="text-[11px] text-slate-400 font-mono">
                            Interactivity
                          </div>
                          <div className="text-white font-bold">
                            {metrics.tbt || "-"}
                          </div>
                          <div className="text-slate-400 text-xs">
                            {tbtVerdict.label} · {tbtVerdict.detail}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                          <div className="text-[11px] text-slate-400 font-mono">
                            Stability
                          </div>
                          <div className="text-white font-bold">
                            {metrics.cls || "-"}
                          </div>
                          <div className="text-slate-400 text-xs">
                            {clsVerdict.label} · {clsVerdict.detail}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={downloadPDF}
                      disabled={pdfLoading}
                      className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 rounded-lg bg-white text-black font-bold hover:bg-slate-200 transition-colors shadow-lg shadow-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      {pdfLoading ? "Building PDF..." : "Download PDF Report"}
                    </button>
                  </div>

                  {/* THE GATE */}
                  {shouldGate && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-md p-5 shadow-[0_0_40px_-18px_rgba(6,182,212,0.45)]">
                        <h3 className="text-xl text-white font-bold mb-2">
                          Detailed Report Locked
                        </h3>
                        <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                          Your site has critical performance issues. Unlock the
                          full PDF fix plan (plain English + metrics).
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="email"
                            inputMode="email"
                            placeholder="Enter email to unlock"
                            className="flex-1 px-4 py-3 rounded-lg bg-slate-800/80 border border-slate-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                          <button
                            onClick={handleUnlock}
                            className="px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap"
                          >
                            Unlock
                          </button>
                        </div>
                        {emailError && (
                          <p className="text-red-400 text-xs mt-2">
                            {emailError}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
