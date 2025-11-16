import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Menu,
  LogOut,
  FileText,
  LayoutDashboard,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { CrispProvider } from "@/context/CrispContext";

interface AdminLayoutProps {
  children:
    | React.ReactNode
    | ((props: {
        crispUnread: number | null;
        crispOpen: number | null;
        crispLatest: string | null;
      }) => React.ReactNode);
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [crispUnread, setCrispUnread] = useState<number | null>(null);
  const [crispOpen, setCrispOpen] = useState<number | null>(null);
  const [crispLatest, setCrispLatest] = useState<string | null>(null);
  const location = useLocation();
  const { logout } = useAdminAuth();

  // Fetch Crisp summary data
  useEffect(() => {
    let cancelled = false;

    const loadCrispData = async () => {
      try {
        const res = await fetch("/api/admin/crisp/summary");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json || json.ok !== true) return;

        if (typeof json.unreadCount === "number") {
          setCrispUnread(json.unreadCount);
        }
        if (typeof json.openConversations === "number") {
          setCrispOpen(json.openConversations);
        }

        // Derive latest message snippet from raw.data[0]
        const data =
          json.raw && Array.isArray(json.raw.data) ? json.raw.data : null;
        if (data && data.length > 0) {
          const first = data[0];
          const excerpt =
            first?.preview_message?.excerpt || first?.last_message || null;
          if (typeof excerpt === "string" && excerpt.length > 0) {
            setCrispLatest(excerpt);
          }
        }
      } catch {
        // Silently ignore errors - leave Crisp items as null
      }
    };

    loadCrispData();

    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = [
    {
      name: "Dashboard",
      href: "/admin",
      icon: LayoutDashboard,
      external: false,
    },
    {
      name: "Blog Posts",
      href: "/admin/blog-posts",
      icon: FileText,
      external: false,
    },
    {
      name: "Crisp inbox",
      href: "https://app.crisp.chat/website/9d827b35-3e4e-494f-8c0b-72d233fc92bb/inbox/",
      icon: MessageCircle,
      external: true,
    },
  ];

  const isActive = (href: string) => location.pathname === href;

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      logout();
      window.location.href = "/admin";
    }
  };

  return (
    <>
      <Helmet>
        <title>Kaizen Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="flex h-screen bg-gray-950 text-white">
        {/* Sidebar */}
        <motion.aside
          animate={{ width: sidebarOpen ? 256 : 80 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-b from-gray-900 to-gray-950 border-r border-gray-800 flex flex-col"
        >
          {/* Logo/Brand */}
          <div className="p-4 border-b border-gray-800/50">
            <Link
              to="/admin"
              className="flex items-center gap-3 hover:opacity-80 transition"
            >
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F6ca2caa53229445d9a63b2ab64bfede4?format=webp&width=800"
                alt="Kaizen Web"
                className="h-12 w-auto"
              />
              {sidebarOpen && (
                <span className="text-xs font-heading font-bold text-gray-400 uppercase tracking-wider">
                  Admin
                </span>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = !item.external && isActive(item.href);
              const baseClasses = `flex items-center gap-3 px-4 py-3 rounded-lg transition font-body ${
                active
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50 hover:scale-105"
              }`;

              return item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={baseClasses}
                >
                  <Icon size={20} />
                  {sidebarOpen && (
                    <>
                      <span className="font-medium">{item.name}</span>
                      {item.name === "Crisp inbox" &&
                        (typeof crispOpen === "number" ||
                          typeof crispUnread === "number") && (
                          <div className="ml-auto flex items-center gap-1">
                            {typeof crispOpen === "number" && crispOpen > 0 && (
                              <span className="inline-flex items-center rounded-full bg-slate-800 text-slate-200 text-[11px] px-2 py-0.5">
                                Open: {crispOpen}
                              </span>
                            )}
                            {typeof crispUnread === "number" &&
                              crispUnread > 0 && (
                                <span className="inline-flex items-center rounded-full bg-red-500/80 text-white text-[11px] px-2 py-0.5">
                                  {crispUnread}
                                </span>
                              )}
                          </div>
                        )}
                    </>
                  )}
                </a>
              ) : (
                <Link key={item.href} to={item.href} className={baseClasses}>
                  <Icon size={20} />
                  {sidebarOpen && (
                    <span className="font-medium">{item.name}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition font-body"
            >
              <LogOut size={20} />
              {sidebarOpen && <span className="font-medium">Logout</span>}
            </button>
          </div>
        </motion.aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topbar */}
          <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-800 rounded-lg transition"
            >
              <Menu size={20} />
            </button>
            <div className="text-sm text-gray-400 font-body">
              Admin Dashboard
            </div>
            <a
              href="https://www.kaizenweb.co.uk/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-gray-300 hover:text-blue-400 text-sm font-body flex items-center gap-2"
            >
              View site
              <ExternalLink size={16} />
            </a>
          </div>

          {/* Content Area */}
          <CrispProvider
            crispUnread={crispUnread}
            crispOpen={crispOpen}
            crispLatest={crispLatest}
          >
            <div className="flex-1 overflow-auto">
              <main className="p-6">
                {typeof children === "function"
                  ? children({ crispUnread, crispOpen, crispLatest })
                  : children}
              </main>
            </div>
          </CrispProvider>
        </div>
      </div>
    </>
  );
}
