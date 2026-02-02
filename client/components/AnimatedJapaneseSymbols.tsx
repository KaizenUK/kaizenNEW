import { motion } from "framer-motion";

export default function AnimatedJapaneseSymbols() {
  const symbols = [
    { kanji: "改", romaji: "Kai", meaning: "Change / Improvement" },
    { kanji: "善", romaji: "Zen", meaning: "Good / Better" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3,
        delayChildren: 0.2,
      },
    },
  };

  const symbolVariants = {
    hidden: {
      opacity: 0,
      scale: 0.5,
      y: -20,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  const romajiVariants = {
    hidden: {
      opacity: 0,
      y: 10,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1] as const,
        delay: 0.1,
      },
    },
  };

  return (
    <motion.div
      className="flex gap-8 lg:gap-12 items-center justify-center lg:justify-start"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {symbols.map((symbol, index) => (
        <motion.div
          key={index}
          className="flex flex-col items-center gap-2"
          variants={symbolVariants}
        >
          <motion.div
            className="text-7xl md:text-8xl lg:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-kaizen-cyan to-kaizen-lime"
            whileHover={{
              scale: 1.1,
              textShadow: "0 0 20px rgba(34, 211, 238, 0.5)",
            }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            {symbol.kanji}
          </motion.div>
          <motion.p
            className="text-sm md:text-base font-heading font-semibold text-kaizen-cyan dark:text-kaizen-cyan/80 uppercase tracking-wider"
            variants={romajiVariants}
          >
            {symbol.romaji}
          </motion.p>
          <motion.p
            className="text-xs md:text-sm font-medium text-kaizen-dark dark:text-white text-center"
            variants={romajiVariants}
          >
            {symbol.meaning}
          </motion.p>
        </motion.div>
      ))}
    </motion.div>
  );
}
