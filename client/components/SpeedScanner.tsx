import { Button } from "./untitled/base/buttons/button";
import { useEffect, useState, type ReactNode } from "react";
import { scannerFindingIds } from "@/lib/scanner-report";

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

export default function SpeedScanner({
  showExample = false,
  children,
}: {
  showExample?: boolean;
  children?: ReactNode;
}) {
  const [reportUrl, setReportUrl] = useState("");
  const [testedAt, setTestedAt] = useState("");
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
  const [consentToMarketing, setConsentToMarketing] = useState(false);

  useEffect(() => {
    if (score === null) return;
    const heading = document.getElementById("scanner-result-title");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [score, isEmailSubmitted]);

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
    if (!auditUrl) {
      setStatusMsg("Error: Enter your website address to start.");
      return;
    }

    setLoading(true);
    setScore(null);
    setScreenshot("");
    setMetrics({
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
    setStatusMsg("Waiting for your speed test results...");
    setIsEmailSubmitted(false);
    setEmailError("");
    setEmail("");

    try {
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
      if (
        typeof data.lighthouseResult.categories.performance.score !==
          "number" ||
        !Number.isFinite(lighthouseScore) ||
        data.lighthouseResult.runtimeError
      ) {
        throw new Error(
          "The test could not measure this page. Please try again.",
        );
      }
      setReportUrl(auditUrl);
      setTestedAt(data.lighthouseResult.fetchTime || new Date().toISOString());

      // Core Web Vitals
      const lcpAudit = audits["largest-contentful-paint"];
      const clsAudit = audits["cumulative-layout-shift"];
      const tbtAudit = audits["total-blocking-time"];
      const fcpAudit = audits["first-contentful-paint"];
      const siAudit = audits["speed-index"];
      const ttiAudit = audits["interactive"];

      // Extract opportunities (things that can be fixed)
      const opportunityIds = scannerFindingIds;

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
      setScore(Math.round(lighthouseScore));

      setLoading(false);
      setStatusMsg(""); // Clear status
    } catch (err: any) {
      console.error("SpeedScanner error:", err);
      setStatusMsg(
        "Error: We could not test this page. Check the address and try again.",
      );
      setLoading(false);
    }
  }

  async function handleUnlock() {
    const normalizedEmail = email.trim();

    // Email format validation (must include TLD)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedEmail) {
      setEmailError("Please enter an email address.");
      return;
    }
    if (!emailRegex.test(normalizedEmail)) {
      setEmailError("Email must include a domain (e.g., name@example.co.uk).");
      return;
    }

    setStatusMsg("Saving results...");

    // 2. Save to Supabase (Client-Side)
    try {
      const { getSupabaseClient } = await import("@/lib/supabase");
      const supabase = getSupabaseClient();

      if (supabase) {
        const { error } = await supabase.from("speed_scanner_results").insert([
          {
            email: normalizedEmail,
            website_url: reportUrl || null,
            performance_score: typeof score === "number" ? score : null,
            consent_to_marketing: consentToMarketing,
          },
        ]);

        if (error) {
          console.error("Supabase Error:", error.message);
        }
      } else {
        console.warn("Supabase not connected. Check .env keys.");
      }
    } catch (err) {
      console.error("Save failed:", err);
    }

    // 3. Success - Unlock the view regardless of save status
    setIsEmailSubmitted(true);
    setStatusMsg("Your report is ready.");
    setEmailError("");
  }

  async function downloadPDF() {
    if (score === null) return;
    setPdfLoading(true);
    try {
      const { createScannerPdf } = await import("@/lib/scanner-report");
      const doc = await createScannerPdf({
        url: reportUrl,
        testedAt,
        score,
        screenshot,
        metrics,
      });
      doc.save("Kaizen-Performance-Audit.pdf");
    } catch (err) {
      console.error("PDF Error:", err);
      alert("Could not generate PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  }

  // Keep a completed report tied to the page that was actually tested.
  const shouldGate = score !== null && score < 90 && !isEmailSubmitted;
  return (
    <div
      id="live-performance-scanner"
      className={`w-full mx-auto font-body text-slate-900 ${showExample ? "" : "max-w-4xl rounded-2xl bg-white p-6 md:p-10"}`}
    >
      <div
        className={
          showExample ? "grid gap-8 lg:grid-cols-2 lg:gap-16 items-center" : ""
        }
      >
        <div>
          {children}
          {!showExample && (
            <div className="mb-6">
              <p className="marketing-eyebrow mb-3 text-slate-600 uppercase tracking-[0.2em]">
                Free speed check
              </p>
              <h2 className="font-heading text-3xl md:text-4xl mb-3">
                Check how fast your page loads.
              </h2>
              <p className="text-slate-600">
                Test one page as a phone visit. See what to check first.
              </p>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void runAudit();
            }}
            noValidate
          >
            <label
              htmlFor="scanner-url"
              className="block text-sm font-semibold mb-2"
            >
              Your website address
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="scanner-url"
                type="text"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                placeholder="yourwebsite.co.uk"
                value={url}
                disabled={loading}
                aria-describedby="scanner-steps"
                onChange={(e) =>
                  setUrl(
                    e.target.value
                      .trimStart()
                      .replace(/^https?:\/\//i, "")
                      .replace(/^\/+/, ""),
                  )
                }
                className="min-w-0 flex-1 rounded-lg border border-slate-400 bg-white px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-500 focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
              />
              <Button
                type="submit"
                isDisabled={loading}
                size="lg"
                color="primary"
              >
                {loading ? "Scanning..." : "Check my site"}
              </Button>
            </div>
            <div
              id="scanner-steps"
              className="mt-4 space-y-2 text-sm leading-relaxed text-slate-600"
            >
              <p>
                See your score first. Below 90, enter your email for the full
                report.
              </p>
              <p>
                The test and PDF are free. Download it here; it is not emailed.
                Tips by email are optional.
              </p>
            </div>
          </form>
          <div
            role="status"
            aria-live="polite"
            className="mt-4 text-sm text-slate-700"
          >
            {loading
              ? statusMsg
              : score !== null
                ? "Your speed test is ready below."
                : ""}
          </div>
          {!loading && statusMsg.startsWith("Error") && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {statusMsg}
            </p>
          )}
          <noscript>
            <p className="mt-4 text-slate-700">
              Turn on JavaScript in your browser to run the test.
            </p>
          </noscript>
        </div>
        {showExample && (
          <figure className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <figcaption className="mb-4">
              <p className="marketing-eyebrow mb-2 text-slate-600 uppercase tracking-[0.2em]">
                A real report
              </p>
              <h2 className="font-heading text-2xl text-slate-900">
                See what you will get.
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Our homepage, tested on 2 October 2026. Your result will differ.
              </p>
            </figcaption>
            <a
              href="/images/scanner/kaizen-report-2026-10-02.webp"
              className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
              aria-label="View the full-size example speed report"
            >
              <picture>
                <source
                  media="(max-width: 767px)"
                  srcSet="/images/scanner/kaizen-report-2026-10-02-mobile.webp"
                  width="600"
                  height="1309"
                />
                <img
                  src="/images/scanner/kaizen-report-2026-10-02.webp"
                  width="900"
                  height="357"
                  alt="Kaizen's homepage report: 76 out of 100, main content loads in 4.7 seconds, no blocking time or page movement in this test."
                  className="w-full h-auto rounded-lg border border-slate-200"
                />
              </picture>
              <span className="mt-3 block text-sm font-semibold text-blue-700 underline underline-offset-4">
                View the full-size example report
              </span>
            </a>
          </figure>
        )}
      </div>
      {score !== null && (
        <section
          aria-labelledby="scanner-result-title"
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8"
        >
          <div data-scanner-report className="mx-auto max-w-4xl">
            <div className="grid grid-cols-[72px_1fr] gap-5 items-start md:grid-cols-[100px_1fr] md:gap-8">
              {screenshot ? (
                <img
                  src={screenshot}
                  alt="The page captured during your phone test"
                  width="100"
                  height="217"
                  className="w-full rounded-lg border border-slate-200"
                />
              ) : (
                <div className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600">
                  No page image returned.
                </div>
              )}
              <div className="min-w-0">
                <p className="marketing-eyebrow text-slate-600 mb-2">
                  Your phone test
                </p>
                <h2
                  id="scanner-result-title"
                  tabIndex={-1}
                  className="scroll-mt-28 font-heading text-2xl md:text-3xl outline-offset-4"
                >
                  {score >= 90
                    ? "A good result in this test."
                    : "There is more to check."}
                </h2>
                <p className="mt-2 break-words text-sm text-slate-600">
                  {reportUrl}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {testedAt &&
                    new Date(testedAt).toLocaleString("en-GB", {
                      timeZone: "Europe/London",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                  (UK time)
                </p>
                <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-slate-900">
                  <strong className="text-4xl font-heading">{score}</strong>
                  <span className="text-sm">out of 100</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {score >= 90
                    ? "Good"
                    : score >= 50
                      ? "Needs improvement"
                      : "Poor"}
                </p>
              </div>
            </div>
            {!shouldGate && (
              <div className="mt-6">
                <dl className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Main content loads", metrics.lcp],
                    ["Time spent stuck", metrics.tbt],
                    ["Page movement", metrics.cls],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg bg-slate-50 border border-slate-200 p-4"
                    >
                      <dt className="text-sm text-slate-600">{label}</dt>
                      <dd className="mt-2 font-heading text-2xl text-slate-900">
                        {value || "Not available"}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  One page, at one point in time. Real visits may differ. The
                  PDF explains these figures and lists what to check.
                </p>
              </div>
            )}
          </div>
          {shouldGate ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleUnlock();
              }}
              noValidate
              className="mx-auto mt-6 max-w-4xl rounded-xl bg-slate-50 border border-slate-200 p-5 md:p-6"
            >
              <h3 className="font-heading text-2xl mb-2">
                Your full report is ready.
              </h3>
              <p className="text-sm text-slate-600 mb-5">
                Enter your email to see the results and download your PDF. Tips
                by email are optional.
              </p>
              <label
                htmlFor="scanner-email"
                className="block text-sm font-semibold mb-2"
              >
                Your email address
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="scanner-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@company.co.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={
                    emailError ? "scanner-email-error" : undefined
                  }
                  className="min-w-0 flex-1 rounded-lg bg-white border border-slate-400 px-4 py-3 text-base placeholder:text-slate-500 focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
                />
                <Button type="submit" size="lg" color="primary">
                  View my report
                </Button>
              </div>
              <label className="mt-4 flex items-start gap-3 cursor-pointer text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={consentToMarketing}
                  onChange={(e) => setConsentToMarketing(e.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-blue-700"
                />
                <span>
                  I&apos;m happy to receive occasional tips on website
                  performance from Kaizen.
                </span>
              </label>
              {emailError && (
                <p
                  id="scanner-email-error"
                  role="alert"
                  className="mt-3 text-sm text-red-700"
                >
                  {emailError}
                </p>
              )}
            </form>
          ) : (
            <div className="mx-auto mt-6 max-w-4xl">
              <Button
                onPress={downloadPDF}
                isDisabled={pdfLoading}
                size="lg"
                color="primary"
              >
                {pdfLoading ? "Building PDF..." : "Download PDF Report"}
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
