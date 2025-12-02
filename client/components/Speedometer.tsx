import { useState, useEffect } from "react";

export function Speedometer() {
  const [speed, setSpeed] = useState(0);
  const maxSpeed = 100;

  useEffect(() => {
    let animationFrame: number;
    const durationMs = 2000;
    const startTime = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - startTime) % durationMs;
      const progress = elapsed / durationMs; // 0 -> 1
      const value = Math.round(progress * maxSpeed);
      setSpeed(value);
      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrame);
  }, [maxSpeed]);

  const rotation = -180 + (speed / maxSpeed) * 180;

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <div className="relative w-48 h-48 md:w-64 md:h-64">
        {/* SVG Speedometer */}
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-slate-700 dark:text-slate-600"
          />

          {/* Speed zones - Green (0-50), Yellow (50-80), Red (80-100) */}
          {/* 0 starts at far left of the arc, 100 ends at far right */}
          <path
            d="M 20 100 A 80 80 0 0 1 100 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-emerald-400"
            strokeLinecap="round"
          />
          <path
            d="M 100 20 A 80 80 0 0 1 169.28 60"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-amber-400"
            strokeLinecap="round"
          />
          <path
            d="M 169.28 60 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-red-500"
            strokeLinecap="round"
          />

          {/* Tick marks */}
          {[0, 20, 40, 60, 80, 100].map((tick) => {
            const angle = (tick / 100) * 180 - 90;
            const startRadius = 75;
            const endRadius = 85;
            const startX = 100 + startRadius * Math.cos((angle * Math.PI) / 180);
            const startY = 100 + startRadius * Math.sin((angle * Math.PI) / 180);
            const endX = 100 + endRadius * Math.cos((angle * Math.PI) / 180);
            const endY = 100 + endRadius * Math.sin((angle * Math.PI) / 180);

            return (
              <g key={tick}>
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-slate-500 dark:text-slate-600"
                />
                <text
                  x={100 + 60 * Math.cos((angle * Math.PI) / 180)}
                  y={100 + 60 * Math.sin((angle * Math.PI) / 180)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs fill-slate-600 dark:fill-slate-400 font-mono"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Needle */}
          <g transform={`rotate(${rotation} 100 100)`}>
            <rect
              x="98"
              y="30"
              width="4"
              height="70"
              fill="currentColor"
              className="text-slate-900 dark:text-white"
              rx="2"
            />
            <circle
              cx="100"
              cy="100"
              r="6"
              fill="currentColor"
              className="text-slate-900 dark:text-white"
            />
          </g>

          {/* Center circle with shadow */}
          <circle
            cx="100"
            cy="100"
            r="8"
            fill="currentColor"
            className="text-slate-900 dark:text-white"
          />
        </svg>

        {/* Speed display in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-white">
              {speed}
            </div>
            <div className="text-xs md:text-sm font-mono text-slate-400">
              / 100
            </div>
          </div>
        </div>
      </div>

      <div className="text-center max-w-md">
        <p className="text-sm md:text-base text-slate-300">
          <span className="font-semibold text-cyan-400">Ready for Core Web Vitals.</span>{" "}
          Our builds regularly score <span className="font-semibold">95%+ in Lighthouse</span>, often ahead of giants like Amazon (~90) and the BBC (~88). Learn what Google cares about in
          {" "}
          <a
            href="https://developers.google.com/search/docs/appearance/core-web-vitals"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted text-cyan-300 hover:text-cyan-200"
          >
            Core Web Vitals
          </a>
          .
        </p>
      </div>
    </div>
  );
}
