import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, Edit, ArrowLeft, Save, AlertCircle, CheckCircle } from "lucide-react";
import builder from "@/builder";
import { getBuilderEditUrl } from "@/lib/builder-utils";
import AdminLayout from "@/components/AdminLayout";

interface BlogPost {
  id: string;
  data: {
    title?: string;
    slug?: string;
    excerpt?: string;
    publishedDate?: string;
    body?: string;
    tags?: string[];
    coverImage?: any;
  };
}

export default function BlogPostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // Post data
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formPublishedDate, setFormPublishedDate] = useState("");
  const [formTagsString, setFormTagsString] = useState("");

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Track if form has been modified
  const [isModified, setIsModified] = useState(false);

  // Fetch post on mount
  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) {
        setError("No post slug provided");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const results = await builder.getAll("blog-post", {
          query: { "data.slug": slug },
          limit: 1,
        });

        if (!results || results.length === 0) {
          setError("Post not found");
        } else {
          const loadedPost = results[0] as BlogPost;
          console.log("Loaded post:", loadedPost);
          console.log("Post ID:", loadedPost.id);
          setPost(loadedPost);

          // Initialize form with post data
          setFormTitle(loadedPost.data.title || "");
          setFormSlug(loadedPost.data.slug || "");
          setFormExcerpt(loadedPost.data.excerpt || "");
          setFormPublishedDate(loadedPost.data.publishedDate || "");
          setFormTagsString(
            Array.isArray(loadedPost.data.tags)
              ? loadedPost.data.tags.join(", ")
              : ""
          );
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
  }, [slug]);

  // Track form modifications
  const handleFormChange = () => {
    setIsModified(true);
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Save changes
  const handleSave = async () => {
    if (!post?.id) {
      setSaveError("Post ID not available");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      // Convert comma-separated tags to array
      const tagsArray = formTagsString
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const payload = {
        title: formTitle,
        slug: formSlug,
        excerpt: formExcerpt,
        publishedDate: formPublishedDate,
        tags: tagsArray,
      };

      const res = await fetch(`/api/admin/builder/blog-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to save changes");
      }

      setSaveSuccess(true);
      setIsModified(false);

      // Re-fetch the post to sync latest data
      const results = await builder.getAll("blog-post", {
        query: { "data.slug": slug },
        limit: 1,
      });

      if (results && results.length > 0) {
        const updatedPost = results[0] as BlogPost;
        setPost(updatedPost);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save changes"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
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

  // Error state
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
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition font-body"
          >
            <ArrowLeft size={18} />
            Back to Posts
          </button>
        </div>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-heading font-bold mb-2">
              Edit Post
            </h1>
            <p className="text-gray-400 font-body">
              Editing: <span className="font-mono text-blue-400">{formSlug}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://www.kaizenweb.co.uk/blog/${formSlug}`}
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
              title="Edit in Builder (body & cover image)"
            >
              <Edit size={20} />
            </a>
          </div>
        </div>

        {/* Error Message */}
        {saveError && (
          <motion.div
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-start gap-3 font-body"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Error saving changes</p>
              <p className="text-sm">{saveError}</p>
            </div>
          </motion.div>
        )}

        {/* Success Message */}
        {saveSuccess && (
          <motion.div
            className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 flex items-center gap-3 font-body"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <CheckCircle size={20} />
            <p className="font-bold">Changes saved successfully</p>
          </motion.div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="col-span-2 space-y-6">
            {/* Title */}
            <motion.div
              className="bg-gray-900 border border-gray-800 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <label className="block font-heading font-bold mb-2 text-sm text-gray-300">
                Title
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  handleFormChange();
                }}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-body"
                placeholder="Post title"
              />
            </motion.div>

            {/* Slug */}
            <motion.div
              className="bg-gray-900 border border-gray-800 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <label className="block font-heading font-bold mb-2 text-sm text-gray-300">
                Slug
              </label>
              <input
                type="text"
                value={formSlug}
                onChange={(e) => {
                  setFormSlug(e.target.value);
                  handleFormChange();
                }}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-body"
                placeholder="post-slug"
              />
              <p className="text-xs text-gray-500 mt-2 font-body">
                Used in the URL: /blog/your-slug-here
              </p>
            </motion.div>

            {/* Excerpt */}
            <motion.div
              className="bg-gray-900 border border-gray-800 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <label className="block font-heading font-bold mb-2 text-sm text-gray-300">
                Excerpt
              </label>
              <textarea
                value={formExcerpt}
                onChange={(e) => {
                  setFormExcerpt(e.target.value);
                  handleFormChange();
                }}
                rows={3}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-body"
                placeholder="Short summary of the post"
              />
            </motion.div>

            {/* Published Date */}
            <motion.div
              className="bg-gray-900 border border-gray-800 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <label className="block font-heading font-bold mb-2 text-sm text-gray-300">
                Published Date
              </label>
              <input
                type="date"
                value={formPublishedDate.split("T")[0]}
                onChange={(e) => {
                  setFormPublishedDate(e.target.value);
                  handleFormChange();
                }}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-body"
              />
            </motion.div>

            {/* Tags */}
            <motion.div
              className="bg-gray-900 border border-gray-800 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <label className="block font-heading font-bold mb-2 text-sm text-gray-300">
                Tags
              </label>
              <input
                type="text"
                value={formTagsString}
                onChange={(e) => {
                  setFormTagsString(e.target.value);
                  handleFormChange();
                }}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-body"
                placeholder="Separate tags with commas (e.g., design, web, agile)"
              />
              <p className="text-xs text-gray-500 mt-2 font-body">
                Separate tags with commas
              </p>
            </motion.div>

            {/* Body (Read-only) */}
            {post.data.body && (
              <motion.div
                className="bg-gray-900 border border-gray-800 rounded-lg p-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.35 }}
              >
                <h3 className="font-heading font-bold mb-3 text-sm text-gray-400 uppercase tracking-widest">
                  Content (Edit in Builder)
                </h3>
                <div className="prose prose-invert max-w-none max-h-64 overflow-y-auto">
                  <div
                    className="blog-content"
                    dangerouslySetInnerHTML={{ __html: post.data.body }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-4 font-body">
                  To edit the post content and cover image, click "Edit in Builder" above.
                </p>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Save Button */}
            <motion.button
              onClick={handleSave}
              disabled={isSaving || !isModified}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-heading font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Save size={18} />
              {isSaving ? "Saving..." : "Save Changes"}
            </motion.button>

            {/* Info */}
            <motion.div
              className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <p className="text-xs text-gray-300 font-body">
                <span className="font-bold font-heading block mb-2">Editable fields:</span>
                Title, Slug, Excerpt, Published Date, and Tags
              </p>
            </motion.div>

            {/* Post ID */}
            <motion.div
              className="bg-gray-900 border border-gray-800 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <h3 className="font-heading font-bold mb-3 text-sm text-gray-400 uppercase tracking-widest">
                Post ID
              </h3>
              <p className="text-gray-300 font-mono text-xs break-all">
                {post.id}
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AdminLayout>
  );
}
