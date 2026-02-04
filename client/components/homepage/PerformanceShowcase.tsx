import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

import SpeedScanner from '@/components/SpeedScanner';

/**
 * Performance Badge with Framer Motion animations
 */
const PerformanceBadgeEnhanced: React.FC = () => {
  const [count, setCount] = useState(0);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Simple count-up animation
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && count === 0) {
        let current = 0;
        const target = 96;
        const increment = target / 60; // 60 frames for smooth animation
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            setCount(target);
            clearInterval(timer);
          } else {
            setCount(Math.floor(current));
          }
        }, 30);
        return () => clearInterval(timer);
      }
    });

    if (badgeRef.current) {
      observer.observe(badgeRef.current);
    }

    return () => observer.disconnect();
  }, [count]);

  return (
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
            Grade A Performance
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          {/* Performance Badge */}
          <motion.div
            ref={badgeRef}
            id="performance-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative w-64 h-64 mx-auto mb-12"
          >
            <svg className="w-full h-full drop-shadow-2xl" viewBox="0 0 200 200">
              <defs>
                <linearGradient
                  id="shimmer"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.6)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
              </defs>

              {/* Background circle */}
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />

              {/* Progress circle */}
              <motion.circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="#22c55e"
                strokeWidth="8"
                strokeDasharray={565.48}
                strokeLinecap="round"
                initial={{ strokeDashoffset: 565.48 }}
                whileInView={{ strokeDashoffset: 565.48 * (1 - 0.96) }}
                viewport={{ once: true }}
                transition={{ duration: 2, ease: "easeOut" }}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '100px 100px' }}
              />

              {/* Rotating shimmer overlay */}
              <motion.circle
                cx="100"
                cy="100"
                r="90"
                fill="url(#shimmer)"
                opacity="0.3"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                style={{ transformOrigin: '100px 100px' }}
              />

              {/* Score text */}
              <text
                x="100"
                y="95"
                textAnchor="middle"
                className="font-heading font-black text-4xl"
                fill="#047857"
              >
                {count}%
              </text>
              <text
                x="100"
                y="125"
                textAnchor="middle"
                className="text-xs"
                fill="#6b7280"
              >
                Performance
              </text>
            </svg>
          </motion.div>

          {/* Core Web Vitals Cards with Framer Motion */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-4 text-center mb-12"
          >
            {[
              { label: 'LCP', value: '0.8s' },
              { label: 'TBT', value: '0ms' },
              { label: 'CLS', value: '0.01' },
            ].map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + index * 0.1 }}
                whileHover={{ y: -5 }}
                className="group relative rounded-2xl bg-white/50 dark:bg-slate-950/50 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 p-6 hover:border-kaizen-cyan/50 transition-all duration-300 cursor-default"
              >
                <div className="absolute -inset-px bg-gradient-to-br from-kaizen-cyan to-kaizen-lime rounded-2xl opacity-0 group-hover:opacity-10 blur transition duration-300" />
                <div className="relative">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-mono uppercase tracking-widest mb-2">
                    {metric.label}
                  </p>
                  <p className="text-2xl font-heading font-bold text-gray-950 dark:text-white">
                    {metric.value}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Description and CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7 }}
            className="text-center"
          >
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              We don't guess. We benchmark. Core Web Vitals are Google's way of
              measuring real user experience: how quickly your page loads, how
              responsive it feels, and how stable it looks as it renders. A 96%
              score means your site feels instant on real devices and gives
              Google fewer reasons to push you down the results.
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
  );
};

/**
 * Performance Showcase: Combines SpeedScanner and PerformanceBadge
 * Features: React Spring, GSAP, Lottie, Framer Motion
 */
export const PerformanceShowcase: React.FC = () => {
  return (
    <>
      {/* Speed Scanner Section */}
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
              Live Performance Scanner
            </p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
              Test Your Site Speed Now
            </h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto">
              Enter any URL to see how your website performs. Get instant
              feedback on load times, Core Web Vitals, and actionable fixes.
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

      {/* Performance Badge Section */}
      <PerformanceBadgeEnhanced />
    </>
  );
};
