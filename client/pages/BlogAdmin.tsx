import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Pen, Trash2 } from "lucide-react";

export default function BlogAdmin() {
  return (
    <Layout>
      <div className="min-h-screen bg-kaizen-light py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-heading font-bold mb-12">Dashboard</h1>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <nav className="bg-white rounded-lg border border-kaizen-light p-4 space-y-2">
                <button className="w-full text-left px-4 py-2 rounded font-medium bg-kaizen-cyan text-white">
                  Overview
                </button>
                <Link
                  to="#blog"
                  className="block px-4 py-2 rounded font-medium hover:bg-kaizen-light transition"
                >
                  Blog Posts
                </Link>
                <Link
                  to="#cases"
                  className="block px-4 py-2 rounded font-medium hover:bg-kaizen-light transition"
                >
                  Case Studies
                </Link>
              </nav>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-8">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: "Total Blog Posts", value: "0" },
                  { label: "Published", value: "0" },
                  { label: "Case Studies", value: "0" },
                ].map((card, index) => (
                  <div key={index} className="bg-white rounded-lg border border-kaizen-light p-6">
                    <p className="text-sm text-kaizen-text-dark/70 mb-2">{card.label}</p>
                    <p className="text-3xl font-heading font-bold">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Blog Posts Section */}
              <div id="blog">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-heading font-bold">Blog Posts</h2>
                  <button className="px-4 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-white font-medium text-sm hover:opacity-90 transition">
                    New Post
                  </button>
                </div>

                <div className="bg-white rounded-lg border border-kaizen-light overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-kaizen-light border-b border-kaizen-light">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-medium">Title</th>
                        <th className="px-6 py-4 text-left text-sm font-medium">Slug</th>
                        <th className="px-6 py-4 text-left text-sm font-medium">Date</th>
                        <th className="px-6 py-4 text-left text-sm font-medium">Category</th>
                        <th className="px-6 py-4 text-right text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-kaizen-light hover:bg-kaizen-light/50 transition">
                        <td className="px-6 py-4 text-sm">No posts yet</td>
                        <td className="px-6 py-4 text-sm">–</td>
                        <td className="px-6 py-4 text-sm">–</td>
                        <td className="px-6 py-4 text-sm">–</td>
                        <td className="px-6 py-4 text-right text-sm">
                          <p className="text-kaizen-text-dark/50">Create your first post</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Case Studies Section */}
              <div id="cases">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-heading font-bold">Case Studies</h2>
                  <button className="px-4 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-white font-medium text-sm hover:opacity-90 transition">
                    New Case Study
                  </button>
                </div>

                <div className="bg-white rounded-lg border border-kaizen-light overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-kaizen-light border-b border-kaizen-light">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-medium">Title</th>
                        <th className="px-6 py-4 text-left text-sm font-medium">Industry</th>
                        <th className="px-6 py-4 text-left text-sm font-medium">Location</th>
                        <th className="px-6 py-4 text-right text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-kaizen-light hover:bg-kaizen-light/50 transition">
                        <td className="px-6 py-4 text-sm">No case studies yet</td>
                        <td className="px-6 py-4 text-sm">–</td>
                        <td className="px-6 py-4 text-sm">–</td>
                        <td className="px-6 py-4 text-right text-sm">
                          <p className="text-kaizen-text-dark/50">Create your first case study</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white rounded-lg border border-kaizen-light p-8">
            <h3 className="font-heading font-bold mb-4">About the Dashboard</h3>
            <p className="text-kaizen-text-dark/70 mb-6">
              This dashboard is a front-end shell for managing your blog posts and case studies. You can structure and organize content here, with links to edit in Builder.io's visual editor.
            </p>
            <p className="text-kaizen-text-dark/70 text-sm">
              In a future phase, you can connect this to Builder.io's content APIs or add authentication to create a full content management experience.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
