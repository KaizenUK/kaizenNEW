import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, Edit, ArrowLeft } from "lucide-react";
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
    body: string;
    tags: string[];
  };
}

export default function BlogPostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) {
        setError("No post ID provided");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const result = await builder.get("blog-post", {
          query: { _id: id },
        }).toPromise();

        if (!result) {
          setError("Post not found");
        } else {
          setPost(result as BlogPost);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch post"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-8 h-8 border-4 border-gray-800 border-t-blue-400 rounded-full"
          />
        </div>
      </AdminLayout>
    );
  }

  if (error || !post) {
    return (
      <AdminLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-6">
            <button
              onClick={() => navigate("/admin/blog-posts")}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition"
            >
              <ArrowLeft size={18} />
              Back to Posts
            </button>
          </div>

          <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error || "Post not found"}
          </div>
        </motion.div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/admin/blog-posts")}
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition"
          >
            <ArrowLeft size={18} />
            Back to Posts
          </button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-heading font-bold mb-2">
                {post.data.title}
              </h1>
              <p className="text-gray-400 font-mono text-sm">{post.data.slug}</p>
            </div>
            <div className="flex gap-2">
              <a
                href={`https://www.kaizenweb.co.uk/blog/${post.data.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-gray-300 hover:text-blue-400"
                title="View live post"
              >
                <ExternalLink size={20} />
              </a>
              <a
                href={getBuilderEditUrl(post.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition text-blue-400"
                title="Edit in Builder"
              >
                <Edit size={20} />
              </a>
            </div>
          </div>

          <p className="text-gray-400 text-sm">
            Published {new Date(post.data.publishedDate).toLocaleDateString()}
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Main Content */}
          <div className="col-span-2 space-y-6">
            {/* Excerpt */}
            {post.data.excerpt && (
              <motion.div
                className="bg-gray-900 border border-gray-800 rounded-lg p-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <h3 className="font-heading font-bold mb-3 text-sm text-gray-400 uppercase tracking-widest">
                  Excerpt
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {post.data.excerpt}
                </p>
              </motion.div>
            )}

            {/* Body Preview */}
            {post.data.body && (
              <motion.div
                className="bg-gray-900 border border-gray-800 rounded-lg p-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <h3 className="font-heading font-bold mb-3 text-sm text-gray-400 uppercase tracking-widest">
                  Content Preview
                </h3>
                <div className="prose prose-invert max-w-none max-h-96 overflow-y-auto">
                  <div
                    className="blog-content"
                    dangerouslySetInnerHTML={{ __html: post.data.body }}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Tags */}
            {post.data.tags && post.data.tags.length > 0 && (
              <motion.div
                className="bg-gray-900 border border-gray-800 rounded-lg p-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
              >
                <h3 className="font-heading font-bold mb-3 text-sm text-gray-400 uppercase tracking-widest">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {post.data.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-xs font-mono font-bold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Post ID */}
            <motion.div
              className="bg-gray-900 border border-gray-800 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <h3 className="font-heading font-bold mb-3 text-sm text-gray-400 uppercase tracking-widest">
                Post ID
              </h3>
              <p className="text-gray-300 font-mono text-xs break-all">
                {post.id}
              </p>
            </motion.div>

            {/* Info */}
            <motion.div
              className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <p className="text-xs text-gray-300">
                This is a read-only view. To edit this post, click the "Edit in Builder" button above.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AdminLayout>
  );
}
