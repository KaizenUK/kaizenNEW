import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, LogOut, FileText, LayoutDashboard, ExternalLink, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { logout } = useAdminAuth();

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Blog Posts", href: "/admin/blog-posts", icon: FileText },
  ];

  const isActive = (href: string) => location.pathname === href;

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      logout();
      window.location.href = "/admin";
    }
  };

  return (
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
              <span className="text-xs font-heading font-bold text-gray-400 uppercase tracking-wider">Admin</span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-body ${
                  active
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50 hover:scale-105"
                }`}
              >
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
          <div className="text-sm text-gray-400 font-body">Admin Dashboard</div>
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
        <div className="flex-1 overflow-auto">
          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
