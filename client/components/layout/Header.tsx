import KaizenLogo from "@/components/KaizenLogo";
import { Mail, Newspaper } from "lucide-react";
import {
  ArrowRightIcon,
  MenuIcon,
  XIcon,
} from "@/components/icons/CriticalIcons";
import HeaderDesktopNav from "./HeaderDesktopNav";
import AppLink from "@/components/routing/AppLink";

interface HeaderProps {
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({
  mobileMenuOpen,
  onMobileMenuChange,
}) => {
  return (
    <header className="site-header sticky top-0 z-50 w-full border-b border-white/10 bg-[#050910]/95 backdrop-blur-xl">
      <div className="site-header-wrap mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="site-header-inner flex items-center h-16">
          {/* Logo */}
          <AppLink
            href="/"
            className="mr-5 flex flex-shrink-0 items-center gap-2 transition hover:opacity-85"
          >
            <KaizenLogo className="h-7 w-[122px] text-white" />
          </AppLink>

          <HeaderDesktopNav />

          {/* Right Actions - pushed to the right */}
          <div className="ml-auto flex items-center gap-1.5">
            <AppLink
              href="/blog"
              aria-label="Open blog insights"
              className="hidden h-8 w-8 items-center justify-center rounded-full border border-white/15 text-slate-300 transition hover:border-cyan-300 hover:text-cyan-200 lg:inline-flex"
            >
              <Newspaper size={14} />
            </AppLink>

            <AppLink
              href="/contact"
              aria-label="Contact Kaizen"
              className="hidden h-8 w-8 items-center justify-center rounded-full border border-white/15 text-slate-300 transition hover:border-cyan-300 hover:text-cyan-200 lg:inline-flex"
            >
              <Mail size={14} />
            </AppLink>

            <AppLink
              href="/performance-scanner"
              className="site-header-speed hidden items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/55 hover:text-cyan-200 lg:inline-flex"
            >
              Page Scanner
            </AppLink>

            <AppLink
              href="/contact"
              className="site-header-cta hidden items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(34,211,238,0.35)] transition hover:scale-[1.02] sm:inline-flex"
            >
              Start Your Project
              <ArrowRightIcon size={14} />
            </AppLink>

            {/* Mobile Menu Button */}
            <button
              className="site-header-mobile rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
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
