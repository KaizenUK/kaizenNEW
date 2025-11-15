import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FileText, ArrowRight } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";

export default function AdminDashboard() {
  const quickLinks = [
    {
      title: "Blog Posts",
      description: "Manage all blog posts in the Publish space",
      icon: FileText,
      href: "/admin/blog-posts",
    },
  ];

  return (
    <AdminLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-heading font-bold mb-2">Welcome to Admin</h1>
        <p className="text-gray-400 mb-12 font-body">
          Manage your Kaizen web content from here.
        </p>

        {/* Quick Links */}
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
                    <ArrowRight className="text-gray-600 group-hover:text-blue-400 transition" size={20} />
                  </div>
                  <h3 className="text-lg font-heading font-bold mb-2 group-hover:text-blue-400 transition">
                    {link.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{link.description}</p>
                </Link>
              </motion.div>
            );
          })}
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
            You can now edit metadata (title, slug, excerpt, date, tags) directly. For full editing of content and cover images, use "Edit in Builder".
          </p>
        </motion.div>
      </motion.div>
    </AdminLayout>
  );
}
