import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ExternalLink, Edit, Plus, FileText, Info } from "lucide-react";
import builder from "@/builder";
import { getBuilderEditUrl } from "@/lib/builder-utils";
import AdminLayout from "@/components/AdminLayout";

interface BlogPost {
  id: string;
  data: {
    title: string;
    slug: string;
    excerpt: string;
    publishedDate: string;
    tags: string[];
  };
  [key: string]: any; // Allow accessing other fields
}

interface ProcessedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedDate: string;
  tags: string[];
  status: string; // "Published", "Draft", or "Unknown"
}

export default function BlogPostsList() {
  const [posts, setPosts] = useState<ProcessedPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<ProcessedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  // Helper function to derive status from Builder post object
  const deriveStatus = (post: any): string => {
    // Check for common status indicators in Builder
    // Order of precedence: published, query.published, lastPublished, state
    if (post.published === true) return "Published";
    if (post.published === false) return "Draft";
    if (post.query?.published === true) return "Published";
    if (post.query?.published === false) return "Draft";
    if (post.lastPublished) return "Published";
    if (post.state === "published") return "Published";
    if (post.state === "draft") return "Draft";
    // Fallback: if publishedDate is in the future, consider it draft
    if (post.data?.publishedDate) {
      const pubDate = new Date(post.data.publishedDate);
      if (pubDate > new Date()) return "Draft";
      return "Published";
    }
    return "Unknown";
  };

  // Fetch posts from Builder
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Important: don't restrict fields so we keep the top-level `id`
        const results = await builder.getAll("blog-post", {
          // Removing `fields` so `id` is included in the response
          limit: 100,
        });

        // Log sample for development debugging
        if (results && results.length > 0) {
          console.log("[BlogPostsList] Sample Builder blog-post:", results[0]);
        }

        const processed: ProcessedPost[] = (results as BlogPost[])
          .map((post) => ({
            id: (post as any).id || "", // guard in case id is missing
            title: post.data?.title || "Untitled",
            slug: post.data?.slug || "",
            excerpt: post.data?.excerpt || "",
            publishedDate:
              post.data?.publishedDate || new Date().toISOString(),
            tags: Array.isArray(post.data?.tags) ? post.data.tags : [],
            status: deriveStatus(post as any),
          }))
          .sort(
            (a, b) =>
              new Date(b.publishedDate).getTime() -
              new Date(a.publishedDate).getTime(),
          );

        setPosts(processed);

        // Extract unique tags
        const tags = new Set<string>();
        processed.forEach((post) => {
          post.tags.forEach((tag) => {
            if (tag) tags.add(tag);
          });
        });
        setAllTags(Array.from(tags).sort());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch posts");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // Filter posts
  useEffect(() => {
    let results = posts;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.slug.toLowerCase().includes(query),
      );
    }

    // Tag filter
    if (selectedTags.length > 0) {
      results = results.filter((post) =>
        selectedTags.some((tag) => post.tags.includes(tag)),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      results = results.filter(
        (post) =>
          post.status.toLowerCase() === statusFilter.toLowerCase(),
      );
    }

    setFilteredPosts(results);
  }, [posts, searchQuery, selectedTags, statusFilter]);

  return (
    <AdminLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-heading font-bold mb-2">Blog Posts</h1>
            <p className="text-gray-400 font-body">
              {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}
              {searchQuery || selectedTags.length > 0 ? " found" : ""}
            </p>
          </div>
          <Link
            to="/admin/blog-posts/new"
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-heading font-bold rounded-lg hover:opacity-90 transition flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={20} />
            New Post
          </Link>
        </div>

        {/* Search Bar */}
        <motion.div
          className="mb-6 relative"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Search className="absolute left-3 top-3 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search by title or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-body"
          />
        </motion.div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <p className="text-sm font-mono text-gray-500 mb-3 font-body">
              Filter by tags
            </p>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setSelectedTags((prev) =>
                      prev.includes(tag)
                        ? prev.filter((t) => t !== tag)
                        : [...prev, tag],
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest transition ${
                    selectedTags.includes(tag)
                      ? "bg-blue-500 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-8 h-8 border-4 border-gray-800 border-t-blue-400 rounded-full"
            />
          </div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Error: {error}
          </motion.div>
        )}

        {/* Posts Table */}
        {!isLoading && !error && (
          <motion.div
            className="overflow-x-auto rounded-lg border border-gray-800"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-800">
                <tr key="header">
                  <th className="text-left p-4 font-heading font-bold text-gray-300">
                    Title
                  </th>
                  <th className="text-left p-4 font-heading font-bold text-gray-300">
                    Slug
                  </th>
                  <th className="text-left p-4 font-heading font-bold text-gray-300">
                    Published
                  </th>
                  <th className="text-left p-4 font-heading font-bold text-gray-300">
                    Tags
                  </th>
                  <th className="text-left p-4 font-heading font-bold text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post, idx) => (
                  <motion.tr
                    key={post.id || post.slug || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="border-b border-gray-800 hover:bg-gray-800/30 transition"
                  >
                    <td className="p-4">
                      <Link
                        to={`/admin/blog-posts/${post.slug}`}
                        className="font-medium text-blue-400 hover:text-blue-300 transition"
                      >
                        {post.title}
                      </Link>
                    </td>
                    <td className="p-4 text-sm text-gray-400 font-mono">
                      {post.slug}
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {new Date(post.publishedDate).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 flex-wrap">
                        {post.tags.slice(0, 2).map((tag, tagIdx) => (
                          <span
                            key={`${tag}-${tagIdx}`}
                            className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-xs font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                        {post.tags.length > 2 && (
                          <span className="px-2 py-0.5 text-gray-500 text-xs">
                            +{post.tags.length - 2} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-3">
                        <a
                          href={`https://www.kaizenweb.co.uk/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-400 transition"
                          title="View live post"
                        >
                          <ExternalLink size={16} />
                        </a>
                        {post.id && (
                          <a
                            href={getBuilderEditUrl(post.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-400 transition"
                            title="Edit in Builder"
                          >
                            <Edit size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {filteredPosts.length === 0 && (
              <div className="p-12 text-center text-gray-400 font-body">
                <p>No posts found</p>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </AdminLayout>
  );
}
