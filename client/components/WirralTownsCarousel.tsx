import { motion } from "framer-motion";

const wirralTowns = [
  "Heswall",
  "West Kirby",
  "Wallasey",
  "Birkenhead",
  "Port Sunlight",
  "Bromborough",
  "Hoylake",
  "Greasby",
  "Prenton",
  "Bebington",
  "Thurstaston",
  "Caldy",
  "Meols",
  "Pensby",
  "Neston",
  "Parkgate",
  "Egremont",
  "Upton",
  "Irby",
  "Landican",
];

export function WirralTownsCarousel() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.4 },
    },
  };

  return (
    <section className="bg-slate-50 dark:bg-slate-900 py-16 px-4 border-y border-slate-200 dark:border-slate-800">
      <div className="container mx-auto max-w-6xl">
        <h3 className="text-center text-xl font-heading font-bold text-slate-900 dark:text-white mb-12">
          Proudly Serving Businesses In:
        </h3>

        <motion.div
          className="flex flex-wrap gap-3 justify-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {wirralTowns.map((town) => (
            <motion.div
              key={town}
              variants={itemVariants}
              whileHover={{ scale: 1.05, y: -2 }}
              className="px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-cyan-400 dark:hover:border-cyan-400/50 transition text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {town}
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          className="text-center text-sm text-slate-600 dark:text-slate-400 mt-12 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1 }}
        >
          Whether you're in a bustling city centre, a coastal village, or an
          industrial hub, Kaizen builds Wirral websites that rank, convert, and
          deliver real business results.
        </motion.p>
      </div>
    </section>
  );
}
