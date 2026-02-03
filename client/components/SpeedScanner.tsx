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

  // API Key
  const API_KEY = useMemo(() => {
    return (import.meta as any).env?.VITE_PAGESPEED_API_KEY as
      | string
      | undefined;
  }, []);

  // --- PLACEHOLDER FOR YOUR LOGO ---
  // Go to https://www.base64-image.de/, upload your logo, and paste the string here.
  // It should look like "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
  const LOGO_BASE64 = ""; // <--- PASTE YOUR LOGO STRING HERE

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
      setTimeout(() => setStatusMsg('Measuring Load Speeds...'), 1000);
      setTimeout(() => setStatusMsg('Analysing Stability...'), 2000);
      setTimeout(() => setStatusMsg('Generating Fix Plan...'), 3500);

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

  // --- THE MULTI-PAGE CONSULTANT REPORT ---
  function downloadPDF() {
    setPdfLoading(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // BRAND COLOURS
      const navy = [2, 6, 23];      // #020617 (Backgrounds)
      const cyan = [6, 182, 212];   // #06b6d4 (Primary Accent)
      const green = [74, 222, 128]; // #4ade80 (Success)
      const red = [239, 68, 68];    // Error
      const orange = [249, 115, 22]; // Warning
      const white = [255, 255, 255];
      const lightGrey = [248, 250, 252];

      // PARSE METRICS
      const lcpVal = parseFloat(metrics.lcp.replace(/[^\d.-]/g, ''));
      const tbtVal = parseFloat(metrics.tbt.replace(/[^\d.-]/g, ''));
      const clsVal = parseFloat(metrics.cls.replace(/[^\d.-]/g, ''));

      // ===========================
      // PAGE 1: THE COVER (Dark Mode)
      // ===========================
      
      // Background
      doc.setFillColor(navy[0], navy[1], navy[2]);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Logo
      if (LOGO_BASE64) {
        try {
          doc.addImage(LOGO_BASE64, 'PNG', 20, 20, 40, 40); // Adjust size as needed
        } catch (e) {
          // Fallback if logo fails
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

      // Title
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("PERFORMANCE AUDIT REPORT", 20, 70);
      
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(url || "Website Audit", 20, 80);

      // The Score Ring
      const scoreColor = (score && score < 50 ? red : score && score < 90 ? orange : green);
      doc.setDrawColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.setLineWidth(3);
      doc.circle(150, 50, 20, 'S');
      doc.setFontSize(20);
      doc.setTextColor(white[0], white[1], white[2]);
      doc.text(`${score}`, 144, 53);

      // Phone Frame with Screenshot
      if (screenshot) {
        const phoneX = (pageWidth / 2) - 40;
        const phoneY = 110;
        const phoneW = 80;
        const phoneH = 140; // Approx 16:9 ratio adjusted

        // Glow effect behind phone
        doc.setDrawColor(cyan[0], cyan[1], cyan[2]);
        doc.setLineWidth(0);
        doc.setFillColor(6, 182, 212, 0.2); // Not supported in all jsPDF versions, simulating with solid
        
        // Device Bezel
        doc.setFillColor(20, 20, 20);
        doc.roundedRect(phoneX - 3, phoneY - 3, phoneW + 6, phoneH + 6, 6, 6, 'F');
        
        // Screen
        const imageFormat = screenshot.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(screenshot, imageFormat, phoneX, phoneY, phoneW, phoneH);
      }

      // Footer
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 280);
      doc.text("kaizenweb.co.uk", 160, 280);

      // ===========================
      // PAGE 2: DEEP DIVE (White Mode)
      // ===========================
      doc.addPage();
      
      // Header
      doc.setFillColor(navy[0], navy[1], navy[2]);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Detailed Analysis", 20, 20);

      let yPos = 50;

      // --- Helper to Draw Insight Card ---
      const drawInsight = (title: string, valStr: string, valNum: number, target: number, unit: string, meaning: string, fixes: string[]) => {
         // Status Colour Logic
         let statusColor = green;
         let statusText = "GOOD";
         
         if (title.includes("LCP")) {
            if (valNum > 4) { statusColor = red; statusText = "CRITICAL"; }
            else if (valNum > 2.5) { statusColor = orange; statusText = "NEEDS WORK"; }
         } else if (title.includes("CLS")) {
            if (valNum > 0.25) { statusColor = red; statusText = "CRITICAL"; }
            else if (valNum > 0.1) { statusColor = orange; statusText = "NEEDS WORK"; }
         } else {
            if (valNum > 600) { statusColor = red; statusText = "CRITICAL"; }
            else if (valNum > 200) { statusColor = orange; statusText = "NEEDS WORK"; }
         }

         // Container
         doc.setFillColor(lightGrey[0], lightGrey[1], lightGrey[2]);
         doc.roundedRect(15, yPos, pageWidth - 30, 60, 3, 3, 'F');
         
         // Left Border (Status)
         doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
         doc.rect(15, yPos, 2, 60, 'F');

         // Title & Value
         doc.setFontSize(14);
         doc.setTextColor(navy[0], navy[1], navy[2]);
         doc.setFont("helvetica", "bold");
         doc.text(title, 25, yPos + 10);
         
         doc.setFontSize(24);
         doc.text(valStr, 25, yPos + 25);
         
         doc.setFontSize(10);
         doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
         doc.text(statusText, 25, yPos + 32);

         // Right Side: Meaning & Fixes
         doc.setFontSize(10);
         doc.setTextColor(80, 80, 80);
         doc.setFont("helvetica", "bold");
         doc.text("WHAT IT MEANS:", 80, yPos + 10);
         doc.setFont("helvetica", "normal");
         doc.text(meaning, 80, yPos + 16, { maxWidth: 100 });

         doc.setFont("helvetica", "bold");
         doc.text("HOW TO FIX:", 80, yPos + 32);
         doc.setFont("helvetica", "normal");
         
         let fixY = yPos + 38;
         fixes.forEach(fix => {
           doc.text(`• ${fix}`, 80, fixY);
           fixY += 5;
         });

         yPos += 70; // Move down for next card
      };

      // --- 1. LCP (Speed) ---
      const lcpFixes = lcpVal > 2.5 
        ? ["Convert images to WebP format.", "Preload the 'Hero' image.", "Upgrade server/hosting plan."] 
        : ["Keep images optimised.", "Monitor server response times."];
      
      drawInsight(
        "Load Speed (LCP)", 
        metrics.lcp, 
        lcpVal, 
        2.5, "s", 
        "The time it takes for the largest content (image or text) to appear. Users leave if this > 3s.", 
        lcpFixes
      );

      // --- 2. TBT (Interactivity) ---
      const tbtFixes = tbtVal > 200 
        ? ["Remove unused JavaScript.", "Defer chat widgets/tracking scripts.", "Code-split large bundles."] 
        : ["Maintain low JS payload.", "Avoid heavy third-party scripts."];

      drawInsight(
        "Responsiveness (TBT)", 
        metrics.tbt, 
        tbtVal, 
        200, "ms", 
        "How long the browser is 'frozen' while loading code. If high, users click but nothing happens.", 
        tbtFixes
      );

      // --- 3. CLS (Stability) ---
      const clsFixes = clsVal > 0.1 
        ? ["Add width/height to images.", "Reserve space for ads/banners.", "Use CSS aspect-ratio."] 
        : ["Ensure all media has dimensions.", "Avoid inserting content above fold."];

      drawInsight(
        "Visual Stability (CLS)", 
        metrics.cls, 
        clsVal, 
        0.1, "", 
        "Measures if content jumps around while loading. High scores frustrate users and cause mis-clicks.", 
        clsFixes
      );

      // ===========================
      // PAGE 3: ACTION PLAN
      // ===========================
      doc.addPage();
      
      // Header
      doc.setFillColor(navy[0], navy[1], navy[2]);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Your Immediate Action Plan", 20, 20);

      let yPos = 50;

      // Checklist Intro
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Based on your score, we recommend the following sprint plan:", 20, yPos);
      yPos += 15;

      // Checkboxes
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

      // CTA Box
      yPos += 30;
      doc.setFillColor(navy[0], navy[1], navy[2]); // Navy Box
      doc.roundedRect(20, yPos, pageWidth - 40, 50, 4, 4, 'F');
      
      // Left Text
      doc.setTextColor(cyan[0], cyan[1], cyan[2]);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Need a hand with this?", 30, yPos + 15);
      
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      // UPDATED COPY: Generic "High-Performance Brands"
      doc.text("We specialise in fixing these exact issues for high-performance brands.", 30, yPos + 25);
      doc.text("Book a 15-minute discovery call to discuss a fixed-price fix.", 30, yPos + 32);

      // Email Fallback
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("Or email this PDF to sales@kaizenweb.co.uk", 30, yPos + 42);

      // --- THE BUTTON (Centred & Clickable) ---
      const btnX = 140;
      const btnY = yPos + 15;
      const btnW = 40;
      const btnH = 12;

      doc.setFillColor(green[0], green[1], green[2]);
      doc.roundedRect(btnX, btnY, btnW, btnH, 2, 2, 'F');
      
      doc.setTextColor(navy[0], navy[1], navy[2]);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      
      // Centering Math: X + (ButtonWidth / 2) - (TextWidth / 2)
      const text = "BOOK CALL";
      const textWidth = doc.getTextWidth(text);
      const textX = btnX + (btnW / 2) - (textWidth / 2);
      const textY = btnY + 7.5; // Adjusted for visual centre
      
      doc.text(text, textX, textY);

      // MAKE IT CLICKABLE
      doc.link(btnX, btnY, btnW, btnH, { url: 'https://kaizenweb.co.uk/contact' });

      doc.save('Kaizen-Performance-Audit.pdf');
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
                        ? "Unlock the full PDF fix plan (this is written in plain English + metrics)."
                        : "Download a polished PDF report for your records."}
                    </p>

                    <div className="rounded-xl bg-black/25 border border-white/5 p-4 mb-5">
                      <div className="text-xs font-mono tracking-[0.25em] text-cyan-300 uppercase mb-3">
                        Core Web Vitals
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

                  {/* THE GATE */}
                  {shouldGate && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-md p-5 shadow-[0_0_40px_-18px_rgba(6,182,212,0.45)]">
                        <h3 className="text-xl text-white font-bold mb-2">
                          Detailed Report Locked
                        </h3>
                        <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                          Your site has critical performance issues. Unlock the full PDF fix plan (this is written in plain English + metrics).
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
