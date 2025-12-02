import { useState, useEffect, useRef } from "react";

export function Speedometer() {
  const [speed, setSpeed] = useState(0);
  const maxSpeed = 100;
  const targetSpeed = 95;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const [isWobbling, setIsWobbling] = useState(false);

  useEffect(() => {
    const startAnimation = () => {
      const durationMs = 2000;
      const startTime = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        // Ease out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(easeOut * targetSpeed);
        setSpeed(value);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setIsWobbling(true);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Trigger when element is roughly in the middle of the viewport
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          startAnimation();
        }
      },
      { threshold: 0.6, rootMargin: "-10% 0px -10% 0px" },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
      observer.disconnect();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Map 0-100 to -90 to 90 degrees
  // Add wobble if animation is done
  const wobble = isWobbling ? Math.sin(Date.now() / 100) * 2 : 0;
  const rotation = -90 + (speed / maxSpeed) * 180 + wobble;

  // Force re-render for wobble
  useEffect(() => {
    if (isWobbling) {
      const interval = setInterval(() => {
        setSpeed((s) => s); // Trigger re-render
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isWobbling]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center gap-6"
    >
      <div className="relative w-64 h-64 md:w-80 md:h-80">
        {/* Realistic Gauge SVG */}
        <svg
          viewBox="0 0 200 120"
          className="w-full h-full overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter
              id="gauge-shadow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3" />
            </filter>
            <linearGradient id="needle-gradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>

          {/* Gauge Background Arc (Gray) */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#1e293b"
            strokeWidth="16"
            strokeLinecap="round"
            className="dark:stroke-slate-800"
          />

          {/* Colored Arcs */}
          {/* Red: 0-50 */}
          <path
            d="M 20 100 A 80 80 0 0 1 100 20"
            fill="none"
            stroke="#ef4444"
            strokeWidth="12"
            strokeLinecap="butt"
            className="opacity-80"
          />
          {/* Orange: 50-90 */}
          <path
            d="M 100 20 A 80 80 0 0 1 176.08 75.28"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="12"
            strokeLinecap="butt"
            className="opacity-80"
          />
          {/* Green: 90-100 */}
          <path
            d="M 176.08 75.28 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#10b981"
            strokeWidth="12"
            strokeLinecap="butt"
            className="opacity-80"
          />

          {/* Tick Marks */}
          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tick) => {
            // Map 0-100 to 180-360 degrees for trig calculations (Left -> Top -> Right)
            const angle = 180 + (tick / 100) * 180;
            const isMajor = tick % 20 === 0;
            const innerR = isMajor ? 65 : 70;
            const outerR = 78;

            const startX = 100 + innerR * Math.cos((angle * Math.PI) / 180);
            const startY = 100 + innerR * Math.sin((angle * Math.PI) / 180);
            const endX = 100 + outerR * Math.cos((angle * Math.PI) / 180);
            const endY = 100 + outerR * Math.sin((angle * Math.PI) / 180);

            return (
              <g key={tick}>
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="currentColor"
                  strokeWidth={isMajor ? 2 : 1}
                  className="text-slate-400 dark:text-slate-600"
                />
                {isMajor && (
                  <text
                    x={100 + 50 * Math.cos((angle * Math.PI) / 180)}
                    y={100 + 50 * Math.sin((angle * Math.PI) / 180)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[8px] font-mono fill-slate-500 dark:fill-slate-400 font-bold"
                  >
                    {tick}
                  </text>
                )}
              </g>
            );
          })}

          {/* Needle */}
          <g
            transform={`rotate(${rotation} 100 100)`}
            style={{
              transition: isWobbling ? "none" : "transform 0.1s ease-out",
            }}
          >
            {/* Needle Shadow */}
            <path
              d="M 100 100 L 95 100 L 100 25 L 105 100 Z"
              fill="black"
              opacity="0.2"
              transform="translate(2, 2)"
            />
            {/* Needle Body */}
            <path
              d="M 100 100 L 96 100 L 100 25 L 104 100 Z"
              fill="#ef4444"
              filter="url(#gauge-shadow)"
            />
            <circle
              cx="100"
              cy="100"
              r="6"
              fill="#1e293b"
              stroke="#ef4444"
              strokeWidth="2"
            />
          </g>
        </svg>

        {/* Digital Readout */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-8">
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 px-4 py-2 rounded-lg shadow-xl">
            <div className="text-3xl font-black font-mono text-white tracking-wider">
              {speed}
            </div>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-2">
            Average Performance
          </div>
        </div>
      </div>
    </div>
  );
}
