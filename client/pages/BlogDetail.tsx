import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useSpring } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import builder from "@/builder";
import Layout from "@/components/Layout";
import BlogTableModal from "@/components/BlogTableModal";
import { fetchPostBySlug, fetchPosts } from "../../src/api/wordpress";
import { SeoFromYoast } from "../../src/components/SeoFromYoast";
import { stripHtmlTags } from "@/lib/html-utils";
import { SITE_URL } from "@/lib/seo";

type CoverImage = string | { url?: string } | null;
type TableOfContentsItem = { id: string; title: string; level: number };

interface BlogPostDetail {
  id: string;
  data: {
    title: string;
    slug: string;
    excerpt?: string;
    publishedDate: string;
    body: string;
    coverImage?: CoverImage;
    tags?: string[];
  };
  published?: boolean;
  query?: { published?: boolean };
  lastPublished?: string;
  state?: string;
}

interface ProcessedPost {
  id: string;
  title: string;
  slug: string;
  publishedDate: string;
  body: string;
  coverImage: string;
  excerpt?: string;
  tags: string[];
  category: string;
  author: {
    name: string;
    role: string;
    image: string;
  };
  readingTime: number;
  tableOfContents: TableOfContentsItem[];
  modifiedDate?: string;
}

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  publishedDate: string;
}

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1460925895917-aae19e488e71?w=800&h=600&fit=crop";

function extractImageUrl(image: CoverImage): string {
  if (!image) return DEFAULT_IMAGE;
  if (typeof image === "string") return image;
  if (typeof image === "object" && image.url) return image.url;
  return DEFAULT_IMAGE;
}

function generateDescriptionFromBody(html: string): string {
  if (!html) return "";
  const text = html.replace(/<[^>]*>/g, "").trim();
  if (text.length <= 160) return text;
  const truncated = text.substring(0, 160);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0
    ? truncated.substring(0, lastSpace) + "..."
    : truncated + "...";
}

function calculateReadingTime(html: string): number {
  if (!html) return 0;
  const textContent = html.replace(/<[^>]*>/g, "");
  const wordCount = textContent.trim().split(/\s+/).length;
  return Math.ceil(wordCount / 200);
}

function addIdsToHeadings(html: string): string {
  if (!html) return html;
  const idMap: Record<string, number> = {};

  let result = html;

  const h2Regex = /<h2([^>]*)>(.*?)<\/h2>/gi;
  result = result.replace(h2Regex, (match, attrs, content) => {
    if (attrs.includes('id="')) return match;

    const text = content.replace(/<[^>]*>/g, "").trim();
    let id = text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (idMap[id]) {
      idMap[id]++;
      id = `${id}-${idMap[id]}`;
    } else {
      idMap[id] = 1;
    }

    return `<h2 id="${id}"${attrs}>${content}</h2>`;
  });

  return result;
}

function decodeHtmlEntities(html: string): string {
  if (!html) return "";
  const parser = new DOMParser();
  const decoded =
    parser.parseFromString(html, "text/html").documentElement.textContent || "";
  return decoded;
}

function extractHeadings(html: string): TableOfContentsItem[] {
  const headings: TableOfContentsItem[] = [];

  if (!html) {
    return [{ id: "content", title: "Content", level: 2 }];
  }

  const h2Regex = /<h2[^>]*id="([^"]*)"[^>]*>(.*?)<\/h2>/gi;
  let match;

  while ((match = h2Regex.exec(html)) !== null) {
    const id = match[1];
    const rawText = match[2].replace(/<[^>]*>/g, "").trim();
    const text = decodeHtmlEntities(rawText);
    if (text && id) {
      headings.push({ id, title: text, level: 2 });
    }
  }

  return headings.length > 0
    ? headings
    : [{ id: "content", title: "Content", level: 2 }];
}

interface ImageWithSkeletonProps {
  src: string;
  alt: string;
}

function ImageWithSkeleton({ src, alt }: ImageWithSkeletonProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative w-full bg-gray-200 rounded-lg overflow-hidden">
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]"
            animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }}
            transition={{ duration: 2, repeat: Infinity }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <img
        src={src}
        alt={alt}
        width="1200"
        height="675"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        className={`w-full h-auto relative z-10 ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity`}
        loading="lazy"
        decoding="async"
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-600">
          <span className="text-sm">Image failed to load</span>
        </div>
      )}
    </div>
  );
}

