import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";

type MetricsState = {
  lcp: string;
  cls: string;
  tbt: string;
};

export default function SpeedScanner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState("");
  const [metrics, setMetrics] = useState<MetricsState>({
    lcp: "",
    cls: "",
    tbt: "",
  });

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
    setMetrics({ lcp: "", cls: "", tbt: "" });
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

      const lcpAudit = data.lighthouseResult.audits["largest-contentful-paint"];
      const clsAudit = data.lighthouseResult.audits["cumulative-layout-shift"];
      const tbtAudit = data.lighthouseResult.audits["total-blocking-time"];

      setMetrics({
        lcp: lcpAudit?.displayValue ?? "",
        cls: clsAudit?.displayValue ?? "",
        tbt: tbtAudit?.displayValue ?? "",
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

    // TODO: Send this email to Zapier/DB later
    setIsEmailSubmitted(true);
    setEmailError("");
  }

  // --- THE NEW "DESIGNER GRADE" PDF GENERATOR ---
  async function downloadPDF() {
    if (score === null) return;
    setPdfLoading(true);

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // COLORS
      const navy = [2, 6, 23];
      const cyan = [6, 182, 212];
      const white = [255, 255, 255];
      const lightGrey = [241, 245, 249];
      const red = [239, 68, 68];
      const orange = [249, 115, 22];
      const green = [34, 197, 94];

      // PARSE METRICS
      const lcpVal = parseFloat(metrics.lcp.replace(/[^\d.-]/g, ""));
      const tbtVal = parseFloat(metrics.tbt.replace(/[^\d.-]/g, ""));
      const clsVal = parseFloat(metrics.cls.replace(/[^\d.-]/g, ""));

      // --- LEFT SIDEBAR (The "Brand" Column) ---
      doc.setFillColor(navy[0], navy[1], navy[2]);
      doc.rect(0, 0, 70, height, "F");

      // Branding
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("KAIZEN", 10, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("WEB AUDIT", 10, 26);

      // Big Score in Sidebar
      doc.setFontSize(12);
      doc.text("OVERALL SCORE", 10, 60);

      doc.setFontSize(60);
      doc.setFont("helvetica", "bold");
      if (score < 50) doc.setTextColor(red[0], red[1], red[2]);
      else if (score < 90) doc.setTextColor(orange[0], orange[1], orange[2]);
      else doc.setTextColor(green[0], green[1], green[2]);
      doc.text(`${score}`, 10, 82);

      // Screenshot in Sidebar (Phone Frame)
      if (screenshot) {
        const phoneX = 10;
        const phoneY = 110;
        const phoneW = 50;
        const phoneH = 90;

        // Draw Phone Bezel
        doc.setDrawColor(50, 50, 50);
        doc.setLineWidth(1);
        doc.roundedRect(
          phoneX - 2,
          phoneY - 2,
          phoneW + 4,
          phoneH + 4,
          3,
          3,
          "S",
        ); // Outer
        doc.setFillColor(0, 0, 0);
        doc.roundedRect(
          phoneX - 1,
          phoneY - 1,
          phoneW + 2,
          phoneH + 2,
          2,
          2,
          "F",
        ); // Black bezel

        // Image
        const imageFormat = screenshot.startsWith("data:image/png")
          ? "PNG"
          : "JPEG";
        doc.addImage(screenshot, imageFormat as any, phoneX, phoneY, phoneW, phoneH);
      }

      // Footer Sidebar
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.text("Audit Date:", 10, 260);
      doc.setTextColor(white[0], white[1], white[2]);
      doc.text(new Date().toLocaleDateString("en-GB"), 10, 265);

      // --- RIGHT CONTENT (The "Report" Column) ---
      const leftMargin = 80;
      const contentWidth = 110;

      // Header Info
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      doc.text("AUDIT REPORT FOR:", leftMargin, 20);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(auditedUrl || buildAuditUrl(url) || "URL Not Provided", leftMargin, 28);

      // LINE DIVIDER
      doc.setDrawColor(200, 200, 200);
      doc.line(leftMargin, 35, 200, 35);

      // --- SECTION 1: THE METRICS (Visual Bars) ---
      let yPos = 50;

      // Helper to draw a metric card
      const drawMetric = (
        label: string,
        valueStr: string,
        valueNum: number,
        target: number,
        unit: string,
        desc: string,
      ) => {
        // Background Card
        doc.setFillColor(lightGrey[0], lightGrey[1], lightGrey[2]);
        doc.roundedRect(leftMargin, yPos, contentWidth, 35, 2, 2, "F");

        // Label
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text(label, leftMargin + 5, yPos + 8);

        // Value
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(valueStr, leftMargin + 5, yPos + 16);

        // Progress Bar Background
        doc.setFillColor(220, 220, 220);
        doc.rect(leftMargin + 5, yPos + 22, 60, 4, "F");

        // Progress Bar Fill (Logic)
        let percent = 0;
        let color = green;

        // Logic for "Lower is Better" metrics
        if (label.includes("SPEED")) {
          // LCP
          percent = Math.min(100, (target / valueNum) * 100);
          if (valueNum > 4) color = red;
          else if (valueNum > 2.5) color = orange;
        } else if (label.includes("STABILITY")) {
          // CLS
          percent = Math.min(100, (1 - valueNum) * 100); // 0.1 is good
          if (valueNum > 0.25) color = red;
          else if (valueNum > 0.1) color = orange;
        } else {
          // TBT
          percent = Math.min(100, (target / valueNum) * 100);
          if (valueNum > 600) color = red;
          else if (valueNum > 200) color = orange;
        }

        // Safety for weird values
        if (percent < 5) percent = 5;
        if (isNaN(percent)) percent = 100;

        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(leftMargin + 5, yPos + 22, 60 * (percent / 100), 4, "F");

        // Description
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(desc, leftMargin + 5, yPos + 31);

        yPos += 40;
      };

      // Draw the 3 metrics
      drawMetric(
        "LOAD SPEED (LCP)",
        metrics.lcp,
        lcpVal,
        2.5,
        "s",
        "Time until the main content is visible.",
      );
      drawMetric(
        "INTERACTIVITY (TBT)",
        metrics.tbt,
        tbtVal,
        200,
        "ms",
        "Time the browser is blocked by code.",
      );
      drawMetric(
        "VISUAL STABILITY (CLS)",
        metrics.cls,
        clsVal,
        0.1,
        "",
        "How much the layout shifts while loading.",
      );

      // --- SECTION 2: DYNAMIC ACTION PLAN ---
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("IMMEDIATE FIX PLAN", leftMargin, yPos + 5);

      yPos += 15;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);

      // Logic: What to say?
      const bullets: string[] = [];

      // LCP Advice
      if (lcpVal > 2.5) {
        bullets.push(
          "• Your Hero Image is too slow. Convert to WebP & Preload it.",
        );
        bullets.push("• Your server response time is lagging. Check hosting.");
      } else {
        bullets.push("• Load speed is good. Keep images compressed.");
      }

      // TBT Advice
      if (tbtVal > 200) {
        bullets.push("• Remove unused JavaScript (e.g. old chat widgets).");
        bullets.push("• Defer third-party scripts to run after load.");
      }

      // CLS Advice
      if (clsVal > 0.1) {
        bullets.push("• Add explicit width/height to all images.");
        bullets.push("• Reserve space for dynamic ads/banners.");
      }

      // Generic filler if they pass everything
      if (bullets.length < 3) {
        bullets.push("• Set up caching for static assets.");
      }

      // Print Bullets
      bullets.forEach((b) => {
        doc.text(b, leftMargin, yPos);
        yPos += 8;
      });

      // --- SECTION 3: CTA BOX ---
      yPos += 10;
      doc.setDrawColor(cyan[0], cyan[1], cyan[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(leftMargin, yPos, contentWidth, 30, 2, 2, "S");

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(navy[0], navy[1], navy[2]);
      doc.text("Want this fixed for you?", leftMargin + 5, yPos + 8);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(
        "Reply to our email with this PDF attached.",
        leftMargin + 5,
        yPos + 16,
      );
      doc.text("We will provide a fixed-price quote.", leftMargin + 5, yPos + 21);

      // --- COPYRIGHT FOOTER ---
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("© 2026 Kaizen Web. All rights reserved.", leftMargin, 280);
      doc.text(
        "Kaizen Web Ltd t/a Kaizen Ltd (Company No. 17007703)",
        leftMargin,
        285,
      );

      doc.save("kaizen-audit-report.pdf");
    } finally {
      setPdfLoading(false);
    }
  }

  const shouldGate = score !== null && score < 90 && !isEmailSubmitted;

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
                      {score < 90
                        ? "Consultant Report Ready"
                        : "Excellent Score!"}
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
                        </div>
                        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                          <div className="text-[11px] text-slate-400 font-mono">
                            Interactivity
                          </div>
                          <div className="text-white font-bold">
                            {metrics.tbt || "-"}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                          <div className="text-[11px] text-slate-400 font-mono">
                            Stability
                          </div>
                          <div className="text-white font-bold">
                            {metrics.cls || "-"}
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
