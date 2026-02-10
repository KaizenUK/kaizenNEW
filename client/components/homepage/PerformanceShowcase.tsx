import React, { useState, useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";

import SpeedScanner from "@/components/SpeedScanner";

/**
 * Section 3: Combined Audit Tool + Core Web Vitals
 * "Test yours → now look at ours" one-two punch.
 */
export const PerformanceShowcase: React.FC = () => {
  const [count, setCount] = useState(0);
  const badgeRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        let current = 0;
        const target = 96;
        const timer = setInterval(() => {
          current += 1.5;
          if (current >= target) {
            setCount(target);
            clearInterval(timer);
          } else {
            setCount(Math.floor(current));
          }
        }, 20);
      }
    });

    if (badgeRef.current) observer.observe(badgeRef.current);
    return () => observer.disconnect();
  }, []);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - count / 100);

  return (
    <>
      {/* Audit Tool */}
      <section
        id="live-performance-scanner"
        className="py-20 md:py-28 bg-gradient-to-b from-slate-950 to-slate-900 text-white relative overflow-hidden"
      >
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
              Free Site Audit
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
              How Does Google See Your Site?
            </h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto">
              Enter your URL. Get a real-time audit of load speed, Core Web
              Vitals, and what's costing you rankings.
            </p>
          </div>

          <div>
            <SpeedScanner />
          </div>
        </div>
      </section>

      {/* Our Score — directly below */}
      <section className="py-20 md:py-32 bg-slate-50 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
              Proof, Not Promises
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-950">
              Here's How We Score.
            </h2>
          </div>

          <div className="max-w-2xl mx-auto">
            {/* Gauge */}
            <div
              ref={badgeRef}
              className="relative w-52 h-52 mx-auto mb-12"
            >
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="10"
                />
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-heading font-black text-green-600 tabular-nums">
                  {count}%
                </span>
                <span className="text-xs text-gray-500 uppercase tracking-widest mt-1">
                  Performance
                </span>
              </div>
            </div>

            {/* Core Web Vitals */}
            <div className="grid grid-cols-3 gap-4 text-center mb-12">
              {[
                { label: "LCP", value: "0.8s" },
                { label: "TBT", value: "0ms" },
                { label: "CLS", value: "0.01" },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl bg-white/50 backdrop-blur-lg border border-slate-200/50 p-6"
                >
                  <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">
                    {metric.label}
                  </p>
                  <p className="text-2xl font-heading font-bold text-gray-950">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Explanation */}
            <div className="text-center">
              <p className="text-gray-700 mb-6 leading-relaxed">
                Core Web Vitals are how Google measures whether your site is any
                good. Load speed, responsiveness, visual stability — if these
                are poor, Google pushes you down the results. We hit 96% on our
                own site. We build yours to the same standard.
              </p>
              <a
                href="https://gtmetrix.com/reports/kaizenweb.co.uk/e2VJJsxv/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-kaizen-cyan/50 text-kaizen-cyan font-heading font-bold transition-all duration-300 transform-gpu hover:scale-105 active:scale-95 hover:border-kaizen-cyan hover:bg-cyan-500/10"
              >
                View Full Report
                <ArrowUpRight size={18} />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
