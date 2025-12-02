import { useState } from "react";
import { motion } from "framer-motion";

const wirralAreas = [
  {
    id: "heswall",
    name: "Heswall",
    x: 140,
    y: 320,
    region: "Southwest",
    color: "cyan",
  },
  {
    id: "west-kirby",
    name: "West Kirby",
    x: 90,
    y: 200,
    region: "Northwest Coast",
    color: "lime",
  },
  {
    id: "birkenhead",
    name: "Birkenhead",
    x: 200,
    y: 240,
    region: "Central",
    color: "cyan",
  },
  {
    id: "wallasey",
    name: "Wallasey",
    x: 240,
    y: 140,
    region: "Northeast",
    color: "lime",
  },
  {
    id: "caldy",
    name: "Caldy",
    x: 100,
    y: 250,
    region: "West Coast",
    color: "cyan",
  },
  {
    id: "hoylake",
    name: "Hoylake",
    x: 75,
    y: 160,
    region: "Northwest Coast",
    color: "lime",
  },
  {
    id: "new-brighton",
    name: "New Brighton",
    x: 260,
    y: 80,
    region: "North Coast",
    color: "cyan",
  },
  {
    id: "bromborough",
    name: "Bromborough",
    x: 220,
    y: 350,
    region: "Southeast",
    color: "lime",
  },
  {
    id: "bebington",
    name: "Bebington",
    x: 200,
    y: 300,
    region: "South Central",
    color: "cyan",
  },
  {
    id: "neston",
    name: "Neston",
    x: 180,
    y: 380,
    region: "South",
    color: "lime",
  },
];

export function WirralInteractiveMap() {
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-8">
      <svg
        viewBox="0 0 320 420"
        className="w-full max-w-2xl h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wirral-water" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="wirral-land" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.8" />
          </linearGradient>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Water background */}
        <rect
          width="320"
          height="420"
          fill="url(#wirral-water)"
          className="dark:fill-slate-900"
        />

        {/* River Dee and River Mersey labels */}
        <text
          x="20"
          y="200"
          fontSize="10"
          fill="currentColor"
          className="text-cyan-400/60 dark:text-cyan-500/60"
          fontStyle="italic"
          opacity="0.6"
        >
          River Dee
        </text>
        <text
          x="270"
          y="200"
          fontSize="10"
          fill="currentColor"
          className="text-cyan-400/60 dark:text-cyan-500/60"
          fontStyle="italic"
          opacity="0.6"
        >
          River Mersey
        </text>

        {/* Wirral Peninsula - more accurate outline */}
        <path
          d="M 70 120 L 90 100 L 110 90 L 140 80 L 160 75 L 200 70 L 240 75 L 260 100 L 280 150 L 290 200 L 285 250 L 270 300 L 250 340 L 220 360 L 180 375 L 140 380 L 120 375 L 100 370 L 80 360 L 70 340 L 65 300 L 60 250 L 58 200 L 60 150 L 65 120 Z"
          fill="url(#wirral-land)"
          stroke="currentColor"
          strokeWidth="2"
          className="text-slate-400 dark:text-slate-600"
          opacity="0.8"
          filter="url(#shadow)"
        />

        {/* Interactive areas - towns/regions */}
        {wirralAreas.map((area) => (
          <g
            key={area.id}
            onMouseEnter={() => setHoveredArea(area.id)}
            onMouseLeave={() => setHoveredArea(null)}
            className="cursor-pointer"
          >
            {/* Highlight circle when hovered */}
            {hoveredArea === area.id && (
              <>
                <circle
                  cx={area.x}
                  cy={area.y}
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`text-${area.color}-400 dark:text-${area.color}-300`}
                  opacity="0.5"
                  style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
                />
                <circle
                  cx={area.x}
                  cy={area.y}
                  r="50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className={`text-${area.color}-400 dark:text-${area.color}-300`}
                  opacity="0.3"
                />
              </>
            )}

            {/* Area dot */}
            <circle
              cx={area.x}
              cy={area.y}
              r="6"
              fill="currentColor"
              className={`${
                hoveredArea === area.id
                  ? `text-${area.color}-400 dark:text-${area.color}-300`
                  : "text-slate-500 dark:text-slate-500"
              } transition-all duration-200`}
              style={{
                filter: hoveredArea === area.id ? "drop-shadow(0 0 4px currentColor)" : "none",
              }}
            />

            {/* Area label */}
            <text
              x={area.x}
              y={area.y + 22}
              textAnchor="middle"
              className={`font-bold text-xs transition-all duration-200 ${
                hoveredArea === area.id
                  ? `text-${area.color}-400 dark:text-${area.color}-300`
                  : "text-slate-600 dark:text-slate-400"
              }`}
              style={{ fontWeight: hoveredArea === area.id ? "700" : "500" }}
            >
              {area.name}
            </text>
          </g>
        ))}

        {/* Decorative elements for visual interest */}
        <circle cx="40" cy="80" r="3" fill="currentColor" className="text-cyan-400/40" opacity="0.4" />
        <circle cx="290" cy="380" r="2" fill="currentColor" className="text-lime-400/40" opacity="0.4" />
      </svg>

      {/* Info cards for hovered area */}
      <div className="h-16 w-full max-w-2xl px-4">
        {hoveredArea && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
          >
            {wirralAreas.map(
              (area) =>
                area.id === hoveredArea && (
                  <div key={area.id} className="flex items-center gap-4">
                    <div
                      className={`w-3 h-3 rounded-full bg-${area.color}-400 dark:bg-${area.color}-300`}
                    />
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {area.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {area.region}
                      </p>
                    </div>
                  </div>
                ),
            )}
          </motion.div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-400 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>Serving</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-lime-400" />
          <span>Key Areas</span>
        </div>
      </div>
    </div>
  );
}
