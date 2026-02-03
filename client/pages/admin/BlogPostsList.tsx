import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  ExternalLink,
  Edit,
  Plus,
  FileText,
  Info,
  ImageOff,
  AlertTriangle,
} from "lucide-react";
import builder from "@/builder";
import { getBuilderEditUrl } from "@/lib/builder-utils";
import AdminLayout from "@/components/AdminLayout";

type BuilderCoverImage =
  | string
  | {
      image?: string;
      src?: string;
      url?: string;
    }
  | null;

interface BlogPost {
  id: string;
  data: {
    title?: string;
    slug?: string;
    excerpt?: string;
    publishedDate?: string;
    tags?: string[];
    coverImage?: BuilderCoverImage;
  };
  published?: boolean;
  query?: { published?: boolean };
  lastPublished?: string;
  state?: string;
  [key: string]: unknown; // Allow accessing other Builder fields (state, published, etc.)
}

interface ProcessedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedDate: string;
  tags: string[];
  status: string; // "Published", "Draft", or "Unknown"
  coverImageUrl: string | null;
}

// Helper to derive status from Builder object
const deriveStatus = (post: BlogPost): string => {
  if (post.published === true) return "Published";
  if (post.published === false) return "Draft";
  if (post.query?.published === true) return "Published";
  if (post.query?.published === false) return "Draft";
  if (post.lastPublished) return "Published";
  if (post.state === "published") return "Published";
  if (post.state === "draft") return "Draft";

  if (post.data?.publishedDate) {
    const pubDate = new Date(post.data.publishedDate);
    if (pubDate > new Date()) return "Draft";
    return "Published";
  }
  return "Unknown";
};