interface TableOfContentsProps {
  items: TableOfContentsItem[];
  activeId: string;
}

function TableOfContents({ items, activeId }: TableOfContentsProps) {
  return (
    <motion.div
      className="bg-gray-100 border border-gray-200 rounded-lg p-6 sticky top-20"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <p className="text-xs font-mono text-gray-600 font-bold tracking-widest mb-4">
        TABLE OF CONTENTS
      </p>
      <nav className="space-y-0">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <motion.a
              key={item.id}
              href={`#${item.id}`}
              className={`block text-sm py-3 px-3 rounded-md transition-all duration-200 relative group border-l-2 ${
                isActive
                  ? "text-cyan-600 border-l-cyan-500 font-semibold bg-cyan-50/50"
                  : "text-gray-700 border-l-transparent hover:text-gray-950 hover:bg-gray-200/50"
              }`}
              whileHover={{ x: 3 }}
              transition={{ duration: 0.2 }}
            >
              <motion.span
                className="block"
                initial={{ opacity: 0.8 }}
                animate={{ opacity: isActive ? 1 : 0.8 }}
                transition={{ duration: 0.2 }}
              >
                {item.title}
              </motion.span>

              {/* Animated indicator dot for active state */}
              {isActive && (
                <motion.div
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-500"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </motion.a>
          );
        })}
      </nav>
    </motion.div>
  );
}

interface AuthorProps {
  name: string;
  role: string;
  image: string;
}

