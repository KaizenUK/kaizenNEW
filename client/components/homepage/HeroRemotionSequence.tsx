import React, { useState, useRef } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { openCrisp } from "@/lib/crisp-utils";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

/**
 * Hero Section - optimized for performance with CSS animations
 */
export const HeroRemotionSequence: React.FC = () => {
  const [spotlightPos, setSpotlightPos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSpotlightPos({ x, y });
  };

  return (
    <section
      ref={heroRef}
      onMouseMove={handleMouseMove}
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
      />

      {/* Fixed mesh gradient background */}
      <div className="hero-mesh-bg absolute inset-0 -z-10">
        <div className="hero-mesh-blob hero-mesh-blob--violet" />
        <div className="hero-mesh-blob hero-mesh-blob--teal" />
        <div className="hero-mesh-blob hero-mesh-blob--gold" />
      </div>

      {/* Noise texture overlay */}
      <div className="hero-noise absolute inset-0 -z-10" />

      {/* Grid pattern */}
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

      {/* Cursor spotlight effect */}
      <div
        className="hero-spotlight absolute -z-10 opacity-60"
        style={{
          width: "600px",
          height: "600px",
          left: `${spotlightPos.x - 300}px`,
          top: `${spotlightPos.y - 300}px`,
          background: `radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(124, 58, 237, 0.08) 50%, transparent 100%)`,
          transform: "translate3d(0, 0, 0)",
        }}
      />

      {/* Fade to base color at bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#020617] to-transparent -z-10" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan mb-6 uppercase hero-reveal"
            style={{ "--delay": "0s" } as React.CSSProperties}
          >
            Wirral Web Design
          </p>

          <h1
            className="text-5xl md:text-7xl font-heading font-black mb-8 leading-tight hero-reveal text-white"
            style={{ "--delay": "0s" } as React.CSSProperties}
          >
            Web Design Wirral:
            <br />
            Lean, Fast, &amp; Profitable Websites
          </h1>

          <p
            className="text-lg md:text-xl text-white/85 leading-relaxed mb-12 max-w-3xl mx-auto hero-reveal"
            style={{ "--delay": "0.2s" } as React.CSSProperties}
          >
            Stop losing customers to slow loading times. We build streamlined
            sites designed to convert traffic into leads.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 hero-reveal"
            style={{ "--delay": "0.4s" } as React.CSSProperties}
          >
            <button
              onClick={() => openCrisp()}
              className="px-8 py-4 rounded-lg bg-white text-black font-heading font-bold text-lg inline-flex items-center justify-center gap-2 transform-gpu transition-all duration-200 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] active:scale-95"
            >
              Get in Touch
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
        </div>
      </div>
    </section>
  );
};
