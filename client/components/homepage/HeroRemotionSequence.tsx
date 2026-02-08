import React from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

const LIGHTHOUSE_SCORE = 96;
const HIGH_PRIORITY_IMAGE_ATTRS: Record<string, string> = {
  fetchpriority: "high",
};

const LighthouseGauge: React.FC = () => {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - LIGHTHOUSE_SCORE / 100);

  return (
    <div
      className="relative w-48 h-48 md:w-56 md:h-56 mx-auto"
      style={
        {
          "--gauge-circumference": circumference,
          "--gauge-offset": offset,
        } as React.CSSProperties
      }
    >
      <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
        {/* Track */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
        />
        {/* Progress */}
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
        />
      </svg>

      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl md:text-6xl font-heading font-black text-green-400 tabular-nums">
          {LIGHTHOUSE_SCORE}
        </span>
        <span className="text-xs text-white/50 uppercase tracking-widest mt-1">
          Performance
        </span>
      </div>
    </div>
  );
};

export const HeroRemotionSequence: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section
      className="relative isolate min-h-[100vh] text-white flex items-center py-20 overflow-hidden"
    >
      {/* Hidden preload-optimized hero image for LCP */}
      <img
        src={DEFAULT_OG_IMAGE}
        alt=""
        loading="eager"
        decoding="async"
        width="1200"
        height="630"
        className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
        aria-hidden="true"
        {...HIGH_PRIORITY_IMAGE_ATTRS}
      />

      {/* Fixed mesh gradient background */}
      <div className="hero-mesh-bg absolute inset-0 -z-10">
        <div className="hero-mesh-blob hero-mesh-blob--violet" />
        <div className="hero-mesh-blob hero-mesh-blob--teal" />
        <div className="hero-mesh-blob hero-mesh-blob--gold" />
      </div>

      <div className="hero-noise absolute inset-0 -z-10" />

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20 -z-10"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="hero-grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(6, 182, 212, 0.08)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>

      <div className="hero-spotlight absolute -z-10 opacity-60" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#020617] to-transparent -z-10" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
          {/* Left: Copy */}
          <div>
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan mb-6 uppercase">
              Wirral Web Design
            </p>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-black mb-8 leading-tight text-white">
              Sites That Actually Make You Money
            </h1>

            <p className="text-lg md:text-xl text-white/85 leading-relaxed mb-10 max-w-xl">
              Slow sites lose customers. We build fast, lean websites that turn
              visitors into paying leads. Enterprise-grade. No corporate
              nonsense.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
              <button
                onClick={() => navigate("/contact")}
                className="px-8 py-4 rounded-lg bg-white text-black font-heading font-bold text-lg inline-flex items-center justify-center gap-2 transform-gpu transition-all duration-200 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] active:scale-95"
              >
                Start Your Project
                <ArrowRight size={20} />
              </button>

              <button
                onClick={() => {
                  const slider = document.getElementById(
                    "pricing-slider-section",
                  );
                  slider?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-8 py-4 rounded-lg border-2 border-white/30 text-white font-heading font-bold text-lg inline-flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 hover:border-cyan-400 hover:text-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95"
              >
                See Our Pricing
                <ArrowUpRight size={20} />
              </button>
            </div>

            {/* Social proof line */}
            <p className="text-sm text-white/50">
              Trusted by Wirral trades, small shops, e-commerce brands, and SaaS
              teams.
            </p>
          </div>

          {/* Right: Lighthouse Gauge */}
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute -inset-12 bg-green-500/10 rounded-full blur-3xl" />
              <div className="relative text-center">
                <LighthouseGauge />
                <p className="text-sm text-white/40 mt-4">
                  Our Zero Bloat Score
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