function Author({ name, role, image }: AuthorProps) {
  return (
    <motion.div
      className="bg-gray-100 border border-gray-200 rounded-lg p-6"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
    >
      <p className="text-xs font-mono text-gray-600 font-bold tracking-widest mb-4">
        AUTHOR
      </p>
      <div className="flex items-center gap-4">
        <img
          src={image}
          alt={name}
          width="48"
          height="48"
          className="w-12 h-12 rounded-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div>
          <p className="font-heading font-bold text-gray-950">
            {name}
          </p>
          <p className="text-xs text-gray-600">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}

interface RichTextContentProps {
  html: string;
}

function RichTextContent({ html }: RichTextContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [modalTableHtml, setModalTableHtml] = useState("");

  const openTableModal = (tableHtml: string) => {
    setModalTableHtml(tableHtml);
    setIsTableModalOpen(true);
  };

  const closeTableModal = () => {
    setIsTableModalOpen(false);
    setModalTableHtml("");
  };

  useEffect(() => {
    if (!contentRef.current) return;

    // Add copy link functionality to H2 headings
    const h2s = contentRef.current.querySelectorAll("h2[id]");
    h2s.forEach((h2) => {
      const id = h2.getAttribute("id");
      if (!id) return;

      // Create a wrapper group if not already present
      if (!h2.parentElement?.classList.contains("group")) {
        const wrapper = document.createElement("div");
        wrapper.className = "group relative";
        h2.parentNode?.insertBefore(wrapper, h2);
        wrapper.appendChild(h2);
      }

      // Remove existing copy button if present
      const existingBtn = h2.querySelector(".copy-link-btn");
      if (existingBtn) existingBtn.remove();

      // Add copy button
      const btn = document.createElement("button");
      btn.className =
        "copy-link-btn absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-kaizen-cyan hover:text-kaizen-lime p-1";
      btn.innerHTML = "#";
      btn.title = "Copy link to this section";
      btn.type = "button";
      btn.onclick = (e) => {
        e.preventDefault();
        const url = `${window.location.href.split("#")[0]}#${id}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      };

      h2.parentElement?.insertBefore(btn, h2);
    });

    // Style links with decorative underline
    const links = contentRef.current.querySelectorAll("a:not(.copy-link-btn)");
    links.forEach((link) => {
      link.classList.add(
        "text-kaizen-cyan",
        "hover:text-kaizen-lime",
        "underline",
        "transition-colors",
      );
    });

    // Style blockquotes
    const blockquotes = contentRef.current.querySelectorAll("blockquote");
    blockquotes.forEach((bq) => {
      bq.className =
        "border-l-4 border-primary bg-gray-50 pl-4 py-3 my-6 italic text-gray-800 rounded-md";
    });

    // Handle tables: hide on mobile, show modal button
    const tables = contentRef.current.querySelectorAll("table");
    tables.forEach((table) => {
      const parent = table.parentElement;
      if (!parent) return;
      if (parent.classList.contains("blog-table-wrapper")) return;

      // Capture table HTML BEFORE any DOM mutations
      const tableHtml = table.outerHTML;

      // Create and inject mobile button with the captured HTML
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "block md:hidden w-full bg-slate-100 text-slate-900 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 my-6 hover:bg-slate-200 transition";
      btn.innerHTML = "🔍 View Table";

      // Use captured HTML in closure
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openTableModal(tableHtml);
      });

      parent.insertBefore(btn, table);

      // Hide table on mobile, show on desktop
      table.classList.add("hidden", "md:table");

      // Desktop: wrap table for scrolling
      const wrapper = document.createElement("div");
      wrapper.className =
        "blog-table-wrapper overflow-x-auto my-6 -mx-4 sm:mx-0";
      parent.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }, [openTableModal]);

  return (
    <>
      <motion.div
        ref={contentRef}
        className="max-w-3xl blog-content prose text-gray-950"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <BlogTableModal
        isOpen={isTableModalOpen}
        onClose={closeTableModal}
        htmlContent={modalTableHtml}
      />
    </>
  );
}

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<ProcessedPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("content");
  const [scrollProgress, setScrollProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const scaleX = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) {
        setIsLoading(false);
        return;
      }

      try {
        const wpPost = await fetchPostBySlug(slug);
        if (!wpPost) {
          setPost(null);
          setIsLoading(false);
          return;
        }

        const bodyContent = wpPost.content?.rendered || "";
        // Basic sanitization: remove script tags and inline event handlers
        const sanitizedRaw = bodyContent.replace(
          /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
          "",
        );
        const withoutOnHandlers = sanitizedRaw.replace(/ on\w+="[^"]*"/gi, "");
        const bodyWithIds = addIdsToHeadings(withoutOnHandlers);
        const headings = extractHeadings(bodyWithIds);

        const coverImage =
          wpPost._embedded &&
          wpPost._embedded["wp:featuredmedia"] &&
          wpPost._embedded["wp:featuredmedia"][0]
            ? wpPost._embedded["wp:featuredmedia"][0].source_url
            : DEFAULT_IMAGE;

        const processedPost: ProcessedPost = {
          id: String(wpPost.id),
          title: decodeHtmlEntities(wpPost.title?.rendered || "Untitled"),
          slug: wpPost.slug || slug,
          publishedDate: wpPost.date || new Date().toISOString(),
          modifiedDate:
            wpPost.modified || wpPost.date || new Date().toISOString(),
          body: bodyWithIds,
          coverImage: coverImage,
          excerpt: decodeHtmlEntities(
            stripHtmlTags(wpPost.excerpt?.rendered || ""),
          ),
          tags: [],
          category: "Blog Post",
          author: {
            name: "Kaizen",
            role: "Web Design & Agile",
            image:
              "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fbe9c606a991946d9b3a5d47d9cfbf290?format=webp&width=800",
          },
          readingTime: calculateReadingTime(bodyContent),
          tableOfContents: headings,
          // Attach yoast for SEO usage
          // @ts-ignore
          yoast_head_json: wpPost.yoast_head_json,
        } as any;

        setPost(processedPost);

        // Related posts: fetch a couple of recent posts and exclude current
        try {
          const allWp = await fetchPosts();
          const filtered = (allWp || [])
            .filter((p) => p.slug !== slug)
            .slice(0, 2)
            .map((p) => ({
              id: String(p.id),
              title: p.title?.rendered || "Untitled",
              slug: p.slug || "",
              publishedDate: p.date || new Date().toISOString(),
            }));

          setRelatedPosts(filtered);
        } catch (e) {
          setRelatedPosts([]);
        }
      } catch (error) {
        console.error("Failed to fetch blog post:", error);
        setPost(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  // Update reading progress AND TOC active state based on scroll position
  useEffect(() => {
    let rafId: number | null = null;
    let cachedHeadings: HTMLElement[] = [];

    const refreshHeadings = () => {
      if (!contentRef.current) {
        cachedHeadings = [];
        return;
      }
      cachedHeadings = Array.from(
        contentRef.current.querySelectorAll("h2[id]"),
      ) as HTMLElement[];
    };

    // Headings are injected HTML, so cache after paint
    const cacheTimer = window.setTimeout(refreshHeadings, 0);

    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        // Update progress bar
        const totalHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = window.scrollY;
        const progress = totalHeight > 0 ? scrolled / totalHeight : 0;
        const clampedProgress = Math.min(progress, 1);
        setScrollProgress(Math.round(clampedProgress * 100));
        scaleX.set(clampedProgress);

        // Update TOC active section based on scroll position
        if (cachedHeadings.length === 0) {
          setActiveSection("content");
          return;
        }

        let activeId = cachedHeadings[0]?.id || "content";
        const triggerPoint = 150;

        for (let i = cachedHeadings.length - 1; i >= 0; i--) {
          const heading = cachedHeadings[i];
          const rect = heading.getBoundingClientRect();
          if (rect.top <= triggerPoint) {
            activeId = heading.id;
            break;
          }
        }

        setActiveSection(activeId);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", refreshHeadings, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", refreshHeadings);
      window.clearTimeout(cacheTimer);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [scaleX, post?.id]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen bg-white">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-12 h-12 border-4 border-gray-300 border-t-blue-400 rounded-full"
          />
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="min-h-screen bg-white text-gray-950 flex flex-col items-center justify-center px-4">
          <h1 className="text-4xl font-heading font-bold mb-4">
            Post Not Found
          </h1>
          <p className="text-gray-600 mb-8">
            The blog post you're looking for doesn't exist.
          </p>
          <Link
            to="/blog"
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-heading font-bold rounded-lg hover:opacity-90 transition flex items-center gap-2"
          >
            <ArrowLeft size={18} />
            Back to Blog
          </Link>
        </div>
      </Layout>
    );
  }

  // SEO: derive from Yoast if available, otherwise fallback
  // @ts-ignore
  const yoast = (post as any)?.yoast_head_json;
  const seoTitle = post?.title || "Blog Post";
  const seoDescription =
    yoast?.description ||
    (post?.excerpt
      ? post.excerpt.replace(/<[^>]*>/g, "").trim()
      : post?.body
        ? generateDescriptionFromBody(post.body)
        : "");
  const pageUrl = `${SITE_URL}/blog/${post?.slug || ""}`;
  const coverImageUrl = post?.coverImage || DEFAULT_IMAGE;

  // Derive friendly published date + time label
  const publishedRaw = post?.publishedDate;
  const publishedDate = publishedRaw ? new Date(publishedRaw) : null;
  const publishedLabel = publishedDate
    ? publishedDate.toLocaleString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  const modifiedRaw = post?.modifiedDate || post?.publishedDate;
  const publishedIso = publishedRaw
    ? new Date(publishedRaw).toISOString()
    : undefined;
  const modifiedIso = modifiedRaw
    ? new Date(modifiedRaw).toISOString()
    : undefined;
  const modifiedDate = modifiedRaw ? new Date(modifiedRaw) : null;
  const modifiedLabel = modifiedDate
    ? modifiedDate.toLocaleString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
    headline: seoTitle,
    description: seoDescription,
    image: [coverImageUrl],
    datePublished: publishedIso,
    dateModified: modifiedIso || publishedIso,
    author: {
      "@type": "Person",
      name: post.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: "Kaizen Web",
    },
    url: pageUrl,
  };

  return (
    <Layout>
      {post && (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify(articleSchema)}
          </script>
        </Helmet>
      )}
      <SeoFromYoast yoast={yoast} />

      {/* Progress Bar with Percentage */}
      <motion.div className="fixed top-0 left-0 right-0 h-1 z-50 bg-gray-200">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-400"
          style={{ scaleX, transformOrigin: "left" }}
        />
        <motion.div className="absolute top-2 right-4 text-xs font-mono text-gray-700 bg-gray-100/80 px-2 py-1 rounded">
          {scrollProgress}%
        </motion.div>
      </motion.div>

      {/* Hero Image Section with Parallax */}
      <motion.div
        className="relative h-[400px] md:h-[500px] w-full overflow-hidden bg-gray-900 blog-hero"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.img
          src={post.coverImage}
          alt={post.title}
          className="w-full h-full object-cover object-center opacity-90"
          width={1200}
          height={675}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.2 }}
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />

        <div className="absolute top-4 left-4">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white text-gray-950 rounded-lg transition font-mono text-sm"
          >
            <ArrowLeft size={16} />
            Back to Blog
          </Link>
        </div>
      </motion.div>

      {/* Content Section */}
      <section className="bg-white text-gray-950 py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar - TOC and Author */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <div className="sticky top-24 space-y-6">
                <TableOfContents
                  items={post.tableOfContents}
                  activeId={activeSection}
                />
                <Author
                  name={post.author.name}
                  role={post.author.role}
                  image={post.author.image}
                />
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <motion.article
                className="max-w-3xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {/* Header */}
                <div className="mb-8">
                  <motion.h1
                    className="text-5xl font-heading font-bold mb-4 text-gray-950"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  >
                    {post.title}
                  </motion.h1>

                  <motion.div
                    className="flex flex-col gap-1 text-gray-600 font-mono text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {publishedLabel && (
                        <>
                          <span>Published on {publishedLabel}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{post.readingTime} min read</span>
                    </div>
                    {modifiedLabel && (
                      <div className="italic text-xs md:text-sm text-gray-500">
                        Last updated {modifiedLabel}
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Body Content with proper HTML rendering */}
                <div ref={contentRef}>
                  <RichTextContent html={post.body} />
                </div>

                {/* Tags */}
                {post.tags.length > 0 && (
                  <motion.div
                    className="flex gap-3 flex-wrap mb-12 pt-8 border-t border-gray-200"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                  >
                    {post.tags.map((tag, tagIdx) => (
                      <span
                        key={`post-tag-${post.id}-${tagIdx}`}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-mono font-bold tracking-widest"
                      >
                        {tag}
                      </span>
                    ))}
                  </motion.div>
                )}
              </motion.article>

              {/* CTA Section */}
              <motion.section
                className="bg-gray-100 border border-gray-200 rounded-lg p-8 my-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
              >
                <p className="text-green-600 text-sm mb-4">
                  $ ready_to_sprint();
                </p>
                <h3 className="text-2xl font-heading font-bold text-gray-950 mb-3">
                  Ready to sprint? Let's build your MVP.
                </h3>
                <p className="text-gray-600 text-sm mb-6">
                  Take your idea from concept to launch with Agile delivery and
                  clear thinking.
                </p>
                <Link
                  to="/contact"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-heading font-bold rounded-lg hover:opacity-90 transition flex items-center gap-2"
                >
                  Start Project <ArrowRight size={18} />
                </Link>
              </motion.section>

              {/* More from Blog */}
              {relatedPosts.length > 0 && (
                <motion.section
                  className="py-12"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                  <h2 className="text-3xl font-heading font-bold text-gray-950 mb-8">
                    More from the Blog
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {relatedPosts.map((relatedPost, idx) => (
                      <motion.div
                        key={relatedPost.id || `related-post-fallback-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.9 + idx * 0.1 }}
                      >
                        <Link
                          to={`/blog/${relatedPost.slug}`}
                          className="group p-4 border border-gray-200 rounded-lg hover:border-blue-500/50 hover:bg-gray-100 transition block"
                        >
                          <h4 className="font-heading font-bold text-gray-950 group-hover:text-blue-600 transition mb-2">
                            {relatedPost.title}
                          </h4>
                          <p className="text-gray-600 text-sm font-mono">
                            {relatedPost.publishedDate
                              ? new Date(
                                  relatedPost.publishedDate,
                                ).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </p>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
