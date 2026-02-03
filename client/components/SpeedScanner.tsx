import { useMemo, useState } from "react";

import { openCrisp } from "@/lib/crisp-utils";

export default function SpeedScanner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  // Your API Key
  const API_KEY = useMemo(() => {
    return (import.meta as any).env?.VITE_PAGESPEED_API_KEY as string | undefined;
  }, []);

  async function runAudit() {
    if (!url) return;

    setLoading(true);
    setScore(null);
    setScreenshot("");
    setStatusMsg("Connecting to Google Lighthouse...");

    try {
      // Fake stages to build tension/UX
      setTimeout(() => setStatusMsg("Analyzing Core Web Vitals..."), 1000);
      setTimeout(() => setStatusMsg("Capturing Screenshot..."), 2000);

      if (!API_KEY) {
        throw new Error("Missing API key");
      }

      const res = await fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
          url,
        )}&category=PERFORMANCE&strategy=MOBILE&key=${API_KEY}`,
      );
      const data = await res.json();

      if (data.error) throw new Error(data.error.message);

      // 1. Get Score
      const lighthouseScore =
        data.lighthouseResult.categories.performance.score * 100;
      setScore(Math.round(lighthouseScore));

      // 2. Get Screenshot (Base64 data from Google)
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

  return (
    <section
      id="live-performance-scanner"
      className="relative py-16 md:py-20 bg-gray-950 text-white overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_10%_10%,rgba(6,182,212,0.12),transparent_55%),radial-gradient(circle_at_90%_90%,rgba(59,130,246,0.10),transparent_60%)]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="w-full max-w-4xl mx-auto p-8 rounded-3xl border border-cyan-500/20 bg-slate-900/60 backdrop-blur-xl shadow-[0_0_50px_-15px_rgba(6,182,212,0.2)] relative overflow-hidden">
          {/* Background Glow Effect */}
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
            <input
              type="text"
              placeholder="https://yourcompetitor.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-6 py-4 rounded-full bg-black/40 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600"
            />
            <button
              onClick={runAudit}
              disabled={loading}
              className="px-8 py-4 rounded-full font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? "Scanning..." : "Run Audit"}
            </button>
          </div>

          {/* Loading / Status */}
          {(loading || statusMsg.startsWith("Error")) && statusMsg && (
            <div
              className={`text-center font-mono text-sm mb-4 ${
                statusMsg.startsWith("Error")
                  ? "text-red-300"
                  : "text-cyan-400 animate-pulse"
              }`}
            >
              {statusMsg}
            </div>
          )}

          {/* Result Reveal Section */}
          {score !== null && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-black/20 p-8 rounded-2xl border border-white/5 mt-8">
              {/* LEFT: The Screenshot (Phone Frame) */}
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
                {/* Glossy Reflection overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
              </div>

              {/* RIGHT: The Score & CTA */}
              <div className="text-center md:text-left flex flex-col items-center md:items-start">
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

                <h3 className="text-2xl text-white font-bold mb-2">
                  {score < 50
                    ? "Google Penalty Detected."
                    : score < 90
                      ? "Needs Improvement."
                      : "Perfect Score."}
                </h3>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                  {score < 50
                    ? "Your site failed the Core Web Vitals test. This hurts your ranking and costs you ad money."
                    : score < 90
                      ? "You are passing, but speed optimizations could double your leads."
                      : "Your site is perfectly optimized! Great work."}
                </p>

                <button
                  onClick={() => openCrisp()}
                  className="px-6 py-3 rounded-lg bg-white text-black font-bold hover:bg-slate-200 transition-colors shadow-lg shadow-white/10 w-full md:w-auto"
                >
                  Get Full Fix Report &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
