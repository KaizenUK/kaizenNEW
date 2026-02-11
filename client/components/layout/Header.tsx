import { Link } from "react-router-dom";
import KaizenLogo from "@/components/KaizenLogo";
import {
  ArrowRightIcon,
  MenuIcon,
  XIcon,
  ZapIcon,
} from "@/components/icons/CriticalIcons";
import HeaderDesktopNav from "./HeaderDesktopNav";

interface HeaderProps {
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({
  mobileMenuOpen,
  onMobileMenuChange,
}) => {
  return (
    <header className="site-header sticky top-0 z-50 w-full bg-white border-b border-gray-100">
      <div className="site-header-wrap max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="site-header-inner flex items-center h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition flex-shrink-0 mr-8"
          >
            <KaizenLogo className="h-7 w-[120px] text-black" />
          </Link>

          <HeaderDesktopNav />

          {/* Right Actions - pushed to the right */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Free Speed Test */}
            <Link
              to="/performance-scanner"
              className="site-header-speed hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
            >
              <ZapIcon size={16} />
              Free Speed Test
            </Link>

            {/* Start Your Project - Primary CTA */}
            <Link
              to="/contact"
              className="site-header-cta hidden sm:flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Your Project
              <ArrowRightIcon size={14} />
            </Link>

            {/* Mobile Menu Button */}
            <button
              className="site-header-mobile lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              onClick={() => onMobileMenuChange(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
