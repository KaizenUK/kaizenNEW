import { useState } from "react";
import { motion } from "framer-motion";

const wirralAreas = [
  {
    id: "heswall",
    name: "Heswall",
    x: 120,
    y: 200,
    focus: "Premium Service Brands",
    description: "Owner-led service businesses",
  },
  {
    id: "west-kirby",
    name: "West Kirby",
    x: 80,
    y: 150,
    focus: "Experience & Retail",
    description: "Cafes, salons & lifestyle brands",
  },
  {
    id: "birkenhead",
    name: "Birkenhead",
    x: 150,
    y: 280,
    focus: "Industrial & B2B",
    description: "Trades & manufacturing",
  },
];

export function WirralInteractiveMap() {
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-8">
      <svg
        viewBox="0 0 300 400"
        className="w-full max-w-md h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Wirral Peninsula outline - simplified */}
        <defs>
          <linearGradient id="wirral-water" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Water background */}
        <rect
          width="300"
          height="400"
          fill="url(#wirral-water)"
          className="dark:fill-slate-900"
        />

        {/* Peninsula shape (simplified outline) */}
        <path
          d="M 50 50 L 180 40 L 200 120 L 220 200 L 180 320 L 80 350 L 40 280 Z"
          fill="currentColor"
          className="text-slate-200 dark:text-slate-800"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-slate-400 dark:text-slate-600"
          opacity="0.6"
        />

        {/* Interactive areas */}
        {wirralAreas.map((area) => (
          <g key={area.id} onMouseEnter={() => setHoveredArea(area.id)} onMouseLeave={() => setHoveredArea(null)}>
            {/* Highlight circle when hovered */}
            {hoveredArea === area.id && (
              <circle
                cx={area.x}
                cy={area.y}
                r="35"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-cyan-400 dark:text-cyan-300"
                opacity="0.6"
              />
            )}

            {/* Area dot */}
            <circle
              cx={area.x}
              cy={area.y}
              r="8"
              fill="currentColor"
              className={`${
                hoveredArea === area.id
                  ? "text-cyan-400 dark:text-cyan-300"
                  : "text-slate-400 dark:text-slate-600"
              } transition-colors cursor-pointer`}
            />

            {/* Area label */}
            <text
              x={area.x}
              y={area.y + 25}
              textAnchor="middle"
              className={`text-xs font-bold ${
                hoveredArea === area.id
                  ? "fill-cyan-400 dark:fill-cyan-300"
                  : "fill-slate-600 dark:fill-slate-400"
              } transition-colors`}
            >
              {area.name}
            </text>
          </g>
        ))}
      </svg>

      {/* Info cards for hovered area */}
      <div className="h-24 w-full">
        {hoveredArea && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-lg p-4 border border-cyan-200 dark:border-cyan-400/20"
          >
            {wirralAreas.map(
              (area) =>
                area.id === hoveredArea && (
                  <div key={area.id}>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                      {area.focus}
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {area.description}
                    </p>
                  </div>
                ),
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
