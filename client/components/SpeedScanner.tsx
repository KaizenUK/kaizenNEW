import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";

export default function SpeedScanner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [auditedUrl, setAuditedUrl] = useState("");

  // Gating State
  const [email, setEmail] = useState("");
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");

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
    setStatusMsg("Connecting to Google Lighthouse...");

    // Reset gate on new run
    setAuditedUrl(auditUrl);
    setIsEmailSubmitted(false);
    setEmailError("");
    setEmail("");

    try {
      setTimeout(() => setStatusMsg("Analyzing Core Web Vitals..."), 1000);
      setTimeout(() => setStatusMsg("Capturing Screenshot..."), 2000);

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

      // Get Screenshot
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
    // eslint-disable-next-line no-console
    console.log("Lead Captured:", normalizedEmail, "URL:", auditedUrl, "Score:", score);

    setIsEmailSubmitted(true);
    setEmailError("");
  }

  function downloadPDF() {
    if (score === null) return;

    const doc = new jsPDF();
    const date = new Date().toLocaleDateString("en-GB");

    // Header
    doc.setFillColor(2, 6, 23);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Kaizen Web - Performance Audit", 20, 25);

    // Meta
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Audit Report for: ${auditedUrl || buildAuditUrl(url)}`, 20, 55);
    doc.text(`Date: ${date}`, 20, 63);

    // Score
    doc.setFontSize(32);
    if (score < 50) doc.setTextColor(239, 68, 68);
    else if (score < 90) doc.setTextColor(249, 115, 22);
    else doc.setTextColor(34, 197, 94);

    doc.text(`Score: ${score}/100`, 20, 82);

    // Screenshot
    if (screenshot) {
      const imageFormat = screenshot.startsWith("data:image/png")
        ? "PNG"
        : "JPEG";
      doc.addImage(screenshot, imageFormat as any, 20, 92, 80, 110);
    }

    // Recommendations
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text("Immediate Fix Plan:", 110, 98);

    doc.setFontSize(10);
    const fixes = [
      "1. Optimize Images (modern formats + compression)",
      "2. Minimize Main-Thread Work",
      "3. Eliminate Render-Blocking CSS",
      "4. Reduce JavaScript Execution Time",
      "5. Improve caching for static assets",
    ];

    let yPos = 108;
    fixes.forEach((fix) => {
      doc.text(fix, 110, yPos);
      yPos += 8;
    });

    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(
      "Contact Kaizen Web for a full technical breakdown.",
      110,
      yPos + 12,
    );

    doc.save("kaizen-performance-report.pdf");
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
              {/* SCREENSHOT (Always visible) */}
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
                {/* Score Always Visible */}
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
                      {score < 90 ? "Report Unlocked." : "Excellent Score!"}
                    </h3>
                    <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                      {score < 90
                        ? "Download your PDF fix plan below."
                        : "Your site is perfectly optimized. Download the proof for your records."}
                    </p>

                    <div className="rounded-xl bg-black/25 border border-white/5 p-4 mb-5">
                      <div className="text-xs font-mono tracking-[0.25em] text-cyan-300 uppercase mb-3">
                        High Impact Fixes
                      </div>
                      <ul className="text-slate-300/90 text-sm space-y-2">
                        <li>1. Optimize images (size + format + compression)</li>
                        <li>2. Cut unused JavaScript</li>
                        <li>3. Remove render-blocking CSS</li>
                        <li>4. Improve caching + CDN delivery</li>
                      </ul>
                    </div>

                    <button
                      onClick={downloadPDF}
                      className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 rounded-lg bg-white text-black font-bold hover:bg-slate-200 transition-colors shadow-lg shadow-white/10"
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
                      Download PDF Report
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
                          full PDF breakdown to see how to fix them.
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
