import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Home,
  List,
  FileText,
  ExternalLink,
  Edit,
  AlertTriangle,
} from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import AdminLayout from "@/components/AdminLayout";

// Quill editor configuration (same as BlogPostDetail)
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

// Helper function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

// Helper function to get today's date in YYYY-MM-DD format
function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function BlogPostCreate() {
  const navigate = useNavigate();

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formPublishedDate, setFormPublishedDate] = useState(getTodayDateString());
  const [formTagsString, setFormTagsString] = useState("");
  const [formBody, setFormBody] = useState<string>("");

  // Auto-slug generation tracking
  const [hasUserEditedSlug, setHasUserEditedSlug] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handle title change and auto-generate slug if user hasn't manually edited it
  const handleTitleChange = (value: string) => {
    setFormTitle(value);
    if (!hasUserEditedSlug && value) {
      setFormSlug(generateSlug(value));
    }
  };

  // Handle slug change and mark that user has manually edited it
  const handleSlugChange = (value: string) => {
    setFormSlug(value);
    setHasUserEditedSlug(true);
  };

  // Save new post
  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);

    // Basic validation
    if (!formTitle.trim() && !formSlug.trim()) {
      setSaveError("Please provide at least a title or slug.");
      return;
    }

    try {
      setIsSaving(true);

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

      const res = await fetch("/api/admin/builder/blog-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = "Failed to create post";
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

      // Navigate to the new post's edit page after a short delay
      setTimeout(() => {
        if (formSlug) {
          navigate(`/admin/blog-posts/${formSlug}`);
        } else {
          navigate("/admin/blog-posts");
        }
      }, 1000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to create post"
      );
    } finally {
      setIsSaving(false);
    }
  };

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
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-bold mb-2">Create New Post</h1>
          <p className="text-gray-400 font-body">Add a new blog post to your site</p>
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
              <p className="font-bold">Error creating post</p>
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
            <p className="font-bold">Post created successfully</p>
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
                onChange={(e) => handleTitleChange(e.target.value)}
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
                onChange={(e) => handleSlugChange(e.target.value)}
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
                onChange={(e) => setFormExcerpt(e.target.value)}
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
                value={formPublishedDate}
                onChange={(e) => setFormPublishedDate(e.target.value)}
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
                onChange={(e) => setFormTagsString(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-body"
                placeholder="Separate tags with commas (e.g., design, web, agile)"
              />
              <p className="text-xs text-gray-500 mt-2 font-body">
                Separate tags with commas
              </p>
            </motion.div>

            {/* Body Editor */}
            <motion.div
              className="bg-gray-900 border border-gray-800 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              <label className="block font-heading font-bold mb-3 text-sm text-gray-400 uppercase tracking-widest">
                Content
              </label>
              <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <ReactQuill
                  theme="snow"
                  value={formBody}
                  onChange={setFormBody}
                  modules={quillModules}
                  formats={quillFormats}
                  className="bg-gray-800 text-white"
                  style={{
                    height: "300px",
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-4 font-body">
                Write your post content here. Use headings, formatting, links, and lists as needed.
              </p>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Create Button */}
            <motion.button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-heading font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Save size={18} />
              {isSaving ? "Creating..." : "Create Post"}
            </motion.button>

            {/* Info */}
            <motion.div
              className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <p className="text-xs text-gray-300 font-body">
                <span className="font-bold font-heading block mb-2">Create Mode</span>
                This will create a new blog post entry in your Builder Publish space. After creation, you'll be able to edit it further.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AdminLayout>
  );
}
