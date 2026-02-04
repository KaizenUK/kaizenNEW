import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Define the metrics type for comprehensive reporting
type MetricsState = {
  lcp: string;
  cls: string;
  tbt: string;
  fcp: string;
  si: string;
  tti: string;
  // Raw values for calculations
  lcpValue: number;
  clsValue: number;
  tbtValue: number;
  fcpValue: number;
  siValue: number;
  // Opportunities and diagnostics from PageSpeed
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    savings: string;
    score: number;
  }>;
  diagnostics: Array<{
    id: string;
    title: string;
    description: string;
  }>;
};

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
// FIX: Changed from VITE_SUPABASE_KEY to VITE_SUPABASE_ANON_KEY to match your .env
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ""; 

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
export default function SpeedScanner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState("");
  const [metrics, setMetrics] = useState<MetricsState>({
    lcp: "",
    cls: "",
    tbt: "",
    fcp: "",
    si: "",
    tti: "",
    lcpValue: 0,
    clsValue: 0,
    tbtValue: 0,
    fcpValue: 0,
    siValue: 0,
    opportunities: [],
    diagnostics: [],
  });

  // Gate State
  const [email, setEmail] = useState("");
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // --- CONFIGURATION ---
  // Safe to expose because you restricted it to kaizenweb.co.uk in Google Cloud
  const API_KEY = "AIzaSyDSXGxDMpnliJGpRpPzahrrTSpFvaCApXc";

  // Placeholder for logo (optional - paste Base64 string here if you want it)
  const LOGO_BASE64 = "";

  // --- HELPER: Fix URL Format ---
  const buildAuditUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    // If they typed "google.com", automatically make it "https://google.com"
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  // --- MAIN FUNCTION: Run the Audit ---
  async function runAudit() {
    const auditUrl = buildAuditUrl(url);
    if (!auditUrl) return;

    setLoading(true);
    setScore(null);
    setScreenshot("");
    setMetrics({ lcp: "", cls: "", tbt: "", fcp: "", si: "", tti: "", lcpValue: 0, clsValue: 0, tbtValue: 0, fcpValue: 0, siValue: 0, opportunities: [], diagnostics: [] });
    setStatusMsg("Connecting to Google Lighthouse...");
    setIsEmailSubmitted(false);
    setEmailError("");
    setEmail("");

    try {
      // UX Fakes: Show progress steps to build anticipation
      setTimeout(() => setStatusMsg("Measuring Load Speeds..."), 1000);
      setTimeout(() => setStatusMsg("Analysing Stability..."), 2000);
      setTimeout(() => setStatusMsg("Generating Fix Plan..."), 3500);

      // 1. CALL GOOGLE DIRECTLY (Client-Side)
      // This bypasses the need for a backend server
      const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(auditUrl)}&category=PERFORMANCE&strategy=MOBILE&key=${API_KEY}`;

      const res = await fetch(endpoint);
      const data = await res.json();

      // 2. Handle Errors
      if (data.error) {
        throw new Error(data.error.message || "Google API Error");
      }
      if (!res.ok) {
        throw new Error(`Scan failed: ${res.statusText}`);
      }

      // 3. Extract Data
      const audits = data.lighthouseResult.audits;
      const lighthouseScore =
        data.lighthouseResult.categories.performance.score * 100;
      setScore(Math.round(lighthouseScore));

      // Core Web Vitals
      const lcpAudit = audits["largest-contentful-paint"];
      const clsAudit = audits["cumulative-layout-shift"];
      const tbtAudit = audits["total-blocking-time"];
      const fcpAudit = audits["first-contentful-paint"];
      const siAudit = audits["speed-index"];
      const ttiAudit = audits["interactive"];

      // Extract opportunities (things that can be fixed)
      const opportunityIds = [
        "render-blocking-resources",
        "unused-javascript",
        "unused-css-rules",
        "offscreen-images",
        "unminified-javascript",
        "unminified-css",
        "uses-optimized-images",
        "uses-webp-images",
        "uses-text-compression",
        "uses-responsive-images",
        "efficient-animated-content",
        "duplicated-javascript",
        "legacy-javascript",
        "total-byte-weight",
        "dom-size",
        "critical-request-chains",
        "redirects",
        "uses-rel-preconnect",
        "server-response-time",
        "mainthread-work-breakdown",
        "bootup-time",
        "font-display",
        "third-party-summary",
      ];

      const opportunities = opportunityIds
        .map((id) => {
          const audit = audits[id];
          if (!audit || audit.score === 1 || audit.score === null) return null;
          return {
            id,
            title: audit.title || id,
            description: audit.description || "",
            savings: audit.displayValue || "",
            score: audit.score || 0,
          };
        })
        .filter(Boolean) as MetricsState["opportunities"];

      // Extract diagnostics
      const diagnosticIds = [
        "layout-shifts",
        "long-tasks",
        "non-composited-animations",
        "unsized-images",
        "lcp-element",
        "largest-contentful-paint-element",
      ];

      const diagnostics = diagnosticIds
        .map((id) => {
          const audit = audits[id];
          if (!audit) return null;
          return {
            id,
            title: audit.title || id,
            description: audit.description || "",
          };
        })
        .filter(Boolean) as MetricsState["diagnostics"];

      setMetrics({
        lcp: lcpAudit?.displayValue ?? "-",
        cls: clsAudit?.displayValue ?? "-",
        tbt: tbtAudit?.displayValue ?? "-",
        fcp: fcpAudit?.displayValue ?? "-",
        si: siAudit?.displayValue ?? "-",
        tti: ttiAudit?.displayValue ?? "-",
        lcpValue: lcpAudit?.numericValue ? lcpAudit.numericValue / 1000 : 0,
        clsValue: clsAudit?.numericValue ?? 0,
        tbtValue: tbtAudit?.numericValue ?? 0,
        fcpValue: fcpAudit?.numericValue ? fcpAudit.numericValue / 1000 : 0,
        siValue: siAudit?.numericValue ? siAudit.numericValue / 1000 : 0,
        opportunities,
        diagnostics,
      });

      const base64Image = audits["final-screenshot"]?.details?.data;
      setScreenshot(base64Image || "");

      setLoading(false);
      setStatusMsg(""); // Clear status
    } catch (err: any) {
      console.error("SpeedScanner error:", err);
      setStatusMsg(`Error: ${err.message || "Could not scan URL"}`);
      setLoading(false);
    }
  }

async function handleUnlock() {
console.log("⚠️ KAIZEN SCANNER V2 - UPDATED CODE LOADED"); // Add this line
  const normalizedEmail = email.trim();

    // 1. Validation
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setStatusMsg("Saving results...");

    // 2. Save to Supabase (Client-Side)
    if (supabase) {
      try {
        // FIX 1: Table name changed from 'leads' to 'speed_scanner_submissions'
        const { error } = await supabase.from("speed_scanner_submissions").insert([
          {
            email: normalizedEmail,
            // FIX 2: Mapped 'url' to 'website_url' (to match your DB column)
            website_url: url || null,
            // FIX 3: Mapped 'score' to 'performance_score' (to match your DB column)
            performance_score: score, 
            // FIX 4: Removed 'lcp' because your table doesn't have that column
            // created_at is handled automatically by Supabase
          },
        ]);

        if (error) {
          console.error("Supabase Error:", error.message);
        } else {
          console.log("Saved successfully!");
        }
      } catch (err) {
        console.error("Save failed:", err);
      }
    } else {
      console.warn("Supabase not connected. Check .env keys.");
    }

    // 3. Success - Unlock the view regardless of save status
    setIsEmailSubmitted(true);
    setStatusMsg("Success! Report Unlocked.");
    setEmailError("");
  }

  // --- PDF GENERATION (Dynamic Import to fix Build Error) ---
  async function downloadPDF() {
    setPdfLoading(true);
    try {
      // Dynamically load jsPDF so it doesn't break the build
      const { jsPDF } = await import("jspdf");

      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const navy = [2, 6, 23];
      const cyan = [6, 182, 212];
      const green = [74, 222, 128];
      const red = [239, 68, 68];
      const orange = [249, 115, 22];
      const white = [255, 255, 255];
      const lightGrey = [248, 250, 252];

      // Parse values for logic
      const lcpVal = parseFloat(metrics.lcp.replace(/[^\d.-]/g, ""));
      const tbtVal = parseFloat(metrics.tbt.replace(/[^\d.-]/g, ""));
      const clsVal = parseFloat(metrics.cls.replace(/[^\d.-]/g, ""));

      // PAGE 1: COVER
      doc.setFillColor(navy[0], navy[1], navy[2]);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      // Brand
      if (LOGO_BASE64) {
        try {
          doc.addImage(LOGO_BASE64, "PNG", 20, 20, 40, 40);
        } catch (e) {
          doc.setTextColor(cyan[0], cyan[1], cyan[2]);
          doc.setFontSize(30);
          doc.setFont("helvetica", "bold");
          doc.text("KAIZEN", 20, 40);
        }
      } else {
        doc.setTextColor(cyan[0], cyan[1], cyan[2]);
        doc.setFontSize(30);
        doc.setFont("helvetica", "bold");
        doc.text("KAIZEN", 20, 40);
      }

      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("PERFORMANCE AUDIT REPORT", 20, 70);

      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(url || "Website Audit", 20, 80);

      // Score Circle
      const scoreColor =
        score && score < 50 ? red : score && score < 90 ? orange : green;
      doc.setDrawColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.setLineWidth(3);
      doc.circle(150, 50, 20, "S");

      doc.setFontSize(20);
      doc.setTextColor(white[0], white[1], white[2]);
      doc.text(`${score}`, 144, 53);

      // Screenshot Phone Frame
      if (screenshot) {
        const phoneX = pageWidth / 2 - 40;
        const phoneY = 110;
        const phoneW = 80;
        const phoneH = 140;

        doc.setFillColor(20, 20, 20);
        doc.roundedRect(
          phoneX - 3,
          phoneY - 3,
          phoneW + 6,
          phoneH + 6,
          6,
          6,
          "F",
        );

        const imageFormat = screenshot.startsWith("data:image/png")
          ? "PNG"
          : "JPEG";
        doc.addImage(screenshot, imageFormat, phoneX, phoneY, phoneW, phoneH);
      }

      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 280);
      doc.text("kaizenweb.co.uk", 160, 280);

      // PAGE 2: ANALYSIS
      doc.addPage();
      doc.setFillColor(navy[0], navy[1], navy[2]);
      doc.rect(0, 0, pageWidth, 30, "F");

      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Detailed Analysis", 20, 20);

      let yPos = 50;

      // Analysis Helper
      const drawInsight = (
        title: string,
        valStr: string,
        valNum: number,
        meaning: string,
        fixes: string[],
      ) => {
        let statusColor = green;
        let statusText = "GOOD";

        // Traffic Light Logic
        if (title.includes("LCP")) {
          if (valNum > 4) {
            statusColor = red;
            statusText = "CRITICAL";
          } else if (valNum > 2.5) {
            statusColor = orange;
            statusText = "NEEDS WORK";
          }
        } else if (title.includes("CLS")) {
          if (valNum > 0.25) {
            statusColor = red;
            statusText = "CRITICAL";
          } else if (valNum > 0.1) {
            statusColor = orange;
            statusText = "NEEDS WORK";
          }
        } else {
          // TBT
          if (valNum > 600) {
            statusColor = red;
            statusText = "CRITICAL";
          } else if (valNum > 200) {
            statusColor = orange;
            statusText = "NEEDS WORK";
          }
        }

        // Card UI
        doc.setFillColor(lightGrey[0], lightGrey[1], lightGrey[2]);
        doc.roundedRect(15, yPos, pageWidth - 30, 60, 3, 3, "F");
        doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.rect(15, yPos, 2, 60, "F");

        // Content
        doc.setFontSize(14);
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFont("helvetica", "bold");
        doc.text(title, 25, yPos + 10);

        doc.setFontSize(24);
        doc.text(valStr, 25, yPos + 25);

        doc.setFontSize(10);
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.text(statusText, 25, yPos + 32);

        // Explainer
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.setFont("helvetica", "bold");
        doc.text("WHAT IT MEANS:", 80, yPos + 10);
        doc.setFont("helvetica", "normal");
        doc.text(meaning, 80, yPos + 16, { maxWidth: 100 });

        // Fixes
        doc.setFont("helvetica", "bold");
        doc.text("HOW TO FIX:", 80, yPos + 32);
        doc.setFont("helvetica", "normal");
        let fixY = yPos + 38;
        fixes.forEach((fix) => {
          doc.text(`• ${fix}`, 80, fixY);
          fixY += 5;
        });

        yPos += 70;
      };

      // Call Helper for 3 metrics
      drawInsight(
        "Load Speed (LCP)",
        metrics.lcp,
        lcpVal,
        "The time it takes for the largest content to appear. Users leave if this > 3s.",
        lcpVal > 2.5
          ? [
              "Convert images to WebP.",
              "Preload the 'Hero' image.",
              "Check hosting speed.",
            ]
          : ["Keep images optimised."],
      );

      drawInsight(
        "Responsiveness (TBT)",
        metrics.tbt,
        tbtVal,
        "How long the browser is 'frozen' while loading code.",
        tbtVal > 200
          ? ["Remove unused JavaScript.", "Defer chat widgets."]
          : ["Maintain low JS payload."],
      );

      drawInsight(
        "Visual Stability (CLS)",
        metrics.cls,
        clsVal,
        "Measures if content jumps around while loading.",
        clsVal > 0.1
          ? ["Add width/height to images.", "Reserve space for ads."]
          : ["Ensure all media has dimensions."],
      );

      // PAGE 3: ACTION PLAN
      doc.addPage();
      doc.setFillColor(navy[0], navy[1], navy[2]);
      doc.rect(0, 0, pageWidth, 30, "F");

      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Your Immediate Action Plan", 20, 20);

      yPos = 50;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(
        "Based on your score, we recommend the following sprint plan:",
        20,
        yPos,
      );
      yPos += 15;

      const drawCheckbox = (text: string) => {
        doc.setDrawColor(200, 200, 200);
        doc.rect(20, yPos, 6, 6);
        doc.setTextColor(50, 50, 50);
        doc.text(text, 35, yPos + 4);
        yPos += 12;
      };

      drawCheckbox("Optimise and compress all images (WebP)");
      drawCheckbox("Minify CSS and JavaScript files");
      drawCheckbox("Configure server-side caching");
      drawCheckbox("Audit third-party plugins/scripts");
      drawCheckbox("Implement 'Lazy Loading' for off-screen media");

      yPos += 30;

      // CTA Box
      doc.setFillColor(navy[0], navy[1], navy[2]);
      doc.roundedRect(20, yPos, pageWidth - 40, 50, 4, 4, "F");

      doc.setTextColor(cyan[0], cyan[1], cyan[2]);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Need a hand with this?", 30, yPos + 15);

      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(
        "We specialise in fixing these exact issues for high-performance brands.",
        30,
        yPos + 25,
      );
      doc.text(
        "Book a 15-minute discovery call to discuss a fixed-price fix.",
        30,
        yPos + 32,
      );

      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("Or email this PDF to sales@kaizenweb.co.uk", 30, yPos + 42);

      // Button
      const btnX = 140;
      const btnY = yPos + 15;
      const btnW = 40;
      const btnH = 12;

      doc.setFillColor(green[0], green[1], green[2]);
      doc.roundedRect(btnX, btnY, btnW, btnH, 2, 2, "F");

      doc.setTextColor(navy[0], navy[1], navy[2]);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");

      const text = "BOOK CALL";
      const textWidth = doc.getTextWidth(text);
      doc.text(text, btnX + btnW / 2 - textWidth / 2, btnY + 7.5);

      // Link
      doc.link(btnX, btnY, btnW, btnH, {
        url: "https://kaizenweb.co.uk/contact",
      });

      doc.save("Kaizen-Performance-Audit.pdf");
    } catch (err: any) {
      console.error("PDF Error:", err);
      alert("Could not generate PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  }

  // --- JSX (The Visuals) ---
  const shouldGate = score !== null && score < 90 && !isEmailSubmitted;

  return (
    <section
      id="live-performance-scanner"
      className="relative py-16 md:py-20 bg-gray-950 text-white overflow-hidden"
    >
      {/* Background Ambience */}
      <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_10%_10%,rgba(6,182,212,0.12),transparent_55%),radial-gradient(circle_at_90%_90%,rgba(59,130,246,0.10),transparent_60%)]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="w-full max-w-4xl mx-auto p-8 rounded-3xl border border-cyan-500/20 bg-slate-900/60 backdrop-blur-xl shadow-[0_0_50px_-15px_rgba(6,182,212,0.2)] relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 blur-sm" />

          <div className="text-center mb-8 relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Don&apos;t Guess. Test.
            </h2>
            <p className="text-slate-400 text-lg">
              Enter your URL. Watch the audit run in real-time.
            </p>
          </div>

          {/* INPUT AREA */}
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

          {/* STATUS TEXT */}
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

          {/* RESULTS AREA */}
          {score !== null && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-black/20 p-8 rounded-2xl border border-white/5 mt-8 relative overflow-hidden">
              {/* Screenshot */}
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

              {/* Data & Gate */}
              <div className="text-center md:text-left flex flex-col items-center md:items-start z-10 w-full">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-slate-800 bg-slate-900 relative mb-4 shadow-lg">
                  <span
                    className={`text-4xl font-black ${score < 50 ? "text-red-500" : score < 90 ? "text-orange-500" : "text-green-500"}`}
                  >
                    {score}
                  </span>
                </div>

                <div className="relative w-full">
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
                        ? "Unlock the full PDF fix plan (this is written in plain English + metrics)."
                        : "Download a polished PDF report for your records."}
                    </p>

                    {/* Metrics Grid */}
                    <div className="rounded-xl bg-black/25 border border-white/5 p-4 mb-5">
                      <div className="text-xs font-mono tracking-[0.25em] text-cyan-300 uppercase mb-3">
                        Core Web Vitals
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                        {/* Metric 1 */}
                        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                          <div className="text-[11px] text-slate-400 font-mono">
                            Load Speed
                          </div>
                          <div className="text-white font-bold">
                            {metrics.lcp || "-"}
                          </div>
                        </div>
                        {/* Metric 2 */}
                        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                          <div className="text-[11px] text-slate-400 font-mono">
                            Interactivity
                          </div>
                          <div className="text-white font-bold">
                            {metrics.tbt || "-"}
                          </div>
                        </div>
                        {/* Metric 3 */}
                        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                          <div className="text-[11px] text-slate-400 font-mono">
                            CLS
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

                  {/* The Gate Overlay */}
                  {shouldGate && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-md p-5 shadow-[0_0_40px_-18px_rgba(6,182,212,0.45)]">
                        <h3 className="text-xl text-white font-bold mb-2">
                          Detailed Report Locked
                        </h3>
                        <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                          Your site has critical performance issues. Unlock the
                          full PDF fix plan.
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
