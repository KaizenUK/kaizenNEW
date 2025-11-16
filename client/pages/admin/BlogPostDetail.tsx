import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Edit,
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Home,
  List,
  FileText,
  AlertTriangle,
  Link as LinkIcon,
} from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import builder from "@/builder";
import { getBuilderEditUrl } from "@/lib/builder-utils";
import AdminLayout from "@/components/AdminLayout";

// Quill editor configuration
const quillModules = {
  toolbar: [
    [{ header: [false, 2] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote"],
    ["link"],
    ["clean"],
  ],
};

const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "list",
  "blockquote",
  "link",
];

// Helper functions
function deriveStatus(post: any): string {
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
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function calculateReadingTime(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, "");
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / 200);
}

function calculateWordCount(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, "");
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

interface BlogPost {
  id: string;
  data: {
    title?: string;
    slug?: string;
    excerpt?: string;
    publishedDate?: string;
    body?: string | undefined;
    tags?: string[];
    coverImage?: any;
    seoTitle?: string;
    seoDescription?: string;
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
  const [formBody, setFormBody] = useState<string>("");
  const [formSeoTitle, setFormSeoTitle] = useState("");
  const [formSeoDescription, setFormSeoDescription] = useState("");

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

          // Initialise form with post data
          setFormTitle(loadedPost.data.title || "");
          setFormSlug(loadedPost.data.slug || "");
          setFormExcerpt(loadedPost.data.excerpt || "");
          setFormPublishedDate(loadedPost.data.publishedDate || "");
          setFormTagsString(
            Array.isArray(loadedPost.data.tags)
              ? loadedPost.data.tags.join(", ")
              : "",
          );
          setFormBody(loadedPost.data.body || "");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch post");
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
    if (!post || !post.id) {
      setSaveError("Post data not fully loaded. Please refresh and try again.");
      console.error("Post object:", post);
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
        body: formBody,
      };

      // IMPORTANT: call the Node API route that actually exists
      const res = await fetch(
        `/api/admin/builder/blog-posts/${post.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        let errorMessage = "Failed to save changes";
        try {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await res.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            errorMessage = await res.text();
          }
        } catch (e) {
          errorMessage = res.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      setSaveSuccess(true);
      setIsModified(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save changes",
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
            <h1 className="text-4xl font-heading font-bold mb-2">Edit Post</h1>
            <p className="text-gray-400 font-body">
              Editing:{" "}
              <span className="font-mono text-blue-400">{formSlug}</span>
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
              className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
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
                  const newTitle = e.target.value;
                  setFormTitle(newTitle);
                  handleFormChange();
                  // Auto-generate slug if it's empty
                  if (!formSlug && newTitle) {
                    setFormSlug(slugify(newTitle));
                  }
                }}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-transparent font-body"
                placeholder="Post title"
              />
              <div className={`mt-2 text-xs font-body ${formTitle.length > 60 ? "text-yellow-400" : "text-gray-500"}`}>
                {formTitle.length} / 60 characters
                {formTitle.length > 60 && (
                  <p className="mt-1">Long titles may be truncated in search results.</p>
                )}
              </div>
            </motion.div>

            {/* Slug */}
            <motion.div
              className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
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
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-transparent font-body"
                placeholder="post-slug"
              />
              <p className="text-xs text-gray-500 mt-2 font-body font-mono">
                URL: https://www.kaizenweb.co.uk/blog/<span className="text-gray-300">{formSlug || "your-slug-here"}</span>
              </p>
              {formSlug && !/^[a-z0-9-]+$/.test(formSlug) && (
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-600 text-xs font-body">
                  <p className="font-bold mb-1">Slug format warning</p>
                  <p>For best results, use lowercase letters, numbers, and hyphens only (no spaces).</p>
                </div>
              )}
            </motion.div>

            {/* Excerpt */}
            <motion.div
              className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
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
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-transparent font-body"
                placeholder="Short summary of the post"
              />
              <div className={`mt-2 text-xs font-body ${formExcerpt.length >= 80 && formExcerpt.length <= 180 ? "text-green-400" : "text-yellow-400"}`}>
                {formExcerpt.length} characters
                {(formExcerpt.length < 80 || formExcerpt.length > 180) && formExcerpt && (
                  <p className="mt-1">Descriptions around 80–180 characters are often clearer in search snippets.</p>
                )}
              </div>
            </motion.div>

            {/* Published Date */}
            <motion.div
              className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
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
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-transparent font-body"
              />
            </motion.div>

            {/* Tags */}
            <motion.div
              className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
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
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-transparent font-body"
                placeholder="Separate tags with commas (e.g., design, web, agile)"
              />
              <p className="text-xs text-gray-500 mt-2 font-body">
                Separate tags with commas
              </p>
            </motion.div>

            {/* Body Editor */}
            <motion.div
              className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              <label className="block font-heading font-bold mb-3 text-sm text-gray-400 uppercase tracking-widest">
                Content
              </label>
              <div className="rounded-lg overflow-hidden border border-gray-300">
                <ReactQuill
                  theme="snow"
                  value={formBody}
                  onChange={(value) => {
                    setFormBody(value);
                    handleFormChange();
                  }}
                  modules={quillModules}
                  formats={quillFormats}
                  className="quill-editor-light"
                  style={{
                    height: "300px",
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-4 font-body">
                Write your post content here. Use headings, formatting, links, and lists as needed.
              </p>
              {/* Word Count & Reading Time */}
              {formBody && (
                <div className="mt-4 pt-4 border-t border-gray-700 flex gap-4">
                  <div className="text-xs text-gray-400 font-body">
                    <span className="font-bold">Word count:</span> {calculateWordCount(formBody)}
                  </div>
                  <div className="text-xs text-gray-400 font-body">
                    <span className="font-bold">Reading time:</span> {calculateReadingTime(formBody)}–{Math.ceil(calculateReadingTime(formBody) * 1.2)} min
                  </div>
                </div>
              )}
              {calculateWordCount(formBody) < 150 && formBody && (
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-600 text-xs font-body">
                  <p className="font-bold mb-1">Short post warning</p>
                  <p>Very short posts may not provide enough depth for readers.</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Badge */}
            {post && (
              <motion.div
                className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
              >
                <p className="text-xs text-gray-500 mb-2 font-mono">STATUS</p>
                {(() => {
                  const status = deriveStatus(post as any);
                  const statusColor =
                    status === "Published"
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : status === "Draft"
                        ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
                        : "bg-gray-800 text-gray-300 border-gray-700";
                  return (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
                      {status}
                    </span>
                  );
                })()}
              </motion.div>
            )}

            {/* Save Card */}
            <motion.div
              className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl p-6 backdrop-blur-sm shadow-lg shadow-blue-500/10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <motion.button
                onClick={handleSave}
                disabled={isSaving || !isModified}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-heading font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Save size={18} />
                {isSaving ? "Saving..." : "Save Changes"}
              </motion.button>
              <p className="text-xs text-gray-400 mt-3 font-body">
                {isModified ? "You have unsaved changes. Remember to publish in Builder if required." : "All changes saved"}
              </p>
            </motion.div>

            {/* SEO & Content Checklist */}
            {(() => {
              const tagsArray = formTagsString
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0);

              const wordCount = calculateWordCount(formBody);
              const slugValid = /^[a-z0-9-]+$/.test(formSlug) && formSlug.length > 0;
              const excerptOK = formExcerpt.length >= 80 && formExcerpt.length <= 180;
              const contentOK = wordCount >= 300;
              const tagsOK = tagsArray.length > 0;
              const titleOK = formTitle.trim().length > 0;

              return (
                <motion.div
                  className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                >
                  <h3 className="font-heading font-bold mb-4 text-sm text-gray-300">
                    SEO & Content Checklist
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {titleOK ? (
                        <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
                      )}
                      <span className="text-xs text-gray-300 font-body">Title set</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {slugValid ? (
                        <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
                      )}
                      <span className="text-xs text-gray-300 font-body">Slug looks clean</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {excerptOK ? (
                        <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
                      )}
                      <span className="text-xs text-gray-300 font-body">Excerpt length OK</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {contentOK ? (
                        <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
                      )}
                      <span className="text-xs text-gray-300 font-body">Enough content ({wordCount} words)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {tagsOK ? (
                        <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
                      )}
                      <span className="text-xs text-gray-300 font-body">Tags added</span>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* Quick Links */}
            <motion.div
              className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <h3 className="font-heading font-bold mb-4 text-sm text-gray-300">
                Quick links
              </h3>
              <div className="space-y-2">
                <a
                  href="https://www.kaizenweb.co.uk/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition text-gray-300 hover:text-blue-400 text-xs font-body"
                >
                  <Home size={14} />
                  Go to Kaizen homepage
                </a>
                <a
                  href="https://www.kaizenweb.co.uk/blog"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition text-gray-300 hover:text-blue-400 text-xs font-body"
                >
                  <List size={14} />
                  View blog index
                </a>
                {formSlug && (
                  <a
                    href={`https://www.kaizenweb.co.uk/blog/${formSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition text-gray-300 hover:text-blue-400 text-xs font-body"
                  >
                    <ExternalLink size={14} />
                    View this post on site
                  </a>
                )}
                {post && (
                  <a
                    href={getBuilderEditUrl(post.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition text-gray-300 hover:text-blue-400 text-xs font-body"
                  >
                    <Edit size={14} />
                    Edit in Builder
                  </a>
                )}
              </div>
            </motion.div>

            {/* Post Insights */}
            {(() => {
              const tagsArray = formTagsString
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0);
              const wordCount = calculateWordCount(formBody);
              const readingTime = calculateReadingTime(formBody);
              const status = deriveStatus(post as any);

              return (
                <motion.div
                  className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 }}
                >
                  <h3 className="font-heading font-bold mb-4 text-sm text-gray-300">
                    Post insights
                  </h3>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-body">
                      <span className="text-gray-300 font-bold">Word count:</span> {wordCount}
                    </p>
                    <p className="text-xs text-gray-400 font-body">
                      <span className="text-gray-300 font-bold">Reading time:</span> {readingTime}–{Math.ceil(readingTime * 1.2)} min
                    </p>
                    <p className="text-xs text-gray-400 font-body">
                      <span className="text-gray-300 font-bold">Tags:</span> {tagsArray.length}
                    </p>
                    <p className="text-xs text-gray-400 font-body">
                      <span className="text-gray-300 font-bold">Status:</span> {status}
                    </p>
                  </div>
                </motion.div>
              );
            })()}

            {/* Post ID */}
            <motion.div
              className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 backdrop-blur-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <h3 className="font-heading font-bold mb-3 text-sm text-gray-400 uppercase tracking-widest">
                Post ID
              </h3>
              <p className="text-gray-300 font-mono text-xs break-all">
                {post?.id}
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AdminLayout>
  );
}
