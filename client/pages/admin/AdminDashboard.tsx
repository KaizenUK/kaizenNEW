import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FileText, ArrowRight, MessageCircle } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";

interface DashboardProps {
  crispUnread: number | null;
  crispOpen: number | null;
  crispLatest: string | null;
}

function DashboardContent({
  crispUnread,
  crispOpen,
  crispLatest,
}: DashboardProps) {
  const quickLinks = [
    {
      title: "Blog Posts",
      description: "Manage all blog posts in the Publish space",
      icon: FileText,
      href: "/admin/blog-posts",
    },
  ];

  // Helper to truncate latest message
  const truncateMessage = (msg: string, maxLength: number = 80): string => {
    if (msg.length <= maxLength) return msg;
    return msg.substring(0, maxLength) + "...";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-4xl font-heading font-bold mb-2">
        Welcome to Admin
      </h1>
      <p className="text-gray-400 mb-12 font-body">
        Manage your Kaizen web content from here.
      </p>

      {/* Quick Links and Crisp Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {quickLinks.map((link, index) => {
          const Icon = link.icon;
          return (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Link
                to={link.href}
                className="group block p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500/50 hover:bg-gray-800/50 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition">
                    <Icon className="text-blue-400" size={24} />
                  </div>
                  <ArrowRight
                    className="text-gray-600 group-hover:text-blue-400 transition"
                    size={20}
                  />
                </div>
                <h3 className="text-lg font-heading font-bold mb-2 group-hover:text-blue-400 transition">
                  {link.title}
                </h3>
                <p className="text-gray-400 text-sm">{link.description}</p>
              </Link>
            </motion.div>
          );
        })}

        {/* Crisp Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-purple-500/50 hover:bg-gray-800/50 transition"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <MessageCircle className="text-purple-400" size={24} />
            </div>
          </div>
          <h3 className="text-lg font-heading font-bold mb-4">Crisp Inbox</h3>

          {/* Counters */}
          <div className="space-y-2 mb-4 text-sm text-gray-300 font-body">
            {(typeof crispOpen === "number" || typeof crispUnread === "number") ? (
              <>
                {typeof crispOpen === "number" && (
                  <p>
                    <span className="font-semibold text-slate-200">{crispOpen}</span> open{" "}
                    {crispOpen === 1 ? "conversation" : "conversations"}
                  </p>
                )}
                {typeof crispUnread === "number" && (
                  <p>
                    <span className="font-semibold text-red-300">{crispUnread}</span> unread operator{" "}
                    {crispUnread === 1 ? "message" : "messages"}
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-500">No unread or open conversations</p>
            )}
          </div>

          {/* Latest Message */}
          {crispLatest && (
            <div className="mb-4 p-3 bg-gray-800/50 rounded border border-gray-700/50">
              <p className="text-xs text-gray-500 font-mono mb-1">Latest message:</p>
              <p className="text-sm text-gray-300 font-body italic">"{truncateMessage(crispLatest)}"</p>
            </div>
          )}

          {/* Button */}
          <a
            href="https://app.crisp.chat/website/9d827b35-3e4e-494f-8c0b-72d233fc92bb/inbox/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full text-center px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 rounded-lg transition font-body text-sm font-medium"
          >
            Open Crisp Inbox
          </a>
        </motion.div>
      </div>

      {/* Info Section */}
      <motion.div
        className="mt-12 p-6 bg-blue-500/10 border border-blue-500/30 rounded-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <h3 className="font-heading font-bold mb-2 text-blue-300">Info</h3>
        <p className="text-sm text-gray-300 font-body">
          You can now edit metadata (title, slug, excerpt, date, tags)
          directly. For full editing of content and cover images, use "Edit in
          Builder".
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function AdminDashboard({
  crispUnread,
  crispOpen,
  crispLatest,
}: DashboardProps) {
  return (
    <AdminLayout>
      <DashboardContent crispUnread={crispUnread} crispOpen={crispOpen} crispLatest={crispLatest} />
    </AdminLayout>
  );
}
