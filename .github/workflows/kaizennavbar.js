import { useState } from 'react';
import { ChevronDown, Search, Menu, X, Box, Cloud, Gamepad2, ShoppingBag, Car, Film, Building2, BookOpen, FileText, Users, Newspaper } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const iconMap: Record<string, any> = {
  'Unity Engine': Box,
  'Unity Cloud': Cloud,
  'Unity Gaming Services': Gamepad2,
  'Unity Asset Store': ShoppingBag,
  'Gaming': Gamepad2,
  'Automotive': Car,
  'Film & Animation': Film,
  'Architecture': Building2,
  'Learn': BookOpen,
  'Documentation': FileText,
  'Community': Users,
  'Blog': Newspaper,
};

export function UnityNavbar() {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {
      label: 'Products',
      items: [
        { name: 'Unity Engine', desc: 'The world-leading creation engine' },
        { name: 'Unity Cloud', desc: 'Services to scale your projects' },
        { name: 'Unity Gaming Services', desc: 'Operate and monetize your game' },
        { name: 'Unity Asset Store', desc: 'Find the perfect assets' },
      ],
    },
    {
      label: 'Solutions',
      items: [
        { name: 'Gaming', desc: 'Build immersive games' },
        { name: 'Automotive', desc: 'Transform vehicle experiences' },
        { name: 'Film & Animation', desc: 'Create stunning visuals' },
        { name: 'Architecture', desc: 'Design interactive experiences' },
      ],
    },
    {
      label: 'Resources',
      items: [
        { name: 'Learn', desc: 'Tutorials and courses' },
        { name: 'Documentation', desc: 'Technical references' },
        { name: 'Community', desc: 'Connect with creators' },
        { name: 'Blog', desc: 'Latest news and insights' },
      ],
    },
  ];

  return (
    <nav className="bg-[#0d0d0d]/95 backdrop-blur-xl text-white fixed top-0 left-0 right-0 z-50 border-b border-white/10">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <motion.a
              href="/"
              className="flex items-center"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <svg
                width="88"
                height="24"
                viewBox="0 0 88 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-white"
              >
                <path
                  d="M12 0L0 6.5V17.5L12 24L24 17.5V6.5L12 0Z"
                  fill="currentColor"
                />
                <text
                  x="28"
                  y="18"
                  fill="currentColor"
                  style={{ fontSize: '18px', fontWeight: '600' }}
                >
                  Unity
                </text>
              </svg>
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setActiveDropdown(item.label)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <motion.button
                    className="flex items-center gap-1 px-4 py-2 rounded-lg transition-colors relative"
                    whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className="text-sm">{item.label}</span>
                    <motion.div
                      animate={{ rotate: activeDropdown === item.label ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </motion.button>

                  {/* Dropdown Menu with Glassmorphism */}
                  <AnimatePresence>
                    {activeDropdown === item.label && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute top-full left-0 mt-2 w-80 rounded-2xl overflow-hidden shadow-2xl"
                        style={{
                          background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.98) 0%, rgba(20, 20, 20, 0.98) 100%)',
                          backdropFilter: 'blur(20px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <div className="p-3">
                          {item.items.map((subItem, index) => {
                            const Icon = iconMap[subItem.name];
                            return (
                              <motion.a
                                key={subItem.name}
                                href="#"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                  duration: 0.3,
                                  delay: index * 0.05,
                                  ease: [0.4, 0, 0.2, 1],
                                }}
                                className="flex items-start gap-4 p-4 rounded-xl transition-all duration-300 group relative overflow-hidden"
                                whileHover={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                  scale: 1.02,
                                }}
                              >
                                {/* Glassmorphism hover effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/10 group-hover:via-blue-500/5 group-hover:to-transparent transition-all duration-500" />
                                
                                {/* 3D Icon with shadow */}
                                <div className="relative flex-shrink-0">
                                  <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center relative"
                                    style={{
                                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.25) 100%)',
                                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                    }}
                                  >
                                    <Icon className="w-5 h-5 text-blue-400 drop-shadow-[0_2px_4px_rgba(59,130,246,0.5)]" />
                                  </div>
                                  {/* Subtle glow effect */}
                                  <div className="absolute inset-0 rounded-lg bg-blue-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                </div>
                                
                                <div className="flex-1 relative z-10">
                                  <div className="text-sm text-white group-hover:text-blue-300 transition-colors duration-300 flex items-center gap-2">
                                    {subItem.name}
                                    <motion.span
                                      initial={{ x: -5, opacity: 0 }}
                                      whileHover={{ x: 0, opacity: 1 }}
                                      className="text-blue-400"
                                    >
                                      →
                                    </motion.span>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1 group-hover:text-gray-300 transition-colors duration-300">
                                    {subItem.desc}
                                  </div>
                                </div>
                              </motion.a>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              <motion.a
                href="#"
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                transition={{ duration: 0.2 }}
              >
                Industries
              </motion.a>
              <motion.a
                href="#"
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                transition={{ duration: 0.2 }}
              >
                Pricing
              </motion.a>
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* Search Icon */}
            <motion.button
              className="hidden lg:flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Search className="w-5 h-5" />
            </motion.button>

            {/* Sign In */}
            <motion.a
              href="#"
              className="hidden lg:block px-4 py-2 text-sm rounded-lg transition-colors"
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              transition={{ duration: 0.2 }}
            >
              Sign in
            </motion.a>

            {/* Get Started Button */}
            <motion.a
              href="#"
              className="hidden lg:block px-5 py-2 text-sm rounded-lg relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
              whileHover={{
                scale: 1.05,
                boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
              }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <span className="relative z-10">Get started</span>
              <motion.div
                className="absolute inset-0 bg-white/20"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
              />
            </motion.a>

            {/* Mobile Menu Button */}
            <motion.button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <AnimatePresence mode="wait">
                {mobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="w-6 h-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="lg:hidden border-t border-white/10 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.98) 0%, rgba(20, 20, 20, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="max-w-[1400px] mx-auto px-6 py-4">
              <div className="flex flex-col gap-2">
                {navItems.map((item, itemIndex) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: itemIndex * 0.1, duration: 0.3 }}
                    className="border-b border-white/10 pb-2"
                  >
                    <button className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-white/10 rounded-lg transition-colors">
                      <span>{item.label}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <div className="pl-4 mt-1 space-y-1">
                      {item.items.map((subItem) => {
                        const Icon = iconMap[subItem.name];
                        return (
                          <a
                            key={subItem.name}
                            href="#"
                            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Icon className="w-4 h-4 text-blue-400" />
                            {subItem.name}
                          </a>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
                <motion.a
                  href="#"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="px-3 py-2 text-sm hover:bg-white/10 rounded-lg transition-colors"
                >
                  Industries
                </motion.a>
                <motion.a
                  href="#"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35, duration: 0.3 }}
                  className="px-3 py-2 text-sm hover:bg-white/10 rounded-lg transition-colors"
                >
                  Pricing
                </motion.a>
                <div className="pt-2 mt-2 border-t border-white/10 flex flex-col gap-2">
                  <motion.a
                    href="#"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.3 }}
                    className="px-3 py-2 text-sm hover:bg-white/10 rounded-lg transition-colors text-center"
                  >
                    Sign in
                  </motion.a>
                  <motion.a
                    href="#"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.3 }}
                    className="px-3 py-2 text-sm rounded-lg transition-colors text-center"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    Get started
                  </motion.a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}