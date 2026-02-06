import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

import SpeedScanner from '@/components/SpeedScanner';

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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
              Free Site Audit
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
              How Does Google See Your Site?
            </h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto">
              Enter your URL. Get a real-time audit of load speed, Core Web Vitals, and what's costing you rankings.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <SpeedScanner />
          </motion.div>
        </div>
      </section>

      {/* Our Score — directly below */}
      <section className="py-20 md:py-32 bg-slate-50 dark:bg-slate-900/50 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs font-mono tracking-[0.25em] text-kaizen-cyan uppercase mb-4">
              Proof, Not Promises
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold text-gray-950 dark:text-white">
              Here's How We Score.
            </h2>
          </motion.div>

          <div className="max-w-2xl mx-auto">
            {/* Gauge */}
            <motion.div
              ref={badgeRef}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
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
                  style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-heading font-black text-green-600 dark:text-green-400 tabular-nums">
                  {count}%
                </span>
                <span className="text-xs text-gray-500 uppercase tracking-widest mt-1">
                  Performance
                </span>
              </div>
            </motion.div>

            {/* Core Web Vitals */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-3 gap-4 text-center mb-12"
            >
              {[
                { label: 'LCP', value: '0.8s' },
                { label: 'TBT', value: '0ms' },
                { label: 'CLS', value: '0.01' },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl bg-white/50 dark:bg-slate-950/50 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 p-6"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono uppercase tracking-widest mb-2">
                    {metric.label}
                  </p>
                  <p className="text-2xl font-heading font-bold text-gray-950 dark:text-white">
                    {metric.value}
                  </p>
                </div>
              ))}
            </motion.div>

            {/* Explanation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="text-center"
            >
              <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                Core Web Vitals are how Google measures whether your site is any good. Load speed, responsiveness, visual stability — if these are poor, Google pushes you down the results. We hit 96% on our own site. We build yours to the same standard.
              </p>
              <motion.a
                href="https://gtmetrix.com/reports/kaizenweb.co.uk/e2VJJsxv/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-kaizen-cyan/50 text-kaizen-cyan font-heading font-bold transition-all duration-300"
                whileHover={{
                  scale: 1.05,
                  borderColor: '#06b6d4',
                  backgroundColor: 'rgba(6, 182, 212, 0.1)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                View Full Report
                <ArrowUpRight size={18} />
              </motion.a>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
};
