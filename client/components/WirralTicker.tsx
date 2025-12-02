import { memo } from "react";

const towns = [
  "Serving Heswall",
  "West Kirby",
  "Birkenhead",
  "Wallasey",
  "Caldy",
  "Hoylake",
  "New Brighton",
  "Bromborough",
  "Bebington",
  "Neston",
  "Overchurch",
  "Woodchurch",
  "Thurstaston",
];

export const WirralTicker = memo(function WirralTicker() {
  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 py-4 border-y border-slate-800">
      {/* Gradient overlays for fade effect */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-900 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-900 to-transparent z-10" />

      <div className="relative z-20 mb-2 px-4 text-xs md:text-sm font-mono uppercase tracking-[0.25em] text-slate-400 text-center">
        Proudly Serving Businesses From:
      </div>

      {/* Ticker content */}
      <div className="flex whitespace-nowrap animate-scroll">
        {/* First set */}
        {towns.map((town, idx) => (
          <span
            key={`set1-${idx}`}
            className="inline-flex items-center gap-3 px-6 text-sm md:text-base font-medium text-slate-300 hover:text-cyan-400 transition-colors"
          >
            {town}
            {idx < towns.length - 1 && (
              <span className="inline-block w-1 h-1 rounded-full bg-slate-600" />
            )}
          </span>
        ))}

        {/* Second set for seamless loop */}
        {towns.map((town, idx) => (
          <span
            key={`set2-${idx}`}
            className="inline-flex items-center gap-3 px-6 text-sm md:text-base font-medium text-slate-300 hover:text-cyan-400 transition-colors"
          >
            {town}
            {idx < towns.length - 1 && (
              <span className="inline-block w-1 h-1 rounded-full bg-slate-600" />
            )}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-scroll {
          animation: scroll 60s linear infinite;
        }

        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
});

WirralTicker.displayName = "WirralTicker";