export default function BlogPostsList() {
  const [posts, setPosts] = useState<ProcessedPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<ProcessedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft"
  >("all");

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Fetch posts from Builder
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Keep full objects so we retain id and status-ish fields
        const results = (await builder.getAll("blog-post", {
          limit: 100,
        })) as unknown as BlogPost[];

        const processed: ProcessedPost[] = results
          .map((post) => {
            const rawCover = post.data?.coverImage;
            let coverImageUrl: string | null = null;

            if (typeof rawCover === "string") {
              coverImageUrl = rawCover;
            } else if (rawCover && typeof rawCover === "object") {
              // Common Builder shapes: { image: "…" } or { src: "…" }
              coverImageUrl =
                rawCover.image || rawCover.src || rawCover.url || null;
            }

            return {
              id: post.id || "",
              title: post.data?.title || "Untitled",
              slug: post.data?.slug || "",
              excerpt: post.data?.excerpt || "",
              publishedDate:
                post.data?.publishedDate || new Date().toISOString(),
              tags: Array.isArray(post.data?.tags) ? post.data.tags : [],
              status: deriveStatus(post),
              coverImageUrl,
            };
          })
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

  // Apply search / tag / status filters
  useEffect(() => {
    let results = posts;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.slug.toLowerCase().includes(query),
      );
    }

    if (selectedTags.length > 0) {
      results = results.filter((post) =>
        selectedTags.some((tag) => post.tags.includes(tag)),
      );
    }

    if (statusFilter !== "all") {
      results = results.filter(
        (post) => post.status.toLowerCase() === statusFilter.toLowerCase(),
      );
    }

    setFilteredPosts(results);
    setCurrentPage(1); // reset when filters change
  }, [posts, searchQuery, selectedTags, statusFilter]);

  // Pagination calculations
  const totalItems = filteredPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

  const handleChangePageSize = (value: number) => {
    setPageSize(value);
    setCurrentPage(1);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <AdminLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-heading font-bold mb-2 bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
              Blog Posts
            </h1>
            <p className="text-gray-400 font-body">
              {filteredPosts.length} post
              {filteredPosts.length !== 1 ? "s" : ""}
              {searchQuery || selectedTags.length > 0 || statusFilter !== "all"
                ? " found"
                : ""}
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

        {/* Heads Up Info Box */}
        <motion.div
          className="mb-6 bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3 flex gap-3 items-start"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <Info size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm font-body text-gray-300">
            <p className="font-bold text-blue-300 mb-1">Heads up</p>
            <p className="text-gray-400">
              New or updated posts may take a short time to sync between the
              live site and this admin view.
            </p>
          </div>
        </motion.div>

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
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent font-body"
          />
        </motion.div>

        {/* Status Filter */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
        >
          <p className="text-sm font-mono text-gray-500 mb-3 font-body">
            Filter by status
          </p>
          <div className="flex flex-wrap gap-2">
            {(["all", "published", "draft"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-body transition ${
                  statusFilter === status
                    ? "bg-blue-500 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
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

        {/* Posts Table + Pagination */}
        {!isLoading && !error && (
          <>
            <motion.div
              className="overflow-x-auto rounded-2xl border border-gray-800/80 bg-gray-950/80 shadow-xl shadow-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {filteredPosts.length === 0 ? (
                <div className="p-16 text-center text-gray-400 font-body">
                  <FileText size={48} className="mx-auto mb-4 text-gray-600" />
                  <p className="text-lg font-medium mb-2">
                    No posts match your filters
                  </p>
                  <p className="text-sm text-gray-500">
                    Try clearing your search, tags, or status filters to see all
                    posts.
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-900/50 border-b border-gray-800">
                    <tr key="header">
                      <th className="text-left p-4 font-heading font-bold text-gray-300">
                        Title
                      </th>
                      <th className="text-left p-4 font-heading font-bold text-gray-300">
                        Cover
                      </th>
                      <th className="text-left p-4 font-heading font-bold text-gray-300">
                        Slug
                      </th>
                      <th className="text-left p-4 font-heading font-bold text-gray-300">
                        Published
                      </th>
                      <th className="text-left p-4 font-heading font-bold text-gray-300">
                        Status
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
                    {paginatedPosts.map((post, idx) => {
                      const hasCover = !!post.coverImageUrl;

                      return (
                        <motion.tr
                          key={post.id || post.slug || idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.05 }}
                          className="border-b border-gray-800 hover:bg-gray-800/40 transition"
                        >
                          {/* Title */}
                          <td className="p-4">
                            <Link
                              to={`/admin/blog-posts/${post.slug}`}
                              className="font-medium text-blue-400 hover:text-blue-300 transition"
                            >
                              {post.title}
                            </Link>
                          </td>

                          {/* Cover */}
                          <td className="p-4">
                            {hasCover ? (
                              <div className="flex items-center gap-2">
                                <div className="h-10 w-16 rounded-md overflow-hidden border border-gray-700 bg-gray-900 flex items-center justify-center">
                                  <img
                                    src={post.coverImageUrl || ""}
                                    alt=""
                                    width="64"
                                    height="40"
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </div>
                                <span className="text-xs text-gray-400 font-body">
                                  Set
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="inline-flex items-center gap-1 text-xs text-amber-300 font-body">
                                  <AlertTriangle size={14} />
                                  <span>No cover image</span>
                                </div>
                                {post.id && (
                                  <a
                                    href={getBuilderEditUrl(post.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-body"
                                  >
                                    <ImageOff size={12} />
                                    <span>Fix in Builder</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Slug */}
                          <td className="p-4 text-sm text-gray-400 font-mono">
                            {post.slug}
                          </td>

                          {/* Published date */}
                          <td className="p-4 text-sm text-gray-400">
                            {post.publishedDate
                              ? new Date(post.publishedDate).toLocaleDateString(
                                  "en-GB",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "—"}
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                                post.status === "Published"
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                  : post.status === "Draft"
                                    ? "bg-yellow-500/10 text-yellow-300 border border-yellow-500/30"
                                    : "bg-gray-800 text-gray-300 border border-gray-700"
                              }`}
                            >
                              {post.status}
                            </span>
                          </td>

                          {/* Tags */}
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

                          {/* Actions */}
                          <td className="p-4">
                            <div className="flex gap-3">
                              <a
                                href={`https://kaizenweb.co.uk/blog/${post.slug}`}
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
                      );
                    })}
                  </tbody>
                </table>
              )}
            </motion.div>

            {/* Pagination controls */}
            {filteredPosts.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm font-body text-gray-400">
                <div className="flex items-center gap-3">
                  <span>
                    Showing{" "}
                    <span className="text-gray-200">
                      {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
                    </span>{" "}
                    of <span className="text-gray-200">{totalItems}</span> posts
                  </span>
                  <span className="hidden md:inline">•</span>
                  <div className="flex items-center gap-2">
                    <span>Rows per page</span>
                    <select
                      value={pageSize}
                      onChange={(e) =>
                        handleChangePageSize(Number(e.target.value))
                      }
                      className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-end">
                  <span>
                    Page{" "}
                    <span className="text-gray-200">{safeCurrentPage}</span> of{" "}
                    <span className="text-gray-200">{totalPages}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={safeCurrentPage <= 1}
                      className="px-3 py-1 rounded border border-gray-700 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={safeCurrentPage >= totalPages}
                      className="px-3 py-1 rounded border border-gray-700 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </AdminLayout>
  );
}
